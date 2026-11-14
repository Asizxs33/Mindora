import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { planApi } from '../backend/plan-api.js';
import { reviewWithDeepSeek, taskReviewApi } from '../backend/task-review-api.js';
import { restorePlan, taskReviewInput, normalizePlan } from '../core/learning-plan.js';
import { learningPlanView } from '../ui/learning-plan.js';

// Provider fixtures remain offline; public-page integration is tested separately.
const offlineReader = { readPage: async () => null, readRenderedPage: async () => null };
const accountSettings = { databaseUrl: 'test-only', baseUrl: 'https://auth.example.org', cookieSecret: 'test-only' };
const accountSession = async () => ({ user: { id: 'account-a' }, cookies: [] });

const source = 'https://docs.python.org/3/tutorial/controlflow.html';
const draft = {
  title: 'Циклы Python', outcome: 'Написать цикл по списку',
  steps: Array.from({ length: 4 }, (_, index) => ({
    title: `Шаг ${index + 1}`, instruction: 'Прочитай пример цикла.',
    task: 'Напиши свой цикл и запиши вывод.', criterion: 'Для трёх элементов вывод содержит три строки.',
    sourceId: index === 0 ? 0 : 999, minutes: 999,
    teaching: {
      why: 'Цикл выполняет одно действие для каждого элемента списка.',
      example: { input: "for name in ['A', 'B']:\n    print(name)", output: 'A\nB', explanation: 'Каждая итерация печатает один элемент.' },
      checkpoint: { question: 'Сколько строк напечатает этот цикл?', choices: ['Две', 'Одну', 'Ни одной'], correctIndex: 0, explanation: 'В списке два элемента, действие выполняется два раза.' },
      takeaway: 'Число итераций соответствует числу элементов списка.',
    },
  })),
};

const github = 'https://github.com/python/cpython/blob/main/Doc/tutorial/controlflow.rst';

function modelResponse(value) {
  return Response.json({ choices: [{
    finish_reason: 'stop', message: { content: JSON.stringify(value) },
  }] });
}

function researchFixture(steps, { readable = true, verify = () => {}, verifySearch = () => {} } = {}) {
  return async (url, options) => {
    const request = JSON.parse(options.body);
    if (url.endsWith('/v1/tools/search')) {
      assert.equal(request.need_content, true);
      return Response.json({ results: request.query.endsWith('site:github.com')
        ? [{ url: github, title: 'CPython tutorial' }]
        : [{ url: source, title: 'Python Tutorial', content: readable ? 'A for loop iterates over a sequence.' : '' }] });
    }
    if (url.endsWith('/v1/tools/fetch')) {
      if (!readable) return new Response(null, { status: 404 });
      assert.equal(request.url, github);
      return Response.json({ content: 'The for statement iterates over the items of a sequence.' });
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const input = JSON.parse(request.messages[1].content);
    if (!input.materials) {
      verifySearch(input);
      return modelResponse({ query: 'Python loops beginner guide', githubQuery: 'Python for loop tutorial' });
    }
    assert.deepEqual(input.materials.map(item => item.url), [source, github]);
    assert.match(input.materials[1].content, /items of a sequence/);
    verify(request, input);
    const guided = steps.slice(0, -1).map(step => {
      const { checkpoint, ...teaching } = step.teaching;
      const { question, choices, correctIndex, explanation } = checkpoint;
      return {
        ...step, teaching: { ...teaching, assessment: { type: 'choice', question, options: choices, answer: correctIndex, explanation } },
      };
    });
    return modelResponse({ formatVersion: 3, title: draft.title, outcome: draft.outcome, guided, final: steps.at(-1) });
  };
}

test('the research agent reads search results and GitHub before preparing timed lessons', async () => {
  for (const [minutes, count] of [[5, 2], [10, 3], [20, 4]]) {
    const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes }, 'test-only',
      researchFixture(draft.steps.slice(0, count), { verify: (_, input) => assert.equal(input.minutes, minutes) }), offlineReader);
    assert.equal(plan.steps.length, count);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
    assert.deepEqual(plan.steps.filter(step => step.resource).map(step => step.resource.url), [source]);
  }
  await assert.rejects(generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only',
    researchFixture(draft.steps.slice(0, 2), { readable: false }), offlineReader), /No readable learning materials/);
});

