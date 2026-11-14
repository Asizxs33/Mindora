import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudDrafts } from '../core/cloud-drafts.js';
import { renderCloudPanel } from '../ui/cloud-drafts.js';

const userA = { id: 'a', email: 'alex@example.com' };
const userB = { id: 'b', email: 'sam@example.com' };
const account = user => ({ available: true, user });
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(t) {
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };
  const listeners = new Map();
  const slot = { dataset: { cloudPanel: 'editor' }, innerHTML: '' };
  const calls = [];
  const restored = [];
  globalThis.document = {
    querySelector: () => slot,
    addEventListener(type, callback) { listeners.set(type, callback); },
  };
  globalThis.window = { confirm: () => true };
  globalThis.fetch = (url, options) => new Promise(resolve => {
    calls.push({ url, options, reply: (body, status = 200) => resolve(Response.json(body, { status })) });
  });
  t.after(() => Object.assign(globalThis, previous));
  const workspace = { marker: 'local-draft' };
  const cloud = createCloudDrafts({
    getWorkspace: () => workspace,
    hasLocalDraft: () => false,
    restoreWorkspace: value => restored.push(value),
  });
  return {
    cloud, calls, slot, restored,
    click(action) {
      listeners.get('click')({ target: { closest: () => ({ dataset: { cloudAction: action } }) } });
    },
    async login(user) {
      const completion = cloud.init();
      await tick();
      calls.at(-1).reply(account(user));
      await completion;
    },
  };
}

test('account changes during an initial session read queue one fresh read and discard the stale result', async t => {
  const h = harness(t);
  const first = h.cloud.init();
  await tick();
  assert.equal(h.calls.length, 1);
  const second = h.cloud.init();
  const third = h.cloud.init();
  h.calls[0].reply(account(null));
  await tick();
  assert.equal(h.calls.length, 2, 'coalesce notifications while the first read is pending');
  assert.equal(h.calls[1].url, '/api/account');
  h.calls[1].reply(account(userA));
  await Promise.all([first, second, third]);
  assert.match(h.slot.innerHTML, /alex@example\.com/);
  assert.match(h.slot.innerHTML, /data-cloud-action="save"/);
  assert.doesNotMatch(h.slot.innerHTML, / disabled/);
});

test('account change during draft load prevents the previous account draft from replacing local work', async t => {
  const h = harness(t);
  await h.login(userA);
  h.click('load');
  await tick();
  const refresh = h.cloud.init();
  h.calls[1].reply({ draft: { workspace: { marker: 'old-account-private-work' }, revision: 8 } });
  await tick();
  assert.equal(h.calls[2].url, '/api/account');
  h.calls[2].reply(account(userB));
  await refresh;
  assert.deepEqual(h.restored, []);
  assert.match(h.slot.innerHTML, /sam@example\.com/);
  assert.doesNotMatch(h.slot.innerHTML, /alex@example\.com/);
  h.click('save');
  await tick();
  assert.equal(JSON.parse(h.calls[3].options.body).revision, null);
  h.calls[3].reply({ draft: { revision: 1 } });
  await tick();
});

test('queued signout clears the cloud identity and stale save result without keeping its revision', async t => {
  const h = harness(t);
  await h.login(userA);
  h.click('save');
  await tick();
  const refresh = h.cloud.init();
  h.calls[1].reply({ draft: { revision: 7 } });
  await tick();
  h.calls[2].reply(account(null));
  await refresh;
  assert.match(h.slot.innerHTML, /data-account-open="signin"/);
  assert.doesNotMatch(h.slot.innerHTML, /alex@example\.com|data-cloud-action="save"/);
  await h.login(userB);
  h.click('save');
  await tick();
  assert.equal(JSON.parse(h.calls.at(-1).options.body).revision, null);
  h.calls.at(-1).reply({ draft: { revision: 1 } });
  await tick();
});

test('cloud profile controls share the account dialog and never mount a second credential form', () => {
  const slot = { dataset: { cloudPanel: 'profile' }, innerHTML: '' };
  renderCloudPanel(slot, { user: null, available: true, busy: false, status: '' });
  assert.match(slot.innerHTML, /data-account-open="signin"/);
  assert.match(slot.innerHTML, /data-account-open="signup"/);
  assert.doesNotMatch(slot.innerHTML, /<form|name="password"|mindora-account-form/);
  renderCloudPanel(slot, { user: userA, available: true, busy: false, status: '' });
  assert.match(slot.innerHTML, /data-account-open="profile"/);
  assert.match(slot.innerHTML, /data-cloud-action="load"/);
  assert.doesNotMatch(slot.innerHTML, /data-cloud-action="signout"/);
});
