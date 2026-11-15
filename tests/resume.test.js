import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeCursor, needsRecap, RECAP_AFTER_MS, certificateEligible } from '../core/resume.js';

test('return gate uses strictly more than 24 hours and does not modify learning data', () => {
  const state = { progress: { design: 2 }, sessions: { design: { lastSeen: 1000, cursor: { step: 2 } } }, drafts: { title: 'Keep me' } };
  const before = structuredClone(state);
  assert.equal(needsRecap(state, 'design', 1000 + RECAP_AFTER_MS), false);
  assert.equal(needsRecap(state, 'design', 1001 + RECAP_AFTER_MS), true);
  assert.deepEqual(state, before);
  assert.equal(needsRecap(state, 'budget', 1001 + RECAP_AFTER_MS), false);
});
test('unfinished reading and quiz position survive; opening a later step preserves the cursor without granting credit', () => {
  assert.deepEqual(resumeCursor({ progress: { design: 0 }, sessions: { design: { cursor: { step: 0, page: 2 } } } }, 'design'), { step: 0, page: 2, quizIndex: 0, quizChoice: null, quizFeedback: false });
  const state = { progress: { design: 1 }, sessions: { design: { cursor: { step: 1, quizIndex: 2, quizChoice: 1, quizFeedback: true } } } };
  assert.equal(resumeCursor(state, 'design').quizIndex, 2);
  assert.equal(resumeCursor(state, 'design').quizChoice, 1);
  state.sessions.design.cursor = { step: 3, page: 900, quizIndex: -1 };
  assert.equal(resumeCursor(state, 'design').step, 3);
  assert.equal(resumeCursor(state, 'design').quizIndex, 0);
});
test('no reminder for a first visit, invalid clock, or future timestamp', () => {
  assert.equal(needsRecap({ progress: { design: 0 } }, 'design'), false);
  assert.equal(needsRecap({ progress: { design: 1 }, sessions: { design: { lastSeen: 'broken' } } }, 'design'), false);
  assert.equal(needsRecap({ progress: { design: 1 }, sessions: { design: { lastSeen: 10000 } } }, 'design', 5000), false);
});

test('budget resume does not reuse answers from another duration and supports the fourth question', () => {
  const state = { minutes: 5, progress: { budget: 1 }, sessions: { budget: { cursor: { step: 1, minutes: 10, quizIndex: 0, quizChoice: 1, quizFeedback: true } } } };
  assert.equal(resumeCursor(state, 'budget').quizChoice, null);
  assert.equal(resumeCursor(state, 'budget').quizFeedback, false);
  state.minutes = 20;
  state.budgetQuiz = { 20: { index: 3, choice: 0, feedback: true } };
  assert.equal(resumeCursor(state, 'budget').quizIndex, 3);
  assert.equal(resumeCursor(state, 'budget').quizFeedback, true);
});
test('certificate requires all stages and the independent challenge', () => {
  assert.equal(certificateEligible({ progress: { design: 4 }, works: { design: { challenge: true } } }, 'design'), true);
  assert.equal(certificateEligible({ progress: { design: 3 }, works: { design: { challenge: true } } }, 'design'), false);
  assert.equal(certificateEligible({ progress: { design: 4 }, works: { design: { challenge: false } } }, 'design'), false);
});

test('earned certificate remains available after reviewing a practice step', () => {
  const state = { progress: { design: 4 }, works: { design: { challenge: false } }, certificates: { design: { completedAt: '2026-11-14T15:00:00.000Z' } } };
  assert.equal(certificateEligible(state, 'design'), true);
  state.progress.design = 3;
  assert.equal(certificateEligible(state, 'design'), false);
});
