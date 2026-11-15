export const STUDIO_TYPES = Object.freeze(['sql', 'sheet', 'bar-chart', 'flow', 'conversation']);
const short = (v, max) => typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null;
const identifier = v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(v);
function labels(values, min, max, length) {
  if (!Array.isArray(values) || values.length < min || values.length > max) return null;
  const clean = values.map(value => short(value, length));
  return clean.every(Boolean) && new Set(clean).size === clean.length ? clean : null;
}

export function normalizeTable(raw) {
  const columns = labels(raw?.columns, 1, 4, 32);
  if (!columns || !Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > 6) return null;
  const rows = [];
  for (const row of raw.rows) {
    if (!Array.isArray(row) || row.length !== columns.length) return null;
    const cells = row.map(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e8 ? v : short(v, 48));
    if (cells.includes(null)) return null;
    rows.push(cells);
  }
  return { columns, rows };
}

export function normalizeStudio(raw) {
  const { type } = raw;
  if (type === 'sheet' || type === 'sql') {
    const table = normalizeTable(raw);
    if (!table) return null;
    if (type === 'sql') {
      if (!identifier(raw.table) || !table.columns.every(identifier) || new Set(table.columns.map(v => v.toLowerCase())).size !== table.columns.length) return null;
      const practice = { type, table: raw.table, ...table };
      const target = short(raw.target, 240);
      if (target && queryTable(practice, target)) practice.target = target;
      return practice;
    }
    if (!table.rows.some(row => row.some(v => typeof v === 'number'))) return null;
    const practice = { type, ...table };
    const target = short(raw.target, 240);
    if (target && sheetValue(practice, target) !== null) practice.target = target;
    return practice;
  }
  if (type === 'conversation') {
    const turns = labels(raw.turns, 1, 3, 110);
    return turns ? { type, turns } : null;
  }
  const items = labels(raw.labels, 2, 5, 38);
  if (!items) return null;
  if (type === 'flow') return { type, labels: items };
  if (type === 'bar-chart' && Number.isInteger(raw.max) && raw.max >= 1 && raw.max <= 1000) return { type, labels: items, max: raw.max };
  return null;
}

// Interpret only this lesson's bounded in-memory table, never learner code or database commands.
export function queryTable(practice, expression) {
  const m = /^select\s+(\*|[a-z_]\w*(?:\s*,\s*[a-z_]\w*)*)\s+from\s+([a-z_]\w*)(?:\s+where\s+([a-z_]\w*)\s*(<=|>=|<>|!=|=|<|>)\s*(-?\d+(?:\.\d+)?|'(?:[^']|'')*'))?\s*;?$/i.exec(expression.trim());
  if (!m || m[2].toLowerCase() !== practice.table.toLowerCase()) return null;
  const names = practice.columns.map(c => c.toLowerCase());
  const indexes = m[1] === '*' ? names.map((_, i) => i) : m[1].toLowerCase().split(/\s*,\s*/).map(c => names.indexOf(c));
  if (indexes.includes(-1)) return null;
  let rows = practice.rows;
  if (m[3]) {
    const index = names.indexOf(m[3].toLowerCase());
    if (index < 0) return null;
    const expected = m[5].startsWith("'") ? m[5].slice(1, -1).replaceAll("''", "'") : Number(m[5]);
    rows = rows.filter(row => {
      const value = row[index];
      if (typeof value !== typeof expected) return false;
      switch (m[4]) {
        case '=': return value === expected;
        case '!=': case '<>': return value !== expected;
        case '<': return value < expected;
        case '>': return value > expected;
        case '<=': return value <= expected;
        case '>=': return value >= expected;
      }
    });
  }
  return { columns: indexes.map(i => practice.columns[i]), rows: rows.map(row => indexes.map(i => row[i])) };
}

export function sheetValue(practice, expression) {
  const m = /^=\s*(SUM|AVERAGE|MIN|MAX)\s*\(\s*([A-D])([2-7])\s*:\s*([A-D])([2-7])\s*\)$/i.exec(expression.trim());
  if (!m) return null;
  const col = s => s.toUpperCase().charCodeAt(0) - 65;
  const left = col(m[2]), right = col(m[4]), top = Number(m[3])-2, bottom = Number(m[5])-2;
  if (top > bottom || left > right || bottom >= practice.rows.length || right >= practice.columns.length) return null;
  const values = practice.rows.slice(top, bottom+1).flatMap(row => row.slice(left, right+1)).filter(v => typeof v === 'number');
  if (!values.length) return null;
  switch (m[1].toUpperCase()) {
    case 'MAX': return Math.max(...values);
    case 'MIN': return Math.min(...values);
    case 'SUM': return values.reduce((a,b) => a+b, 0);
    case 'AVERAGE': return values.reduce((a,b) => a+b, 0) / values.length;
  }
}

export function studioCheck(practice, expression) {
  if (!expression.trim()) return 'empty';
  const evaluate = practice.type === 'sql' ? queryTable : sheetValue;
  const actual = evaluate(practice, expression);
  if (actual === null) return 'invalid';
  if (!practice.target) return 'ready';
  const expected = evaluate(practice, practice.target);
  return JSON.stringify(actual) === JSON.stringify(expected) ? 'correct' : 'different';
}

function inputText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}

export function studioAnswer(practice, fields) {
  const { type } = practice;
  if (type === 'sheet' || type === 'sql') {
    const expression = inputText(fields.expression, 240);
    if (type === 'sheet') return { type, expression, result: sheetValue(practice, expression) };
    const result = queryTable(practice, expression);
    return { type, expression, rowCount: result?.rows.length ?? null, sample: result?.rows[0]?.map(v => String(v).slice(0,24)) || [] };
  }
  const items = practice.labels || practice.turns;
  const values = items.map((_,i) => {
    const value = fields['item'+i] ?? fields.values?.[i] ?? '';
    if (type === 'bar-chart') return value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= practice.max ? String(Number(value)) : '';
    return inputText(value, type === 'conversation' ? 100 : 65);
  });
  return { type, values };
}
