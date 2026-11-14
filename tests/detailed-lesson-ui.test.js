import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { restorePlan } from '../core/learning-plan.js';
import { learningPlanView } from '../ui/learning-plan.js';
import { setLanguage } from '../ui/language.js';

const teaching = {
  why: 'A clear request makes the result easier to check.',
  example: { input: 'Summarize these three notes.', output: 'Three concise bullet points.', explanation: 'The request specifies the source and format.' },
  checkpoint: { question: 'Which request gives a useful constraint?', choices: ['Do something.', 'Write three bullet points.', 'Be clever.'], correctIndex: 1, explanation: 'Three bullet points gives a measurable format.' },
  takeaway: 'Name the input and the output you need.',
};
const plan = {
  formatVersion: 2, goal: 'Write clearer prompts', title: 'A useful first prompt', minutes: 5, language: 'en',
  outcome: 'Write a request with a source and an output format.',
  steps: [
    { title: 'Add a clear output format', instruction: 'Tell the assistant exactly what to produce.', task: 'Write your own request for a summary.', criterion: 'Your request names a source and format.', minutes: 2, teaching,
      resource: { title: 'Foreign source title', url: 'https://docs.python.org/3/tutorial/', images: [{ url: 'https://docs.python.org/example.png', alt: 'Image 1: An example request' }] } },
    { title: 'An independent request', instruction: 'Do this without a model answer.', task: 'Make a new request for a different situation.', criterion: 'It includes both a source and a format.', minutes: 3 },
  ],
};

function savedAt(page = 0) {
  return { plan: structuredClone(plan), answers: ['', ''], reviews: [null, null], completed: 0,
    study: [{ page, choice: null, checked: false }, { page: 0, choice: null, checked: false }] };
}

function view(saved = savedAt(), options = {}) {
  const html = learningPlanView({ goal: plan.goal, minutes: plan.minutes, saved, ...options });
  return { html, document: parseHTML(`<html><body>${html}</body></html>`).document };
}

test('the first screen teaches one task, keeps the source image, and collapses goal settings', () => {
  const { html, document } = view();
  assert.equal(document.querySelectorAll('.ai-lesson-page').length, 1);
  assert.equal(document.querySelector('#learning-page-title').textContent, plan.steps[0].title);
  assert.equal(document.querySelector('#learning-page-title').getAttribute('tabindex'), '-1');
  assert.ok(html.includes(plan.steps[0].instruction));
  assert.ok(html.includes(teaching.why));
  assert.ok(!html.includes(plan.steps[0].task));
  assert.ok(!html.includes(plan.steps[1].title));
  assert.ok(!html.includes(teaching.example.output));
  assert.ok(!html.includes(teaching.checkpoint.explanation));
  assert.equal(document.querySelector('img').getAttribute('src'), plan.steps[0].resource.images[0].url);
  assert.equal(document.querySelector('img').getAttribute('alt'), 'An example request');
  assert.equal(document.querySelector('img').getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(document.querySelector('figcaption'), null);
  assert.ok(!html.includes('Foreign source title'));
  assert.equal(document.querySelector('.ai-lesson-settings').hasAttribute('open'), false);
  assert.equal(document.querySelector('#learning-plan-form [name="goal"]').getAttribute('value'), plan.goal);
  assert.ok(document.querySelector('#learning-plan-form [name="minutes"]'));
  assert.equal(document.querySelector('[data-learning-page="back"]').hasAttribute('disabled'), true);
  assert.equal(document.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), false);
  assert.equal(document.querySelector('.ai-lesson-stages [aria-current="step"]').textContent.trim(), '1Understand');
});

test('the example is a separate screen with input, worked output, and an explanation', () => {
  const { html, document } = view(savedAt(1));
  assert.ok(html.includes(teaching.example.input));
  assert.ok(html.includes(teaching.example.output));
  assert.ok(html.includes(teaching.example.explanation));
  assert.ok(!html.includes(plan.steps[0].instruction));
  assert.ok(!html.includes(plan.steps[0].task));
  assert.equal(document.querySelector('#learning-step-form'), null);
  assert.equal(document.querySelector('[data-learning-page="back"]').hasAttribute('disabled'), false);
  assert.match(document.querySelector('.ai-lesson-page-count').textContent, /Screen 2 of 4/);
});