test('a saved plan restores answers and opens the first unfinished task', async () => {
  const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 10 }, 'test-only',
    researchFixture(draft.steps.slice(0, 3)), offlineReader);
  const saved = restorePlan(JSON.parse(JSON.stringify({ plan, answers: ['Готово', 'Черновик ответа'], completed: 1 })));
  assert.equal(saved.completed, 1);
  assert.equal(saved.answers[saved.completed], 'Черновик ответа');
  assert.equal(saved.plan.language, 'ru');
  assert.equal(restorePlan({ plan, answers: ['', 'Готово'], completed: 2 }).completed, 0);
  const review = { answer: 'Черновик ответа', observation: 'Есть пример.', nextAction: 'Добавь вывод.' };
  assert.deepEqual(restorePlan({ ...saved, reviews: [null, review] }).reviews, [null, review, null]);
  assert.deepEqual(restorePlan({
    ...saved, answers: ['Готово', 'Новый ответ'], reviews: [null, review],
  }).reviews, [null, null, null]);
});

test('malformed lesson JSON retries composition without repeating research or creating duplicate courses', async () => {
  const fixture = researchFixture(draft.steps.slice(0, 2));
  let compositions = 0, searches = 0, creates = 0;
  const fetcher = (url, options) => {
    const request = JSON.parse(options.body);
    if (url.endsWith('/v1/tools/search')) searches++;
    if (url.endsWith('/chat/completions') && JSON.parse(request.messages[1].content).materials) {
      compositions++;
      if (compositions === 1) return Promise.resolve(Response.json({ choices: [{
        finish_reason: 'stop', message: { content: '{"guided":[{"task":"print("Hello")"}]}' },
      }] }));
    }
    return fixture(url, options);
  };
  const request = new Request('https://mindora.test/api/learning-plan', {
    method: 'POST', headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
    body: JSON.stringify({ goal: 'Освоить циклы', minutes: 5 }),
  });
  const response = await planApi(request, {
    apiKey: 'test-only', settings: accountSettings, session: accountSession,
    generate: (input, key) => generateDeepSeekPlan(input, key, fetcher, offlineReader),
    store: () => ({ create: async (_owner, id, saved) => { creates++; return { id, saved, revision: 1 }; } }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual([compositions, searches, creates], [2, 2, 1]);
  assert.ok((await response.json()).plan.steps[0].resource);
});

test('a detailed independent task can be stored and sent for review', async () => {
  const steps = draft.steps.slice(0, 2);
  const longTask = 'Новый пример. '.repeat(40).trim();
  steps[1] = { ...steps[1], task: longTask };
  const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only', researchFixture(steps), offlineReader);
  const step = restorePlan({ plan }).plan.steps.at(-1);
  assert.equal(step.task, longTask);
  assert.equal(taskReviewInput({ ...step, goal: plan.goal, answer: 'Готово' }).task, longTask);
});

test('task review requests thinking mode and returns only shaped feedback', async () => {
  const input = { goal: 'Python', task: 'Напиши цикл', criterion: 'Выведи три строки', answer: 'Вывод: a, b, c' };
  const feedback = { observation: 'Указаны три значения.', nextAction: 'Покажи каждое значение с новой строки.' };
  const result = await reviewWithDeepSeek(input, 'test-only', async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const request = JSON.parse(options.body);
    assert.equal(request.thinking.type, 'enabled');
    assert.equal(request.response_format.type, 'json_object');
    assert.deepEqual(JSON.parse(request.messages[1].content), input);
    return Response.json({ choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify({ ...feedback, extra: 'ignored' }), reasoning_content: 'private' },
    }] });
  });
  assert.deepEqual(result, feedback);
  await assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => Response.json({
    choices: [{ finish_reason: 'length', message: { content: JSON.stringify(feedback) } }],
  })), /Incomplete DeepSeek review/);
});

