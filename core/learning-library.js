const ENDPOINT = '/api/learning-courses';
const copy = value => structuredClone(value);
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
  catch { throw Object.assign(new Error('The course service could not respond. Please try again.'), { status: response.status }); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'The course request failed.'), { status: response.status });
  return result;
}

// request(path, method, body, ownerId) is the network port. Only explicit imports create
// courses; an unowned legacy/local draft must never be uploaded by autosave.
export function createLearningLibrary({
  getCurrent, setCurrent, updateMeta, onChange = () => {}, onUnauthorized = () => {},
  request = apiRequest, debounceMs = 700,
}) {
  let user = null, generation = 0, selection = 0, timer = null;
  let courses = [], error = '', syncError = '', conflict = false, status = 'idle';
  let acknowledgements = new Map();
  let listTask = null, openTask = null, flushTask = null;
  let putTail = Promise.resolve();

  const userId = () => user?.id ?? null;
  const token = () => ({ generation, ownerId: userId() });
  const valid = operation => operation.generation === generation && operation.ownerId === userId() && Boolean(operation.ownerId);
  const owned = current => Boolean(current?.id && userId() && current.ownerId === userId());
  const sameCourse = (operation, id) => valid(operation) && owned(getCurrent()) && getCurrent().id === id;
  const fingerprint = current => current ? serialized([current.id, current.ownerId, current.revision, current.dirty, current.saved]) : null;
  function notify() { onChange(); }
  function stopTimer() { if (timer !== null) clearTimeout(timer); timer = null; }

  function fail(failure, operation, saving = false) {
    if (!valid(operation)) return;
    if (failure?.status === 401) {
      stopTimer();
      generation++;
      selection++;
      user = null;
      courses = [];
      acknowledgements = new Map();
      listTask = openTask = flushTask = null;
      conflict = false;
      status = 'idle';
      error = 'Please sign in again to open your courses.';
      syncError = saving ? 'Sign in again to save your changes. Your draft is still on this device.' : '';
      notify();
      onUnauthorized();
      return;
    }
    if (saving && failure?.status === 409) {
      conflict = true;
      status = 'conflict';
      syncError = 'This course changed on another device. Open the saved version or save your work as a copy.';
    } else {
      const description = failure?.status && failure?.message ? failure.message
        : saving ? 'Could not save to your account. Your changes are still on this device. Try again.'
          : 'Could not load your courses. Check your connection and try again.';
      if (saving) syncError = description;
      else error = description;
      status = 'offline';
    }
    notify();
  }

  function rememberCourse(course) {
    const saved = course.saved;
    if (!saved?.plan) return;
    const summary = {
      id: course.id, title: saved.plan.title, goal: saved.plan.goal,
      minutes: saved.plan.minutes, language: saved.plan.language,
      completed: saved.completed, totalSteps: saved.plan.steps.length,
      revision: course.revision, updatedAt: course.updatedAt,
    };
    courses = [summary, ...courses.filter(item => item.id !== course.id)];
    // Merge acknowledgements into any older list response without dropping the
    // other courses that a newly signed-in device has not received yet.
    acknowledgements.set(course.id, summary);
  }

  async function refresh() {
    if (!userId()) return false;
    const operation = token();
    listTask = operation;
    error = '';
    notify();
    try {
      if (!valid(operation) || listTask !== operation) return false;
      const result = await request(ENDPOINT, 'GET', undefined, operation.ownerId);
      if (!valid(operation) || listTask !== operation) return false;
      const received = new Map((Array.isArray(result.courses) ? result.courses : []).map(course => [course.id, course]));
      for (const [id, summary] of acknowledgements) {
        if (!received.has(id) || received.get(id).revision < summary.revision) received.set(id, summary);
        else acknowledgements.delete(id);
      }
      courses = [...received.values()];
      if (status === 'offline' && !syncError) status = 'idle';
      return true;
    } catch (failure) {
      if (listTask === operation) fail(failure, operation);
      return false;
    } finally {
      if (listTask === operation) { listTask = null; notify(); }
    }
  }

  function enqueuePut(task) {
    const pending = putTail.then(task, task);
    putTail = pending.catch(() => {});
    return pending;
  }

  async function drain(operation) {
    while (valid(operation)) {
      const current = getCurrent();
      if (!current?.dirty) { status = 'saved'; return true; }
      if (!owned(current)) {
        syncError = 'This draft is not linked to this account. Import it explicitly before syncing.';
        return false;
      }
      if (conflict) return false;
      const id = current.id;
      const snapshot = copy(current.saved);
      const snapshotText = serialized(snapshot);
      const revision = current.revision;
      status = 'saving';
      syncError = '';
      notify();
      try {
        const result = await enqueuePut(() => {
          if (!sameCourse(operation, id)) return null;
          return request(ENDPOINT, 'PUT', { id, revision, saved: snapshot }, operation.ownerId);
        });
        if (!result || !sameCourse(operation, id)) return false;
        const course = result.course;
        if (!course || course.id !== id || !Number.isInteger(course.revision)) throw new Error('Invalid saved course response');
        const unchanged = serialized(getCurrent().saved) === snapshotText;
        updateMeta({ revision: course.revision, updatedAt: course.updatedAt, dirty: !unchanged });
        rememberCourse({ ...course, saved: course.saved || snapshot });
        notify();
      } catch (failure) {
        if (sameCourse(operation, id)) fail(failure, operation, true);
        return false;
      }
    }
    return false;
  }

  function flush() {
    stopTimer();
    if (!getCurrent()?.dirty) return Promise.resolve(true);
    if (!userId()) return Promise.resolve(false);
    if (flushTask && valid(flushTask)) {
      if (flushTask.id === getCurrent()?.id) return flushTask.promise;
      const waiting = token();
      return flushTask.promise.then(() => valid(waiting) ? flush() : false);
    }
    const operation = { ...token(), id: getCurrent()?.id };
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
    if (!conflict) timer = setTimeout(() => { timer = null; void flush(); }, debounceMs);
    notify();
    return true;
  }

  async function open(id, discard = false) {
    if (!userId() || !id) return false;
    const operation = { ...token(), selection: ++selection };
    openTask = operation;
    const active = () => valid(operation) && operation.selection === selection;
    stopTimer();
    error = '';
    notify();
    try {
      if (discard) {
        // Finish any already-sent PUT before asking for the version to restore.
        if (flushTask) await flushTask.promise;
      } else if (!await flush()) return false;
      if (!active()) return false;
      const before = fingerprint(getCurrent());
      const result = await request(`${ENDPOINT}?id=${encodeURIComponent(id)}`, 'GET', undefined, operation.ownerId);
      if (!active()) return false;
      if (fingerprint(getCurrent()) !== before) {
        error = 'Your draft changed while the course was loading. Save it, then try opening the course again.';
        return false;
      }
      if (!result.course || result.course.id !== id) throw new Error('Invalid course response');
      setCurrent(result.course, operation.ownerId);
      conflict = false;
      syncError = '';
      status = 'saved';
      rememberCourse(result.course);
      return true;
    } catch (failure) {
      if (active()) fail(failure, operation);
      return false;
    } finally {
      if (openTask === operation) { openTask = null; notify(); }
    }
  }

  async function accept(course) {
    if (!userId() || !course?.id || !course.saved) return false;
    const operation = token();
    stopTimer();
    selection++;
    openTask = null;
    setCurrent(course, userId());
    conflict = false;
    error = syncError = '';
    status = 'saved';
    rememberCourse(course);
    notify();
    await refresh();
    return sameCourse(operation, course.id);
  }

  async function createCopy(saved) {
    if (!userId() || !saved) return false;
    stopTimer();
    const operation = { ...token(), selection: ++selection };
    openTask = operation;
    const original = getCurrent();
    const originalId = original?.id, originalOwner = original?.ownerId;
    const snapshot = copy(saved);
    const basedOnCurrent = original && serialized(original.saved) === serialized(snapshot);
    const active = () => valid(operation) && operation.selection === selection
      && getCurrent()?.id === originalId && getCurrent()?.ownerId === originalOwner;
    error = '';
    notify();
    try {
      if (!active()) return false;
      const result = await request(ENDPOINT, 'POST', { saved: snapshot }, operation.ownerId);
      if (!active()) return false;
      if (!result.course?.id || !result.course.saved) throw new Error('Invalid copied course response');
      const latest = getCurrent();
      const edited = basedOnCurrent && serialized(latest.saved) !== serialized(snapshot);
      const course = edited ? { ...result.course, saved: copy(latest.saved) } : result.course;
      setCurrent(course, operation.ownerId);
      conflict = false;
      error = syncError = '';
      status = 'saved';
      rememberCourse(result.course);
      if (edited) changed();
      notify();
      await refresh();
      return sameCourse(operation, course.id);
    } catch (failure) {
      if (active()) fail(failure, operation, true);
      return false;
    } finally {
      if (openTask === operation) { openTask = null; notify(); }
    }
  }

  async function setUser(nextUser) {
    const nextId = nextUser?.id ?? null;
    if (nextId !== userId()) {
      stopTimer();
      generation++;
      selection++;
      courses = [];
      acknowledgements = new Map();
      error = syncError = '';
      conflict = false;
      status = 'idle';
      listTask = openTask = flushTask = null;
    }
    user = nextUser || null;
    notify();
    if (!nextId) return true;
    const current = getCurrent();
    const reconcile = owned(current) ? current.dirty ? flush() : open(current.id) : Promise.resolve(true);
    const results = await Promise.all([refresh(), reconcile]);
    return results.every(Boolean);
  }

  return {
    setUser, changed, flush, accept, refresh,
    load: id => open(id),
    loadLatest: () => owned(getCurrent()) ? open(getCurrent().id, true) : Promise.resolve(false),
    importLocal: saved => createCopy(saved),
    saveCopy: () => owned(getCurrent()) ? createCopy(getCurrent().saved) : Promise.resolve(false),
    screen: () => ({
      user, loading: Boolean(listTask), error, courses, syncError, conflict,
      status: conflict ? 'conflict' : flushTask || timer !== null ? 'saving' : listTask || openTask ? 'loading' : status,
      currentId: owned(getCurrent()) ? getCurrent().id : null,
      dirty: Boolean(owned(getCurrent()) && getCurrent().dirty),
      busy: flushTask ? 'saving' : openTask ? 'opening' : listTask ? 'loading' : null,
    }),
  };
}
