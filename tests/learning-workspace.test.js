import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBuiltinWorkspace, WORKSPACE_MAX_BYTES } from '../backend/builtin-workspace.js';
import { learningWorkspaceStore } from '../backend/learning-workspace-store.js';
import { buyRewardItem } from '../core/roadmap-rewards.js';
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
  const shield = buyRewardItem(undefined,'mistake-shield',Date.parse(date));
  const purchases = buyRewardItem(shield,'lesson-bonus',Date.parse(date));
  const changed = { ...data, notes: { budget: 'Updated note' }, learningRewards:purchases };
  assert.equal((await learningWorkspaceApi(request('PUT', { data: changed, revision: null }), a)).status, 409);
  assert.equal((await learningWorkspaceApi(request('PUT', { data: changed, revision: 1 }), a)).status, 200);
  const updateRetry = await learningWorkspaceApi(request('PUT', { data: changed, revision: 1 }), a);
  assert.equal(updateRetry.status, 200, 'retrying a committed update returns its existing revision');
  assert.deepEqual((await updateRetry.json()).workspace, { data: changed, revision: 2, updatedAt: date });
  assert.equal((await learningWorkspaceApi(request('PUT', { data, revision: 1 }), a)).status, 409);
  assert.equal((await learningWorkspaceApi(request('PUT', { data, revision: 2 }, 'account-b'), b)).status, 409);
  const reloaded = (await (await learningWorkspaceApi(request('GET'), a)).json()).workspace;
  assert.deepEqual(reloaded.data.learningRewards, purchases);
  assert.deepEqual([reloaded.data.learningRewards.gems,reloaded.data.learningRewards.shields,reloaded.data.learningRewards.bonusLessons], [8,1,3]);
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

test('streamed workspaces preserve multiple long verified courses beyond 98KiB and reject a 1MiB overflow before storage', async () => {
  const id = number => `30000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  const roadmaps = Array.from({ length: 8 }, (_, course) => ({
    id: id(course + 1), goal: `Learn Python through practical project ${course + 1}`, originalGoal: 'Python',
    minutes: [5, 10, 20][course % 3], language: 'en', curriculumVersion: 2,
    title: `Python project course ${course + 1}`, outcome: 'Build and explain a useful program independently.',
    level: 'beginner', levelReason: 'The learner is starting from lists and simple arithmetic.',
    modules: Array.from({ length: 8 }, (_, module) => ({ title: `Module ${module + 1}: applied Python`,
      outcome: 'Combine the concepts practiced in this module into a small working program.', startIndex: module * 6, count: 6 })),
    sourceStatus: 'verified', sources: [{ title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }],
    stages: Array.from({ length: 48 }, (_, stage) => ({ title: `Lesson ${stage + 1}: practice a new Python operation`,
      objective: `Task ${stage + 1}: write a small program using literal data, explain how each operation changes the result, compare the printed output with your expected values, and revise one input to demonstrate that the solution generalizes.` })),
    progress: Array.from({ length: 48 }, (_, stage) => ({ courseId: stage < 12 ? id(1000 + course * 100 + stage) : null, completed: stage < 12 })),
  }));
  const data = { ...workspace(), learningRoadmap: roadmaps[0], learningRoadmaps: roadmaps.slice(1) };
  assert.deepEqual(validateBuiltinWorkspace(data), data, 'all course metadata and saved stage IDs are valid');
  const encoded = new TextEncoder().encode(JSON.stringify({ data, revision: null }));
  assert.ok(encoded.byteLength > 98_304, `fixture must exceed the previous shared body limit: ${encoded.byteLength}`);
  assert.ok(encoded.byteLength < WORKSPACE_MAX_BYTES);
  assert.equal(WORKSPACE_MAX_BYTES, 1_048_576);
  function streamedRequest(bytes) {
    const stats = { offset: 0, cancelled: false };
    const stream = new ReadableStream({ pull(controller) {
      if (stats.offset === bytes.length) return controller.close();
      const end = Math.min(stats.offset + 16_384, bytes.length);
      controller.enqueue(bytes.subarray(stats.offset, end));
      stats.offset = end;
    }, cancel() { stats.cancelled = true; } });
    return { stats, request: new Request('https://mindora.test/api/learning-workspace', {
      method: 'PUT', body: stream, duplex: 'half',
      headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
    }) };
  }
  let saved = null, writes = 0;
  const store = { read: async owner => {
    assert.equal(owner, 'account-a'); return structuredClone(saved);
  }, write: async (owner, value, revision) => {
    assert.equal(owner, 'account-a'); assert.equal(revision, null); writes++;
    saved = { data: structuredClone(value), revision: 1, updatedAt: date };
    return structuredClone(saved);
  } };
  const dependencies = { settings, session: async () => ({ user: { id: 'account-a' }, cookies: [] }), store: () => store };
  const upload = streamedRequest(encoded);
  const response = await learningWorkspaceApi(upload.request, dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).workspace.data, data);
  assert.equal(upload.stats.cancelled, false);
  const reopened = await learningWorkspaceApi(request(), dependencies);
  assert.equal(reopened.status, 200);
  assert.deepEqual((await reopened.json()).workspace, { data, revision: 1, updatedAt: date });

  const oversized = new TextEncoder().encode(JSON.stringify({ data, revision: 1, padding: 'x'.repeat(WORKSPACE_MAX_BYTES) }));
  const overflow = streamedRequest(oversized);
  const rejected = await learningWorkspaceApi(overflow.request, dependencies);
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, 'INVALID_WORKSPACE');
  assert.equal(overflow.stats.cancelled, true, 'the reader stops an oversized stream early');
  assert.ok(overflow.stats.offset < oversized.length, 'the reader does not consume the entire oversized request');
  assert.equal(writes, 1, 'an oversized payload never reaches storage');
  assert.deepEqual(saved.data, data, 'the valid saved courses remain intact');
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
