import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBuiltinWorkspace, WORKSPACE_MAX_BYTES } from '../backend/builtin-workspace.js';
import { learningWorkspaceStore } from '../backend/learning-workspace-store.js';
import { learningWorkspaceApi } from '../backend/learning-workspace-api.js';

const settings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' };
const date = '2026-11-14T08:00:00.000Z';
const poster = { title: 'Coffee Saturday', subtitle: 'Fresh coffee from 10 am', cta: 'Visit this Saturday', titleSize: 34, subtitleSize: 16,
  textColor: '#263c31', bgColor: '#f7d667', seed: 0 };
const budget = { values: [10, 20.5, null], formula: '=SUM(B2:B4)', answer: '30.5', balance: '-10.5', seed: 3, checked: true };
function workspace() {
  return { minutes: 20, active: 'budget', goals: { design: 'Make a poster', budget: 'Track expenses' }, progress: { design: 4, budget: 3 },
    drafts: { 'design-practice': poster, 'design-challenge': { ...poster, seed: 2 }, 'budget-challenge-20': budget },
    works: { design: { data: poster, challenge: true, savedAt: date }, budget: { data: { ...budget, values: [10, 20.5, 1], limit: 320 }, challenge: false, savedAt: date } },
    notes: { design: 'Make the title readable.', budget: 'Check the range.' },
    sessions: { budget: { lastSeen: Date.parse(date), cursor: { step: 1, page: 0, minutes: 20, quizIndex: 3, quizChoice: 1, quizFeedback: true } } },
    certificates: { design: { name: 'Alex Learner', completedAt: date, certificateId: 'MD-DESIGN-1234ABCD' } },
    practiceCount: 2, studyDays: ['2026-11-13', '2026-11-14'], budgetQuiz: { 20: { index: 3, choice: 1, feedback: true } },
    budgetActivity: { view: 'lesson', step: 3 },
  };
}
function request(method = 'GET', body, owner = 'account-a', origin = 'https://mindora.test') {
  return new Request('https://mindora.test/api/learning-workspace', { method,
    headers: { origin, 'content-type': 'application/json', 'X-Mindora-Account': owner },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('built-in course data preserves drafts, quiz cursors, works and certificates while excluding unrelated state', () => {
  const data = workspace();
  assert.deepEqual(validateBuiltinWorkspace(data), data);
  assert.deepEqual(validateBuiltinWorkspace({ ...data, learningPlan: { secret: 'Other lesson' }, learningCourse: { id: 'other' }, userId: 'forged', language: 'ru' }), data);
  assert.deepEqual(validateBuiltinWorkspace({}), { minutes: 10, active: null, goals: {}, progress: { design: 0, budget: 0 }, drafts: {}, works: {}, notes: {},
    sessions: {}, certificates: {}, practiceCount: 0, studyDays: [], budgetQuiz: {} });
  for (const minutes of [5, 10, 20]) assert.equal(validateBuiltinWorkspace({ minutes }).minutes, minutes);
});

test('invalid nested state, unsafe keys, unbounded values and oversized payloads are rejected', () => {
  const invalid = [
    { progress: { design: 5 } }, { progress: [] }, { active: 'other' }, { practiceCount: Infinity },
    { goals: { design: 'x'.repeat(181) } }, { notes: { design: 'x'.repeat(601) } },
    { drafts: { 'unknown-draft': poster } }, { drafts: { 'design-practice': { ...poster, titleSize: NaN } } },
    { drafts: { 'budget-practice': { ...budget, values: [1, 2] } } },
    { drafts: { 'budget-practice': { ...budget, values: [1, -2, 3] } } },
    { works: { budget: { data: { ...budget, limit: Infinity }, challenge: true, savedAt: date } } },
    { sessions: { design: { lastSeen: 10, cursor: { step: 0, quizIndex: 3 } } } },
    { certificates: { design: { name: 'Alex', completedAt: 'not a date', certificateId: 'MD-DESIGN-1234' } } },
    { budgetQuiz: { 5: { index: 1, choice: 0, feedback: true } } },
    { budgetActivity: { view: 'other', step: 1 } }, { studyDays: ['2026-2-30'] },
    { extra: 'x'.repeat(WORKSPACE_MAX_BYTES) }, JSON.parse('{"drafts":{"__proto__":{"polluted":true}}}'),
    { notes: Object.create({ design: 'Inherited value' }) },
  ];
  for (const value of invalid) assert.equal(validateBuiltinWorkspace(value), null);
  assert.equal({}.polluted, undefined);
});

test('workspace API and real SQL store isolate accounts and enforce insert/update revisions', async () => {
  const rows = new Map();
  const sql = async (parts, ...values) => {
    const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT')) {
      assert.match(query, /WHERE user_id = \$1$/);
      return rows.has(values[0]) ? [structuredClone(rows.get(values[0]))] : [];
    }
    if (query.startsWith('INSERT')) {
      assert.match(query, /VALUES \(\$1, \$2::jsonb\) ON CONFLICT \(user_id\) DO NOTHING/);
      if (rows.has(values[0])) return [];
      const row = { data: JSON.parse(values[1]), revision: 1, updatedAt: date };
      rows.set(values[0], row); return [structuredClone(row)];
    }
    assert.match(query, /WHERE user_id = \$2 AND revision = \$3/);
    assert.match(query, /revision = revision \+ 1/);
    const row = rows.get(values[1]);
    if (!row || row.revision !== values[2]) return [];
    Object.assign(row, { data: JSON.parse(values[0]), revision: row.revision + 1 });
    return [structuredClone(row)];
  };
  const store = learningWorkspaceStore('test-only', { sql });
  const dependencies = owner => ({ settings, session: async () => ({ user: { id: owner }, cookies: [] }), store: () => store });
  const a = dependencies('account-a'), b = dependencies('account-b');
  assert.deepEqual(await (await learningWorkspaceApi(request(), a)).json(), { workspace: null });
  const data = workspace();
  const initial = await learningWorkspaceApi(request('PUT', { data, revision: null, userId: 'account-b' }), a);
  assert.equal(initial.status, 200);
  assert.deepEqual((await initial.json()).workspace, { data, revision: 1, updatedAt: date });
  assert.deepEqual(await (await learningWorkspaceApi(request('GET', undefined, 'account-b'), b)).json(), { workspace: null });
  const initialRetry = await learningWorkspaceApi(request('PUT', { data, revision: null }), a);
  assert.equal(initialRetry.status, 200, 'retrying a committed initial insert returns its existing revision');
  assert.equal((await initialRetry.json()).workspace.revision, 1);
  const changed = { ...data, notes: { budget: 'Updated note' } };
  assert.equal((await learningWorkspaceApi(request('PUT', { data: changed, revision: null }), a)).status, 409);
  assert.equal((await learningWorkspaceApi(request('PUT', { data: changed, revision: 1 }), a)).status, 200);
  const updateRetry = await learningWorkspaceApi(request('PUT', { data: changed, revision: 1 }), a);
  assert.equal(updateRetry.status, 200, 'retrying a committed update returns its existing revision');
  assert.deepEqual((await updateRetry.json()).workspace, { data: changed, revision: 2, updatedAt: date });
  assert.equal((await learningWorkspaceApi(request('PUT', { data, revision: 1 }), a)).status, 409);
  assert.equal((await learningWorkspaceApi(request('PUT', { data, revision: 2 }, 'account-b'), b)).status, 409);
  assert.deepEqual((await store.read('account-a')).data, changed);
  assert.equal((await store.read('account-a')).revision, 2);
});

test('workspace API rejects missing sessions, foreign origins and invalid bodies before storage', async () => {
  let calls = 0;
  const configured = { settings, session: async () => ({ user: { id: 'account-a' }, cookies: [] }), store: () => { calls++; } };
  assert.equal((await learningWorkspaceApi(request(), { ...configured, session: async () => ({ user: null, cookies: [] }) })).status, 401);
  assert.equal((await learningWorkspaceApi(request('PUT', { data: {}, revision: null }, 'account-a', 'https://other.test'), configured)).status, 403);
  for (const body of [{ data: {}, revision: 0 }, { data: {} }, { data: { progress: [] }, revision: null }, { data: {}, revision: null, extra: 'x'.repeat(WORKSPACE_MAX_BYTES) }]) {
    const response = await learningWorkspaceApi(request('PUT', body), configured);
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('missing built-in workspace table is created with RLS and public privileges revoked', async () => {
  let calls = 0, statements;
  const sql = parts => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT data')) return ++calls === 1 ? Promise.reject(Object.assign(new Error('missing'), { code: '42P01' })) : Promise.resolve([]);
    return query;
  };
  sql.transaction = async queries => { statements = queries.join('\n'); };
  assert.equal(await learningWorkspaceStore('test-only', { sql }).read('account-a'), null);
  assert.equal(calls, 2);
  assert.match(statements, /user_id text PRIMARY KEY/);
  assert.match(statements, /REVOKE ALL ON public.mindora_learning_workspaces FROM PUBLIC/);
  assert.match(statements, /ENABLE ROW LEVEL SECURITY/);
});
