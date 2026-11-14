import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssessment, normalizeAssessmentResponse, isAssessmentCorrect } from '../core/lesson-assessment.js';
import { lessonPages, normalizePlan, restorePlan } from '../core/learning-plan.js';
import { normalizeSavedCourse } from '../backend/learning-course-store.js';

const gap = {
  type: 'gap-fill', question: 'Complete the introduction.', before: 'Hello,', after: 'a teacher.',
  accepted: ["I'm"], explanation: 'Use I am or its contraction when introducing yourself.',
};

test('language gaps accept straight and curly apostrophes while preserving the typed response', () => {
  for (const expected of ["I'm", 'I’m', 'I‘m']) {
    const assessment = normalizeAssessment({ ...gap, accepted: [expected], answerMode: 'language' });
    assert.ok(assessment);
    assert.deepEqual(assessment.accepted, ["I'm"]);
    for (const response of ["I'm", 'I’m', 'I‘m', ' I’m ']) {
      assert.equal(isAssessmentCorrect(assessment, response), true);
      assert.equal(normalizeAssessmentResponse(assessment, response), response, 'normalization never changes what the learner typed');
    }
  }
});

test('language typography support does not accept wrong grammar, case or other punctuation', () => {
  const assessment = normalizeAssessment({ ...gap, answerMode: 'language' });
  for (const response of ['Im', "i'm", 'i’m', 'I am', "I'am", "I'm.", 'I m', 'I`m', 'Iʼm', 'I＇m', "I' m", "I'm!"]) {
    assert.equal(isAssessmentCorrect(assessment, response), false, response);
  }
  const sentence = normalizeAssessment({ ...gap, accepted: ['Hello, I’m Aida.'], answerMode: 'language' });
  assert.equal(isAssessmentCorrect(sentence, "Hello, I'm Aida."), true);
  for (const response of ["Hello I'm Aida.", "Hello, I'm Aida!", "hello, I'm Aida.", "Hello,  I'm Aida."]) {
    assert.equal(isAssessmentCorrect(sentence, response), false, response);
  }
});

test('language aliases deduplicate after apostrophe canonicalization without removing input bounds', () => {
  const assessment = normalizeAssessment({ ...gap, answerMode: 'language', accepted: ["I'm", 'I’m', 'I‘m', 'I am'] });
  assert.deepEqual(assessment.accepted, ["I'm", 'I am']);
  assert.equal(isAssessmentCorrect(assessment, 'I am'), true, 'a distinct valid answer remains allowed when explicitly listed');
  for (const accepted of [[], ["I'm", null], ['x'.repeat(161)], Array(6).fill("I'm")]) {
    assert.equal(normalizeAssessment({ ...gap, answerMode: 'language', accepted }), null);
  }
});

test('legacy and programming gaps retain exact case and apostrophe matching; unknown modes are invalid', () => {
  const legacy = normalizeAssessment(gap);
  assert.equal(legacy.answerMode, undefined);
  assert.equal(isAssessmentCorrect(legacy, "I'm"), true);
  assert.equal(isAssessmentCorrect(legacy, 'I’m'), false);
  const code = normalizeAssessment({ ...gap, before: 'print(', after: ')', accepted: ["'Hello'"] });
  assert.equal(isAssessmentCorrect(code, "'Hello'"), true);
  assert.equal(isAssessmentCorrect(code, '‘Hello’'), false);
  assert.equal(isAssessmentCorrect(code, "'hello'"), false);
  assert.equal(normalizeAssessment({ ...gap, accepted: ['é', 'e\u0301'] }), null, 'legacy duplicate checks are unchanged');
  for (const answerMode of ['exact', 'case-insensitive', '', null, true]) {
    assert.equal(normalizeAssessment({ ...gap, answerMode }), null);
  }
});

test('language mode and an original smart-apostrophe response survive cloud save and reopen', () => {
  const source = 'https://learnenglish.britishcouncil.org/grammar/english-grammar-reference/present-simple';
  const step = { title: 'Introduce yourself', instruction: 'Use I am before your name or profession.', task: 'Write your own introduction.', criterion: 'The introduction includes a name and profession.' };
  const plan = normalizePlan({
    formatVersion: 3, title: 'A short introduction', outcome: 'Introduce yourself in English.',
    steps: [{ ...step, sourceUrl: source, teaching: {
      why: 'An introduction starts a conversation.',
      example: { input: 'Name: Aida. Job: teacher.', output: "Hello, I'm Aida. I'm a teacher.", explanation: 'The contraction I’m means I am.' },
      takeaway: 'Use I am or I’m to introduce yourself.',
      assessment: { ...gap, accepted: ["I'm", 'I’m'], answerMode: 'language' },
    } }, { ...step, title: 'A fresh introduction' }],
  }, { goal: 'Learn beginner English', minutes: 5, language: 'en' }, new Map([[source, { url: source, title: 'English grammar' }]]));
  assert.ok(plan);
  const pages = lessonPages(plan.steps[0]);
  const practice = pages.indexOf('practice');
  const response = 'I’m';
  const stored = normalizeSavedCourse(JSON.parse(JSON.stringify({ plan, study: [{ page: practice, response, checked: true }] })));
  assert.ok(stored);
  const restored = restorePlan(JSON.parse(JSON.stringify(stored)));
  assert.equal(restored.plan.steps[0].teaching.assessment.answerMode, 'language');
  assert.deepEqual(restored.plan.steps[0].teaching.assessment.accepted, ["I'm"]);
  assert.equal(restored.study[0].response, response);
  assert.equal(restored.study[0].page, practice, 'the correct typographic variant still unlocks practice on another device');
  const incorrect = normalizeSavedCourse({ plan, study: [{ page: practice, response: 'Im', checked: true }] });
  assert.equal(incorrect.study[0].page, pages.indexOf('check'), 'a missing apostrophe remains incorrect after restoration');
});
