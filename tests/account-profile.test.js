import test from 'node:test';
import assert from 'node:assert/strict';
import { accountApi } from '../backend/cloud-api.js';
import { validateProfile } from '../backend/profile-store.js';

const origin = 'https://mindora.test';
const url = `${origin}/api/account`;
const profile = { name: 'Alex Learner', age: 29, gender: 'prefer_not_to_say', interests: ['Design', 'Coding'] };
const account = { id: 'learner-a', name: 'Alex', email: 'alex@example.com' };
const credentials = { email: account.email, password: 'test-password-123' };
const request = (method = 'GET', input, headers = {}) => new Request(url, {
  method, headers: { origin, 'content-type': 'application/json', ...headers },
  ...(input === undefined ? {} : { body: JSON.stringify(input) }),
});

function harness() {
  const rows = new Map();
  const authCalls = [];
  const sessionCalls = [];
  let user = account;
  let failWrites = false;
  let authResponse = () => Response.json({ user: account }, {
    headers: { 'set-cookie': 'session=new-session; Path=/; HttpOnly; Secure; SameSite=Lax' },
  });
  const dependencies = {
    settings: { databaseUrl: 'test-db' },
    session: async req => {
      sessionCalls.push(req);
      return { user, cookies: ['session-cache=fresh; Path=/; HttpOnly; Secure'] };
    },
    auth: async (_request, _settings, path, body) => {
      authCalls.push({ path, body });
      return authResponse();
    },
    store: () => ({
      read: async id => rows.get(id) || null,
      write: async (id, value) => {
        if (failWrites) throw new Error('Simulated database outage');
        rows.set(id, structuredClone(value));
        return structuredClone(value);
      },
    }),
  };
  return {
    rows, authCalls, sessionCalls,
    user: value => { user = value; },
    failWrites: value => { failWrites = value; },
    authResponse: value => { authResponse = value; },
    call: req => accountApi(req, dependencies),
  };
}

test('profiles enforce bounded fields and remove unknown identity/credential data', () => {
  assert.deepEqual(validateProfile({ ...profile, name: '  Alex Learner  ', interests: [' Design ', 'design', 'CODING'], userId: 'other', password: 'secret' }), {
    ...profile, interests: ['Design', 'CODING'],
  });
  assert.deepEqual(validateProfile({ name: 'Sam' }), { name: 'Sam', age: null, gender: '', interests: [] });
  for (const invalid of [
    null, [], { ...profile, name: '' }, { ...profile, name: 'x'.repeat(81) },
    { ...profile, name: 'Alex\u0000' }, { ...profile, age: 0 }, { ...profile, age: 121 },
    { ...profile, age: 3.5 }, { ...profile, age: '29' }, { ...profile, gender: 'unknown' },
    { ...profile, interests: 'Design' }, { ...profile, interests: Array(9).fill('Design') },
    { ...profile, interests: [''] }, { ...profile, interests: [42] }, { ...profile, interests: ['x'.repeat(41)] },
  ]) assert.equal(validateProfile(invalid), null);
});

test('profile writes use only the verified owner and survive account GET without leaking between accounts', async () => {
  const h = harness();
  const saved = await h.call(request('PUT', { ...profile, userId: 'learner-b', password: 'secret' }));
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ok: true, user: { ...account, name: profile.name }, profile });
  assert.deepEqual([...h.rows.keys()], ['learner-a']);
  const restored = await h.call(request());
  assert.deepEqual(await restored.json(), { available: true, user: { ...account, name: profile.name }, profile });
  assert.equal(restored.headers.get('cache-control'), 'no-store');
  assert.match(restored.headers.get('set-cookie'), /session-cache=fresh/);
  h.user({ id: 'learner-b', name: 'Other', email: 'other@example.com' });
  assert.equal((await (await h.call(request())).json()).profile, null);
  h.user(null);
  assert.deepEqual(await (await h.call(request())).json(), { available: true, user: null, profile: null });
  assert.equal((await h.call(request('PUT', profile))).status, 401);
});

