import { escapeHtml as esc } from '../core/engine.js';
import { drawingSvg, relationModel, RELATIONS } from '../core/lab-models.js';
import { icon } from './icons.js';
import { t } from './language.js';

const capy = new URL('./assets/characters/mino-scenes/03-learning-map.png', import.meta.url).href;

export function capyEditor(practice) {
  const targetX = practice.challenge === 'north' ? 0 : 3;
  return `<section class="capy-lab" aria-label="${t('Code playground', 'Кодовая площадка', 'Код алаңы')}">
    <div class="lab-heading">${icon('code', 20)}<strong>${t('Code → movement', 'Код → движение', 'Код → қозғалыс')}</strong></div>
    <p class="lab-instruction">${t('Guide Mino to the flag. Orange arrows show the direction he is facing.', 'Доведи Мино до флага. Оранжевая стрелка показывает направление движения.', 'Миноны жалауға жеткіз. Қызғылт сары көрсеткі оның бағытын көрсетеді.')}</p>
    <div class="capy-board" data-capy-board>${Array.from({ length: 16 }, (_, n) => { const x = n % 4, y = Math.floor(n / 4); return `<span class="capy-cell${y === 1 && (x === 1 || x === 2) ? ' is-wall' : ''}" data-capy-cell="${x},${y}">${y === 0 && x === targetX ? icon('flag', 25) : ''}</span>`; }).join('')}<span class="capy-token" data-capy-token style="transform:translate(0%,300%)"><img src="${capy}" alt="Mino" width="288" height="288"><b data-capy-direction aria-hidden="true">→</b></span></div>
    <p class="lab-command-help"><code>forward(2)</code> ${t('move', 'вперёд', 'алға')} · <code>left()</code> / <code>right()</code> ${t('turn', 'поворот', 'бұрылу')}<br><code>repeat(3) { forward(1) }</code> ${t('repeat', 'повтор', 'қайталау')}</p>
    <p class="small-note">${t('This small teaching language moves Mino; it is separate from Python.', 'Это учебный язык для управления Мино, отдельный от Python.', 'Бұл — Миноны басқаруға арналған оқу тілі, Python тілінен бөлек.')}</p>
  </section>`;
}

export function drawingEditor(answer, busy) {
  const disabled = busy ? ' disabled' : '';
  return `<section class="drawing-lab"><div class="lab-heading">${icon('palette', 20)}<strong>${t('Drawing studio', 'Мастерская рисунка', 'Сурет шеберханасы')}</strong></div>
    <div class="drawing-tools"><label>${t('Color', 'Цвет', 'Түс')}<input type="color" data-drawing-color value="#bc4b00"${disabled}></label><label>${t('Tool', 'Инструмент', 'Құрал')}<select data-drawing-tool${disabled}><option value="brush">${t('Brush', 'Кисть', 'Қылқалам')}</option><option value="line">${t('Line', 'Линия', 'Сызық')}</option><option value="rectangle">${t('Rectangle', 'Прямоугольник', 'Тіктөртбұрыш')}</option><option value="circle">${t('Circle', 'Круг', 'Шеңбер')}</option></select></label><button type="button" class="secondary" data-drawing-undo${disabled}>${t('Undo', 'Отменить', 'Қайтару')}</button><button type="button" class="text-link" data-drawing-clear${disabled}>${t('Clear', 'Очистить', 'Тазалау')}</button></div>
    <div class="drawing-surface" data-drawing-surface${busy ? ' aria-disabled="true"' : ''} aria-label="${t('Draw with a finger or mouse. Shape tools are also available.', 'Рисуй пальцем или мышью. Можно выбрать геометрическую фигуру.', 'Саусақпен не тінтуірмен сал. Геометриялық пішіндерді де таңдауға болады.')}">${drawingSvg(answer.strokes)}</div>
    <p class="small-note">${t('Up to 12 strokes and 64 points. Your drawing stays with your answer.', 'До 12 штрихов и 64 точек. Рисунок сохраняется вместе с ответом.', '12 сызық пен 64 нүктеге дейін. Сурет жауабыңмен бірге сақталады.')}</p><p data-drawing-status role="status"></p>
    <input type="hidden" data-practice-field="strokes" value="${esc(JSON.stringify(answer.strokes))}">
  </section>`;
}

