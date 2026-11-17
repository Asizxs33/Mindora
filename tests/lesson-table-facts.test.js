import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonTableFactIssues } from '../backend/lesson-table-facts.js';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';

// The observed live lesson used these exact data and contradictory claims.
const table = {
  columns: ['Item', 'Reported', 'Receipts'],
  rows: [['Fuel', 80, 80], ['Lunch', 60, 60], ['Printing', 45, 0], ['Phone', 120, 120], ['Parking', 180, 180]],
};
const captured = {
  title: 'Cells, rows, columns and one SUM',
  instruction: 'Row 1 holds the headers. A cell address combines its column letter and row number.',
  task: 'Use =SUM(B2:B6) to total Reported in the workspace table.',
  criterion: '=SUM(B2:B6) returns 485.',
  sourceId: 0, imageIds: [], practice: { type: 'sheet', ...structuredClone(table), target: '=SUM(B2:B6)' },
  teaching: {
    why: 'Point at exact data and total a column without retyping numbers.',
    example: {
      input: 'A five-row expense table. Reported values: 80, 60, 45, 120, 180.',
      output: 'Cell A1 is Item, B2 is the Reported value 60 for Lunch, and =SUM(B2:B6) returns 485.',
      explanation: 'A1 is the first header. B2 means column B, row 2, which holds the second Reported value.',
      visual: { type: 'table', label: 'Reported vs receipts', ...structuredClone(table) },
    },
    assessment: {
      type: 'choice', question: 'In the table, which cell holds the Receipts value for Printing?',
      options: ['C3', 'B3', 'C2', 'A3'], answer: 0,
      explanation: 'Printing is the third data row, so row 3. Receipts is the third column, C. The cell is C3.',
    },
    takeaway: 'A cell address is column letter plus row number.',
  },
};

function corrected() {
  const step = structuredClone(captured);
  step.teaching.example.output = 'Cell A1 is Item, B3 is the Reported value 60 for Lunch, and =SUM(B2:B6) returns 485.';
  step.teaching.example.explanation = 'B3 is column B, row 3: Lunch is the second data row, below the header in row 1.';
  step.teaching.assessment.options = ['C4', 'B3', 'C2', 'A3'];
  step.teaching.assessment.explanation = 'Printing is data row 3, spreadsheet row 4. Receipts is column C, so the answer is C4.';
  return step;
}

test('captured live off-by-one teaching and impossible cell-address quiz are rejected', () => {
  assert.deepEqual(new Set(lessonTableFactIssues(captured)), new Set(['table-cell-claim', 'table-cell-answer', 'table-cell-explanation']));
  assert.deepEqual(lessonTableFactIssues(corrected()), []);
});

test('a correct marked option cannot retain an explicit contradictory answer explanation', () => {
  const step = corrected();
  step.teaching.assessment.explanation = 'The cell is C3.';
  assert.deepEqual(lessonTableFactIssues(step), ['table-cell-explanation']);
  step.teaching.assessment.explanation = 'C3 is Lunch; the answer is C4.';
  assert.deepEqual(lessonTableFactIssues(step), []);
});

test('an incorrect answer index is rejected even when the correct option is available', () => {
  const step = corrected();
  step.teaching.assessment.answer = 1;
  assert.ok(lessonTableFactIssues(step).includes('table-cell-answer'));
  step.teaching.assessment.answer = 0;
  step.teaching.assessment.options[1] = '$C$4';
  assert.ok(lessonTableFactIssues(step).includes('table-cell-answer'), 'two equivalent correct options are ambiguous');
});

test('cell lookup works with uniquely named English, Russian and Kazakh labels', () => {
  for (const [columns, labels, question] of [
    [['Item', 'Reported', 'Receipts'], ['Fuel', 'Lunch', 'Printing'], 'Which cell contains Receipts for Printing?'],
    [['Статья', 'Заявлено', 'Чеки'], ['Топливо', 'Обед', 'Печать'], 'В какой ячейке находятся «Чеки» для строки «Печать»?'],
    [['Шығын', 'Есеп', 'Түбіртек'], ['Жанармай', 'Түскі ас', 'Баспа'], '«Баспа» жолының «Түбіртек» мәні қай ұяшықта орналасқан?'],
  ]) {
    const step = corrected();
    step.teaching.example.visual.columns = columns;
    step.teaching.example.visual.rows = labels.map((label, i) => [label, i + 10, i + 10]);
    step.teaching.example.output = ''; step.teaching.example.explanation = '';
    Object.assign(step.teaching.assessment, { question, options: ['C4', 'B3', 'C2'], answer: 0 });
    assert.deepEqual(lessonTableFactIssues(step), [], question);
    step.teaching.assessment.answer = 1;
    assert.deepEqual(lessonTableFactIssues(step), ['table-cell-answer'], question);
  }
});

test('ambiguous, conditional, non-address and non-spreadsheet assessments are not guessed', () => {
  for (const change of [
    step => { step.teaching.example.visual.rows[1][0] = 'Printing'; },
    step => { step.teaching.assessment.question = 'Which cell is NOT the Receipts value for Printing?'; },
    step => { step.teaching.assessment.question = 'Which cell contains Receipts for Printing after inserting a row?'; },
    step => { step.teaching.assessment.question = 'Which cell contains Receipts for Printing or Lunch?'; },
    step => { step.teaching.assessment.options = ['a formula', 'a number', 'a label']; },
    step => { step.practice.type = 'sql'; },
    step => { delete step.teaching.example.visual; },
  ]) {
    const step = corrected();
    step.teaching.example.output = ''; step.teaching.example.explanation = '';
    step.teaching.assessment.answer = 1;
    change(step);
    assert.deepEqual(lessonTableFactIssues(step), []);
  }
});

