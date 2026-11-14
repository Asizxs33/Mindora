import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { normalizeSavedCourse } from '../backend/learning-course-store.js';
import { lessonPages, normalizePlan, restorePlan } from '../core/learning-plan.js';
import { learningPlanView } from '../ui/learning-plan.js';

const source = 'https://openstax.org/books/prealgebra-2e/pages/6-1-understand-percent';
const sources = new Map([[source, { url: source, title: 'Worked examples', images: [] }]]);
const visuals = [
  { type: 'palette', background: '#fff1e5', foreground: '#302723', accent: '#bc4b00', headline: 'A calm place to learn' },
  { type: 'percent', percent: 25, total: 80, label: 'A quarter of the total' },
];
const input = { goal: 'Practise one useful skill', minutes: 5, language: 'en' };

function draft(visual, version = 3) {
  const teaching = {
    why: 'A worked example makes the next task easier to understand.',
    example: {
      input: 'Start with the supplied sample.', output: 'A completed sample with a clear result.',
      explanation: 'Compare the result with the starting values.',
      ...(visual === undefined ? {} : { visual }),
    },
    takeaway: 'Check the result against the original task.',
    ...(version === 3 ? {
      assessment: { type: 'choice', question: 'What should you check?',
        options: ['The original task', 'The unrelated file', 'Nothing'], answer: 0,
        explanation: 'The task tells you what the result should achieve.' },
    } : {
      checkpoint: { question: 'What should you check?', choices: ['The original task', 'The unrelated file', 'Nothing'],
        correctIndex: 0, explanation: 'The task defines the intended result.' },
    }),
  };
  const step = { title: 'Try the skill', instruction: 'Look at the sample and identify its result.',
    task: 'Make your own example.', criterion: 'The result fits the stated goal.' };
  return {
    ...(version === undefined ? {} : { formatVersion: version }),
    title: 'A small practical lesson', outcome: 'Make and explain one clear result.',
    steps: [{ ...step, sourceUrl: source, ...(version === undefined ? {} : { teaching }) },
      { ...step, title: 'Apply independently', sourceUrl: null }],
  };
}

function normalized(visual, version = 3) {
  const plan = normalizePlan(draft(visual, version), input, sources);
  assert.ok(plan, 'the complete lesson remains valid');
  return plan;
}

function cloudRoundtrip(plan, page = 0) {
  const answer = 'My unfinished result';
  const sent = JSON.parse(JSON.stringify({ plan, answers: [answer], completed: 0, study: [{ page }] }));
  const stored = normalizeSavedCourse(sent);
  assert.ok(stored, 'the cloud save validator accepts the lesson');
  const restored = restorePlan(JSON.parse(JSON.stringify(stored)));
  assert.ok(restored, 'another device can restore the saved lesson');
  assert.equal(restored.answers[0], answer);
  return restored;
}

function exampleScreen(saved) {
  return parseHTML(`<html><body>${learningPlanView({ saved, goal: saved.plan.goal, minutes: saved.plan.minutes, accountSaved: true })}</body></html>`).document;
}

test('palette and percent examples survive normalization and the cloud course save/restore boundary', () => {
  for (const visual of visuals) {
    const plan = normalized(visual);
    assert.deepEqual(plan.steps[0].teaching.example.visual, visual);
    const page = lessonPages(plan.steps[0]).indexOf('example');
    const restored = cloudRoundtrip(plan, page);
    assert.deepEqual(restored.plan.steps[0].teaching.example.visual, visual);
    assert.equal(restored.study[0].page, page, 'the learner returns to the illustrated example');
    assert.deepEqual(restored.plan.steps[0].resource.images, [], 'a generated diagram is not a fetched source screenshot');
    assert.equal(restored.plan.steps[1].teaching, undefined, 'the independent task keeps its own content');
  }
});