export function relationEquation(m) {
  return m.relation === 'logarithm' ? `${m.base}<sup>${m.exponent}</sup> = ${m.value} ⇔ log<sub>${m.base}</sub>(${m.value}) = ${m.exponent}`
    : `y = ${m.relation === 'linear' ? `${m.base} × ${m.exponent}` : m.relation === 'quadratic' ? `${m.base} × ${m.exponent}<sup>2</sup>` : `${m.base}<sup>${m.exponent}</sup>`} = ${m.value}`;
}

export function logGraph(base, exponent, relation = 'logarithm') {
  const m = relationModel(base, exponent, relation), x = value => 30 + value / m.max * 270, y = value => 180 - value / m.yMax * 150;
  const curve = Array.from({ length: 61 }, (_, i) => {
    const value = relation === 'logarithm' ? 1 + (m.max - 1) * i / 60 : m.max * i / 60;
    const result = relation === 'logarithm' ? Math.log(value) / Math.log(m.base) : relation === 'linear' ? m.base * value : relation === 'quadratic' ? m.base * value ** 2 : m.base ** value;
    return `${x(value).toFixed(2)},${y(result).toFixed(2)}`;
  }).join(' ');
  return `<svg viewBox="0 0 330 220" role="img" aria-label="${m.relation}, x = ${m.x}, y = ${m.y}"><path d="M30 15V180H315" class="lab-axis"/>${[m.yMax / 3, 2 * m.yMax / 3, m.yMax].map(n => `<path d="M30 ${y(n)}H310" class="lab-grid"/><text x="12" y="${y(n) + 4}">${n}</text>`).join('')}<polyline points="${curve}" class="lab-curve"/><path d="M${x(m.x)} 180V${y(m.y)}H30" class="lab-guide"/><circle cx="${x(m.x)}" cy="${y(m.y)}" r="6" class="lab-point"/><text x="25" y="201">0</text><text x="${x(m.max / 2) - 8}" y="201">${m.max / 2}</text><text x="${x(m.max) - 10}" y="201">${m.max}</text><text x="314" y="198">x</text><text x="10" y="18">y</text></svg>`;
}

export function logExplorer(answer = {}, persist = false) {
  const m = relationModel(answer.base ?? 2, answer.exponent ?? 3, answer.relation ?? 'logarithm');
  return `<section class="log-lab" data-log-explorer><div class="lab-heading">${icon('chart', 20)}<strong>${t('Explore the relationship', 'Исследуй зависимость', 'Байланысты зертте')}</strong></div><p class="lab-instruction">${t('Choose a relationship and move its point. The graph and equation update together.', 'Выбери зависимость и двигай точку. График и уравнение изменяются вместе.', 'Байланысты таңдап, нүктені қозға. График пен теңдеу бірге өзгереді.')}</p>
    <label class="lab-relation-label">${t('Relationship', 'Зависимость', 'Байланыс')}<select data-log-relation${persist ? ' data-practice-field="relation"' : ''}>${RELATIONS.map(kind => `<option value="${kind}"${kind === m.relation ? ' selected' : ''}>${{ logarithm: 'y = logₐ(x)', linear: 'y = a × x', quadratic: 'y = a × x²', exponential: 'y = aˣ' }[kind]}</option>`).join('')}</select></label><div data-log-graph>${logGraph(m.base, m.exponent, m.relation)}</div><output class="log-equation" data-log-equation>${relationEquation(m)}</output>
    <div class="log-controls"><label>${t('Base', 'Основание', 'Негіз')} <input type="range" min="2" max="5" step="1" value="${m.base}" data-log-base${persist ? ' data-practice-field="base"' : ''}></label><label><span data-log-position-label>${m.relation === 'logarithm' ? t('Exponent', 'Степень', 'Дәреже') : 'x'}</span> <input type="range" min="0" max="3" step="1" value="${m.exponent}" data-log-exponent${persist ? ' data-practice-field="exponent"' : ''}></label></div></section>`;
}