test('explicit cell values and aggregate results use the real table, not model arithmetic', () => {
  for (const [claim, expected] of [
    ['B2 = 80. B3 contains 60. =SUM(B2:B6) returns 485.', []],
    ['B2 = 60.', ['table-cell-value']],
    ['B2 содержит 60.', ['table-cell-value']],
    ['B2 тең 60.', ['table-cell-value']],
    ['=SUM(B2:B6) returns 484.', ['table-formula-result']],
    ['AVERAGE(B2:B6) = 97. MIN(B2:B6) = 45. MAX(B2:B6) = 180.', []],
    ['=SUM(B2:B6) равно 484.', ['table-formula-result']],
    ['=SUM(B2:B6) тең 484.', ['table-formula-result']],
    ['AVERAGE(B2:B4) = 61.67 (rounded).', []],
    ['B2 is not 60. If B2 = 60, then the total changes.', []],
    ['B2 = 1,000.', []], // Unsupported localized numeric notation is not partially parsed.
  ]) {
    const step = corrected(); step.teaching.example.output = claim;
    assert.deepEqual(lessonTableFactIssues(step), expected, claim);
  }
});

test('worked-example data and independent-workspace data are checked in their own scopes', () => {
  const step = corrected();
  step.practice.rows[0][1] = 100;
  step.criterion = '=SUM(B2:B6) returns 505.';
  assert.deepEqual(lessonTableFactIssues(step), []);
  step.criterion = '=SUM(B2:B6) returns 485.';
  assert.deepEqual(lessonTableFactIssues(step), ['table-formula-result']);
});

test('numeric prefixes and intermediate operands are not mistaken for final table results', () => {
  const step = corrected();
  step.practice = { type: 'sheet', columns: ['Item', 'Amount'], rows: [['First', 1000], ['Second', 20]] };
  step.task = 'Read the table.';
  for (const claim of [
    '=SUM(B2:B3) = 1000 + 20 = 1020.',
    'SUM(B2:B3) returns 1 020.',
    'SUM(B2:B3) returns 1.02e3.',
    'B2 = 1 000.',
    'B2 = 1\u202f000.',
    'B2 = 1e3.',
    'B2 = 1E+3.',
    'B2 = 1,000.',
    'B2 = 1\'000.',
    'When B2 = 10, use the new value.',
    'Assume B2 = 10 for this hypothetical example.',
  ]) {
    step.criterion = claim;
    assert.deepEqual(lessonTableFactIssues(step), [], claim);
  }
  step.criterion = 'SUM(B2:B3) returns 1021.';
  assert.deepEqual(lessonTableFactIssues(step), ['table-formula-result']);
  step.criterion = 'B2 = 1001.';
  assert.deepEqual(lessonTableFactIssues(step), ['table-cell-value']);
});

const input = { goal: 'Read spreadsheet expense tables and cell addresses', minutes: 5, language: 'en' };
function rawLesson(step) {
  return {
    formatVersion: 3, title: 'Read a small expense table', outcome: 'Identify a cell and total the Reported column.',
    guided: [step],
    final: {
      title: 'Total fresh expenses', task: 'Write =SUM(B2:B3) for the new table and explain the result.',
      criterion: '=SUM(B2:B3) returns 70.',
      practice: { type: 'sheet', columns: ['Item', 'Reported'], rows: [['Taxi', 30], ['Supplies', 40]], target: '=SUM(B2:B3)' },
    },
  };
}
function fixture(outputs) {
  const requests = { compositions: [], searches: 0, signals: [] };
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.signals.push(options.signal);
    if (url.endsWith('/v1/tools/search')) {
      requests.searches++;
      return Response.json({ results: [{ url: 'https://example.org/spreadsheet-cells', title: 'Spreadsheet cells', content: 'Headers are in row 1. The first data row is row 2. Columns use letters. SUM adds the values in a range.' }] });
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const composing = Boolean(JSON.parse(body.messages[1].content).materials);
    if (composing) requests.compositions.push(body);
    const content = composing ? outputs[requests.compositions.length - 1] : { query: 'Spreadsheet cell addresses', githubQuery: 'spreadsheet formulas' };
    assert.notEqual(content, undefined, 'retry budget was exceeded');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] });
  };
  return { requests, generate: () => generateDeepSeekPlan(input, 'test-only', fetcher, { readPage: async () => null, readRenderedPage: async () => null }) };
}

test('factual rejection regenerates once with original evidence and the same deadline', async () => {
  const bad = rawLesson(structuredClone(captured));
  bad.title = 'REJECTED_FACT_RESPONSE_MUST_NOT_BE_REPLAYED';
  const run = fixture([bad, rawLesson(corrected())]);
  const result = await run.generate();
  assert.equal(result.steps[0].teaching.assessment.options[0], 'C4');
  assert.equal(run.requests.compositions.length, 2);
  assert.equal(run.requests.searches, 2);
  assert.equal(new Set(run.requests.signals).size, 1);
  const [initial, retry] = run.requests.compositions;
  assert.deepEqual(retry.messages.slice(0, initial.messages.length), initial.messages);
  assert.match(retry.messages.at(-1).content, /deterministic table check/);
  assert.doesNotMatch(JSON.stringify(retry.messages), /REJECTED_FACT_RESPONSE_MUST_NOT_BE_REPLAYED/);
});

test('two factually inconsistent responses fail closed within the existing retry limit', async () => {
  const run = fixture([rawLesson(captured), rawLesson(captured)]);
  await assert.rejects(run.generate(), { name: 'LessonContentInvalid' });
  assert.equal(run.requests.compositions.length, 2);
});

test('a consistent lesson requires no factual-review model call', async () => {
  const run = fixture([rawLesson(corrected())]);
  await run.generate();
  assert.equal(run.requests.compositions.length, 1);
});
