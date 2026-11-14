import test from 'node:test';
import assert from 'node:assert/strict';
import { planApi } from '../backend/plan-api.js';
import { taskReviewApi } from '../backend/task-review-api.js';
import { learningCoursesApi } from '../backend/learning-courses-api.js';
import { learningWorkspaceApi } from '../backend/learning-workspace-api.js';

const settings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' };
const request = (path, body) => new Request('https://mindora.test/api/' + path, {
  method: 'POST', headers: { origin: 'https://mindora.test', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('generation and review require a verified account before any quota or provider call', async () => {
  let calls = 0;
  const dependencies = {
    settings, databaseUrl: settings.databaseUrl, apiKey: 'test-only',
    session: async () => ({ user: null, cookies: ['session=; Max-Age=0'] }),
    reserve: async () => { calls++; return false; },
    generate: async () => { calls++; }, review: async () => { calls++; },
  };
  for (const [api, path, body] of [
    [planApi, 'learning-plan', { goal: 'Python loops', minutes: 5, userId: 'forged-account' }],
    [taskReviewApi, 'task-review', { goal: 'Python', task: 'Write a loop', criterion: 'Print two names', answer: 'Ada\nLin', userId: 'forged-account' }],
  ]) {
    const response = await api(request(path, body), dependencies);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
    assert.deepEqual(response.headers.getSetCookie(), ['session=; Max-Age=0']);
  }
  assert.equal(calls, 0);
});

test('a stale or missing expected account is rejected before reads, writes, quota or AI calls', async () => {
  let calls = 0;
  const dependencies = {
    settings, apiKey: 'test-only', session: async () => ({ user: { id: 'cookie-account-b' }, cookies: [] }),
    reserve: async () => { calls++; return true; }, generate: async () => { calls++; }, review: async () => { calls++; },
    store: () => { calls++; throw new Error('A mismatched account must not reach storage'); },
  };
  for (const [api, path, method] of [
    [planApi, 'learning-plan', 'POST'], [taskReviewApi, 'task-review', 'POST'],
    [learningCoursesApi, 'learning-courses', 'GET'], [learningCoursesApi, 'learning-courses', 'POST'],
    [learningCoursesApi, 'learning-courses', 'PUT'], [learningWorkspaceApi, 'learning-workspace', 'GET'],
    [learningWorkspaceApi, 'learning-workspace', 'PUT'],
  ]) {
    for (const owner of [null, 'stale-account-a']) {
      const response = await api(new Request('https://mindora.test/api/' + path, { method, headers: {
        origin: 'https://mindora.test', ...(owner ? { 'X-Mindora-Account': owner } : {}),
      } }), dependencies);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, 'ACCOUNT_CHANGED');
    }
  }
  assert.equal(calls, 0);
});
