import { normalizeStudio, studioCheck } from '../core/studio-practice.js';
import { normalizePythonChecks } from '../core/python-practice.js';

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
  if (practice?.pythonChecks !== undefined
    && !(practice.type === 'code' && typeof practice.language === 'string'
      && practice.language.toLowerCase() === 'python' && normalizePythonChecks(practice.pythonChecks))) {
    return ['invalid-python-checks'];
  }
  if (!practice || !['sheet', 'sql'].includes(practice.type)) return [];
  const issues = [];
  if (practice.type === 'sql' && isSpreadsheetLesson(input)) issues.push('spreadsheet-sql-workspace');
  if (issues.length) return issues;
  const verified = normalizeStudio(practice);
  if (!verified?.target) return [practice.target === undefined ? 'missing-practice-target' : 'unsupported-practice-target'];
  if (verified.type === 'sheet' && typeof step.criterion === 'string') {
    const formulas = step.criterion.match(/=\s*(?:SUM|AVERAGE|MIN|MAX)\s*\(\s*[A-D][2-7]\s*:\s*[A-D][2-7]\s*\)/gi);
    // A criterion stating a single formula must agree with the executable answer.
    if (formulas?.length === 1 && studioCheck(verified, formulas[0]) !== 'correct') issues.push('practice-target-mismatch');
  }
  return issues;
}

export function repeatsPracticeDataset(guided, final) {
  const practice = final?.practice;
  if (!['sheet', 'sql'].includes(practice?.type)) return false;
  const target = normalizeStudio(practice);
  if (!target) return false;
  const rows = JSON.stringify(target.rows);
  return guided.some(step => step?.practice?.type === target.type
    && JSON.stringify(normalizeStudio(step.practice)?.rows) === rows);
}
