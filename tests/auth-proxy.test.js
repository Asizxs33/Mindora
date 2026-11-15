import test from 'node:test';
import assert from 'node:assert/strict';
import { NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@neondatabase/auth/server';
import { accountApi } from '../backend/cloud-api.js';

const origin = 'https://mindora.test';
const settings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.test/neondb/auth', cookieSecret: 'fixture-cookie-signing-secret-at-least-32-characters' };
const timestamp = new Date().toISOString();
const user = { id: 'fixture-owner', name: 'Alex', email: 'alex@example.test', createdAt: timestamp, updatedAt: timestamp };
const session = { id: 'fixture-session', userId: user.id, createdAt: timestamp, updatedAt: timestamp, expiresAt: new Date(Date.now() + 60_000).toISOString() };
const request = (method = 'GET', body, cookie) => new Request(`${origin}/api/account`, {
  method, headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const browserCookies = response => response.headers.getSetCookie().map(cookie => cookie.split(';', 1)[0]).join('; ');

test('the real Neon proxy signs in, verifies its cookie cache and clears both cookies on signout', async context => {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, options });
    if (url === `${settings.baseUrl}/sign-in/email`) {
      assert.deepEqual(JSON.parse(options.body), { email: user.email, password: 'fixture-password' });
      assert.equal(new Headers(options.headers).get('origin'), origin);
      assert.equal(new Headers(options.headers).get('cookie'), '', 'unrelated browser cookies must not reach Neon');
      return Response.json({ user }, { headers: { 'set-cookie': `${NEON_AUTH_SESSION_COOKIE_NAME}=fixture-token; Path=/; HttpOnly; Secure; SameSite=None` } });
    }
    if (url === `${settings.baseUrl}/get-session`) {
      assert.equal(new Headers(options.headers).get('cookie'), `${NEON_AUTH_SESSION_COOKIE_NAME}=fixture-token`);
      return Response.json({ user, session });
    }
    assert.equal(url, `${settings.baseUrl}/sign-out`);
    return Response.json({ ok: true }, { headers: { 'set-cookie': `${NEON_AUTH_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0` } });
  });
  const dependencies = { settings, store: () => ({ read: async id => { assert.equal(id, user.id); return null; } }) };
  const signedIn = await accountApi(request('POST', { action: 'signin', email: user.email, password: 'fixture-password' }, 'unrelated=private'), dependencies);
  assert.equal(signedIn.status, 200);
  assert.equal((await signedIn.json()).user.id, user.id);
  const cookies = signedIn.headers.getSetCookie();
  assert.ok(cookies.some(cookie => cookie.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`)));
  assert.ok(cookies.some(cookie => cookie.startsWith(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`)));
  assert.ok(cookies.every(cookie => /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=lax/i.test(cookie)));
  assert.equal(calls.length, 2, 'post-login identity is confirmed from the signed cache');
  const cookie = browserCookies(signedIn);
  const restored = await accountApi(request('GET', undefined, cookie), dependencies);
  assert.equal((await restored.json()).user.id, user.id);
  assert.equal(calls.length, 2, 'a verified cache avoids an upstream request');
  const signedOut = await accountApi(request('POST', { action: 'signout' }, cookie), dependencies);
  assert.equal(signedOut.status, 200);
  assert.equal((await signedOut.json()).user, null);
  for (const name of [NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME]) {
    assert.ok(signedOut.headers.getSetCookie().some(value => value.startsWith(`${name}=`) && /Max-Age=0/.test(value)));
  }
});

test('the real Neon proxy preserves rejected credentials without producing an authenticated user', async context => {
  context.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `${settings.baseUrl}/sign-in/email`);
    return Response.json({ code: 'INVALID_CREDENTIALS', message: 'Private upstream details' }, { status: 401 });
  });
  const response = await accountApi(request('POST', { action: 'signin', email: user.email, password: 'fixture-password' }), {
    settings, store: () => { throw new Error('Rejected credentials must never access stored profiles'); },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.getSetCookie().length, 0);
  const body = await response.json();
  assert.equal(body.code, 'AUTH_FAILED');
  assert.equal(body.user, undefined);
  assert.doesNotMatch(body.error, /Private upstream details/);
});
