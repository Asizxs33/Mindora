const ENDPOINT = '/api/learning-workspace';
const serialized = value => JSON.stringify(value);

async function apiRequest(path, method = 'GET', body, ownerId) {
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-Mindora-Account': ownerId, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  let result;
  try { result = await response.json(); }
  catch { throw Object.assign(new Error('The progress service could not respond. Please try again.'), { status: response.status }); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'The progress request failed.'), { status: response.status });
  return result;
}

// The caller supplies only built-in course fields and keeps local workspaces
// separate by account. This module never adopts another owner's local data.
export function createBuiltinSync({
  getCurrent, setCurrent, updateMeta, onChange = () => {}, onUnauthorized = () => {},
  request = apiRequest, debounceMs = 700,
}) {
  let user = null, generation = 0, readSequence = 0, timer = null;
  let status = 'idle', syncError = '', conflict = false;
  let readTask = null, flushTask = null;
  let writeTail = Promise.resolve();

  const userId = () => user?.id ?? null;
  const token = () => ({ generation, ownerId: userId() });
  const valid = operation => Boolean(operation.ownerId) && operation.ownerId === userId() && operation.generation === generation;
  const owned = current => Boolean(current && userId() && current.ownerId === userId());
  const canApply = operation => valid(operation) && owned(getCurrent());
  function notify() { onChange(); }
  function stopTimer() { if (timer !== null) clearTimeout(timer); timer = null; }

  function fail(failure, operation) {
    if (!valid(operation)) return;
    if (failure?.status === 401) {
      stopTimer();
      generation++;
      readSequence++;
      user = null;
      readTask = flushTask = null;
      conflict = false;
      status = 'idle';
      syncError = 'Sign in again to sync your progress. Your work is still on this device.';
      notify();
      onUnauthorized();
      return;
    }
    if (failure?.status === 409) {
      conflict = true;
      status = 'conflict';
      syncError = 'Your course progress changed on another device. Your local work is kept here. Open the saved version to use the other device’s progress.';
    } else {
      status = 'offline';
      syncError = failure?.status && failure?.message ? failure.message
        : 'Could not sync your course progress. Your work is still on this device. Try again.';
    }
    notify();
  }

  async function drain(operation) {
    while (valid(operation)) {
      const current = getCurrent();
      if (!current?.dirty) { status = 'saved'; return true; }
      if (!owned(current)) {
        syncError = 'This local progress belongs to another account and cannot be synced here.';
        return false;
      }
      if (conflict) return false;
      const data = structuredClone(current.data);
      const snapshot = serialized(data);
      const revision = current.revision ?? null;
      status = 'saving';
      syncError = '';
      notify();
      try {
        const send = () => canApply(operation) ? request(ENDPOINT, 'PUT', { data, revision }, operation.ownerId) : null;
        const pending = writeTail.then(send, send);
        writeTail = pending.catch(() => {});
        const result = await pending;
        if (!result || !canApply(operation)) return false;
        const workspace = result.workspace;
        if (!workspace || !Number.isInteger(workspace.revision)) throw new Error('Invalid saved progress response');
        const unchanged = serialized(getCurrent().data) === snapshot;
        updateMeta({ revision: workspace.revision, updatedAt: workspace.updatedAt, dirty: !unchanged });
        notify();
      } catch (failure) {
        if (canApply(operation)) fail(failure, operation);
        return false;
      }
    }
    return false;
  }

  function flush() {
    stopTimer();
    if (!getCurrent()?.dirty) return Promise.resolve(true);
    if (!userId()) return Promise.resolve(false);
    if (flushTask && valid(flushTask)) return flushTask.promise;
    const operation = token();
    flushTask = operation;
    operation.promise = drain(operation).finally(() => {
      if (flushTask === operation) {
        flushTask = null;
        if (!getCurrent()?.dirty) stopTimer();
        notify();
      }
    });
    return operation.promise;
  }

  function changed() {
    if (!owned(getCurrent())) return false;
    updateMeta({ dirty: true });
    stopTimer();
    if (!conflict) {
      status = 'idle';
      timer = setTimeout(() => { timer = null; void flush(); }, debounceMs);
    }
    notify();
    return true;
  }

  async function readLatest(discard = false) {
    if (!userId()) return false;
    stopTimer();
    const operation = { ...token(), sequence: ++readSequence };
    const active = () => valid(operation) && operation.sequence === readSequence;
    const before = getCurrent();
    const beforeOwner = before?.ownerId;
    const snapshot = serialized(before?.data);
    readTask = operation;
    notify();
    try {
      if (discard && flushTask) await flushTask.promise;
      if (!active()) return false;
      // A load may discard only the work present when the learner chose it.
      if (getCurrent()?.ownerId !== beforeOwner || serialized(getCurrent()?.data) !== snapshot) return false;
      const result = await request(ENDPOINT, 'GET', undefined, operation.ownerId);
      if (!active()) return false;
      if (getCurrent()?.ownerId !== beforeOwner || serialized(getCurrent()?.data) !== snapshot) {
        if (discard) syncError = 'Your work changed while saved progress was loading. Copy any new work and try again.';
        return false;
      }
      if (result.workspace) {
        if (!Number.isInteger(result.workspace.revision) || !result.workspace.data) throw new Error('Invalid progress response');
        setCurrent(result.workspace, operation.ownerId);
      } else if (owned(getCurrent())) {
        // The first subsequent edit creates the row with revision:null.
        setCurrent({ data: structuredClone(getCurrent().data), revision: null, updatedAt: null }, operation.ownerId);
      }
      conflict = false;
      syncError = '';
      status = result.workspace ? 'saved' : 'idle';
      return true;
    } catch (failure) {
      if (active()) fail(failure, operation);
      return false;
    } finally {
      if (readTask === operation) { readTask = null; notify(); }
    }
  }

  async function setUser(nextUser) {
    const nextId = nextUser?.id ?? null;
    if (nextId !== userId()) {
      stopTimer();
      generation++;
      readSequence++;
      readTask = flushTask = null;
      conflict = false;
      syncError = '';
      status = 'idle';
    }
    user = nextUser || null;
    notify();
    if (!nextId) return true;
    return owned(getCurrent()) && getCurrent().dirty ? flush() : readLatest();
  }

  return {
    setUser, changed, flush,
    retry: () => getCurrent()?.dirty ? flush() : readLatest(),
    loadLatest: () => readLatest(true),
    screen: () => ({
      status: conflict ? 'conflict' : flushTask || timer !== null ? 'saving' : readTask ? 'loading' : status,
      syncError, conflict, busy: flushTask ? 'saving' : readTask ? 'loading' : null,
    }),
  };
}
