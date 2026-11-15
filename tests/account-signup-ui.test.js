import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const moduleUrl = new URL('../ui/account.js', import.meta.url);
const source = readFileSync(moduleUrl, 'utf8')
  .replace(/^import .*;\r?$/gm, '')
  .replace(/\bexport (?=function )/g, '')
  .replaceAll('import.meta.url', 'moduleUrl');
const profile = { name: 'Alex', age: null, gender: '', interests: [] };
const user = { id: 'learner-1', name: 'Alex', email: 'alex@example.com' };
const password = 'demo-password';
const drain = () => new Promise(resolve => setImmediate(resolve));

async function accountDialog(hash, responses) {
  const { document, Event, CustomEvent, HTMLElement } = parseHTML('<html><head></head><body><main id="main"></main></body></html>').window;
  HTMLElement.prototype.scrollIntoView ??= () => {};
  const location = new URL(hash, 'https://mindora.test/');
  const accountEvents = [];
  const requests = [];
  const createElement = document.createElement.bind(document);
  document.createElement = tag => {
    const element = createElement(tag);
    if (tag === 'dialog') {
      element.showModal = () => { element.open = true; };
      element.close = () => { element.open = false; element.dispatchEvent(new Event('close')); };
    }
    return element;
  };
  const context = vm.createContext({
    document, URL, moduleUrl: moduleUrl.href, location, CustomEvent, AbortController,
    window: { location, dispatchEvent: event => accountEvents.push(event) },
    history: { replaceState: (_state, _title, url) => { location.href = new URL(url, location).href; } },
    setTimeout, clearTimeout, queueMicrotask,
    character: () => '', mountCharacters() {}, t: en => en,
    async fetch(path, options) {
      assert.equal(path, '/api/account');
      requests.push({ method: options.method, body: options.body && JSON.parse(options.body) });
      if (options.method === 'GET') return Response.json({ available: true, user: null, profile: null });
      const response = responses.shift();
      return response instanceof Response ? response : Response.json(response);
    },
  });
  new vm.Script(source, { filename: 'ui/account.js' }).runInContext(context);
  await vm.runInContext('mountAccount()', context);
  const dialog = document.querySelector('#mindora-account');
  const field = name => dialog.querySelector(`[name="${name}"]`);
  const submit = () => dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const fillCredentials = () => {
    const email = field('email');
    email.value = user.email;
    Object.defineProperty(email, 'validity', { value: { valid: true } });
    field('password').value = password;
    if (field('confirm')) { field('confirm').value = password; field('privacy').checked = true; }
  };
  async function signup() {
    field('name').value = profile.name;
    assert.equal(field('age'), null);
    submit();
    submit();
    fillCredentials();
    submit();
    await drain();
  }
  const openProfile = () => vm.runInContext("openAccount('profile')", context);
  return { accountEvents, dialog, document, location, signup, submit, fillCredentials, field, requests, openProfile };
}

test('signup requires the data notice to be acknowledged, while signin has no checkbox', async () => {
  const run = await accountDialog('#signup', []);
  run.field('name').value = profile.name;
  run.submit(); run.submit();
  assert.ok(!run.field('privacy').checked);
  run.fillCredentials();
  run.field('privacy').checked = false;
  run.submit();
  assert.equal(run.requests.filter(request => request.method === 'POST').length, 0);
  assert.equal(run.field('privacy').getAttribute('aria-invalid'), 'true');
  const returning = await accountDialog('#signin', []);
  assert.equal(returning.field('privacy'), null);
});

test('a confirmed signup closes the account dialog and signals home navigation', async () => {
  const run = await accountDialog('#signup', [{ user, profile }]);
  await run.signup();
  assert.equal(run.requests.at(-1).body.action, 'signup');
  assert.equal(run.requests.at(-1).body.name, profile.name);
  assert.equal(run.dialog.open, false);
  assert.equal(run.document.body.classList.contains('account-open'), false);
  assert.equal(run.location.hash, '#discover');
  const change = run.accountEvents.at(-1);
  assert.equal(change.type, 'mindora:account-changed');
  assert.equal(change.detail.user.id, user.id);
  assert.equal(change.detail.reason, 'signup-complete');
  assert.equal(run.field('password')?.value ?? '', '');
});

test('signup waits for email verification and completes after its profile is saved', async () => {
  const run = await accountDialog('#signup', [
    { user: null, verificationRequired: true },
    { user, profile: null },
    { user, profile },
  ]);
  await run.signup();
  assert.equal(run.dialog.open, true);
  assert.ok(run.dialog.querySelector('.account-signin'));
  assert.match(run.dialog.querySelector('#account-notice').textContent, /verify your account/i);
  assert.equal(run.field('password').value, '');
  assert.equal(run.accountEvents.at(-1).detail.user, null);
  assert.notEqual(run.accountEvents.at(-1).detail.reason, 'signup-complete');
  run.fillCredentials();
  run.submit();
  await drain();
  assert.equal(run.dialog.open, true);
  assert.equal(run.field('age').value, '');
  assert.notEqual(run.accountEvents.at(-1).detail.reason, 'signup-complete');
  run.submit();
  await drain();
  assert.equal(run.requests.at(-1).method, 'PUT');
  assert.deepEqual(run.requests.at(-1).body, profile);
  assert.equal(run.dialog.open, false);
  assert.equal(run.accountEvents.at(-1).detail.reason, 'signup-complete');
});

test('signup keeps the draft available until its failed profile write can be retried', async () => {
  const run = await accountDialog('#signup', [
    { user, profile: null, profilePending: true },
    { user, profile },
  ]);
  await run.signup();
  assert.equal(run.dialog.open, true);
  assert.equal(run.field('age').value, '');
  assert.notEqual(run.accountEvents.at(-1).detail.reason, 'signup-complete');
  run.submit();
  await drain();
  assert.equal(run.requests.at(-1).method, 'PUT');
  assert.deepEqual(run.requests.at(-1).body, profile);
  assert.equal(run.dialog.open, false);
  assert.equal(run.accountEvents.at(-1).detail.reason, 'signup-complete');
});

test('returning sign-in closes the form and profile confirmations appear above the form', async () => {
  const run = await accountDialog('#signin', [
    { user, profile },
    Response.json({ error: 'Profile temporarily unavailable' }, { status: 503 }),
    { user, profile },
  ]);
  run.fillCredentials();
  run.submit();
  await drain();
  assert.equal(run.requests.at(-1).body.action, 'signin');
  assert.equal(run.accountEvents.at(-1).detail.user.id, user.id);
  assert.equal(run.dialog.open, false);
  assert.equal(run.location.hash, '#discover');
  assert.match(run.document.querySelector('.account-confirmation-page').textContent, /signed in/);
  assert.notEqual(run.accountEvents.at(-1).detail.reason, 'signup-complete');
  run.openProfile();
  assert.equal(run.dialog.open, true);
  run.submit();
  await drain();
  assert.match(run.dialog.querySelector('#account-error').textContent, /temporarily unavailable/);
  run.submit();
  await drain();
  assert.equal(run.requests.at(-1).method, 'PUT');
  assert.equal(run.dialog.open, true);
  assert.equal(run.dialog.querySelector('#account-notice').textContent, '');
  assert.match(run.dialog.querySelector('.account-confirmation[role="status"]').textContent, /profile is saved/);
  assert.notEqual(run.accountEvents.at(-1).detail.reason, 'signup-complete');
});