test('checkpoint feedback is hidden until checked and only a correct checked answer opens practice', () => {
  const saved = savedAt(2);
  let screen = view(saved);
  assert.equal(screen.document.querySelectorAll('[data-learning-choice]').length, 3);
  assert.equal(screen.document.querySelector('[data-learning-page="check"]').hasAttribute('disabled'), true);
  assert.equal(screen.document.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), true);
  assert.ok(!screen.html.includes(teaching.checkpoint.explanation));
  saved.study[0].choice = 1;
  screen = view(saved);
  assert.equal(screen.document.querySelector('[data-learning-page="check"]').hasAttribute('disabled'), false);
  assert.equal(screen.document.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), true);
  assert.equal(screen.document.querySelector('[data-learning-choice="1"]').getAttribute('aria-pressed'), 'true');
  assert.ok(!screen.html.includes(teaching.checkpoint.explanation));
  saved.study[0].checked = true;
  saved.study[0].choice = 0;
  screen = view(saved);
  assert.ok(screen.html.includes(teaching.checkpoint.explanation));
  assert.equal(screen.document.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), true);
  assert.equal(screen.document.querySelector('[data-learning-choice="1"]').hasAttribute('disabled'), false);
  saved.study[0].choice = 1;
  screen = view(saved);
  assert.equal(screen.document.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), false);
  assert.equal(screen.document.querySelector('[data-learning-page="check"]'), null);
  assert.ok(screen.document.querySelector('.ai-lesson-check-feedback.is-correct'));
});

test('practice preserves the real answer and review hooks without leaking earlier screen content', () => {
  const saved = savedAt(3);
  saved.study[0] = { page: 3, choice: 1, checked: true };
  saved.answers[0] = '<script>user draft</script>';
  let { html, document } = view(saved);
  assert.ok(document.querySelector('#learning-step-form textarea[name="answer"]'));
  assert.ok(html.includes('&lt;script&gt;user draft&lt;/script&gt;'));
  assert.ok(html.includes(plan.steps[0].task));
  assert.ok(html.includes(teaching.takeaway));
  assert.ok(!html.includes(teaching.example.output));
  assert.equal(document.querySelector('script'), null);
  assert.equal(document.querySelector('[data-learning-page="next"]'), null);
  saved.reviews[0] = { observation: 'You named a source.', nextAction: 'Now specify a format.' };
  ({ html, document } = view(saved));
  assert.ok(html.includes(saved.reviews[0].observation));
  assert.ok(html.includes(saved.reviews[0].nextAction));
  assert.ok(document.querySelector('[data-learning-step="edit"]'));
  assert.ok(document.querySelector('[data-learning-step="continue"]'));
  assert.equal(document.querySelector('#learning-review-status').getAttribute('tabindex'), '-1');
});

test('busy and failed reviews preserve disabled controls and the existing recovery actions', () => {
  const saved = savedAt(3);
  saved.study[0] = { page: 3, choice: 1, checked: true };
  let { document } = view(saved, { busy: 'review' });
  assert.equal(document.querySelector('textarea').hasAttribute('disabled'), true);
  assert.equal(document.querySelector('#learning-step-form button').hasAttribute('disabled'), true);
  assert.equal(document.querySelector('[data-learning-page="back"]').hasAttribute('disabled'), true);
  ({ document } = view(saved, { reviewError: 'review-unavailable' }));
  assert.ok(document.querySelector('[data-learning-step="continue"]'));
  assert.ok(document.querySelector('#learning-step-form'));
  ({ document } = view(savedAt(2), { busy: 'plan' }));
  assert.ok([...document.querySelectorAll('[data-learning-choice], [data-learning-page]')].every(button => button.hasAttribute('disabled')));
  assert.equal(document.querySelector('.ai-lesson-settings').hasAttribute('open'), true);
});

test('legacy saved lessons retain their images and use explanation followed by practice', () => {
  const saved = savedAt();
  delete saved.plan.formatVersion;
  delete saved.plan.steps[0].teaching;
  delete saved.study;
  let { document } = view(saved);
  assert.equal(document.querySelectorAll('.ai-lesson-stages > li').length, 2);
  assert.equal(document.querySelector('img').getAttribute('src'), plan.steps[0].resource.images[0].url);
  assert.equal(document.querySelector('#learning-step-form'), null);
  saved.study = [{ page: 1, choice: null, checked: false }];
  ({ document } = view(saved));
  assert.ok(document.querySelector('#learning-step-form'));
  assert.equal(document.querySelector('.ai-lesson-example'), null);
});

