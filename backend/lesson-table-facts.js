import { normalizeTable, sheetValue } from '../core/studio-practice.js';

// A bounded consistency check, not a general natural-language fact checker.
// Only inspect spreadsheet facts whose table and meaning can be resolved without
// guessing. In this workspace headers occupy row 1 and data start at row 2.
const cell = String.raw`\$?[A-Z]{1,2}\$?[1-9]\d{0,2}`;
// Accept only a complete plain decimal claim. A leading operand, grouped number
// or scientific notation is not that claim; never compare its numeric prefix.
const number = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)(?![\p{L}\p{N}_]|[.,'’]\d|\s+\d|\s*[-+*/=×÷−%])`;
const relation = String.raw`(?:is|contains|holds|shows|equals|равно|содержит|показывает|тең|=|—|–)`;
const conditional = /\b(?:not|except|if|when|assume|assuming|would|should|after|before|instead|suppose|imagine|isn't|isn’t|doesn't|doesn’t)\b|(?:^|[^\p{L}])(?:не|кроме|если|после|вместо|егер|кейін|емес|орнына)(?=$|[^\p{L}])/iu;
const addressQuestion = /\b(?:which|what)\s+cell\b|(?:какой|какая|каком|какую)\s+ячейк\p{L}*|қай\s+ұяшық\p{L}*/iu;
const nonLookup = /\b(?:formula|sum|move|insert|shift|replace|next|new)\b|формул|перемест|встав|замен|жылж|ауыстыр|жаңа/iu;
const approximate = /\b(?:approximately|approx|rounded|about)\b|округл|примерно|шамамен/iu;
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mentions(text, value) {
  return typeof value === 'string' && /\p{L}/u.test(value)
    && new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(value.trim())}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

function namedAddress(table, text) {
  const columns = table.columns.flatMap((label, index) => mentions(text, label) ? [index] : []);
  const rows = table.rows.flatMap((row, index) => row.some(value => mentions(text, value)) ? [index] : []);
  // Repeated labels, multiple rows/columns, inflected or absent labels are
  // ambiguous. Leave them to the model rather than reject a possibly valid task.
  return columns.length === 1 && rows.length === 1
    ? String.fromCharCode(65 + columns[0]) + (rows[0] + 2) : null;
}

function coordinate(value) {
  const match = /^\$?([A-Z]{1,2})\$?([1-9]\d{0,2})$/i.exec(String(value).trim());
  return match ? match[1].toUpperCase() + match[2] : null;
}

function cellValue(table, address) {
  const match = /^([A-D])([1-7])$/.exec(address);
  if (!match) return undefined;
  const column = match[1].charCodeAt(0) - 65, row = Number(match[2]);
  return row === 1 ? table.columns[column] : table.rows[row - 2]?.[column];
}

function assertions(table, text, issues) {
  if (typeof text !== 'string') return;
  // Keep thousands separators and decimal points intact. Split a comma only
  // when another explicit cell assertion starts, as in "A1 is Item, B2 is ...".
  const clauses = text.split(/[.!?](?=\s|$)|[;\n]|,\s+(?=(?:and\s+)?(?:cell\s+)?\$?[A-Z]{1,2}\$?[1-9])/iu);
  for (const clause of clauses) {
    if (conditional.test(clause)) continue;
    const references = [...clause.matchAll(new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${cell})\\s*${relation}(?=$|[^\\p{L}])`, 'giu'))];
    const expected = namedAddress(table, clause);
    if (expected && references.length === 1 && coordinate(references[0][1]) !== expected) {
      issues.add('table-cell-claim');
    }
    const values = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${cell})\\s*${relation}\\s*(${number})`, 'giu');
    for (const match of clause.matchAll(values)) {
      const actual = cellValue(table, coordinate(match[1]));
      if (typeof actual === 'number' && actual !== Number(match[2])) issues.add('table-cell-value');
    }
    const results = new RegExp(String.raw`(?:=\s*)?((?:SUM|AVERAGE|MIN|MAX)\s*\(\s*[A-D][2-7]\s*:\s*[A-D][2-7]\s*\))\s*(?:returns?|equals?|is|равно|возвращает|тең|=|—|–)\s*(${number})`, 'giu');
    for (const match of approximate.test(clause) ? [] : clause.matchAll(results)) {
      const actual = sheetValue(table, '=' + match[1]);
      if (actual !== null && Math.abs(actual - Number(match[2])) > 1e-9 * Math.max(1, Math.abs(actual))) {
        issues.add('table-formula-result');
      }
    }
  }
}

export function lessonTableFactIssues(step) {
  if (step?.practice?.type !== 'sheet') return [];
  const practice = normalizeTable(step.practice);
  if (!practice) return [];
  const issues = new Set();
  for (const text of [step.task, step.criterion]) assertions(practice, text, issues);

  const example = step.teaching?.example;
  const table = example?.visual?.type === 'table' ? normalizeTable(example.visual) : null;
  // A worked example may intentionally use different data from the workspace.
  // Never use the practice table to guess facts about an unstructured example.
  if (!table) return [...issues];
  for (const text of [example.output, example.explanation]) assertions(table, text, issues);
  const assessment = step.teaching?.assessment;
  const question = assessment?.question;
  if (assessment?.type === 'choice' && typeof question === 'string'
    && addressQuestion.test(question) && !conditional.test(question) && !nonLookup.test(question)) {
    const expected = namedAddress(table, question);
    const options = Array.isArray(assessment.options) ? assessment.options.map(coordinate) : null;
    if (expected && options?.length && options.every(Boolean)
      && (options[assessment.answer] !== expected || options.filter(value => value === expected).length !== 1)) {
      issues.add('table-cell-answer');
    }
    const explanation = assessment.explanation;
    if (expected && typeof explanation === 'string' && !conditional.test(explanation)) {
      const conclusions = new RegExp(`(?:\\b(?:cell|answer|address)\\s+(?:is|=)|(?:ячейка|адрес|ответ|жауап|ұяшық|мекенжай)\\s*[:=—–])\\s*(${cell})(?![\\p{L}\\p{N}])`, 'giu');
      if ([...explanation.matchAll(conclusions)].some(match => coordinate(match[1]) !== expected)) {
        issues.add('table-cell-explanation');
      }
    }
  }
  return [...issues];
}
