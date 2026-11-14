import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, restorePlan, PLAN_DURATIONS } from '../core/learning-plan.js';
import { learningCoursesApi } from '../backend/learning-courses-api.js';
import { learningCourseStore, normalizeSavedCourse, COURSE_MAX_BYTES } from '../backend/learning-course-store.js';
import { planApi } from '../backend/plan-api.js';

const settings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' };
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const source = 'https://docs.python.org/3/tutorial/controlflow.html';
const teaching = {
  why: 'A loop repeats an action for each item.',
  example: { input: "names = ['Ada', 'Lin']", output: 'Ada\nLin', explanation: 'The body prints the current name.' },
  checkpoint: { question: 'How many lines for two names?', choices: ['One', 'Two', 'Three'], correctIndex: 1, explanation: 'The body runs once for each name.' },
  takeaway: 'Use the current loop variable.',
};
function savedCourse(minutes = 10) {
  const plan = normalizePlan({ formatVersion: 2, title: 'Python loops', outcome: 'Print each item once.',
    steps: PLAN_DURATIONS[minutes].map((_, index, all) => ({ title: `Task ${index + 1}`, instruction: 'Indent the loop body.',
      task: 'Print each name and show the output.', criterion: 'One line per name.', sourceUrl: source,
      ...(index < all.length - 1 ? { teaching } : {}),
    })),
  }, { goal: 'Learn Python loops', minutes, language: 'en' }, new Map([[source, { url: source, title: 'Python tutorial' }]]));
  return restorePlan({ plan });
}

function request(method = 'GET', body, query = '', origin = 'https://mindora.test', owner = 'account-a') {
  return new Request('https://mindora.test/api/learning-courses' + query, {
    method, headers: { origin, 'content-type': 'application/json', 'X-Mindora-Account': owner },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// Exercise the real store and API against the SQL transport boundary. Assertions
// check the actual predicates and bindings, including owner and revision checks.
function database() {
  const rows = new Map();
  const queries = [];
  const sql = async (parts, ...values) => {
    const query = parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '').replace(/\s+/g, ' ').trim();
    queries.push({ query, values });
    if (query.startsWith('INSERT INTO public.mindora_learning_courses')) {
      assert.match(query, /VALUES \(\$1, \$2::uuid, \$3::jsonb\)/);
      assert.doesNotMatch(query, /ON CONFLICT.*DO UPDATE/);
      const [userId, id, json] = values;
      const key = userId + '/' + id;
      if (rows.has(key)) throw Object.assign(new Error('Duplicate course'), { code: '23505' });
      const row = { id, saved: JSON.parse(json), revision: 1, updatedAt: '2026-11-14T00:00:00.000Z' };
      rows.set(key, row);
      return [structuredClone(row)];
    }
    if (query.startsWith('UPDATE')) {
      assert.match(query, /WHERE user_id = \$2 AND id = \$3::uuid AND revision = \$4/);
      assert.match(query, /revision = revision \+ 1/);
      const [json, userId, id, revision] = values;
      const row = rows.get(userId + '/' + id);
      if (!row || row.revision !== revision) return [];
      Object.assign(row, { saved: JSON.parse(json), revision: revision + 1, updatedAt: '2026-11-14T00:01:00.000Z' });
      return [structuredClone(row)];
    }
    if (query.startsWith('SELECT id, saved,')) {
      assert.match(query, /WHERE user_id = \$1 AND id = \$2::uuid/);
      const row = rows.get(values[0] + '/' + values[1]);
      return row ? [structuredClone(row)] : [];
    }
    assert.match(query, /FROM public.mindora_learning_courses WHERE user_id = \$1 ORDER BY updated_at DESC, id DESC LIMIT \$2/);
    assert.equal(values[1], 100);
    return [...rows.entries()].filter(([key]) => key.startsWith(values[0] + '/')).map(([, row]) => ({
      id: row.id, title: row.saved.plan.title, goal: row.saved.plan.goal, minutes: row.saved.plan.minutes,
      language: row.saved.plan.language, completed: row.saved.completed, totalSteps: row.saved.plan.steps.length,
      revision: row.revision, updatedAt: row.updatedAt,
    }));
  };
  const store = learningCourseStore('test-only', { sql });
  return { rows, queries, store, dependencies: userId => ({ settings, session: async () => ({ user: userId ? { id: userId } : null, cookies: [] }), store: () => store }) };
}

test('generation saves separate account-owned courses before returning success', async () => {
  const db = database();
  let index = 0;
  const configured = { ...db.dependencies('account-a'), apiKey: 'test-only', createId: () => ids[index++],
    generate: async input => savedCourse(input.minutes).plan,
  };
  for (const minutes of [5, 20]) {
    const response = await planApi(request('POST', { goal: 'Python loops', minutes, userId: 'account-b' }), configured);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.plan, body.course.saved.plan);
    assert.equal(body.course.revision, 1);
    assert.equal(body.course.saved.completed, 0);
  }
  const listed = await (await learningCoursesApi(request(), db.dependencies('account-a'))).json();
  assert.deepEqual(listed.courses.map(course => course.id), ids);
  assert.deepEqual(listed.courses.map(course => course.totalSteps), [2, 4]);
  assert.equal(Object.hasOwn(listed.courses[0], 'saved'), false);
  assert.deepEqual(await (await learningCoursesApi(request('GET', undefined, '', undefined, 'account-b'), db.dependencies('account-b'))).json(), { courses: [] });
});

test('saved teaching, answers, feedback and study progress round-trip with optimistic locking', async () => {
  for (const minutes of [5, 10, 20]) {
    const db = database();
    const dependencies = { ...db.dependencies('account-a'), createId: () => ids[0] };
    const imported = await learningCoursesApi(request('POST', { saved: savedCourse(minutes), id: ids[1], userId: 'account-b' }), dependencies);
    assert.equal(imported.status, 200);
    const original = (await imported.json()).course;
    assert.equal(original.id, ids[0], 'the server owns the course ID');
    const saved = structuredClone(original.saved);
    saved.answers[0] = 'Ada\nLin';
    saved.reviews[0] = { answer: 'Ada\nLin', observation: 'Both names are present.', nextAction: 'Try a third name.' };
    saved.study[0] = { page: 3, choice: 1, checked: true };
    saved.completed = 1;
    const written = await learningCoursesApi(request('PUT', { id: original.id, revision: 1, saved, userId: 'account-b' }), dependencies);
    assert.equal(written.status, 200);
    const updated = (await written.json()).course;
    assert.equal(updated.revision, 2);
    assert.deepEqual(updated.saved, saved);
    const retry = await learningCoursesApi(request('PUT', { id: original.id, revision: 1, saved }), dependencies);
    assert.equal(retry.status, 200, 'an identical retry after a lost acknowledgement returns the persisted course');
    assert.deepEqual((await retry.json()).course, updated);
    const loaded = await learningCoursesApi(request('GET', undefined, '?id=' + original.id), dependencies);
    assert.deepEqual((await loaded.json()).course, updated);
    const stale = await learningCoursesApi(request('PUT', { id: original.id, revision: 1, saved: original.saved }), dependencies);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'CONFLICT');
    assert.deepEqual((await db.store.read('account-a', original.id)).saved, saved);
    assert.equal((await learningCoursesApi(request('GET', undefined, '?id=' + original.id, undefined, 'account-b'), db.dependencies('account-b'))).status, 404);
    assert.equal((await learningCoursesApi(request('PUT', { id: original.id, revision: 2, saved: original.saved }, '', undefined, 'account-b'), db.dependencies('account-b'))).status, 409);
    assert.deepEqual((await db.store.read('account-a', original.id)).saved, saved);
  }
});