test('the independent task and completion show the actual work without a mastery claim', () => {
  const saved = savedAt();
  saved.completed = 1;
  saved.answers = ['First attempt', 'My final request'];
  let { html, document } = view(saved);
  assert.equal(document.querySelectorAll('.ai-lesson-stages > li').length, 1);
  assert.ok(html.includes(plan.steps[1].task));
  assert.ok(!html.includes(plan.steps[0].instruction));
  assert.ok(!html.includes(teaching.takeaway));
  assert.ok(document.querySelector('#learning-step-form'));
  saved.completed = 2;
  saved.reviews[1] = { observation: 'Your request names both parts.', nextAction: 'Try it with your real notes.' };
  ({ html, document } = view(saved));
  assert.equal(document.querySelector('#learning-plan-complete').getAttribute('tabindex'), '-1');
  assert.ok(html.includes(saved.answers[1]));
  assert.ok(html.includes(saved.reviews[1].observation));
  assert.ok(html.includes(saved.reviews[1].nextAction));
  assert.equal(document.querySelector('.ai-lesson-reader'), null);
  assert.doesNotMatch(html, /mastered|certificate|100%/i);
});

test('restored detailed and legacy lessons retain completed answers and feedback in collapsed history', () => {
  assert.equal(view().document.querySelector('.ai-lesson-history'), null);
  for (const legacy of [false, true]) {
    const saved = savedAt();
    if (legacy) {
      delete saved.plan.formatVersion;
      delete saved.plan.steps[0].teaching;
      delete saved.study;
    }
    saved.completed = 1;
    saved.answers = ['Summarize <notes> as three points.', 'An unfinished final answer'];
    saved.reviews[0] = { answer: saved.answers[0], observation: 'The <source> is named.', nextAction: 'Keep the output specific.' };
    const restored = restorePlan(JSON.parse(JSON.stringify(saved)));
    assert.ok(restored);
    let { document } = view(restored);
    const history = document.querySelector('.ai-lesson-history');
    assert.ok(history);
    assert.equal(history.hasAttribute('open'), false);
    assert.equal(history.querySelectorAll('.ai-lesson-history-list > li').length, 1);
    assert.equal(history.querySelector('h3').textContent, plan.steps[0].title);
    assert.ok(history.textContent.includes(plan.steps[0].task));
    assert.equal(history.querySelector('.ai-lesson-submission').textContent, saved.answers[0]);
    assert.ok(history.textContent.includes(saved.reviews[0].observation));
    assert.ok(history.textContent.includes(saved.reviews[0].nextAction));
    assert.equal(history.querySelector('notes, source'), null);
    assert.equal(history.querySelector('form, [data-learning-step], [data-learning-page]'), null);
    assert.equal(document.querySelectorAll('.ai-lesson-page').length, 1);
    assert.ok(document.querySelector('.ai-lesson-page').textContent.includes(plan.steps[1].task));
    assert.ok(!document.querySelector('.ai-lesson-page').textContent.includes(saved.answers[0]));
    restored.completed = 2;
    ({ document } = view(restorePlan(JSON.parse(JSON.stringify(restored)))));
    assert.equal(document.querySelector('.ai-lesson-history').hasAttribute('open'), false);
    assert.equal(document.querySelectorAll('.ai-lesson-history-list > li').length, 1);
    assert.equal(document.querySelector('.learning-result .ai-lesson-submission').textContent, saved.answers[1]);
    assert.ok(!document.querySelector('.ai-lesson-history').textContent.includes(saved.answers[1]));
  }
});

test('completed detailed and legacy tasks retain neutral source links without restoring image captions', () => {
  for (const legacy of [false, true]) {
    for (const illustrated of [false, true]) {
      const saved = savedAt();
      if (legacy) {
        delete saved.plan.formatVersion;
        delete saved.plan.steps[0].teaching;
        delete saved.study;
      }
      if (!illustrated) saved.plan.steps[0].resource.images = [];
      saved.answers = ['My guided answer', 'My independent answer'];
      for (const completed of [1, 2]) {
        saved.completed = completed;
        const restored = restorePlan(JSON.parse(JSON.stringify(saved)));
        assert.ok(restored);
        const history = view(restored).document.querySelector('.ai-lesson-history');
        const link = history.querySelector('.source-link');
        if (illustrated) {
          assert.equal(link, null);
        } else {
          assert.equal(link.getAttribute('href'), plan.steps[0].resource.url);
          assert.equal(link.textContent.trim(), 'Open lesson material');
          assert.equal(link.getAttribute('target'), '_blank');
          assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
        }
        assert.ok(!history.textContent.includes('Foreign source title'));
        assert.ok(!history.textContent.includes('Image 1:'));
        assert.equal(history.querySelector('figcaption'), null);
      }
    }
  }
});

