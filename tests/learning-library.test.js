import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningLibrary } from '../core/learning-library.js';

const clone = value => structuredClone(value);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const tick = () => new Promise(resolve => setImmediate(resolve));
const saved = answer => ({ plan: { title: 'Loops', goal: 'Learn loops', minutes: 5, language: 'en', steps: [{}, {}] }, answers: [answer, ''], completed: 0 });
const course = (id = 'course-a', revision = 1, answer = 'Original') => ({ id, revision, saved: saved(answer), updatedAt: '2026-11-14T10:00:00Z' });
const local = (ownerId = 'alice', dirty = false) => ({ ...course(), ownerId, dirty });
const failure = (status, message = 'Request failed') => Object.assign(new Error(message), { status });
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture({ initial = null, records = [course()], intercept, onChange } = {}) {
  let current = clone(initial), unauthorized = 0, changes = 0, copies = 0;
  const calls = [], applied = [];
  const database = new Map(records.map(value => [value.id, clone(value)]));
  function respond(call) {
    const { path, method, body } = call;
    if (method === 'GET' && path.includes('?id=')) return { course: clone(database.get(decodeURIComponent(path.split('?id=')[1]))) };
    if (method === 'GET') return { courses: [...database.values()].map(value => ({ id: value.id, title: value.saved.plan.title, revision: value.revision, completed: value.saved.completed })) };
    if (method === 'PUT') {
      const previous = database.get(body.id);
      if (previous.revision !== body.revision) throw failure(409);
      const next = { ...previous, saved: clone(body.saved), revision: previous.revision + 1 };
      database.set(body.id, next);
      return { course: clone(next) };
    }
    const next = { ...course(`copy-${++copies}`), saved: clone(body.saved) };
    database.set(next.id, next);
    return { course: clone(next) };
  }
  const library = createLearningLibrary({
    getCurrent: () => current,
    setCurrent(value, ownerId) {
      current = { ...clone(value), ownerId, dirty: false };
      applied.push(clone(current));
    },
    updateMeta(patch) { current = { ...current, ...patch }; },
    onChange() { changes++; onChange?.(library); },
    onUnauthorized() { unauthorized++; },
    debounceMs: 5,
    async request(path, method = 'GET', body, ownerId) {
      const call = { path, method, ownerId, ...(body ? { body: clone(body) } : {}) };
      calls.push(call);
      return intercept ? intercept(call, () => respond(call)) : respond(call);
    },
  });
  return {
    library, calls, applied, database,
    get current() { return current; },
    get unauthorized() { return unauthorized; },
    get changes() { return changes; },
    edit(answer) { current.saved.answers[0] = answer; library.changed(); },
    replace(value) { current = clone(value); },
    puts: () => calls.filter(call => call.method === 'PUT'),
  };
}

test('a new device lists account courses and opens the full saved progress', async () => {
  const run = fixture({ records: [course('course-a', 7, 'Saved on another device')] });
  await run.library.setUser({ id: 'alice' });
  assert.equal(run.current, null);
  assert.equal(run.library.screen().courses[0].id, 'course-a');
  assert.equal(await run.library.load('course-a'), true);
  assert.equal(run.current.ownerId, 'alice');
  assert.equal(run.current.revision, 7);
  assert.equal(run.current.saved.answers[0], 'Saved on another device');
  assert.equal(run.current.dirty, false);
  assert.equal(run.puts().length, 0);
});

test('debounced edits coalesce and use the stored revision', async () => {
  const run = fixture({ initial: local() });
  await run.library.setUser({ id: 'alice' });
  run.edit('One');
  run.edit('Two');
  run.edit('Final draft');
  await pause(25);
  assert.equal(run.puts().length, 1);
  assert.equal(run.puts()[0].body.revision, 1);
  assert.equal(run.puts()[0].body.saved.answers[0], 'Final draft');
  assert.equal(run.current.revision, 2);
  assert.equal(run.current.dirty, false);
  assert.equal(run.library.screen().status, 'saved');
});

