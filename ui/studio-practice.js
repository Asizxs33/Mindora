import { escapeHtml as esc } from '../core/engine.js';
import { normalizeStudio, queryTable, sheetValue, studioCheck } from '../core/studio-practice.js';
import { t } from './language.js';

export function studioTable({ columns, rows }, sheet = false) {
  return '<div class="studio-grid-scroll"><table class="studio-grid"><thead>' + (sheet ? '<tr><td></td>' + columns.map((_, i) => '<th scope="col">' + String.fromCharCode(65+i) + '</th>').join('') + '</tr>' : '') +
    '<tr>' + (sheet ? '<th scope="row">1</th>' : '') + columns.map(v => '<th scope="col">' + esc(v) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((row, i) => '<tr>' + (sheet ? '<th scope="row">' + (i+2) + '</th>' : '') + row.map(v => '<td>' + esc(String(v)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}

const resultLabel = () => t('Result', 'Результат', 'Нәтиже');
const formulaHint = () => t('Use SUM, AVERAGE, MIN or MAX with a cell range.', 'Используй SUM, AVERAGE, MIN или MAX с диапазоном ячеек.', 'SUM, AVERAGE, MIN немесе MAX функциясын ұяшық ауқымымен қолдан.');
const queryHint = () => t('Select columns from this table. Add WHERE to filter on one column.', 'Выбери столбцы этой таблицы. Условие WHERE отбирает строки по одному столбцу.', 'Кесте бағандарын таңда. WHERE арқылы бір баған бойынша жолдарды сүзуге болады.');
const replyLabel = () => t('Your reply', 'Твоя реплика', 'Сенің жауабың');

export function expressionIssue(practice, value) {
  const check = studioCheck(practice, value);
  if (check === 'invalid') return practice.type === 'sql' ? queryHint() : formulaHint();
  if (check === 'different') return t('Compare your result with the task and try again.', 'Сверь результат с заданием и попробуй ещё раз.', 'Нәтижені тапсырмамен салыстырып, қайта көр.');
  return '';
}

function expressionPreview(practice, answer) {
  if (!answer.expression.trim()) return '';
  const result = practice.type === 'sql' ? queryTable(practice, answer.expression) : sheetValue(practice, answer.expression);
  if (result === null) return '<span class="studio-hint">' + (practice.type === 'sql' ? queryHint() : formulaHint()) + '</span>';
  const issue = expressionIssue(practice, answer.expression);
  const feedback = issue ? '<p class="studio-hint">' + issue + '</p>' : practice.target ? '<p>' + t('Matches the task.', 'Соответствует заданию.', 'Тапсырмаға сәйкес.') + '</p>' : '';
  if (practice.type === 'sheet') return '<output class="studio-number">' + esc(String(Number(result.toPrecision(12)))) + '</output>' + feedback;
  return studioTable(result) + (result.rows.length ? '' : '<p>' + t('No matching rows.', 'Подходящих строк нет.', 'Сәйкес жолдар табылмады.') + '</p>') + feedback;
}

function chart(practice, answer) {
  return '<figure class="studio-bars">' + practice.labels.map((name,i) => {
    const value = answer.values[i];
    return '<div class="studio-bar-row"><span>' + esc(name) + '</span><div aria-hidden="true"><i style="width:' + (100 * Number(value) / practice.max) + '%"></i></div><b>' + esc(value || '–') + '</b></div>';
  }).join('') + '</figure>';
}

export function studioPreview(practice, answer) {
  if (practice.type === 'sql' || practice.type === 'sheet') return expressionPreview(practice, answer);
  if (practice.type === 'bar-chart') return chart(practice, answer);
  return '';
}

export function studioEditor(practice, answer, disabled) {
  if (practice.type === 'sql' || practice.type === 'sheet') {
    const sql = practice.type === 'sql';
    const numberColumn = practice.columns.findIndex((_, i) => practice.rows.some(row => typeof row[i] === 'number'));
    const column = String.fromCharCode(65 + numberColumn);
    const sample = sql ? 'SELECT * FROM ' + practice.table : '=SUM(' + column + '2:' + column + (practice.rows.length+1) + ')';
    return (sql ? '<strong class="studio-table-name">' + esc(practice.table) + '</strong>' : '') + studioTable(practice, !sql) +
      '<label class="field"><span>' + (sql ? 'SQL' : t('Formula', 'Формула', 'Формула')) + '</span><input autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="240" data-practice-field="expression" placeholder="' + esc(sample) + '" value="' + esc(answer.expression) + '"' + disabled + '></label>' +
      '<div class="studio-live" aria-label="' + resultLabel() + '" aria-live="polite" data-studio-preview>' + expressionPreview(practice, answer) + '</div>';
  }
  if (practice.type === 'bar-chart') {
    return '<div class="studio-values">' + practice.labels.map((name,i) => '<label>' + esc(name) + '<input type="number" min="0" max="' + practice.max + '" step="1" required inputmode="numeric" data-practice-field="item' + i + '" value="' + esc(answer.values[i]) + '"' + disabled + '></label>').join('') +
      '</div><div data-studio-preview>' + chart(practice, answer) + '</div>';
  }
  const dialogue = practice.type === 'conversation';
  return '<ol class="studio-' + (dialogue ? 'chat' : 'flow') + '">' + (practice.labels || practice.turns).map((label,i) =>
    '<li><label><span>' + esc(label) + '</span><input required maxlength="' + (dialogue ? 100 : 65) + '" data-practice-field="item' + i + '" value="' + esc(answer.values[i]) + '"' +
    (dialogue ? ' placeholder="' + replyLabel() + '"' : '') + disabled + '></label></li>').join('') + '</ol>';
}

export function studioResult(practice, answer) {
  if (practice.type === 'sheet' || practice.type === 'sql') return '<code>' + esc(answer.expression) + '</code>' + studioPreview(practice, answer);
  if (practice.type === 'bar-chart') return chart(practice, answer);
  return '<ol class="studio-' + (practice.type === 'flow' ? 'flow' : 'chat') + '">' + (practice.labels || practice.turns).map((name,i) => '<li><strong>' + esc(name) + '</strong><div>' + esc(answer.values[i]) + '</div></li>').join('') + '</ol>';
}

// A worked expression runs against its own teaching dataset, independently of the submitted task.
export function workedStudio(practice, example) {
  if (!['sql', 'sheet'].includes(practice?.type) || example?.visual?.type !== 'table') return '';
  const dataset = normalizeStudio({ type:practice.type, table:practice.table, columns:example.visual.columns, rows:example.visual.rows });
  if (!dataset || studioCheck(dataset, example.input) !== 'ready') return '';
  const label = practice.type === 'sql' ? t('Try the query', 'Измени запрос', 'Сұранысты өзгертіп көр') : t('Try the formula', 'Измени формулу', 'Формуланы өзгертіп көр');
  return '<figure class="instructional-visual studio-example" data-studio-example="' + esc(JSON.stringify(dataset)) + '">' +
    '<figcaption><strong>' + esc(example.visual.label) + '</strong></figcaption>' + studioTable(dataset, practice.type === 'sheet') +
    '<label class="field"><span>' + label + '</span><input data-studio-expression value="' + esc(example.input) + '" maxlength="240" spellcheck="false" autocapitalize="off"></label>' +
    '<div aria-live="polite" data-studio-preview>' + expressionPreview(dataset, { expression:example.input }) + '</div></figure>';
}

export function updateWorkedStudio(input) {
  const figure = input.closest('[data-studio-example]');
  if (!figure) return;
  const dataset = JSON.parse(figure.dataset.studioExample);
  figure.querySelector('[data-studio-preview]').innerHTML = expressionPreview(dataset, { expression:input.value });
}
