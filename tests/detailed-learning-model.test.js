import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonPages, normalizePlan, PLAN_DURATIONS, restorePlan } from '../core/learning-plan.js';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';

const source = 'https://docs.python.org/3/tutorial/controlflow.html';
const image = { url: 'https://docs.python.org/3/_images/loop.png', alt: 'A loop printing three items' };
const sources = new Map([[source, { url: source, title: 'Python tutorial', images: [image] }]]);
const offlineReaders = { readPage: async () => null, readRenderedPage: async () => null };
const teaching = {
  why: 'A loop repeats one action for every item, without copying the action.',
  example: {
    input: "names = ['Ada', 'Lin']",
    output: 'for name in names:\n    print(name)\n\nOutput:\nAda\nLin',
    explanation: 'The loop takes each name in order and prints it on its own line.',
  },
  checkpoint: {
    question: 'What happens when the list contains three names?',
    choices: ['Only the first name is printed.', 'Each of the three names is printed.', 'The loop prints the number three.'],
    correctIndex: 1,
    explanation: 'The body runs once for each item. It does not stop after the first name.',
  },
  takeaway: 'Use the loop variable to work with the current item.',
};

function lessonDraft(minutes = 10, rich = true) {
  return {
    ...(rich ? { formatVersion: 2 } : {}),
    title: 'Repeat an action with a loop', outcome: 'Print a separate line for each item in a list.',
    steps: PLAN_DURATIONS[minutes].map((_, index, steps) => ({
      title: `Step ${index + 1}`, instruction: 'A for loop visits each item in order. Indent the action beneath it.',
      task: 'Write a loop over three different names and show its output.', criterion: 'Each name appears on a separate line.',
      sourceUrl: index === 0 ? source : null, illustrationUrls: index === 0 ? [image.url] : [],
      ...(rich && index < steps.length - 1 ? { teaching: structuredClone(teaching) } : {}),
    })),
  };
}

const inputFor = minutes => ({ goal: 'Learn Python loops', minutes, language: 'en' });
const normalize = (draft, minutes = 10) => normalizePlan(draft, inputFor(minutes), sources);

test('detailed lessons preserve typed teaching, source-bound images and duration totals', () => {
  for (const minutes of [5, 10, 20]) {
    const plan = normalize(lessonDraft(minutes), minutes);
    assert.equal(plan.formatVersion, 2);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
    assert.deepEqual(plan.steps[0].teaching, teaching);
    assert.deepEqual(plan.steps[0].resource.images, [image]);
    assert.deepEqual(lessonPages(plan.steps[0], false), ['explain', 'example', 'check', 'practice']);
    assert.deepEqual(lessonPages(plan.steps.at(-1), true), ['practice']);
    assert.equal(Object.hasOwn(plan.steps.at(-1), 'teaching'), false);
  }
});

test('detailed teaching rejects incomplete, oversized and ambiguous checkpoint content', () => {
  const invalid = [
    block => { delete block.why; },
    block => { block.why = 'x'.repeat(221); },
    block => { block.example.input = 'x'.repeat(501); },
    block => { block.example.output = 'x'.repeat(701); },
    block => { block.example.explanation = 'x'.repeat(401); },
    block => { block.checkpoint.question = 'x'.repeat(221); },
    block => { block.checkpoint.choices = ['One', 'Two']; },
    block => { block.checkpoint.choices = ['One', ' One ', 'Three']; },
    block => { block.checkpoint.choices[0] = 'x'.repeat(161); },
    block => { block.checkpoint.choices[0] = { text: 'One' }; },
    block => { block.checkpoint.correctIndex = '1'; },
    block => { block.checkpoint.correctIndex = 3; },
    block => { block.checkpoint.explanation = ' '; },
    block => { block.checkpoint.explanation = 'x'.repeat(321); },
    block => { block.takeaway = 'x'.repeat(221); },
  ];
  for (const mutate of invalid) {
    const draft = lessonDraft();
    mutate(draft.steps[0].teaching);
    assert.equal(normalize(draft), null);
  }
  const missing = lessonDraft();
  delete missing.steps[1].teaching;
  assert.equal(normalize(missing), null);
  assert.equal(normalize({ ...lessonDraft(), formatVersion: 3 }), null);
});

