import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekClarification, generateDeepSeekRoadmap, roadmapApi } from '../backend/roadmap-api.js';
import { clarificationInput, normalizeClarification, roadmapInput } from '../core/roadmap-model.js';
import { roadmapView } from '../ui/roadmap.js';

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

const clarification = {
  question: 'What would you like to build with Python?',
  directions: [
    { title: 'Automate a list', goal: 'Write a Python shopping-list helper', diagnosticQuestion: 'What does len([1, 2, 3]) return, and why?' },
    { title: 'Make a calculator', goal: 'Build a small Python cost calculator', diagnosticQuestion: 'What does 5 + 2 * 3 return, and why?' },
    { title: 'Sort expenses', goal: 'Group expenses using Python', diagnosticQuestion: 'What does [3, 1][0] return, and why?' },
  ],
};

test('clarification enforces account identity and validates distinct practical directions', async () => {
  let calls = 0;
  const body = { action: 'clarify', goal: 'Python', minutes: 5, language: 'ru' };
  const dependencies = { apiKey: 'test-only', settings, session,
    clarify: async data => { calls++; assert.deepEqual(data, { goal: 'Python', minutes: 5, language: 'ru' }); return clarification; },
  };
  assert.equal((await roadmapApi(create(body, 'other-account'), dependencies)).status, 401);
  assert.equal((await roadmapApi(create({ ...body, goal: 'x'.repeat(181) }), dependencies)).status, 400);
  assert.equal((await roadmapApi(create({ ...body, minutes: 15 }), dependencies)).status, 400);
  assert.equal((await roadmapApi(create(body), { ...dependencies, apiKey: '' })).status, 503);
  assert.equal(calls, 0);
  const response = await roadmapApi(create(body), dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { clarification });
  assert.equal(calls, 1);
  const invalid = { ...clarification, directions: [clarification.directions[0], clarification.directions[0], clarification.directions[1]] };
  assert.equal(normalizeClarification(invalid), null);
  assert.equal((await roadmapApi(create(body), { ...dependencies, clarify: async () => invalid })).status, 502);
});

test('clarification prompts preserve concrete intent and require self-contained starting checks', async () => {
  const data = { goal: 'Build a meal-budget calculator in Python', minutes: 10, language: 'en' };
  const result = await generateDeepSeekClarification(data, 'test-only', async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const { messages } = JSON.parse(init.body);
    assert.match(messages[0].content, /keep its exact intent in the first direction/);
    assert.match(messages[0].content, /Include all data needed/);
    assert.match(messages[0].content, /untrusted data/);
    assert.match(messages[0].content, /Each direction goal must explicitly name the subject or tool/);
    assert.deepEqual(JSON.parse(messages[1].content), data);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(clarification) } }] });
  });
  assert.deepEqual(result, clarification);
  assert.deepEqual(clarificationInput(data), data);
});

test('both direction selection and path generation stay within the available practice editors', async () => {
  const data = { ...input, goal: 'Python: process CSV files and rename photos' };
  for (const [generate, response] of [[generateDeepSeekClarification, clarification], [generateDeepSeekRoadmap, providerRoadmap]]) {
    await generate(data, 'test-only', async (url, init) => {
      const { messages } = JSON.parse(init.body);
      const prompt = messages[0].content;
      assert.match(prompt, /literal sample data in memory and print\(\) output/);
      assert.match(prompt, /No input\(\), stdin, user filesystem access/);
      assert.match(prompt, /syntactically valid minimal Python/);
      assert.match(prompt, /Preserve newlines and indentation using escaped newline characters in JSON strings/);
      assert.match(prompt, /Never compress compound statements such as for, if or def onto a semicolon-separated line/);
      assert.match(prompt, /deterministic, evaluable result/);
      assert.match(prompt, /network requests, package installation/);
      assert.match(prompt, /CSV is relevant, supply it as an embedded string/);
      assert.match(prompt, /clearly labeled simulation with a list of filenames/);
      assert.match(prompt, /Other programming languages support writing code, an expected result and an explanation only/);
      assert.match(prompt, /Numeric practice supports a result, calculation steps and units/);
      assert.match(prompt, /exactly three color roles \(background, text, accent\), a headline and a written rationale/);
      assert.match(prompt, /Do not promise freehand drawing, arbitrary page layouts, image editing, file or screenshot uploads/);
      assert.match(prompt, /Writing and other subjects use a text response with a concrete deliverable/);
      assert.deepEqual(JSON.parse(messages[1].content), data);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }] });
    });
  }
});

test('a diagnostic is a bounded pair; legacy questionnaire inputs remain supported', async () => {
  const answer = { ...input, originalGoal: 'Spreadsheets', diagnosticQuestion: 'What is SUM(2,3)? Explain.', diagnosticAnswer: '5, because it adds both numbers.' };
  assert.deepEqual(roadmapInput(answer), answer);
  assert.deepEqual(roadmapInput(input), input);
  for (const patch of [{ diagnosticAnswer: '' }, { diagnosticQuestion: undefined }, { diagnosticAnswer: 'x'.repeat(601) }, { originalGoal: '' }]) {
    assert.equal(roadmapInput({ ...answer, ...patch }), null);
  }
  const response = await roadmapApi(create(answer), { apiKey: 'test-only', settings, session,
    generate: async data => { assert.deepEqual(data, answer); return providerRoadmap; },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).roadmap.originalGoal, answer.originalGoal);
});

test('AI directions, the original topic and diagnostic input render as text', () => {
  const injection = '<img src=x onerror=alert(1)>';
  const wizard = { step: 1, originalGoal: injection, goal: 'Python', direction: '0', minutes: 5,
    clarification: { ...clarification, question: injection }, diagnosticQuestion: injection, diagnosticAnswer: injection,
  };
  for (const directionConfirmed of [false, true]) {
    const html = roadmapView({ wizard: { ...wizard, directionConfirmed } });
    assert.equal(html.includes(injection), false);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, directionConfirmed ? /name="diagnosticAnswer"/ : /name="direction"/);
  }
});
