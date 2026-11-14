import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, DESIGN_QUIZ, BUDGET_QUIZ, matchGoal, contrastRatio, evaluatePoster, evaluateBudget, makeBudgetChallenge, escapeHtml } from './engine.js';

test('only supported goals produce a sample course', () => {
  assert.equal(matchGoal('Create a poster for my coffee shop'), 'design');
  assert.equal(matchGoal('Хочу научиться дизайну'), 'design');
  assert.equal(matchGoal('Жарнама жасауды үйренгім келеді'), 'design');
  assert.equal(matchGoal('Build a household budget spreadsheet'), 'budget');
  assert.equal(matchGoal('Хочу таблицу расходов'), 'budget');
  assert.equal(matchGoal('Шығындар кестесін жасағым келеді'), 'budget');
  assert.equal(matchGoal('Learn Python'), null);
  assert.equal(matchGoal('I want to learn mathematics'), null);
  assert.equal(matchGoal(''), null);
  assert.equal(matchGoal(null), null);
});

test('contrast is symmetric, supports short hex, and rejects malformed colors', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.equal(contrastRatio('#fff', '#000'), 21);
  assert.equal(contrastRatio('#fff', '#fff'), 1);
  assert.equal(contrastRatio('#gggggg', '#ffffff'), 0);
  assert.equal(contrastRatio('', '#ffffff'), 0);
  assert.ok(contrastRatio('#767676', '#fff') >= 4.5);
  assert.ok(contrastRatio('#777777', '#fff') < 4.5);
});

const validPoster = { title: 'Coffee and conversation', subtitle: 'Saturday, 10–4', cta: 'Visit our café', titleSize: 48, subtitleSize: 20, textColor: '#18223B', bgColor: '#ffffff' };

test('a poster passes basic layout checks only with all four constraints met', () => {
  assert.equal(evaluatePoster(validPoster).passed, true);
  for (const field of ['title', 'subtitle', 'cta']) {
    assert.equal(evaluatePoster({ ...validPoster, [field]: '  ' }).passed, false);
  }
  assert.equal(evaluatePoster({ ...validPoster, titleSize: 29 }).passed, false);
  assert.equal(evaluatePoster({ ...validPoster, titleSize: 30 }).passed, true);
  assert.equal(evaluatePoster({ ...validPoster, subtitleSize: 0 }).passed, false);
  assert.equal(evaluatePoster({ ...validPoster, textColor: '#777777' }).passed, false);
  assert.equal(evaluatePoster({ ...validPoster, textColor: '#767676' }).passed, true);
  assert.equal(evaluatePoster({}).passed, false);
});

test('budget formula validates the complete range without executing expressions', () => {
  const amounts = [49.5, 105.1, 25.4];
  assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: 180 }, amounts).passed, true);
  assert.equal(evaluateBudget({ formula: 'sum ( b2 : b4 )', answer: '180.00' }, amounts).passed, true);
  for (const formula of ['=SUM(B2:B3)', '=SUM(B2:B5)', '=SUM(A2:A4)', '=SUM(B2:B4)+1', '=SUM(B2:B4);alert(1)', '=eval("180")', '=IMPORTXML("https://example.com")', '']) {
    assert.equal(evaluateBudget({ formula, answer: 180 }, amounts).passed, false, formula);
  }
  assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: 181 }, amounts).passed, false);
  assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: 180.01 }, amounts).passed, true);
  assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: 180.02 }, amounts).passed, false);
});

test('blank, infinite, malformed answers and invalid expense rows cannot pass', () => {
  for (const answer of ['', ' ', null, undefined, Infinity, '0x0', '0;alert(1)']) {
    assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer }, [0, 0, 0]).passed, false);
  }
  for (const values of [[], [1, 2], [1, 2, 3, 4], [1, 2, NaN], [1, 2, Infinity], [1, 2, -3], ['1', 2, 3]]) {
    assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: 6 }, values).passed, false);
  }
});

test('new expense challenges are reproducible, valid, and varied', () => {
  assert.deepEqual(makeBudgetChallenge('round-one'), makeBudgetChallenge('round-one'));
  assert.notDeepEqual(makeBudgetChallenge('round-one'), makeBudgetChallenge('round-two'));
  for (let seed = 0; seed < 50; seed++) {
    const values = makeBudgetChallenge(seed);
    assert.equal(values.length, 3);
    assert.ok(values.every(value => Number.isInteger(value) && value >= 0));
    assert.equal(evaluateBudget({ formula: '=SUM(B2:B4)', answer: values.reduce((a, b) => a + b, 0) }, values).passed, true);
  }
});

test('user-authored text is escaped for HTML and SVG output', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & \'hello\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;hello&#39;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(123), '123');
});

test('each sample path and quiz has a usable completion sequence', () => {
  for (const course of Object.values(COURSES)) {
    assert.deepEqual(course.steps.map(step => step.type), ['learn', 'quiz', 'practice', 'challenge']);
    assert.ok(course.sources.every(source => source.url.startsWith('https://')));
  }
  for (const quiz of [DESIGN_QUIZ, BUDGET_QUIZ]) {
    assert.equal(quiz.length, 3);
    for (const question of quiz) {
      assert.ok(question.correctIndex >= 0 && question.correctIndex < question.choices.length);
      assert.ok(question.explanation.length > 0);
    }
  }
});