test('edits during a PUT stay dirty and drain serially against its acknowledged revision', async () => {
  const pending = deferred();
  let puts = 0, secondStarted = false;
  const run = fixture({ initial: local(), intercept: async (call, respond) => {
    if (call.method === 'PUT' && ++puts === 1) { await pending.promise; return respond(); }
    if (call.method === 'PUT') secondStarted = true;
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  run.edit('First snapshot');
  const flushing = run.library.flush();
  await tick();
  run.edit('Typed while saving');
  await tick();
  assert.equal(secondStarted, false);
  assert.equal(run.current.dirty, true);
  pending.resolve();
  assert.equal(await flushing, true);
  assert.deepEqual(run.puts().map(call => call.body.revision), [1, 2]);
  assert.deepEqual(run.puts().map(call => call.body.saved.answers[0]), ['First snapshot', 'Typed while saving']);
  assert.equal(run.current.saved.answers[0], 'Typed while saving');
  assert.equal(run.current.revision, 3);
  assert.equal(run.current.dirty, false);
});

test('dirty owned drafts reconcile by PUT instead of being replaced by GET', async () => {
  const initial = local('alice', true);
  initial.saved.answers[0] = 'Offline work';
  const run = fixture({ initial });
  await run.library.setUser({ id: 'alice' });
  assert.equal(run.puts().length, 1);
  assert.equal(run.calls.some(call => call.path.includes('?id=')), false);
  assert.equal(run.current.saved.answers[0], 'Offline work');
  assert.equal(run.current.dirty, false);
});

test('legacy and other-account drafts are never uploaded or reconciled implicitly', async () => {
  for (const initial of [local('bob', true), { saved: saved('Legacy'), dirty: true }]) {
    const run = fixture({ initial });
    await run.library.setUser({ id: 'alice' });
    assert.equal(run.library.changed(), false);
    assert.equal(await run.library.flush(), false);
    assert.equal(run.puts().length, 0);
    assert.equal(run.calls.some(call => call.method === 'POST' || call.path.includes('?id=')), false);
    assert.deepEqual(run.current.saved, initial.saved);
  }
});

test('an account change ignores old PUT responses and cancels pending autosave', async () => {
  const pending = deferred();
  const run = fixture({ initial: local(), intercept: async (call, respond) => {
    if (call.method === 'PUT') { await pending.promise; return respond(); }
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  run.edit('Alice private draft');
  const flushing = run.library.flush();
  await tick();
  run.replace({ ...local('bob'), saved: saved('Bob private draft') });
  await run.library.setUser({ id: 'bob' });
  const before = clone(run.current);
  pending.resolve();
  assert.equal(await flushing, false);
  assert.deepEqual(run.current, before);
  assert.equal(run.library.screen().user.id, 'bob');
  run.edit('Bob unsent draft');
  await run.library.setUser(null);
  await pause(20);
  assert.equal(run.puts().length, 1);
});

test('late lists and course GETs from a previous account cannot replace the new account', async () => {
  const delayed = deferred();
  let delay = true;
  const run = fixture({ initial: local(), intercept: async (call, respond) => {
    if (delay && call.method === 'GET') { await delayed.promise; return respond(); }
    return respond();
  } });
  const oldLogin = run.library.setUser({ id: 'alice' });
  await tick();
  delay = false;
  run.replace(null);
  await run.library.setUser({ id: 'bob' });
  const before = clone(run.library.screen().courses);
  delayed.resolve();
  await oldLogin;
  assert.equal(run.current, null);
  assert.equal(run.applied.length, 0);
  assert.deepEqual(run.library.screen().courses, before);
});

test('409 preserves the dirty draft, blocks retries and blocks switching courses', async () => {
  let rejectSave = false;
  const run = fixture({ initial: local(), records: [course(), course('course-b')], intercept: (call, respond) => {
    if (call.method === 'PUT' && rejectSave) throw failure(409);
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  rejectSave = true;
  run.edit('My conflicting work');
  assert.equal(await run.library.flush(), false);
  assert.equal(run.library.screen().conflict, true);
  assert.equal(run.current.dirty, true);
  assert.equal(await run.library.load('course-b'), false);
  assert.equal(await run.library.flush(), false);
  assert.equal(run.current.id, 'course-a');
  assert.equal(run.current.saved.answers[0], 'My conflicting work');
  assert.equal(run.puts().length, 1);
});

test('loadLatest explicitly replaces a conflicting local draft with the cloud version', async () => {
  const run = fixture({ initial: local() });
  await run.library.setUser({ id: 'alice' });
  run.database.set('course-a', course('course-a', 4, 'Other device wins'));
  run.edit('Conflicting draft');
  await run.library.flush();
  assert.equal(await run.library.loadLatest(), true);
  assert.equal(run.current.saved.answers[0], 'Other device wins');
  assert.equal(run.current.revision, 4);
  assert.equal(run.current.dirty, false);
  assert.equal(run.library.screen().conflict, false);
});

test('saveCopy preserves both versions after a conflict', async () => {
  const run = fixture({ initial: local() });
  await run.library.setUser({ id: 'alice' });
  run.database.set('course-a', course('course-a', 4, 'Other device work'));
  run.edit('My independent copy');
  await run.library.flush();
  assert.equal(await run.library.saveCopy(), true);
  assert.equal(run.current.id, 'copy-1');
  assert.equal(run.current.saved.answers[0], 'My independent copy');
  assert.equal(run.database.get('course-a').saved.answers[0], 'Other device work');
  assert.equal(run.library.screen().conflict, false);
});

test('offline saves stay dirty and manual retry succeeds without changing the draft', async () => {
  let offline = false;
  const run = fixture({ initial: local(), intercept: (call, respond) => {
    if (call.method === 'PUT' && offline) throw new TypeError('Network failed');
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  offline = true;
  run.edit('Offline draft');
  assert.equal(await run.library.flush(), false);
  assert.equal(run.current.dirty, true);
  assert.equal(run.library.screen().status, 'offline');
  assert.ok(run.library.screen().syncError);
  offline = false;
  assert.equal(await run.library.flush(), true);
  assert.equal(run.current.saved.answers[0], 'Offline draft');
  assert.equal(run.current.dirty, false);
  assert.equal(run.library.screen().syncError, '');
});

test('401 invalidates the account and keeps the dirty draft for explicit reauthentication', async () => {
  const run = fixture({ initial: local(), intercept: (call, respond) => {
    if (call.method === 'PUT') throw failure(401);
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  run.edit('Private unsynced draft');
  assert.equal(await run.library.flush(), false);
  assert.equal(run.unauthorized, 1);
  assert.equal(run.library.screen().user, null);
  assert.equal(run.current.ownerId, 'alice');
  assert.equal(run.current.dirty, true);
  assert.equal(await run.library.flush(), false);
  assert.equal(run.puts().length, 1);
});

test('importing local work creates a separate course only after the explicit call', async () => {
  const legacy = { saved: saved('Legacy private answer'), dirty: true };
  const run = fixture({ initial: legacy });
  await run.library.setUser({ id: 'alice' });
  assert.equal(run.calls.filter(call => call.method === 'POST').length, 0);
  assert.equal(await run.library.importLocal(legacy.saved), true);
  assert.equal(run.current.id, 'copy-1');
  assert.equal(run.current.ownerId, 'alice');
  assert.equal(run.current.saved.answers[0], 'Legacy private answer');
});

test('a GET does not replace text typed while the selected course was loading', async () => {
  const pending = deferred();
  let delay = false;
  const run = fixture({ initial: local(), records: [course(), course('course-b')], intercept: async (call, respond) => {
    if (delay && call.path.includes('?id=course-b')) { await pending.promise; return respond(); }
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  delay = true;
  const opening = run.library.load('course-b');
  await tick();
  run.edit('Typed during navigation');
  pending.resolve();
  assert.equal(await opening, false);
  assert.equal(run.current.id, 'course-a');
  assert.equal(run.current.saved.answers[0], 'Typed during navigation');
  await run.library.flush();
});

test('editing an accepted new course waits for an old in-flight PUT without losing its autosave', async () => {
  const pending = deferred();
  const run = fixture({ initial: local(), records: [course(), course('course-b')], intercept: async (call, respond) => {
    if (call.method === 'PUT' && call.body.id === 'course-a') { await pending.promise; return respond(); }
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  run.edit('Old course pending answer');
  const oldSave = run.library.flush();
  await tick();
  await run.library.accept(course('course-b'));
  run.edit('New course answer');
  const newSave = run.library.flush();
  await tick();
  assert.equal(run.puts().length, 1);
  pending.resolve();
  assert.equal(await oldSave, false);
  assert.equal(await newSave, true);
  assert.deepEqual(run.puts().map(call => call.body.id), ['course-a', 'course-b']);
  assert.equal(run.current.id, 'course-b');
  assert.equal(run.current.saved.answers[0], 'New course answer');
  assert.equal(run.current.revision, 2);
  assert.equal(run.current.dirty, false);
});

test('a late list keeps other courses and cannot revert a concurrent save acknowledgement', async () => {
  const pending = deferred();
  const initial = local('alice', true);
  initial.saved.answers[0] = 'Offline work before login';
  const run = fixture({ initial, records: [course(), course('course-b')], intercept: async (call, respond) => {
    if (call.method === 'GET' && !call.path.includes('?')) {
      const oldList = respond();
      await pending.promise;
      return oldList;
    }
    return respond();
  } });
  const login = run.library.setUser({ id: 'alice' });
  await tick();
  assert.equal(run.current.revision, 2);
  pending.resolve();
  assert.equal(await login, true);
  const listed = run.library.screen().courses;
  assert.equal(listed.length, 2);
  assert.equal(listed.find(value => value.id === 'course-a').revision, 2);
  assert.ok(listed.some(value => value.id === 'course-b'));
});

test('copying a conflicting draft retains text entered during POST and saves it to the new row', async () => {
  const pending = deferred();
  const run = fixture({ initial: local(), intercept: async (call, respond) => {
    if (call.method === 'POST') { await pending.promise; return respond(); }
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  run.database.set('course-a', course('course-a', 4, 'Other device answer'));
  run.edit('First copy snapshot');
  await run.library.flush();
  const copying = run.library.saveCopy();
  await tick();
  run.edit('New text while creating copy');
  pending.resolve();
  assert.equal(await copying, true);
  assert.equal(run.current.id, 'copy-1');
  assert.equal(run.current.saved.answers[0], 'New text while creating copy');
  assert.equal(run.current.dirty, true);
  await run.library.flush();
  assert.equal(run.database.get('copy-1').saved.answers[0], 'New text while creating copy');
  assert.equal(run.database.get('course-a').saved.answers[0], 'Other device answer');
});

test('an import response from an old account cannot attach private work to the new account', async () => {
  const pending = deferred();
  const run = fixture({ initial: { saved: saved('Alice legacy work'), dirty: true }, intercept: async (call, respond) => {
    if (call.method === 'POST') { await pending.promise; return respond(); }
    return respond();
  } });
  await run.library.setUser({ id: 'alice' });
  const importing = run.library.importLocal(run.current.saved);
  await tick();
  run.replace(null);
  await run.library.setUser({ id: 'bob' });
  pending.resolve();
  assert.equal(await importing, false);
  assert.equal(run.current, null);
  assert.equal(run.applied.length, 0);
});

test('the default course client sends its captured account on every GET, PUT and POST', async t => {
  let current = local();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, ...options });
    assert.equal(options.headers['X-Mindora-Account'], 'alice');
    const body = options.body ? JSON.parse(options.body) : null;
    const result = options.method === 'POST' ? { course: { ...course('copy-header'), saved: body.saved } }
      : options.method === 'PUT' ? { course: { ...course(body.id, body.revision + 1), saved: body.saved } }
        : path.includes('?id=') ? { course: course(decodeURIComponent(path.split('?id=')[1])) }
          : { courses: [] };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const library = createLearningLibrary({
    getCurrent: () => current,
    setCurrent(value, ownerId) { current = { ...clone(value), ownerId, dirty: false }; },
    updateMeta(patch) { current = { ...current, ...patch }; },
  });
  assert.equal(await library.setUser({ id: 'alice' }), true);
  current.saved.answers[0] = 'Saved with the account header';
  library.changed();
  assert.equal(await library.flush(), true);
  assert.equal(await library.saveCopy(), true);
  assert.deepEqual(new Set(calls.map(call => call.method)), new Set(['GET', 'PUT', 'POST']));
  assert.ok(calls.some(call => call.path.includes('?id=')));
  const count = calls.length;
  library.changed();
  const queued = library.flush();
  await library.setUser(null);
  assert.equal(await queued, false);
  assert.equal(calls.length, count, 'a queued save must not start after the account changes');
});

test('an account change during notifications cancels list and copy requests before they start', async () => {
  let cancelNext = false;
  const run = fixture({ initial: local(), onChange(library) {
    if (!cancelNext) return;
    cancelNext = false;
    void library.setUser(null);
  } });
  await run.library.setUser({ id: 'alice' });
  let count = run.calls.length;
  cancelNext = true;
  assert.equal(await run.library.refresh(), false);
  assert.equal(run.calls.length, count);
  await run.library.setUser({ id: 'alice' });
  count = run.calls.length;
  cancelNext = true;
  assert.equal(await run.library.saveCopy(), false);
  assert.equal(run.calls.length, count);
  assert.ok(run.calls.every(call => call.ownerId === 'alice'));
});
