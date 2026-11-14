import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltinSync } from '../core/builtin-sync.js';

const clone = value => structuredClone(value);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const tick = () => new Promise(resolve => setImmediate(resolve));
const data = answer => ({ progress: { design: 0, budget: 2 }, drafts: { 'budget-practice': { answer } }, works: {}, studyDays: [] });
const workspace = (revision = 1, answer = '35') => ({ data: data(answer), revision, updatedAt: '2026-11-14T10:00:00Z' });
const local = (ownerId = 'alice', dirty = false) => ({ ...workspace(), ownerId, dirty });
const failure = status => Object.assign(new Error('Request failed'), { status });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture({ initial = local(), remote = workspace(), intercept } = {}) {
  let current = clone(initial), cloud = clone(remote), unauthorized = 0;
  const calls = [], applied = [];
  function respond(call) {
    if (call.method === 'GET') return { workspace: clone(cloud) };
    if ((cloud?.revision ?? null) !== call.body.revision) throw failure(409);
    cloud = { data: clone(call.body.data), revision: (cloud?.revision || 0) + 1, updatedAt: '2026-11-14T11:00:00Z' };
    return { workspace: clone(cloud) };
  }
  const sync = createBuiltinSync({
    getCurrent: () => current,
    setCurrent(value, ownerId) { current = { ...clone(value), ownerId, dirty: false }; applied.push(clone(current)); },
    updateMeta(patch) { current = { ...current, ...patch }; },
    onUnauthorized() { unauthorized++; },
    debounceMs: 5,
    async request(path, method = 'GET', body, ownerId) {
      const call = { path, method, ownerId, ...(body ? { body: clone(body) } : {}) };
      calls.push(call);
      return intercept ? intercept(call, () => respond(call)) : respond(call);
    },
  });
  return {
    sync, calls, applied,
    get current() { return current; },
    get cloud() { return cloud; },
    get unauthorized() { return unauthorized; },
    replace(value) { current = clone(value); },
    setRemote(value) { cloud = clone(value); },
    edit(answer) { current.data.drafts['budget-practice'].answer = answer; sync.changed(); },
    puts: () => calls.filter(call => call.method === 'PUT'),
  };
}

test('a clean account loads built-in progress from another device without uploading local data', async () => {
  const run = fixture({ remote: workspace(5, 'Saved elsewhere') });
  assert.equal(await run.sync.setUser({ id: 'alice' }), true);
  assert.equal(run.current.revision, 5);
  assert.equal(run.current.data.drafts['budget-practice'].answer, 'Saved elsewhere');
  assert.equal(run.current.ownerId, 'alice');
  assert.equal(run.puts().length, 0);
});

test('an empty remote workspace is created on the first edit using revision:null', async () => {
  const run = fixture({ remote: null });
  await run.sync.setUser({ id: 'alice' });
  assert.equal(run.current.revision, null);
  assert.equal(run.puts().length, 0);
  run.edit('First answer');
  assert.equal(await run.sync.flush(), true);
  assert.equal(run.puts()[0].body.revision, null);
  assert.equal(run.current.revision, 1);
  assert.equal(run.cloud.data.drafts['budget-practice'].answer, 'First answer');
});

test('an owned dirty initial workspace creates its remote row without a destructive GET', async () => {
  const initial = { ...local('alice', true), revision: null, data: data('Offline work') };
  const run = fixture({ initial, remote: null });
  assert.equal(await run.sync.setUser({ id: 'alice' }), true);
  assert.equal(run.calls.length, 1);
  assert.equal(run.calls[0].method, 'PUT');
  assert.equal(run.calls[0].body.revision, null);
  assert.equal(run.current.dirty, false);
});

test('debounced edits coalesce into one whole-workspace save', async () => {
  const run = fixture();
  await run.sync.setUser({ id: 'alice' });
  run.edit('1'); run.edit('12'); run.edit('123');
  await pause(25);
  assert.equal(run.puts().length, 1);
  assert.equal(run.puts()[0].body.data.drafts['budget-practice'].answer, '123');
  assert.deepEqual(run.puts()[0].body.data.progress, { design: 0, budget: 2 });
  assert.equal(run.current.dirty, false);
});

test('edits during PUT remain dirty and drain with the acknowledged next revision', async () => {
  const pending = deferred();
  let puts = 0;
  const run = fixture({ intercept: async (call, respond) => {
    if (call.method === 'PUT' && ++puts === 1) { await pending.promise; return respond(); }
    return respond();
  } });
  await run.sync.setUser({ id: 'alice' });
  run.edit('First');
  const saving = run.sync.flush();
  await tick();
  run.edit('Second');
  assert.equal(run.puts().length, 1);
  assert.equal(run.current.dirty, true);
  pending.resolve();
  assert.equal(await saving, true);
  assert.deepEqual(run.puts().map(call => call.body.revision), [1, 2]);
  assert.equal(run.current.revision, 3);
  assert.equal(run.current.data.drafts['budget-practice'].answer, 'Second');
  assert.equal(run.current.dirty, false);
});

