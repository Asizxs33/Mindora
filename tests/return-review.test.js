import test from 'node:test';
import assert from 'node:assert/strict';
import { createReturnReview, restoreReturnReview, transitionReturnReview, reviewScore, currentReviewCorrect, reviewCanCheck, needsReturnReview, learningReviewQuestions, learningHasProgress, RETURN_REVIEW_AFTER_MS } from '../core/return-review.js';

const question = (answer = 1) => ({
  assessment: { type: 'choice', question: 'What comes first?', options: ['Small print', 'Headline', 'Footer'], answer, explanation: 'A headline leads the design.' },
  title: 'One main idea', reminder: 'Start with the headline.', detail: 'Make the headline larger than the details.',
});
const create = () => createReturnReview({ key: 'course:one', title: 'Design', mentor: 'mia', questions: [question(), question(2)], cursor: { step: 2, page: 1 } });
const act = (r, type, response) => transitionReturnReview(r, { type, response });

test('only an encountered lesson older than one day needs a return check', () => {
  assert.equal(needsReturnReview(1000, true, 1000 + RETURN_REVIEW_AFTER_MS), false);
  assert.equal(needsReturnReview(1000, true, 1001 + RETURN_REVIEW_AFTER_MS), true);
  assert.equal(needsReturnReview(1000, false, 1001 + RETURN_REVIEW_AFTER_MS), false);
  assert.equal(needsReturnReview('broken', true), false);
  assert.equal(needsReturnReview(10000, true, 2000), false);
  assert.equal(learningHasProgress({ completed: 0, study: [{ page: 0 }], answers: [] }), false);
  assert.equal(learningHasProgress({ completed: 0, study: [{ page: 2 }] }), true);
});

test('a first-pass success resumes the original cursor without touching course data', () => {
  const initial = create(), before = structuredClone(initial);
  let review = act(initial, 'next');
  assert.equal(review.phase, 'question');
  assert.equal(reviewCanCheck(review), false);
  review = act(act(review, 'answer', 1), 'check');
  assert.equal(currentReviewCorrect(review), true);
  assert.deepEqual(reviewScore(review), { correct: 1, total: 2 });
  review = act(review, 'next');
  review = act(act(review, 'answer', 2), 'check');
  review = act(review, 'next');
  assert.equal(review.phase, 'complete');
  assert.deepEqual(review.cursor, { step: 2, page: 1 });
  assert.deepEqual(initial, before);
});

test('weak first attempts require rereading basics and a correct recheck before resuming', () => {
  let review = act(create(), 'next');
  review = act(act(review, 'answer', 0), 'check');
  const locked = act(review, 'answer', 1);
  assert.equal(locked, review);
  review = act(review, 'next');
  review = act(act(review, 'answer', 2), 'check');
  review = act(review, 'next');
  assert.equal(review.phase, 'foundations');
  assert.deepEqual(reviewScore(review), { correct: 1, total: 2 });
  review = act(act(review, 'next'), 'next');
  assert.equal(review.phase, 'repair');
  assert.equal(review.responses[0], null);
  review = act(act(review, 'answer', 0), 'check');
  assert.equal(act(review, 'next'), review, 'wrong repair cannot skip ahead');
  review = act(act(review, 'answer', 1), 'check');
  review = act(review, 'next');
  review = act(act(review, 'answer', 2), 'check');
  review = act(review, 'next');
  assert.equal(review.phase, 'complete');
  assert.deepEqual(reviewScore(review), { correct: 1, total: 2 }, 'repair does not rewrite the first-attempt result');
  assert.deepEqual(review.cursor, { step: 2, page: 1 });
});

test('an interrupted review restores its own course state, never another course', () => {
  let review = act(create(), 'next');
  review = act(act(review, 'answer', 0), 'check');
  const restored = restoreReturnReview(JSON.parse(JSON.stringify(review)), 'course:one');
  assert.deepEqual(restored, review);
  assert.equal(restoreReturnReview(review, 'course:two'), null);
  assert.equal(restoreReturnReview({ ...review, phase: 'bad' }, 'course:one'), null);
});

test('AI recall uses the two most recent encountered assessments, with no invented legacy quiz', () => {
  const a = question().assessment;
  const step = title => ({ title, instruction: 'A real explanation.', teaching: { assessment: a, takeaway: 'One main idea.' } });
  const saved = { completed: 2, study: [{ page: 5 }, { page: 4 }, { page: 0 }], plan: { steps: [step('First'), step('Second'), step('Not read')] } };
  assert.deepEqual(learningReviewQuestions(saved).map(q => q.title), ['First', 'Second']);
  saved.study[2].page = 1;
  assert.deepEqual(learningReviewQuestions(saved).map(q => q.title), ['Second', 'Not read']);
  assert.deepEqual(learningReviewQuestions({ completed: 1, plan: { steps: [{ instruction: 'Legacy text' }] } }), []);
  let review = createReturnReview({ key: 'legacy', reminder: 'Legacy text' });
  review = act(review, 'next');
  assert.equal(review.phase, 'complete');
  assert.deepEqual(reviewScore(review), { correct: 0, total: 0 });
});

test('all v3 deterministic assessment types retain their actual grading rules during recall', () => {
  const base = { question: 'A real checkpoint', explanation: 'A real explanation' };
  for (const [assessment, response] of [
    [{ ...base, type: 'multi-choice', options: ['A', 'B', 'C'], answers: [0, 2] }, [0, 2]],
    [{ ...base, type: 'order', items: ['A', 'B', 'C'], answer: [2, 0, 1] }, [2, 0, 1]],
    [{ ...base, type: 'match', left: ['A', 'B', 'C'], right: ['a', 'b', 'c'], answer: [0, 1, 2] }, [0, 1, 2]],
    [{ ...base, type: 'gap-fill', before: 'Visit', after: 'Monday', accepted: ['on'] }, 'on'],
  ]) {
    let review = act(createReturnReview({ key: 'v3', questions: [{ assessment }] }), 'next');
    review = act(act(review, 'answer', response), 'check');
    assert.equal(currentReviewCorrect(review), true, assessment.type);
    assert.equal(act(review, 'next').phase, 'complete');
  }
});
