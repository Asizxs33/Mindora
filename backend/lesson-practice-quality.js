import { normalizeTable, queryTable, sheetValue } from '../core/studio-practice.js';

const text = value => typeof value === 'string' ? value.slice(0, 1000) : '';
const spreadsheet = /\b(?:spreadsheets?|excel|google\s+sheets?|sheets\s+formulas?)\b|гугл\s*таблиц|электронн\p{L}*\s+таблиц|электронды\s+кесте|google\s+кесте/iu;
const sql = /\bsql\b|\bselect\s+.+\s+from\b/iu;

export function isSpreadsheetLesson(input = {}) {
  const stage = input.roadmapStage;
  const focus = [stage?.title, stage?.objective].map(text).join(' ');
  // A selected SQL stage can belong to a broader data/spreadsheet course.
  if (sql.test(focus) || (!stage && sql.test(text(input.goal)))) return false;
  const context = [input.goal, stage?.goal, stage?.originalGoal, focus].map(text).join(' ');
  return spreadsheet.test(context) && !(sql.test(context) && !spreadsheet.test(focus || text(input.goal)));
}

// Check the original model response, before normalizers can omit an invalid
// target. Reject and regenerate incompatible instructions; do not relabel the
// editor while leaving the learner with tasks for a different tool.
export function lessonPracticeIssues(step, input = {}) {
  const practice = step?.practice;
  if (!practice || !['sheet', 'sql'].includes(practice.type)) return [];
  const issues = [];
  if (practice.type === 'sql' && isSpreadsheetLesson(input)) issues.push('spreadsheet-sql-workspace');
  if (practice.target !== undefined) {
    const table = normalizeTable(practice);
    const target = practice.target;
    const valid = table && typeof target === 'string' && target.trim() && target.length <= 240
      && (practice.type === 'sheet' ? sheetValue(table, target) !== null
        : typeof practice.table === 'string' && queryTable({ ...table, table: practice.table }, target) !== null);
    if (!valid) issues.push('unsupported-practice-target');
  }
  return issues;
}
