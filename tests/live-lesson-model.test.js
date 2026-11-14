import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSavedCourse } from '../backend/learning-course-store.js';
import { lessonPages, normalizePlan } from '../core/learning-plan.js';
import {
  isAssessmentCorrect,
  isAssessmentReady,
  normalizeAssessment,
  normalizeAssessmentResponse,
} from '../core/lesson-assessment.js';

const source = 'https://support.microsoft.com/en-us/excel';
const image = { url: 'https://support.microsoft.com/images/workbook.png', alt: 'A workbook with sample expenses' };
const sources = new Map([[source, { url: source, title: 'Excel help', images: [image] }]]);

const common = { question: 'Which formula adds the expense column?', explanation: 'The SUM function adds the cells in the chosen range.' };
const options = ['SUM(B2:B4)', 'COUNT(B2:B4)', 'AVERAGE(B2:B4)', 'SUM(B2:B3)+B4'];
const items = ['Enter the formula', 'Add the expense rows', 'Choose an empty cell'];
const accepted = ['SUM', 'sum'];

const assessments = {
  choice: { ...common, type: 'choice', options, answer: 0 },
  'multi-choice': { ...common, type: 'multi-choice', options, answers: [0, 3] },
  order: { ...common, type: 'order', items, answer: [1, 2, 0] },
  match: {
    ...common, type: 'match', left: ['SUM', 'COUNT', 'AVERAGE'],
    right: ['Count numbers', 'Find the mean', 'Find the total'], answer: [2, 0, 1],
  },
  'gap-fill': { ...common, type: 'gap-fill', before: 'The function', after: 'adds several cells.', accepted },
};

function normalLesson(assessment, illustrationUrls = [image.url]) {
  const step = {
    title: 'Add expenses', instruction: 'List three expenses and add them together.',
    task: 'Add three different expenses and show the result.', criterion: 'The total matches all three expenses.',
  };
  const teaching = {
    why: 'Add values without doing arithmetic by hand.',
    example: { input: '10, 20, 30', output: '60', explanation: 'All three expenses add up to 60.' },
    takeaway: 'Pick the entire range to include every expense.',
    assessment,
  };
  const draft = {
    formatVersion: 3,
    title: 'Total expenses in a spreadsheet',
    outcome: 'Use a formula to add several cells.',
    steps: [{ ...step, sourceUrl: source, illustrationUrls, teaching }, step],
  };
  return normalizePlan(draft, { goal: 'Build an expense spreadsheet', minutes: 5, language: 'en' }, sources);
}

test('the production lesson reader gets a separate illustration only for images from its source', () => {
  const plan = normalLesson(assessments.order, [image.url, 'https://unverified.org/fake.png']);
  assert.equal(plan.formatVersion, 3);
  assert.deepEqual(plan.steps[0].resource.images, [image]);
  assert.deepEqual(lessonPages(plan.steps[0]), ['explain', 'illustration', 'example', 'check', 'recap', 'practice']);
  assert.deepEqual(lessonPages(plan.steps[1], true), ['practice']);
  const withoutImage = normalLesson(assessments.order, ['https://unverified.org/fake.png']);
  assert.deepEqual(lessonPages(withoutImage.steps[0]), ['explain', 'example', 'check', 'recap', 'practice']);
});

test('the database round-trips all assessed response shapes and only restores practice after a correct check', () => {
  const attempts = [
    [assessments.choice, 0, 1, null],
    [assessments['multi-choice'], [0, 3], [0, 1, 3], []],
    [assessments.order, [1, 2, 0], [0, 1, 2], null],
    [assessments.match, [2, 0, 1], [0, 2, 1], [2, null, 2]],
    [assessments['gap-fill'], ' SUM ', 'Sum', ''],
  ];
  for (const [assessment, right, wrong, unfinished] of attempts) {
    const plan = normalLesson(assessment);
    const encoded = JSON.parse(JSON.stringify({ plan, study: [{ page: 5, response: right, checked: true }] }));
    const restored = normalizeSavedCourse(encoded);
    assert.deepEqual(restored.plan, plan);
    assert.deepEqual(restored.study[0], { page: 5, choice: null, checked: true, response: right });

    for (const entry of [
      { page: 5, response: wrong, checked: true },
      { page: 4, response: right, checked: false },
      { page: 5, response: unfinished, checked: true },
    ]) {
      const restored = normalizeSavedCourse({ plan, study: [entry] }).study[0];
      assert.equal(restored.page, 3, assessment.type);
      assert.equal(restored.checked, entry.response === wrong);
      assert.deepEqual(restored.response, normalizeAssessmentResponse(assessment, entry.response));
    }
  }
});

test('an assessment rejects invalid indices, duplicate values and malformed text before a course is saved', () => {
  for (const invalid of [
    { ...assessments.choice, answer: '0' },
    { ...assessments.choice, options: ['A', ' A ', 'B'] },
    { ...assessments['multi-choice'], answers: [0, 0] },
    { ...assessments['multi-choice'], answers: [0] },
    { ...assessments.order, answer: [1, 0, 1] },
    { ...assessments.match, answer: [2, 0, 3] },
    { ...assessments.match, right: ['A', 'B', 'C', 'D'] },
    { ...assessments['gap-fill'], before: '', after: '', accepted: ['word'] },
    { ...assessments['gap-fill'], accepted: ['é', 'e\u0301'] },
    { ...assessments['gap-fill'], accepted: ['x'.repeat(161)] },
  ]) assert.equal(normalLesson(invalid), null);
});

test('assessment grading distinguishes incomplete matches, unordered multi-choice and case-sensitive blanks', () => {
  const match = normalizeAssessment(assessments.match);
  assert.equal(isAssessmentReady(match, [2, 0, null]), false);
  assert.equal(isAssessmentReady(match, [2, 0, 2]), false);
  assert.equal(isAssessmentCorrect(match, [2, 0, 1]), true);
  const multi = normalizeAssessment(assessments['multi-choice']);
  assert.equal(isAssessmentCorrect(multi, [3, 0]), true);
  assert.equal(isAssessmentCorrect(multi, [3, 0, 0]), false);
  const blank = normalizeAssessment({ ...assessments['gap-fill'], accepted: ['é', 'YES'] });
  assert.equal(isAssessmentCorrect(blank, ' e\u0301 '), true);
  assert.equal(isAssessmentCorrect(blank, ' YES '), true);
  assert.equal(isAssessmentCorrect(blank, 'yes'), false);
});
