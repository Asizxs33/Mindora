import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { planApi } from '../backend/plan-api.js';
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

function modelResponse(steps, { search = true } = {}) {
  return Response.json({ choices: [{
    finish_reason: 'stop', message: {
      content: JSON.stringify({ ...draft, steps }),
      server_tool_calls: search ? [{ calls: [{
        type: 'deepseek_web_search', status: 'completed', sources: [{ type: 'url', url: source, title: 'Python Tutorial' }],
      }] }] : [],
    },
  }] });
}

test('DeepSeek plans use the selected total time and link only to URLs returned by web search', async () => {
  for (const [minutes, count] of [[5, 2], [10, 3], [20, 4]]) {
    const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes }, 'test-only',
      async (url, options) => {
        assert.equal(url, 'https://api.deepseek.com/chat/completions');
        const request = JSON.parse(options.body);
        assert.deepEqual(request.tools, [{ type: 'deepseek_web_search' }]);
        assert.equal(JSON.parse(request.messages[1].content).minutes, minutes);
        return modelResponse(draft.steps.slice(0, count));
      });
    assert.equal(plan.steps.length, count);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
    assert.deepEqual(plan.steps.filter(step => step.resource).map(step => step.resource.url), [source]);
  }
  await assert.rejects(generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 5 }, 'test-only',
    async () => modelResponse(draft.steps.slice(0, 2), { search: false })));
});

test('a saved plan restores answers and opens the first unfinished task', async () => {
  const plan = await generateDeepSeekPlan({ goal: 'Освоить циклы', minutes: 10 }, 'test-only',
    async () => modelResponse(draft.steps.slice(0, 3)));
  const saved = restorePlan(JSON.parse(JSON.stringify({ plan, answers: ['Готово', 'Черновик ответа'], completed: 1 })));
  assert.equal(saved.completed, 1);
  assert.equal(saved.answers[saved.completed], 'Черновик ответа');
  assert.equal(restorePlan({ plan, answers: ['', 'Готово'], completed: 2 }).completed, 0);
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