test('legacy lessons remain readable without new teaching and keep answers and reviews', () => {
  const plan = normalize(lessonDraft(10, false));
  assert.equal(Object.hasOwn(plan, 'formatVersion'), false);
  assert.deepEqual(lessonPages(plan.steps[0]), ['explain', 'practice']);
  const review = { answer: 'Ada\nLin', observation: 'Two lines are present.', nextAction: 'Try a third name.' };
  const restored = restorePlan({ plan, answers: ['Ada\nLin', 'Draft'], reviews: [review], completed: 1 });
  assert.deepEqual(restored.plan, plan);
  assert.deepEqual(restored.answers, ['Ada\nLin', 'Draft', '']);
  assert.deepEqual(restored.reviews, [review, null, null]);
  assert.equal(restored.completed, 1);
  assert.deepEqual(restored.study, Array.from({ length: 3 }, () => ({ page: 0, choice: null, checked: false })));
  const cursor = restorePlan({ plan, study: [{ page: 999, choice: 1, checked: true }] });
  assert.deepEqual(cursor.study[0], { page: 1, choice: null, checked: false });
});

test('restored detailed practice requires a checked correct answer and cannot award completion', () => {
  const plan = normalize(lessonDraft());
  const cases = [
    [{ page: 3 }, { page: 2, choice: null, checked: false }],
    [{ page: 3, choice: 0, checked: true }, { page: 2, choice: 0, checked: true }],
    [{ page: 3, choice: 1, checked: false }, { page: 2, choice: 1, checked: false }],
    [{ page: 3, choice: 1, checked: 'true' }, { page: 2, choice: 1, checked: false }],
    [{ page: 3, choice: '1', checked: true }, { page: 2, choice: null, checked: false }],
    [{ page: 999, choice: 1, checked: true }, { page: 3, choice: 1, checked: true }],
    [{ page: -2, choice: -1, checked: true }, { page: 0, choice: null, checked: false }],
    [{ page: 1.5, choice: 3, checked: true }, { page: 0, choice: null, checked: false }],
  ];
  for (const [entry, expected] of cases) {
    const restored = restorePlan({ plan, completed: 0, study: [entry] });
    assert.deepEqual(restored.study[0], expected);
    assert.equal(restored.completed, 0);
  }
  const restored = restorePlan({ plan, study: [null, null, { page: 3, choice: 1, checked: true }] });
  assert.deepEqual(restored.study[2], { page: 0, choice: null, checked: false });
});

function response(value) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
}

function modelFixture(minutes, { resultUrl = source, resultContent, fetchedContent, verify = () => {}, mutate = () => {} } = {}) {
  const content = resultContent ?? 'A for loop visits each item in a sequence and performs its indented action once for each item.';
  const calls = [];
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    if (url.endsWith('/v1/tools/search')) return Response.json({ results: [{ url: resultUrl, title: 'A beginner guide', content }] });
    if (url.endsWith('/v1/tools/fetch')) return fetchedContent === false ? new Response(null, { status: 404 })
      : Response.json({ content: fetchedContent ?? 'English article: a loop repeats the indented action for each item in a sequence.' });
    const input = JSON.parse(body.messages[1].content);
    if (!input.materials) return response({ query: 'Python loop official beginner guide', githubQuery: '' });
    verify(body, input);
    const draft = lessonDraft(minutes);
    const guided = draft.steps.slice(0, -1).map(step => ({ ...step, sourceId: 0, imageIds: [] }));
    const composed = { title: draft.title, outcome: draft.outcome, guided, final: draft.steps.at(-1) };
    mutate(composed);
    return response(composed);
  };
  return { fetcher, calls };
}

test('the composer requests teaching pages within bounded output budgets for every session size', async () => {
  for (const [minutes, maxTokens] of [[5, 3500], [10, 5000], [20, 6500]]) {
    const fixture = modelFixture(minutes, { verify: (body, input) => {
      assert.equal(body.max_tokens, maxTokens);
      assert.equal(input.minutes, minutes);
      const prompt = body.messages[0].content;
      assert.match(prompt, /formatVersion: 2/);
      assert.match(prompt, /"example"/);
      assert.match(prompt, /"checkpoint"/);
      assert.match(prompt, /"takeaway"/);
      assert.match(prompt, /four pages/);
      assert.match(prompt, /source filenames/);
    } });
    const plan = await generateDeepSeekPlan(inputFor(minutes), 'test-only', fixture.fetcher, offlineReaders);
    assert.equal(plan.formatVersion, 2);
    assert.deepEqual(plan.steps[0].teaching, teaching);
    assert.equal(plan.steps.at(-1).teaching, undefined);
  }
});

