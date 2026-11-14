import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { planApi } from '../backend/plan-api.js';
import { reviewWithDeepSeek, taskReviewApi } from '../backend/task-review-api.js';
import { restorePlan } from '../core/learning-plan.js';

const source = 'https://docs.python.org/3/tutorial/controlflow.html';
const draft = {
  title: 'Циклы Python', outcome: 'Написать цикл по списку',
  steps: Array.from({ length: 4 }, (_, index) => ({
    title: `Шаг ${index + 1}`, instruction: 'Прочитай пример цикла.',
    task: 'Напиши свой цикл и запиши вывод.', criterion: 'Для трёх элементов вывод содержит три строки.',
    sourceUrl: index === 0 ? source : 'https://made-up.example.org/cycle', minutes: 999,
  })),
};

function modelResponse(steps, { search = true, opened = true } = {}) {
  return Response.json({ choices: [{
    finish_reason: 'stop', message: {
      content: JSON.stringify({ ...draft, steps }),
      server_tool_calls: search ? [{ calls: [{
        type: 'deepseek_web_search', kind: 'deep_search', status: 'completed', action: { type: 'search' },
        sources: [{ type: 'url', url: source, title: 'Python Tutorial' }],
      }, {
        type: 'deepseek_web_search', kind: 'deep_search', status: opened ? 'completed' : 'failed',
        action: { type: 'open_page', url: source }, page: { url: source, title: 'Python Tutorial' },
      }, {
        type: 'deepseek_web_search', kind: 'deep_search', status: 'completed',
        action: { type: 'open_page' }, page: { url: 'https://made-up.example.org/cycle', title: 'Unsearched page' },
      }] }] : [],
    },
  }] });
}

test('the research agent builds timed lessons using sources it both found and opened', async () => {
  for (const [minutes, count] of [[5, 2], [10, 3], [20, 4]]) {
    const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes }, 'test-only',
      async (url, options) => {
        assert.equal(url, 'https://api.deepseek.com/chat/completions');
        const request = JSON.parse(options.body);
        assert.deepEqual(request.tools, [{ type: 'deepseek_web_search' }]);
        assert.equal(request.thinking.type, 'enabled');
        assert.match(request.messages[0].content, /site:github\.com/);
        assert.equal(JSON.parse(request.messages[1].content).minutes, minutes);
        return modelResponse(draft.steps.slice(0, count));
      });
    assert.equal(plan.steps.length, count);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
    assert.deepEqual(plan.steps.filter(step => step.resource).map(step => step.resource.url), [source]);
  }
  await assert.rejects(generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only',
    async () => modelResponse(draft.steps.slice(0, 2), { search: false })));
  await assert.rejects(generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only',
    async () => modelResponse(draft.steps.slice(0, 2), { opened: false })), /missing opened lesson sources/);
});

test('a saved plan restores answers and opens the first unfinished task', async () => {
  const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 10 }, 'test-only',
    async () => modelResponse(draft.steps.slice(0, 3)));
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

test('task review validates submissions and uses the AI quota on guest requests', async () => {
  const input = { goal: 'Python', task: 'Напиши цикл', criterion: 'Выведи три строки', answer: 'Вывод: a, b, c', language: 'kk' };
  const request = (body, origin = 'https://mindora.test') => new Request('https://mindora.test/api/task-review', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const feedback = { observation: 'Указаны три значения.', nextAction: 'Проверь разделение на строки.' };
  let calls = 0;
  const configured = {
    apiKey: 'test-only', databaseUrl: 'test-only', reserve: async () => true,
    review: async raw => { calls++; assert.deepEqual(raw, input); return feedback; },
  };
  assert.equal((await taskReviewApi(request({ ...input, answer: ' ' }), configured)).status, 400);
  assert.equal((await taskReviewApi(request(input, 'https://other.test'), configured)).status, 403);
  assert.equal((await taskReviewApi(request(input), { ...configured, apiKey: '' })).status, 503);
  assert.equal((await taskReviewApi(request(input), { ...configured, reserve: async () => false })).status, 429);
  assert.equal(calls, 0);
  assert.deepEqual(await (await taskReviewApi(request({ ...input, account: 'ignored' }), configured)).json(), { review: feedback });
  assert.equal(calls, 1);
});

test('a localized plan preserves its language through generation and browser restore', async () => {
  const input = { goal: 'Python циклдерін үйрену', minutes: 5, language: 'kk' };
  const plan = await generateDeepSeekPlan(input, 'test-only', async (_, options) => {
    const request = JSON.parse(options.body);
    assert.match(request.messages[0].content, /in Kazakh/);
    assert.deepEqual(JSON.parse(request.messages[1].content), input);
    return modelResponse(draft.steps.slice(0, 2));
  });
  assert.equal(restorePlan({ plan, answers: [], completed: 0 }).plan.language, 'kk');
});

test('the endpoint validates input and limits provider requests before calling DeepSeek', async () => {
  let calls = 0;
  const request = (minutes, origin = 'https://mindora.test') => new Request('https://mindora.test/api/learning-plan', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ goal: 'Освоить циклы', minutes }),
  });
  const configured = { apiKey: 'test-only', databaseUrl: 'test-only', generate: async () => { calls++; return { title: 'Маршрут' }; } };
  assert.equal((await planApi(request(99), configured)).status, 400);
  assert.equal((await planApi(request(5, 'https://other.test'), configured)).status, 403);
  assert.equal((await planApi(request(5), { ...configured, apiKey: '' })).status, 503);
  assert.equal((await planApi(request(5), { ...configured, reserve: async () => false })).status, 429);
  assert.equal(calls, 0);
  assert.equal((await planApi(request(5), { ...configured, reserve: async () => true })).status, 200);
  assert.equal(calls, 1);
});