test('the real lesson example renders a readable palette and a computed percent diagram after restore', () => {
  for (const visual of visuals) {
    const plan = normalized(visual);
    const saved = cloudRoundtrip(plan, lessonPages(plan.steps[0]).indexOf('example'));
    const document = exampleScreen(saved);
    const figure = document.querySelector(`figure[data-lesson-visual="${visual.type}"]`);
    assert.ok(figure, 'the lesson reader includes the visual component on its example page');
    assert.equal(figure.getAttribute('role'), 'img');
    assert.ok(figure.getAttribute('aria-label')?.trim(), 'the visual has a text alternative');
    assert.match(document.body.textContent, /Compare the result with the starting values/);
    if (visual.type === 'palette') {
      assert.ok(figure.querySelector('[data-palette-preview]'));
      assert.ok(figure.textContent.includes(visual.headline));
      assert.ok(figure.querySelector('[data-palette-contrast]')?.textContent.trim());
    } else {
      assert.ok(figure.querySelector('svg[data-percent-grid]'));
      assert.equal(figure.querySelectorAll('rect[data-percent-cell]').length, 100);
      assert.equal(figure.querySelectorAll('rect[data-percent-fill]').length, 25);
      assert.ok(figure.querySelector('[data-percent-amount="20"]'), '25 percent of 80 is calculated as 20');
    }
    saved.study[0].page = lessonPages(plan.steps[0]).indexOf('check');
    assert.equal(exampleScreen(saved).querySelector('[data-lesson-visual]'), null, 'the example does not leak onto the later assessment');
  }
});

test('legacy lessons without visuals stay valid and keep their existing example content', () => {
  for (const version of [undefined, 2, 3]) {
    const raw = draft(undefined, version);
    if (version === undefined) { delete raw.formatVersion; delete raw.steps[0].teaching; }
    const plan = normalizePlan(raw, input, sources);
    assert.ok(plan);
    const page = Math.max(0, lessonPages(plan.steps[0]).indexOf('example'));
    const restored = cloudRoundtrip(plan, page);
    assert.deepEqual(restored.plan, plan);
    assert.equal(exampleScreen(restored).querySelector('[data-lesson-visual]'), null);
    if (version !== undefined) assert.equal(restored.plan.steps[0].teaching.example.visual, undefined);
  }
});

test('invalid optional visuals are discarded without losing a valid lesson or cloud draft', () => {
  for (const visual of [
    { ...visuals[0], background: 'red; background-image:url(https://invalid.example/track)' },
    { ...visuals[0], headline: 'x'.repeat(101) },
    { ...visuals[1], percent: 101 },
    { ...visuals[1], total: 0 },
    { type: 'arbitrary-html', html: '<script>alert(1)</script>' },
  ]) {
    const plan = normalized(visual);
    assert.equal(plan.steps[0].teaching.example.visual, undefined);
    const saved = cloudRoundtrip(plan, lessonPages(plan.steps[0]).indexOf('example'));
    assert.equal(saved.plan.steps[0].teaching.example.visual, undefined);
    const document = exampleScreen(saved);
    assert.equal(document.querySelector('[data-lesson-visual]'), null);
    assert.equal(document.querySelector('script'), null);
    assert.match(document.body.textContent, /A completed sample with a clear result/);
  }
});

test('provider visual labels remain text through cloud storage and real lesson rendering', () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  for (const visual of [{ ...visuals[0], headline: unsafe }, { ...visuals[1], label: unsafe }]) {
    const plan = normalized(visual);
    const saved = cloudRoundtrip(plan, lessonPages(plan.steps[0]).indexOf('example'));
    const document = exampleScreen(saved);
    const figure = document.querySelector('[data-lesson-visual]');
    assert.ok(figure);
    assert.equal(figure.querySelector('img, script, [onerror]'), null);
    assert.ok(figure.textContent.includes(unsafe) || figure.getAttribute('aria-label').includes(unsafe));
  }
});
