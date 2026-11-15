import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { finishedSteps, learningStepIndex } from '../core/progress.js';
import * as model from '../core/learning-plan.js';
import * as assessmentModel from '../core/lesson-assessment.js';
import { createPracticeController } from '../core/practice-controller.js';

// Exercise the real controller and event handlers with DOM/network ports only.
const source = readFileSync(new URL('../core/plan-controller.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '').replace('export function createPlanController', 'function createPlanController');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const feedback = { observation: 'The loop uses every item.', nextAction: 'Try a list with four items.' };

function plan({ detailed = true, minutes = 10, goal = 'Learn Python loops', assessment } = {}) {
  const url = 'https://docs.python.org/3/tutorial/controlflow.html';
  const teaching = {
    why: 'Repeat an operation for every item.',
    example: { input: 'names = ["Ada", "Lin"]', output: 'Ada\nLin', explanation: 'Each iteration prints one name.' },
    ...(assessment ? { assessment } : {
      checkpoint: { question: 'How many lines are printed?', choices: ['One', 'Two', 'Three'], correctIndex: 1, explanation: 'The list contains two names.' },
    }),
    takeaway: 'The loop visits every list item.',
  };
  return model.normalizePlan({
    ...(detailed ? { formatVersion: assessment ? 3 : 2 } : {}), title: 'Python loops', outcome: 'Write your own loop.',
    steps: model.PLAN_DURATIONS[minutes].map((_, index, steps) => ({
      title: `Task ${index + 1}`, instruction: 'A for loop processes each list item.',
      task: 'Write a loop over three names and record its output.', criterion: 'The output contains three lines.',
      sourceUrl: index === 0 ? url : '', ...(detailed && index < steps.length - 1 ? { teaching } : {}),
    })),
  }, { goal, minutes, language: 'en' }, new Map([[url, { url, title: 'Python tutorial' }]]));
}

function controller(initial = { plan: plan() }, { confirm = true, fetch: fetchPort } = {}) {
  const state = { minutes: 10, language: 'en', learningPlan: clone(initial) };
  const listeners = new Map(), elements = new Map(), requests = [], confirmations = [];
  let stored = clone(state), saves = 0, renders = 0, open = true;
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, { focusCount: 0, focus() { this.focusCount++; }, remove() { elements.delete(selector); } });
    return elements.get(selector);
  }
  const document = {
    addEventListener(type, handler) { listeners.set(type, [...listeners.get(type) || [], handler]); },
    getElementById(id) { return id === 'learning-page-title' && state.learningPlan?.completed === state.learningPlan?.plan.steps.length ? null : element(`#${id}`); },
    querySelector: element,
  };
  const context = vm.createContext({
    ...model, ...assessmentModel, finishedSteps, learningStepIndex, createPracticeController, document, message: value => value,
    window: { confirm: message => { confirmations.push(message); return confirm; } },
    AbortSignal: { timeout: () => undefined },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return fetchPort ? fetchPort(url, options) : { ok: true, json: async () => ({ review: feedback }) };
    },
  });
  new vm.Script(source, { filename: 'core/plan-controller.js' }).runInContext(context);
  const api = context.createPlanController({
    state, save() { saves++; stored = clone(state); }, render() { renders++; }, isOpen: () => open,
  });
  function emit(type, target) {
    for (const listener of listeners.get(type) || []) listener({ target, preventDefault() {} });
  }
  return {
    state, requests, confirmations, element, api,
    get screen() { return api.screen(); },
    get saved() { return state.learningPlan; },
    get persisted() { return clone(stored.learningPlan); },
    get saves() { return saves; },
    get renders() { return renders; },
    setOpen(value) { open = value; },
    click(dataset, disabled = false) {
      const target = { dataset, disabled, closest: selector => Object.entries({ learningPage: 'data-learning-page', learningChoice: 'data-learning-choice', learningOrder: 'data-learning-order', learningStep: 'data-learning-step' })
        .some(([key, attribute]) => key in dataset && selector.includes(`[${attribute}]`)) ? target : null };
      emit('click', target);
    },
    match(left, value) { emit('change', { dataset: { learningMatch: String(left) }, value }); },
    gap(value) { emit('input', { dataset: { learningGap: '' }, value }); },
    input(answer) { emit('input', { form: { id: 'learning-step-form' }, name: 'answer', value: answer }); },
    submit(answer) { emit('submit', { id: 'learning-step-form', elements: { answer: { value: answer } } }); },
    submitPlan(goal, minutes) { emit('submit', { id: 'learning-plan-form', elements: { goal: { value: goal }, minutes: { value: String(minutes) } } }); },
  };
}