test('task review validates submissions before calling DeepSeek', async () => {
  const input = { goal: 'Python', task: 'Напиши цикл', criterion: 'Выведи три строки', answer: 'Вывод: a, b, c', language: 'kk' };
  const request = (body, origin = 'https://mindora.test') => new Request('https://mindora.test/api/task-review', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' }, body: JSON.stringify(body),
  });
  const feedback = { observation: 'Указаны три значения.', nextAction: 'Проверь разделение на строки.' };
  let calls = 0;
  const configured = {
    apiKey: 'test-only', settings: accountSettings, session: accountSession,
    review: async raw => { calls++; assert.deepEqual(raw, input); return feedback; },
  };
  assert.equal((await taskReviewApi(request({ ...input, answer: ' ' }), configured)).status, 400);
  assert.equal((await taskReviewApi(request(input, 'https://other.test'), configured)).status, 403);
  assert.equal((await taskReviewApi(request(input), { ...configured, apiKey: '' })).status, 503);
  assert.equal(calls, 0);
  assert.deepEqual(await (await taskReviewApi(request({ ...input, account: 'ignored' }), configured)).json(), { review: feedback });
  assert.equal(calls, 1);
});

test('a localized plan preserves its language through generation and browser restore', async () => {
  const input = { goal: 'Python циклдерін үйрену', minutes: 5, language: 'kk' };
  const plan = await generateDeepSeekPlan(input, 'test-only', researchFixture(draft.steps.slice(0, 2), { verify: (request, body) => {
    assert.match(request.messages[0].content, /in Kazakh/);
    assert.equal(body.language, input.language);
    assert.equal(body.goal, input.goal);
  } }), offlineReader);
  assert.equal(restorePlan({ plan, answers: [], completed: 0 }).plan.language, 'kk');
});

test('the generation endpoint validates input before calling DeepSeek', async () => {
  let calls = 0;
  const request = (minutes, origin = 'https://mindora.test') => new Request('https://mindora.test/api/learning-plan', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
    body: JSON.stringify({ goal: 'Освоить циклы', minutes }),
  });
  const configured = {
    apiKey: 'test-only', settings: accountSettings, session: accountSession,
    generate: async input => {
      calls++;
      return normalizePlan({ ...draft, formatVersion: 2, steps: draft.steps.slice(0, 2).map(step => ({ ...step, sourceUrl: source })) },
        input, new Map([[source, { url: source, title: 'Python tutorial' }]]));
    },
    store: () => ({ create: async (_userId, id, saved) => ({ id, saved, revision: 1, updatedAt: '2026-11-14T00:00:00.000Z' }) }),
  };
  assert.equal((await planApi(request(99), configured)).status, 400);
  assert.equal((await planApi(request(5, 'https://other.test'), configured)).status, 403);
  assert.equal((await planApi(request(5), { ...configured, apiKey: '' })).status, 503);
  assert.equal(calls, 0);
  assert.equal((await planApi(request(5), configured)).status, 200);
  assert.equal(calls, 1);
});

test('roadmap stages use the saved objective and level to research and compose one focused lesson', async () => {
  const roadmapStage = {
    goal: 'Summarize report rows', originalGoal: 'Python', title: 'Work with indexes',
    objective: 'Add row numbers using enumerate.',
    level: 'intermediate', levelReason: 'Already comfortable with lists and simple for loops.',
    previousStages: [{ title: 'Read report rows', objective: 'Store report rows in a list.' }],
  };
  const goal = 'Summarize report rows / Work with indexes';
  const create = stage => new Request('https://mindora.test/api/learning-plan', {
    method: 'POST', headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
    body: JSON.stringify({ goal, minutes: 5, language: 'en', roadmapStage: stage }),
  });
  const configured = {
    apiKey: 'test-only', settings: accountSettings, session: accountSession,
    generate: (input, key) => generateDeepSeekPlan(input, key, researchFixture(draft.steps.slice(0, 2), {
      verifySearch(input) {
        const { levelReason, previousStages, ...expectedSearch } = roadmapStage;
        assert.deepEqual(input.stage, expectedSearch);
      },
      verify(request, input) {
        assert.deepEqual(input.roadmapStage, roadmapStage);
        assert.match(request.messages[0].content, /Teach only the selected roadmap stage objective/);
        assert.match(request.messages[0].content, /Build on those skills/);
      },
    }), offlineReader),
    store: () => ({ create: async (_userId, id, saved) => ({ id, saved, revision: 1 }) }),
  };
  const invalid = await planApi(create({ ...roadmapStage, level: 'expert' }), configured);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_ROADMAP_STAGE');
  for (const previousStages of ['invalid', Array(4).fill(roadmapStage.previousStages[0]), [{ title: 'Broken', objective: '' }], [{ title: 'x'.repeat(76), objective: 'Too long' }]]) {
    assert.equal((await planApi(create({ ...roadmapStage, previousStages }), configured)).status, 400);
  }
  const response = await planApi(create(roadmapStage), configured);
  assert.equal(response.status, 200);
  const { plan, course } = await response.json();
  assert.equal(plan.goal, goal);
  assert.equal(plan.roadmapStage, undefined);
  assert.deepEqual(course.saved.plan, plan);
  assert.equal(plan.steps[0].resource.url, source);
});

