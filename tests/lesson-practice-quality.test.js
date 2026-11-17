import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { isSpreadsheetLesson, lessonPracticeIssues, repeatsPracticeDataset } from '../backend/lesson-practice-quality.js';
import { normalizePractice } from '../core/lesson-practice.js';
import { getStarterCourse } from '../core/starter-courses.js';

// Captured from the published service: a Google Sheets range lesson asked the
// learner to aggregate through the SQL editor, which cannot do that operation.
const captured = JSON.parse(readFileSync(new URL('./fixtures/sheet-range-sql-mismatch.json', import.meta.url)));
const input = { goal: 'Use Google Sheets formulas to check a small weekly expense report.', minutes: 5, language: 'en' };

function corrected() {
  const result = structuredClone(captured);
  for (const [step, formula] of [[result.guided[0], '=SUM(B2:B5)'], [result.final, '=AVERAGE(B2:B5)']]) {
    step.practice.type = 'sheet';
    delete step.practice.table;
    step.practice.target = formula;
    step.task = `Enter ${formula} for the provided table. In the notes explain the start row and end row.`;
    step.criterion = `The formula uses B2:B5, excludes the row 1 header and includes all four amounts.`;
  }
  return result;
}

test('captured spreadsheet lesson is rejected rather than silently relabeled to another editor', () => {
  assert.deepEqual(lessonPracticeIssues(captured.guided[0], input), ['spreadsheet-sql-workspace']);
  assert.deepEqual(lessonPracticeIssues(captured.final, input), ['spreadsheet-sql-workspace']);
  for (const step of [corrected().guided[0], corrected().final]) assert.deepEqual(lessonPracticeIssues(step, input), []);
});

test('spreadsheet intent uses the original request and supports all interface languages', () => {
  for (const goal of ['Excel expense formulas', 'Google Sheets ranges', 'Формулы в электронных таблицах', 'Электронды кестелердегі формулалар']) {
    assert.equal(isSpreadsheetLesson({ goal }), true, goal);
  }
  assert.equal(isSpreadsheetLesson({ goal: 'Interpret a range', roadmapStage: { goal: 'Learn Google Sheets', title: 'B2:B5', objective: 'Read a range' } }), true);
  assert.equal(isSpreadsheetLesson({ goal: 'SQL queries for an Excel user' }), false);
  assert.equal(isSpreadsheetLesson({ goal: 'Learn Excel and SQL', roadmapStage: { title: 'SQL SELECT', objective: 'Select rows from a database' } }), false);
  assert.deepEqual(lessonPracticeIssues(captured.guided[0], { goal: 'Learn SQL column projection' }), ['missing-practice-target']);
});

test('unsupported raw targets are rejected before normalizers can discard them', () => {
  for (const [type, target] of [['sheet', '=COUNT(B2:B5)'], ['sheet', '=SUM(B2:B5)+1'], ['sheet', '=SUM(B2:B6)'], ['sql', 'SELECT SUM(amount) FROM weekly_expenses']]) {
    const step = structuredClone(captured.guided[0]);
    step.practice.type = type;
    step.practice.target = target;
    assert.equal(normalizePractice(step.practice).target, undefined, 'legacy normalization drops an unsupported target');
    assert.deepEqual(lessonPracticeIssues(step, { goal: 'Learn SQL' }), ['unsupported-practice-target']);
  }
  const step = structuredClone(captured.guided[0]);
  step.practice.target = 'SELECT amount AS quantity FROM weekly_expenses WHERE amount > 100';
  assert.deepEqual(lessonPracticeIssues(step, { goal: 'Learn SQL' }), []);
});

test('new spreadsheet practice requires a computable target and fresh independent data', () => {
  const { guided: [step], final } = corrected();
  step.criterion = 'Use =SUM(B2:B4) for the total.';
  assert.deepEqual(lessonPracticeIssues(step, input), ['practice-target-mismatch']);
  delete step.practice.target;
  assert.deepEqual(lessonPracticeIssues(step, input), ['missing-practice-target']);
  assert.equal(repeatsPracticeDataset([step], final), false);
  assert.equal(repeatsPracticeDataset([step], { ...final, practice: { ...final.practice, rows: step.practice.rows } }), true);
});

function fixture(outputs, request = input) {
  const calls = { content: [], signals: [], searches: 0 };
  const fetcher = async (url, options) => {
    calls.signals.push(options.signal);
    const body = JSON.parse(options.body);
    if (url.endsWith('/v1/tools/search')) {
      calls.searches++;
      return Response.json({ results: [{ url: 'https://example.org/sheet-ranges', title: 'Spreadsheet ranges', content: 'A1 notation has a column and row. B2:B5 includes four rows below the header. SUM adds range values and AVERAGE divides their sum by the count.' }] });
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const composing = Boolean(JSON.parse(body.messages[1].content).materials);
    if (composing) calls.content.push(body);
    const result = composing ? outputs[calls.content.length - 1] : { query: 'Google Sheets ranges', githubQuery: 'spreadsheet range lesson' };
    assert.notEqual(result, undefined, 'content retry budget exceeded');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
  };
  return { calls, generate: () => generateDeepSeekPlan(request, 'test-only', fetcher, { readPage: async () => null, readRenderedPage: async () => null }) };
}

test('live incompatible response triggers one complete regeneration using the same research and deadline', async () => {
  const run = fixture([captured, corrected()]);
  const plan = await run.generate();
  assert.ok(plan.steps.every(step => step.practice.type === 'sheet'));
  assert.equal(plan.steps[0].practice.target, '=SUM(B2:B5)');
  assert.equal(plan.steps[1].practice.target, '=AVERAGE(B2:B5)');
  assert.equal(run.calls.content.length, 2);
  assert.equal(run.calls.searches, 2);
  assert.equal(new Set(run.calls.signals).size, 1);
  assert.match(run.calls.content[0].messages[0].content, /NOT SQL/);
  assert.match(run.calls.content[1].messages.at(-1).content, /include a supported target matching the criterion and fresh rows/);
});

test('repeated incompatible output fails closed rather than publishing an impossible course', async () => {
  const run = fixture([captured, captured]);
  await assert.rejects(run.generate(), { name: 'LessonContentInvalid' });
  assert.equal(run.calls.content.length, 2);
});

test('valid sheet lesson needs no extra content generation', async () => {
  const run = fixture([corrected()]);
  await run.generate();
  assert.equal(run.calls.content.length, 1);
});

test('real supported SQL lesson keeps its query editor and target without a retry', async () => {
  const { plan } = getStarterCourse('sql-tables', 'en', 5);
  const raw = { formatVersion: 3, title: plan.title, outcome: plan.outcome,
    guided: [{ ...plan.steps[0], sourceId: 0, imageIds: [] }], final: plan.steps[1] };
  const run = fixture([raw], { ...input, goal: 'Learn SQL column projection' });
  const result = await run.generate();
  assert.ok(result.steps.every(step => step.practice.type === 'sql'));
  assert.equal(result.steps[0].practice.target, 'SELECT units FROM sales');
  assert.equal(run.calls.content.length, 1);
});