test('account mutations reject foreign origins, invalid profiles and oversized payloads before writes', async () => {
  const h = harness();
  for (const method of ['PUT', 'POST']) {
    assert.equal((await h.call(request(method, { ...credentials, ...profile, action: 'signup' }, { origin: 'https://other.test' }))).status, 403);
  }
  assert.equal(h.sessionCalls.length, 0);
  assert.equal((await h.call(request('PUT', { ...profile, age: -1 }))).status, 400);
  assert.equal((await h.call(request('POST', { ...credentials, ...profile, action: 'signup', interests: ['x'.repeat(41)] }))).status, 400);
  assert.equal((await h.call(request('PUT', { ...profile, extra: 'x'.repeat(17_000) }))).status, 400);
  assert.equal(h.authCalls.length, 0);
  assert.equal(h.rows.size, 0);
});

test('signup confirms the new response cookies then persists the profile for that session only', async () => {
  const h = harness();
  const response = await h.call(request('POST', { ...credentials, ...profile, action: 'signup' }, { cookie: 'unrelated=keep; session=old-session' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, user: { ...account, name: profile.name }, profile });
  assert.deepEqual(h.authCalls, [{ path: 'sign-up/email', body: { ...credentials, name: profile.name } }]);
  assert.equal(h.sessionCalls[0].headers.get('cookie'), 'unrelated=keep; session=new-session');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(h.rows.get(account.id), profile);
});

test('legacy email/password signup remains compatible without optional onboarding fields', async () => {
  const h = harness();
  const response = await h.call(request('POST', { ...credentials, action: 'signup' }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).profile, { name: 'alex', age: null, gender: '', interests: [] });
});

test('verification-required signup never writes a profile or claims the old session as the new account', async () => {
  for (const user of [null, { id: 'old-learner', email: 'old@example.com', name: 'Old' }]) {
    const h = harness();
    h.user(user);
    h.authResponse(() => Response.json({ token: null, user: { ...account, emailVerified: false } }));
    const response = await h.call(request('POST', { ...credentials, ...profile, action: 'signup' }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, user: null, profile: null, verificationRequired: true });
    assert.equal(h.rows.size, 0);
  }
});

test('a successful auth response cannot stand in for a confirmed matching session', async () => {
  const h = harness();
  h.user(null);
  const missing = await h.call(request('POST', { ...credentials, action: 'signin' }));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, 'SESSION_UNCONFIRMED');
  h.user({ ...account, id: 'different-session-owner' });
  const mismatched = await h.call(request('POST', { ...credentials, ...profile, action: 'signup' }));
  assert.equal(mismatched.status, 503);
  assert.equal((await mismatched.json()).code, 'SESSION_UNCONFIRMED');
  assert.equal(h.rows.size, 0);
});

test('signup profile failure preserves the authenticated cookie and allows a later authenticated retry', async () => {
  const h = harness();
  h.failWrites(true);
  const response = await h.call(request('POST', { ...credentials, ...profile, action: 'signup' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, user: account, profile: null, profilePending: true });
  assert.match(response.headers.get('set-cookie'), /session=new-session/);
  assert.equal(h.rows.size, 0);
  h.failWrites(false);
  assert.equal((await h.call(request('PUT', profile))).status, 200);
  assert.deepEqual((await (await h.call(request())).json()).profile, profile);
});

test('signin confirms session and restores profile; failures stay generic and signout clears public identity', async () => {
  const h = harness();
  h.rows.set(account.id, profile);
  const signedIn = await h.call(request('POST', { ...credentials, action: 'signin' }));
  assert.deepEqual(await signedIn.json(), { ok: true, user: { ...account, name: profile.name }, profile });
  h.authResponse(() => Response.json({ code: 'USER_NOT_FOUND', message: 'Sensitive upstream account detail' }, { status: 401 }));
  const rejected = await h.call(request('POST', { ...credentials, action: 'signin' }));
  assert.equal(rejected.status, 401);
  assert.doesNotMatch(await rejected.text(), /USER_NOT_FOUND|Sensitive upstream/);
  h.authResponse(() => Response.json({ ok: true }, { headers: { 'set-cookie': 'session=; Max-Age=0; Path=/' } }));
  const signedOut = await h.call(request('POST', { action: 'signout' }));
  assert.deepEqual(await signedOut.json(), { ok: true, user: null, profile: null });
  assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/);
});

test('failed profile updates keep session cookies and never claim the new values were saved', async () => {
  const h = harness();
  h.rows.set(account.id, profile);
  h.failWrites(true);
  const response = await h.call(request('PUT', { ...profile, name: 'Changed' }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'ACCOUNT_UNAVAILABLE');
  assert.match(response.headers.get('set-cookie'), /session-cache=fresh/);
  assert.deepEqual(h.rows.get(account.id), profile);
});
