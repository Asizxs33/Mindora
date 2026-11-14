import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekRoadmap, roadmapApi } from '../backend/roadmap-api.js';

const input = {
  goal: 'Learn spreadsheet budgeting', minutes: 10, language: 'kk',
  experience: 'some', motivation: 'personal', evidence: 'I can already sum a column.',
};
const providerRoadmap = {
  level: 'intermediate', levelReason: 'The learner already uses a SUM formula.',
  title: 'Practical budgeting', outcome: 'Build a budget with a breakdown by category.',
  stages: [
    { title: 'Set up categories', objective: 'Label each expense with one category.' },
    { title: 'Sum each category', objective: 'Use SUMIF to calculate category totals.' },
    { title: 'Check the total', objective: 'Reconcile category totals against the whole sheet.' },
    { title: 'Build a monthly budget', objective: 'Create and verify your budget using fresh examples.' },
  ],
};
const settings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' };
const session = async () => ({ user: { id: 'account-a' }, cookies: ['session=verified'] });
const create = (body = input, account = 'account-a', origin = 'https://mindora.test') => new Request('https://mindora.test/api/learning-roadmap', {
  method: 'POST', headers: { origin, 'content-type': 'application/json', 'X-Mindora-Account': account }, body: JSON.stringify(body),
});

test('only a verified matching account with valid answers can invoke roadmap generation', async () => {
  let calls = 0;
  const dependencies = {
    apiKey: 'test-only', settings, session,
    generate: async data => { calls++; assert.deepEqual(data, input); return providerRoadmap; },
  };
  assert.equal((await roadmapApi(create(input, 'account-a', 'https://foreign.test'), dependencies)).status, 403);
  assert.equal((await roadmapApi(create({ ...input, experience: 'self-taught' }), dependencies)).status, 400);
  assert.equal((await roadmapApi(create(input, 'expired-user'), dependencies)).status, 401);
  assert.equal((await roadmapApi(create(), { ...dependencies, session: async () => ({ user: null, cookies: [] }) })).status, 401);
  assert.equal((await roadmapApi(create(), { ...dependencies, apiKey: '' })).status, 503);
  assert.equal(calls, 0);
  const response = await roadmapApi(create({ ...input, goal: '  ' + input.goal + ' ', age: 30 }), dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), ['session=verified']);
  assert.deepEqual(await response.json(), { roadmap: {
    goal: input.goal, minutes: input.minutes, language: input.language, ...providerRoadmap,
  } });
  assert.equal(calls, 1);
});

test('the roadmap uses onboarding evidence and requires a valid four-stage provider result', async () => {
  let requests = 0;
  const dependencies = {
    apiKey: 'test-only', settings, session,
    generate: (data, key) => generateDeepSeekRoadmap(data, key, async (url, init) => {
      requests++;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      const { messages } = JSON.parse(init.body);
      assert.match(messages[0].content, /Return only a JSON object/);
      assert.match(messages[0].content, /in Kazakh/);
      assert.match(messages[0].content, /exactly 4 distinct, ordered stages/);
      assert.match(messages[0].content, /10-minute practice session/);
      assert.match(messages[0].content, /Concrete examples of past work matter more/);
      assert.deepEqual(JSON.parse(messages[1].content), input);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(providerRoadmap) } }] });
    }),
  };
  assert.equal((await roadmapApi(create(), dependencies)).status, 200);
  assert.equal(requests, 1);
  const broken = await roadmapApi(create(), {
    ...dependencies,
    generate: async () => ({ ...providerRoadmap, stages: providerRoadmap.stages.slice(0, 3) }),
  });
  assert.equal(broken.status, 502);
  assert.equal((await broken.json()).code, 'ROADMAP_GENERATION_FAILED');
});