test('course endpoints enforce auth, origin, UUID, revision and bounded valid saved state', async () => {
  const db = database();
  const saved = savedCourse();
  for (const method of ['GET', 'POST', 'PUT']) {
    const response = await learningCoursesApi(request(method, method === 'GET' ? undefined : { saved }), db.dependencies(null));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
  }
  assert.equal(db.queries.length, 0);
  const dependencies = db.dependencies('account-a');
  assert.equal((await learningCoursesApi(request('POST', { saved }, '', 'https://other.test'), dependencies)).status, 403);
  assert.equal((await learningCoursesApi(request('GET', undefined, '?id=invalid'), dependencies)).status, 400);
  for (const body of [
    { id: ids[0], revision: 0, saved }, { id: ids[0], revision: '1', saved },
    { id: 'invalid', revision: 1, saved }, { id: ids[0], revision: 1, saved: { plan: {} } },
    { id: ids[0], revision: 1, saved: { ...saved, answers: ['a'.repeat(1501)] } },
    { id: ids[0], revision: 1, saved, extra: 'a'.repeat(COURSE_MAX_BYTES) },
  ]) assert.equal((await learningCoursesApi(request('PUT', body), dependencies)).status, 400);
  assert.equal(db.queries.length, 0);
  assert.equal(normalizeSavedCourse({ ...saved, completed: -1 }), null);
  assert.equal(normalizeSavedCourse({ ...saved, plan: { ...saved.plan, formatVersion: 999 } }), null);
});

test('a complete detailed course larger than the default API body limit can be imported intact', async () => {
  const db = database();
  const saved = savedCourse(20);
  for (const step of saved.plan.steps) {
    step.instruction = 'У'.repeat(900);
    step.task = 'З'.repeat(900);
  }
  const body = { saved };
  assert.ok(Buffer.byteLength(JSON.stringify(body), 'utf8') > 16_384);
  assert.ok(Buffer.byteLength(JSON.stringify(body), 'utf8') < COURSE_MAX_BYTES);
  const response = await learningCoursesApi(request('POST', body), { ...db.dependencies('account-a'), createId: () => ids[0] });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).course.saved, saved);
});

test('generation does not report an unsaved course as successful', async () => {
  const response = await planApi(request('POST', { goal: 'Python loops', minutes: 5 }), {
    settings, session: async () => ({ user: { id: 'account-a' }, cookies: [] }), apiKey: 'test-only',
    generate: async () => savedCourse(5).plan,
    store: () => ({ create: async () => { throw new Error('Database offline'); } }),
  });
  assert.equal(response.status, 502);
  assert.equal(Object.hasOwn(await response.json(), 'plan'), false);
});

test('a missing course table is initialized with restricted access before retrying', async () => {
  let attempts = 0;
  let transaction;
  const sql = (parts, ...values) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT id,')) {
      attempts++;
      return attempts === 1 ? Promise.reject(Object.assign(new Error('Missing table'), { code: '42P01' })) : Promise.resolve([]);
    }
    return { query, values };
  };
  sql.transaction = async statements => { transaction = statements; };
  assert.deepEqual(await learningCourseStore('test-only', { sql }).list('account-a'), []);
  assert.equal(attempts, 2);
  const queries = transaction.map(item => item.query).join('\n');
  assert.match(queries, /pg_advisory_xact_lock/);
  assert.match(queries, /PRIMARY KEY \(user_id, id\)/);
  assert.match(queries, /REVOKE ALL ON public.mindora_learning_courses FROM PUBLIC/);
  assert.match(queries, /ENABLE ROW LEVEL SECURITY/);
});