function practice(run) {
  run.click({ learningPage: 'next' });
  run.click({ learningPage: 'next' });
  run.click({ learningChoice: '1' });
  run.click({ learningPage: 'check' });
  run.click({ learningPage: 'next' });
}

test('detailed cards gate practice on a correct checked answer and preserve review/edit/continue', async () => {
  const run = controller();
  run.click({ learningPage: 'back' });
  run.submit('A forged practice answer');
  run.input('A forged draft');
  run.click({ learningChoice: '1' });
  assert.equal(run.saved.study[0].page, 0);
  assert.equal(run.saved.answers[0], '');
  assert.equal(run.requests.length, 0);

  run.click({ learningPage: 'next' });
  assert.equal(run.saved.study[0].page, 1);
  run.click({ learningPage: 'next' });
  run.click({ learningPage: 'check' });
  assert.equal(run.saved.study[0].checked, false);
  run.click({ learningChoice: '0' });
  run.click({ learningPage: 'check' });
  assert.equal(run.persisted.study[0].checked, true);
  assert.equal(run.persisted.study[0].choice, 0);
  run.click({ learningPage: 'next' });
  run.click({ learningStep: 'continue' });
  run.submit('Still a forged practice answer');
  assert.equal(run.saved.study[0].page, 2);
  assert.equal(run.saved.completed, 0);
  assert.equal(run.requests.length, 0);

  run.click({ learningChoice: '1' });
  assert.equal(run.persisted.study[0].checked, false);
  run.click({ learningPage: 'next' });
  assert.equal(run.saved.study[0].page, 2);
  run.click({ learningPage: 'check' });
  run.click({ learningPage: 'next' });
  assert.equal(run.saved.study[0].page, 3);
  assert.ok(run.element('#learning-page-title').focusCount >= 5);
  run.click({ learningPage: 'next' });
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved.study[0].page, 3);
  assert.equal(run.saved.completed, 0);
  run.input('Print Ada, Lin and Sam');
  assert.equal(run.persisted.answers[0], 'Print Ada, Lin and Sam');
  run.submit('Print Ada, Lin and Sam');
  assert.equal(run.screen.busy, 'review');
  run.click({ learningPage: 'back' });
  assert.equal(run.saved.study[0].page, 3);
  await flush();
  assert.equal(run.requests.length, 1);
  assert.equal(run.requests[0].url, '/api/task-review');
  assert.equal(run.saved.reviews[0].observation, feedback.observation);
  assert.equal(run.element('#learning-review-status').focusCount, 1);

  run.click({ learningPage: 'back' });
  run.click({ learningStep: 'continue' });
  run.click({ learningStep: 'edit' });
  assert.equal(run.saved.completed, 0);
  assert.ok(run.saved.reviews[0]);
  run.click({ learningPage: 'next' });
  run.click({ learningStep: 'edit' });
  assert.equal(run.persisted.reviews[0], null);
  run.input('Revised output: Ada, Lin, Sam');
  run.submit('Revised output: Ada, Lin, Sam');
  await flush();
  run.click({ learningStep: 'continue' });
  assert.equal(run.persisted.completed, 1);
  assert.equal(run.persisted.study[1].page, 0);
  assert.equal(run.requests.length, 2, 'only explicit reviews call an API');
});

test('reload restores local checkpoint feedback, draft, and the first unfinished card', async () => {
  const first = controller();
  first.click({ learningPage: 'next' });
  first.click({ learningPage: 'next' });
  first.click({ learningChoice: '2' });
  first.click({ learningPage: 'check' });
  const second = controller(first.persisted);
  assert.deepEqual(clone(second.saved.study[0]), { page: 2, choice: 2, checked: true });
  second.click({ learningPage: 'next' });
  assert.equal(second.saved.study[0].page, 2);
  second.click({ learningChoice: '1' });
  second.click({ learningPage: 'check' });
  second.click({ learningPage: 'next' });
  second.input('Unfinished loop');
  const third = controller(second.persisted);
  assert.equal(third.saved.study[0].page, 3);
  assert.equal(third.saved.answers[0], 'Unfinished loop');
  third.submit('Completed loop');
  await flush();
  third.click({ learningStep: 'continue' });
  third.click({ learningPage: 'next' });
  const fourth = controller(third.persisted);
  assert.equal(fourth.saved.completed, 1);
  assert.equal(fourth.saved.study[1].page, 1);
  assert.equal(fourth.saved.reviews[0].answer, 'Completed loop');
  assert.equal(fourth.requests.length, 0);
});

