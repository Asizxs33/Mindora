import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetCsv, budgetSession, budgetDraftKey, createBudgetDraft,
  evaluateBudgetSession, readBudgetQuiz, readBudgetResume,
} from '../core/budget-session.js';

test('time selection changes the question set and keeps the old draft in the ten-minute mode', () => {
  assert.deepEqual([5, 10, 20].map(minutes => budgetSession(minutes).questions.length), [1, 3, 4]);
  assert.equal(createBudgetDraft(2, 5).formula, '=SUM(B2:B4)');
  assert.equal(createBudgetDraft(3, 5).formula, '');
  assert.equal(budgetDraftKey(2, 10), 'budget-practice');
  assert.equal(budgetDraftKey(3, 10), 'budget-challenge');
  assert.equal(new Set([5, 10, 20].map(minutes => budgetDraftKey(2, minutes))).size, 3);
});

test('twenty-minute work must reconcile expenses and budget, including overspending', () => {
  const draft = { values: [150.25, 200.25, 20], formula: '=SUM(B2:B4)', answer: '370.50', balance: '-50.50' };
  assert.equal(evaluateBudgetSession(draft, 20).passed, true);
  for (const balance of ['', '50.50', '-50.49', '-50.5001']) {
    assert.equal(evaluateBudgetSession({ ...draft, balance }, 20).passed, false);
  }
  assert.equal(evaluateBudgetSession({ ...draft, balance: '' }, 10).passed, true);
  assert.equal(evaluateBudgetSession({ ...draft, values: null }, 20).passed, false);
});

test('saved activity can restore a quiz or editable work but cannot open a locked step', () => {
  const state = { active: 'budget', progress: { budget: 1 }, works: {}, budgetActivity: { view: 'lesson', step: 1 } };
  const storedQuiz = JSON.parse(JSON.stringify({ index: 2, choice: 2, feedback: true }));
  assert.deepEqual(readBudgetQuiz(storedQuiz, 10), storedQuiz);
  assert.deepEqual(readBudgetResume(state), { view: 'lesson', step: 1 });
  assert.equal(readBudgetResume({ ...state, budgetActivity: { view: 'lesson', step: 2 } }), null);
  assert.deepEqual(readBudgetResume({ ...state, progress: { budget: 2 }, budgetActivity: { view: 'lesson', step: 2 } }), { view: 'lesson', step: 2 });
  assert.equal(readBudgetResume({ ...state, active: 'design' }), null);
});

test('export preserves older spreadsheets and includes the limit and balance in extended work', () => {
  const old = { values: [48, 125, 24] };
  assert.equal(budgetCsv(old), 'Expense,Amount\r\nTransport,48\r\nGroceries,125\r\nSubscriptions,24\r\nTotal,=SUM(B2:B4)\r\n');
  assert.match(budgetCsv({ ...old, limit: 320 }), /Budget limit,320\r\nRemaining,=B6-B5\r\n$/);
});