test('lesson navigation and headings follow the selected English, Russian, or Kazakh interface', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    for (const [language, title, back, next, historyLabel, answerLabel] of [['en', 'See an example', 'Back', 'Next', 'Completed work', 'Your answer'], ['ru', 'Посмотри пример', 'Назад', 'Дальше', 'Выполненные задания', 'Твой ответ'], ['kk', 'Мысалды қарау', 'Артқа', 'Әрі қарай', 'Орындалған тапсырмалар', 'Жауабың']]) {
      setLanguage(language);
      const { document } = view(savedAt(1));
      assert.equal(document.querySelector('#learning-page-title').textContent, title);
      assert.equal(document.querySelector('#learning-page-title').getAttribute('lang'), language);
      assert.ok(document.querySelector('[data-learning-page="back"]').textContent.includes(back));
      assert.ok(document.querySelector('[data-learning-page="next"]').textContent.includes(next));
      const saved = savedAt();
      saved.completed = 1;
      saved.answers[0] = 'My completed answer';
      const history = view(saved).document.querySelector('.ai-lesson-history');
      assert.ok(history.querySelector('summary').textContent.includes(historyLabel));
      assert.equal(history.querySelector('summary').getAttribute('lang'), language);
      assert.equal(history.querySelector('h4').textContent, answerLabel);
    }
  } finally {
    setLanguage('en');
    globalThis.document = previousDocument;
  }
});

function v3Saved(assessment, page, response, checked = false) {
  const saved = savedAt();
  saved.plan.formatVersion = 3;
  const guided = saved.plan.steps[0].teaching;
  delete guided.checkpoint;
  guided.assessment = { question: 'Test the learned skill', explanation: 'A useful explanation.', ...assessment };
  saved.study[0] = { page, response, checked };
  const restored = restorePlan(saved);
  assert.ok(restored);
  return restored;
}

test('live lessons use every template, preserving answer hooks and unlock behavior', () => {
  const exercises = [
    {
      assessment: { type: 'choice', options: ['A', 'B', 'C'], answer: 1 }, response: 1,
      draft: '[data-learning-choice="1"][aria-pressed="true"]',
    },
    {
      assessment: { type: 'multi-choice', options: ['A', 'B', 'C'], answers: [0, 2] }, response: [0, 2],
      draft: '[data-learning-choice="2"][aria-pressed="true"]',
    },
    {
      assessment: { type: 'order', items: ['A Item', 'B Item', 'C Item'], answer: [1, 0, 2] }, response: [1, 0, 2],
      draft: '[data-learning-order="0"][data-direction="1"][aria-label="Move down: B Item"]',
    },
    {
      assessment: { type: 'match', left: ['A', 'B', 'C'], right: ['X', 'Y', 'Z'], answer: [1, 2, 0] }, response: [1, 2, 0],
      draft: '[data-learning-match="0"] option[value="1"][selected]',
    },
    {
      assessment: { type: 'gap-fill', before: 'Run', after: 'to check the version.', accepted: ['tool --version'] }, response: 'tool --version',
      draft: '[data-learning-gap][value="tool --version"]',
    },
  ];
  for (const { assessment, response, draft } of exercises) {
    const waiting = view(v3Saved(assessment, 3, response)).document;
    assert.ok(waiting.querySelector(`[data-lesson-template="${assessment.type}"]`));
    assert.ok(waiting.querySelector(draft), assessment.type);
    assert.equal(waiting.querySelector('[data-learning-page="check"]').hasAttribute('disabled'), false);
    assert.equal(waiting.querySelector('[data-learning-page="next"]').hasAttribute('hidden'), true);
    assert.equal(waiting.querySelector('#learning-check-feedback'), null);
    const passed = view(v3Saved(assessment, 3, response, true)).document;
    assert.ok(passed.querySelector('#learning-check-feedback.is-correct'));
    assert.equal(passed.querySelector('[data-learning-page="next"]').hasAttribute('disabled'), false);
  }
  const { assessment, response } = exercises[0];
  for (const [page, type] of [[0, 'theory'], [1, 'illustration'], [2, 'comparison'], [4, 'recap'], [5, 'practice']]) {
    const { document } = view(v3Saved(assessment, page, response, true));
    assert.ok(document.querySelector(`[data-lesson-template="${type}"]`), type);
    assert.equal(Boolean(document.querySelector('.lesson-source-figure img')), type === 'illustration');
    assert.equal(Boolean(document.querySelector('#learning-step-form textarea')), type === 'practice');
  }
});