test('generation and review surface a 429 from DeepSeek', async () => {
  const unavailable = async () => { throw Object.assign(new Error('DeepSeek is busy'), { providerStatus: 429 }); };
  const configured = { apiKey: 'test-only', settings: accountSettings, session: accountSession, generate: unavailable, review: unavailable };
  for (const [api, path, body] of [
    [planApi, 'learning-plan', { goal: 'Learn Python', minutes: 5 }],
    [taskReviewApi, 'task-review', { goal: 'Python', task: 'Write a loop', criterion: 'Print two names', answer: 'Ada\nLin' }],
  ]) {
    const request = new Request(`https://mindora.test/api/${path}`, {
      method: 'POST',
      headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' },
      body: JSON.stringify(body),
    });
    const response = await api(request, configured);
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: 'ИИ занят. Попробуй немного позже.' });
  }
});

test('illustrations bind to retrieved sources and survive reload without crossing sources', () => {
  const first = { url: 'https://docs.python.org/first.png', alt: 'First example' };
  const second = { url: 'https://docs.python.org/second.png', alt: 'Second example' };
  const input = { goal: 'Освоить циклы', minutes: 20, language: 'ru' };
  const sources = new Map([[source, { url: source, title: 'Tutorial', images: [first, second] }]]);
  const steps = draft.steps.map((step, index) => ({ ...step, sourceUrl: source,
    illustrationUrls: index === 0 ? [first.url, 'https://unread.org/invented.png'] : index === 1 ? [second.url] : [],
  }));
  const plan = normalizePlan({ ...draft, steps }, input, sources);
  assert.deepEqual(plan.steps[0].resource.images, [first]);
  assert.deepEqual(plan.steps[1].resource.images, [second]);
  assert.deepEqual(plan.steps[2].resource.images, []);
  const saved = restorePlan(JSON.parse(JSON.stringify({ plan, answers: ['Answer'], completed: 1 })));
  assert.deepEqual(saved.plan, plan);
  assert.equal(saved.completed, 1);
  const unsafe = structuredClone(plan);
  unsafe.steps[0].resource.images.push({ url: 'javascript:alert(1)', alt: 'Unsafe' });
  assert.deepEqual(restorePlan({ plan: unsafe }).plan.steps[0].resource.images, [first]);
  const restored = restorePlan({ plan });
  const rendered = learningPlanView({ goal: plan.goal, minutes: plan.minutes, saved: restored });
  assert.match(rendered, /<img src="https:\/\/docs\.python\.org\/first\.png" alt="First example"/);
  assert.ok(rendered.indexOf(steps[0].instruction) < rendered.indexOf('<figure'));
  assert.ok(!rendered.includes(steps[0].task), 'practice is revealed after the explanation, on its own screen');
  assert.match(rendered, /referrerpolicy="no-referrer"/);
  restored.study[0].page = 1;
  const practice = learningPlanView({ goal: plan.goal, minutes: plan.minutes, saved: restored });
  assert.ok(practice.includes(steps[0].task));
  assert.ok(!practice.includes('<figure'), 'source images stay with the explanation');
});

test('the agent selects a discovered illustration by ID and cannot invent its URL', async () => {
  const steps = structuredClone(draft.steps.slice(0, 2));
  steps[0].imageIds = [0, 999];
  steps[0].illustrationUrls = ['https://invented.org/fake.png'];
  const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only', researchFixture(steps, {
    verify: (_, input) => {
      assert.equal(input.materials[0].images[0].caption, 'Loop diagram');
      assert.equal(input.materials[0].images[0].id, 0);
    },
  }), { ...offlineReader, readPage: async url => url === source ? {
    url, contentType: 'text/markdown',
    body: 'A for loop iterates over a sequence. Write the loop and check every item.\n\n![Loop diagram](./loop.png)',
  } : null });
  assert.deepEqual(plan.steps[0].resource.images, [{ url: 'https://docs.python.org/3/tutorial/loop.png', alt: 'Loop diagram' }]);
});