test('other-account local data cannot be adopted or uploaded when the server has no workspace', async () => {
  const initial = local('bob', true);
  const run = fixture({ initial, remote: null });
  await run.sync.setUser({ id: 'alice' });
  assert.equal(run.sync.changed(), false);
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.puts().length, 0);
  assert.deepEqual(run.current, initial);
});

test('409 keeps local work and stops automatic writes until explicit loadLatest', async () => {
  const run = fixture();
  await run.sync.setUser({ id: 'alice' });
  run.setRemote(workspace(4, 'Other device'));
  run.edit('My conflicting answer');
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.sync.screen().conflict, true);
  assert.equal(run.current.dirty, true);
  run.edit('Still my answer');
  await pause(15);
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.puts().length, 1);
  assert.equal(run.cloud.data.drafts['budget-practice'].answer, 'Other device');
  assert.equal(await run.sync.loadLatest(), true);
  assert.equal(run.current.data.drafts['budget-practice'].answer, 'Other device');
  assert.equal(run.current.revision, 4);
  assert.equal(run.current.dirty, false);
  assert.equal(run.sync.screen().conflict, false);
});

test('offline failure retains dirty progress and manual retry saves it', async () => {
  let offline = false;
  const run = fixture({ intercept: (call, respond) => {
    if (offline && call.method === 'PUT') throw new TypeError('Offline');
    return respond();
  } });
  await run.sync.setUser({ id: 'alice' });
  offline = true;
  run.edit('Offline answer');
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.current.dirty, true);
  assert.equal(run.sync.screen().status, 'offline');
  offline = false;
  assert.equal(await run.sync.flush(), true);
  assert.equal(run.current.dirty, false);
  assert.equal(run.cloud.data.drafts['budget-practice'].answer, 'Offline answer');
});

test('401 requests reauthentication and keeps the owned dirty workspace', async () => {
  const run = fixture({ intercept: (call, respond) => {
    if (call.method === 'PUT') throw failure(401);
    return respond();
  } });
  await run.sync.setUser({ id: 'alice' });
  run.edit('Unsynced private answer');
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.unauthorized, 1);
  assert.equal(run.current.ownerId, 'alice');
  assert.equal(run.current.dirty, true);
  assert.equal(await run.sync.flush(), false);
  assert.equal(run.puts().length, 1);
});

test('account changes ignore old GET and PUT responses and cancel pending debounce', async () => {
  for (const method of ['GET', 'PUT']) {
    const pending = deferred();
    let delayed = false;
    const run = fixture({ intercept: async (call, respond) => {
      if (delayed && call.method === method) { const result = respond(); await pending.promise; return result; }
      return respond();
    } });
    await run.sync.setUser({ id: 'alice' });
    delayed = true;
    let oldRequest;
    if (method === 'PUT') { run.edit('Alice private draft'); oldRequest = run.sync.flush(); }
    else oldRequest = run.sync.loadLatest();
    await tick();
    delayed = false;
    run.replace(local('bob'));
    run.setRemote(workspace(8, 'Bob workspace'));
    await run.sync.setUser({ id: 'bob' });
    const before = clone(run.current);
    pending.resolve();
    assert.equal(await oldRequest, false);
    assert.deepEqual(run.current, before);
    run.edit('Unsent Bob draft');
    await run.sync.setUser(null);
    const count = run.puts().length;
    await pause(15);
    assert.equal(run.puts().length, count);
  }
});

test('a delayed GET never replaces edits typed while progress was loading', async () => {
  const pending = deferred();
  let delayed = false;
  const run = fixture({ intercept: async (call, respond) => {
    if (delayed && call.method === 'GET') { const result = respond(); await pending.promise; return result; }
    return respond();
  } });
  await run.sync.setUser({ id: 'alice' });
  delayed = true;
  const loading = run.sync.loadLatest();
  await tick();
  run.edit('Typed while loading');
  pending.resolve();
  assert.equal(await loading, false);
  assert.equal(run.current.data.drafts['budget-practice'].answer, 'Typed while loading');
  await run.sync.flush();
});

test('the default built-in client binds GET and PUT to the captured account and cancels stale queued saves', async t => {
  let current = local();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, ...options });
    assert.equal(options.headers['X-Mindora-Account'], 'alice');
    const body = options.body ? JSON.parse(options.body) : null;
    const result = options.method === 'PUT'
      ? { workspace: { data: body.data, revision: body.revision + 1 } }
      : { workspace: workspace() };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const sync = createBuiltinSync({
    getCurrent: () => current,
    setCurrent(value, ownerId) { current = { ...clone(value), ownerId, dirty: false }; },
    updateMeta(patch) { current = { ...current, ...patch }; },
  });
  assert.equal(await sync.setUser({ id: 'alice' }), true);
  current.data.drafts['budget-practice'].answer = 'Saved with the account header';
  sync.changed();
  assert.equal(await sync.flush(), true);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'PUT']);
  const count = calls.length;
  sync.changed();
  const queued = sync.flush();
  await sync.setUser(null);
  assert.equal(await queued, false);
  assert.equal(calls.length, count, 'a queued save must not start after the account changes');
});