test('live template controls persist attempts and require a checked correct result before recap and practice', () => {
  const exerciseCases = [
    { exercise: { type: 'choice', options: ['A', 'B', 'C'], answer: 2 },
      tryWrong: run => run.click({ learningChoice: '0' }), solve: run => run.click({ learningChoice: '2' }), response: 2 },
    { exercise: { type: 'multi-choice', options: ['A', 'B', 'C'], answers: [0, 2] },
      tryWrong: run => run.click({ learningChoice: '0' }), solve: run => run.click({ learningChoice: '2' }), response: [0, 2] },
    { exercise: { type: 'order', items: ['Step B', 'Step C', 'Step A'], answer: [2, 0, 1] },
      tryWrong: run => run.click({ learningOrder: '0', direction: '-1' }),
      solve: run => {
        run.click({ learningOrder: '2', direction: '-1' });
        run.click({ learningOrder: '1', direction: '-1' });
      }, response: [2, 0, 1] },
    { exercise: { type: 'match', left: ['First', 'Second', 'Third'], right: ['B', 'C', 'A'], answer: [2, 0, 1] },
      tryWrong: run => { run.match(0, '0'); run.match(1, '1'); run.match(2, '2'); },
      solve: run => { run.match(0, '2'); run.match(1, '0'); run.match(2, '1'); }, response: [2, 0, 1] },
    { exercise: { type: 'gap-fill', before: 'for n ', after: ' names:', accepted: ['in'] },
      tryWrong: run => run.gap('by'), solve: run => run.gap('in'), response: 'in' },
  ];
  for (const { exercise, tryWrong, solve, response } of exerciseCases) {
    const assessment = { ...exercise, question: 'Apply the rule from the example.', explanation: 'The example uses this rule.' };
    const first = controller({ plan: plan({ assessment }) });
    first.click({ learningPage: 'next' });
    first.click({ learningPage: 'next' });
    tryWrong(first);
    first.click({ learningPage: 'check' });
    first.click({ learningPage: 'next' });
    assert.equal(first.saved.study[0].page, 2, exercise.type);
    assert.equal(first.saved.study[0].checked, true, exercise.type);
    const resumed = controller(first.persisted);
    assert.deepEqual(clone(resumed.saved.study[0]), first.persisted.study[0], exercise.type);
    solve(resumed);
    assert.deepEqual(resumed.persisted.study[0].response, response, exercise.type);
    resumed.click({ learningPage: 'next' });
    assert.equal(resumed.saved.study[0].page, 2);
    resumed.click({ learningPage: 'check' });
    resumed.click({ learningPage: 'next' });
    assert.equal(resumed.saved.study[0].page, 3);
    resumed.click({ learningPage: 'next' });
    resumed.input('My own result from practice');
    assert.equal(controller(resumed.persisted).saved.answers[0], 'My own result from practice');
    assert.equal(resumed.requests.length, 0, 'interactive checks use no network');
  }
});

test('legacy plans resume answers and feedback without acquiring a checkpoint', async () => {
  const oldPlan = plan({ detailed: false });
  const run = controller({ plan: oldPlan, answers: ['First answer', 'Saved draft'], completed: 1 });
  assert.equal(run.saved.completed, 1);
  assert.equal(run.saved.study[1].page, 0);
  run.click({ learningPage: 'next' });
  assert.equal(run.saved.study[1].page, 1);
  assert.equal(run.saved.answers[1], 'Saved draft');
  run.submit('Saved draft');
  await flush();
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved.completed, 2);
  assert.equal(run.saved.study[2].page, 0, 'independent work opens directly on practice');
  run.submit('Independent answer');
  await flush();
  run.click({ learningStep: 'continue' });
  assert.equal(run.persisted.completed, 3);
  assert.equal(run.element('#learning-plan-complete').focusCount, 1);
});