test('the composer states accepted lesson and final-task text limits for every session size', async () => {
  const title = 'T'.repeat(90);
  const outcome = 'O'.repeat(450);
  const final = { title: 'F'.repeat(90), task: 'A'.repeat(900), criterion: 'C'.repeat(320) };
  for (const minutes of [5, 10, 20]) {
    const fixture = modelFixture(minutes, {
      verify: body => {
        const prompt = body.messages[0].content;
        const lessonContract = prompt.split('\n').find(line => line.startsWith('Return a JSON object'));
        const finalContract = prompt.split('\n').find(line => line.startsWith('The final object'));
        assert.match(lessonContract, /title \(up to 90 characters\)/);
        assert.match(lessonContract, /outcome \(up to 450 characters\)/);
        assert.match(finalContract, /title \(up to 90 characters\)/);
        assert.match(finalContract, /task \(up to 900 characters\)/);
        assert.match(finalContract, /criterion \(up to 320 characters\)/);
      },
      mutate: composed => Object.assign(composed, { title, outcome, final }),
    });
    const plan = await generateDeepSeekPlan(inputFor(minutes), 'test-only', fixture.fetcher, offlineReaders);
    assert.equal(plan.title, title);
    assert.equal(plan.outcome, outcome);
    assert.equal(plan.steps.at(-1).title, final.title);
    assert.equal(plan.steps.at(-1).task, final.task);
    assert.equal(plan.steps.at(-1).criterion, final.criterion);
  }
});

test('oversized lesson and final-task text remains invalid instead of being truncated', () => {
  const oversized = [
    draft => { draft.title = 'T'.repeat(91); },
    draft => { draft.outcome = 'O'.repeat(451); },
    draft => { draft.steps.at(-1).title = 'F'.repeat(91); },
    draft => { draft.steps.at(-1).task = 'A'.repeat(901); },
    draft => { draft.steps.at(-1).criterion = 'C'.repeat(321); },
  ];
  for (const minutes of [5, 10, 20]) {
    for (const mutate of oversized) {
      const draft = lessonDraft(minutes);
      mutate(draft);
      assert.equal(normalize(draft, minutes), null);
    }
  }
});

test('the composer rejects a legacy-shaped response instead of silently dropping teaching', async () => {
  const fixture = modelFixture(5, { mutate: composed => { delete composed.guided[0].teaching; } });
  await assert.rejects(generateDeepSeekPlan(inputFor(5), 'test-only', fixture.fetcher, offlineReaders), { name: 'LessonContentInvalid' });
});

test('localized official Help Center articles are fetched in English before being cited', async () => {
  const canonical = 'https://help.openai.com/en/articles/9237897';
  const fixture = modelFixture(5, {
    resultUrl: 'https://help.openai.com/ja-jp/articles/9237897-search-guide?locale=ja',
    resultContent: 'UNOPENED LOCALIZED CONTENT must not become the content of an English article.',
    fetchedContent: 'The English guide explains how to search and check the sources for a result.',
    verify: (_, input) => {
      assert.equal(input.materials[0].url, canonical);
      assert.match(input.materials[0].content, /English guide/);
      assert.doesNotMatch(input.materials[0].content, /UNOPENED LOCALIZED/);
    },
  });
  const plan = await generateDeepSeekPlan(inputFor(5), 'test-only', fixture.fetcher, offlineReaders);
  assert.deepEqual(fixture.calls.filter(call => call.url.endsWith('/v1/tools/fetch')).map(call => call.body.url), [canonical]);
  assert.equal(plan.steps[0].resource.url, canonical);
});

test('a failed English article fetch cannot reuse the localized page as proof', async () => {
  const fixture = modelFixture(5, {
    resultUrl: 'https://help.openai.com/fr-fr/articles/9237897-guide', fetchedContent: false,
  });
  await assert.rejects(generateDeepSeekPlan(inputFor(5), 'test-only', fixture.fetcher, offlineReaders), { name: 'NoOpenedLessonSources' });
});

test('source canonicalization leaves other hosts and non-article paths unchanged', async () => {
  for (const resultUrl of [
    'https://help.openai.com/en/articles/9237897-chatgpt-search',
    'https://help.openai.com/fr-fr/collections/3742473-chatgpt',
    'https://example.org/fr-fr/articles/9237897-guide',
    'https://help.openai.com.example.org/fr-fr/articles/9237897-guide',
  ]) {
    const fixture = modelFixture(5, { resultUrl, verify: (_, input) => assert.equal(input.materials[0].url, resultUrl) });
    const plan = await generateDeepSeekPlan(inputFor(5), 'test-only', fixture.fetcher, offlineReaders);
    assert.equal(plan.steps[0].resource.url, resultUrl);
    assert.equal(fixture.calls.some(call => call.url.endsWith('/v1/tools/fetch')), false);
  }
});
