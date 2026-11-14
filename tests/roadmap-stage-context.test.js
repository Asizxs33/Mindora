import test from 'node:test';
import assert from 'node:assert/strict';
import { planApi } from '../backend/plan-api.js';
import { normalizePlan } from '../core/learning-plan.js';

test('lesson generation validates and forwards original subject and stage kind while accepting legacy stages', async () => {
  const stage = {
    goal: 'Summarize a short list of expenses', title: 'Add the amounts',
    objective: 'Calculate a total from sample values.', level: 'beginner',
    levelReason: 'Start with supported examples.', previousStages: [],
  };
  const url = 'https://docs.python.org/3/tutorial/introduction.html';
  const calls = [];
  const dependencies = {
    apiKey: 'test-only', settings: { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' },
    session: async () => ({ user: { id: 'account-a' }, cookies: [] }),
    generate: async input => {
      calls.push(input.roadmapStage);
      return normalizePlan({
        title: 'Add sample amounts', outcome: 'Print a total.',
        steps: ['Try a sum', 'Use fresh data'].map(title => ({
          title, instruction: 'Add values from the sample list.', task: 'Print the total.',
          criterion: 'The total matches the sum of the supplied values.', sourceUrl: url,
        })),
      }, input, new Map([[url, { url, title: 'Python tutorial' }]]));
    },
    store: () => ({ create: async (_userId, id, saved) => ({ id, saved, revision: 1 }) }),
  };
  const request = roadmapStage => new Request('https://mindora.test/api/learning-plan', {
    method: 'POST', headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
    body: JSON.stringify({ goal: 'Add sample amounts', minutes: 5, language: 'en', roadmapStage }),
  });
  for (const originalGoal of ['', null, 'x'.repeat(181), 'Python\u0000']) {
    const response = await planApi(request({ ...stage, originalGoal }), dependencies);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_ROADMAP_STAGE');
  }
  for (const kind of ['', null, 'quiz', 'project', 'Review', ' lesson ', 2, { value: 'review' }]) {
    const response = await planApi(request({ ...stage, kind }), dependencies);
    assert.equal(response.status, 400, `reject unsupported kind ${JSON.stringify(kind)}`);
    assert.equal((await response.json()).code, 'INVALID_ROADMAP_STAGE');
  }
  assert.equal(calls.length, 0, 'invalid metadata must not invoke generation');
  assert.equal((await planApi(request(stage), dependencies)).status, 200);
  assert.equal((await planApi(request({ ...stage, originalGoal: ' Python ' }), dependencies)).status, 200);
  const kinds = ['lesson', 'practice', 'review', 'mini-project'];
  const previousStages = [{ title: 'Read a list', objective: 'Access the values in a literal list.' }];
  for (const kind of kinds) {
    assert.equal((await planApi(request({ ...stage, kind, originalGoal: 'Python', previousStages }), dependencies)).status, 200);
  }
  assert.deepEqual(calls, [stage, { ...stage, originalGoal: 'Python' },
    ...kinds.map(kind => ({ ...stage, kind, originalGoal: 'Python', previousStages }))]);
});