test('review failure allows explicit continue from practice without inventing feedback', async () => {
  const run = controller({ plan: plan({ minutes: 5 }), answers: ['Already finished'], completed: 1 }, {
    fetch: async () => ({ ok: false, json: async () => ({ error: 'Review unavailable' }) }),
  });
  run.input('Independent result');
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved.completed, 1);
  run.submit('Independent result');
  await flush();
  assert.equal(run.screen.reviewError, 'Review unavailable');
  assert.equal(run.saved.reviews[1], null);
  run.click({ learningStep: 'continue' });
  assert.equal(run.persisted.completed, 2);
  assert.equal(run.persisted.reviews[1], null);
  assert.equal(run.screen.reviewError, '');
});

test('hidden screens and disabled or invalid events cannot navigate or submit', () => {
  const run = controller();
  run.click({ learningPage: 'next' }, true);
  run.click({ learningPage: 'practice' });
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved.study[0].page, 0);
  practice(run);
  run.setOpen(false);
  run.click({ learningPage: 'back' });
  run.input('Hidden draft');
  run.submit('Hidden answer');
  assert.equal(run.saved.study[0].page, 3);
  assert.equal(run.saved.answers[0], '');
  assert.equal(run.requests.length, 0);
});

test('generation initializes study, preserves same-goal progress, and confirms replacement', async () => {
  const generated = plan({ goal: 'Build a Python loop' });
  const run = controller(null, { fetch: async () => ({ ok: true, json: async () => ({ plan: generated }) }) });
  run.submitPlan('Build a Python loop', 10);
  await flush();
  assert.equal(run.saved.plan.formatVersion, 2);
  assert.deepEqual(clone(run.persisted.study), Array.from({ length: 3 }, () => ({ page: 0, choice: null, checked: false })));
  run.click({ learningPage: 'next' });
  await run.api.generate('Build a Python loop', 10);
  assert.equal(run.requests.length, 1);
  assert.equal(run.saved.study[0].page, 1);
  const declined = controller(run.persisted, { confirm: false });
  await declined.api.generate('Learn another skill', 10);
  assert.equal(declined.confirmations.length, 1);
  assert.equal(declined.requests.length, 0);
  assert.equal(declined.saved.plan.goal, 'Build a Python loop');
});

test('an old generation response cannot replace newer saved state', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const run = controller(null, { fetch: () => pending });
  const operation = run.api.generate('Original request', 10);
  const newer = model.restorePlan({ plan: plan({ goal: 'Newer saved goal' }) });
  run.state.learningPlan = newer;
  resolve({ ok: true, json: async () => ({ plan: plan({ goal: 'Original request' }) }) });
  await operation;
  assert.equal(run.saved, newer);
  assert.equal(run.saves, 0);
  assert.equal(run.screen.busy, null);
  assert.equal(run.screen.error, '');
});

test('an old review cannot mutate or show an error on a replacement lesson', async () => {
  for (const ok of [true, false]) {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const run = controller(undefined, { fetch: () => pending });
    practice(run);
    run.submit('Old answer');
    const older = run.saved;
    const newer = model.restorePlan({ plan: plan({ goal: 'Replacement goal' }) });
    run.state.learningPlan = newer;
    const before = run.saves;
    resolve({ ok, json: async () => ({ review: feedback, error: 'Stale failure' }) });
    await flush();
    assert.equal(run.saved, newer);
    assert.equal(older.reviews[0], null);
    assert.equal(run.saves, before);
    assert.equal(run.screen.reviewError, '');
    assert.equal(run.screen.busy, null);
  }
});

test('a later task keeps its answer and credit across reload without completing earlier tasks', async () => {
  const run = controller({ plan: plan(), selected: 2 });
  assert.equal(learningStepIndex(run.saved), 2);
  run.submit('My own final mini-project');
  await flush();
  run.click({ learningStep: 'continue' });
  assert.deepEqual([...run.saved.finished], [2]);
  assert.equal(run.saved.completed, 1);
  const restored = controller(run.persisted);
  assert.equal(learningStepIndex(restored.saved), 0);
  assert.equal(restored.saved.answers[2], 'My own final mini-project');
  assert.equal(restored.saved.answers[0], '');
});
