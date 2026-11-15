import { cleanStrokes, drawingSvg, relationModel, runCapyCode } from './lab-models.js';
import { logGraph, relationEquation } from '../ui/learning-labs.js';
import { t } from '../ui/language.js';

export function mountLearningLabs({ document, getPractice }) {
  let active = null, drawing = null;
  const save = form => form.querySelector('[data-practice-field="output"], [data-practice-field="strokes"]')?.dispatchEvent(new Event('input', { bubbles: true }));
  const cancel = () => { if (active) { active.cancelled = true; if (active.form.isConnected) { active.button.disabled = false; active.form.querySelector('[data-capy-stop]').hidden = true; } active = null; } };
  const paint = (form, strokes) => {
    const clean = cleanStrokes(strokes);
    form.querySelector('[data-drawing-surface]').innerHTML = drawingSvg(clean);
    form.querySelector('[data-practice-field="strokes"]').value = JSON.stringify(clean);
  };
  document.addEventListener('input', event => {
    if (event.target.matches?.('[data-practice-field="code"]')) cancel();
    const lab = event.target.closest?.('[data-log-explorer]');
    if (!lab) return;
    const model = relationModel(lab.querySelector('[data-log-base]').value, lab.querySelector('[data-log-exponent]').value, lab.querySelector('[data-log-relation]').value);
    lab.querySelector('[data-log-position-label]').textContent = model.relation === 'logarithm' ? t('Exponent', 'Степень', 'Дәреже') : 'x';
    lab.querySelector('[data-log-graph]').innerHTML = logGraph(model.base, model.exponent, model.relation);
    lab.querySelector('[data-log-equation]').innerHTML = relationEquation(model);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-capy-run],[data-capy-stop],[data-drawing-undo],[data-drawing-clear]');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-capy-stop')) return cancel();
    const form = button.form, practice = getPractice();
    if (!form || !practice) return;
    if (practice.type === 'drawing') {
      const strokes = cleanStrokes(form.querySelector('[data-practice-field="strokes"]').value);
      paint(form, button.hasAttribute('data-drawing-clear') ? [] : strokes.slice(0, -1)); save(form); return;
    }
    if (practice.type !== 'code' || practice.language !== 'capy') return;
    cancel();
    const code = form.querySelector('[data-practice-field="code"]').value;
    const status = form.querySelector('[data-capy-status]');
    let run;
    try { run = runCapyCode(code, practice.challenge); } catch (error) {
      status.textContent = error.message === 'limit' ? t('Use at most 80 actions and 3 nested repeats.', 'Не больше 80 действий и 3 вложенных повторов.', '80 әрекет пен 3 қабат қайталаудан асырма.') : t('Check the command spelling, parentheses and braces.', 'Проверь команды, круглые и фигурные скобки.', 'Командаларды, жай және фигуралы жақшаларды тексер.'); return;
    }
    const operation = { form, button, cancelled: false }; active = operation;
    const stop = form.querySelector('[data-capy-stop]'); button.disabled = true; stop.hidden = false;
    status.textContent = t('Running your instructions…', 'Выполняем твои команды…', 'Командаларың орындалып жатыр…');
    form.querySelectorAll('.is-visited').forEach(cell => cell.classList.remove('is-visited'));
    for (const state of run.states) {
      if (operation.cancelled || !form.isConnected || getPractice() !== practice) { cancel(); return; }
      form.querySelector('[data-capy-token]').style.transform = `translate(${state.x * 100}%,${state.y * 100}%)`;
      form.querySelector('[data-capy-direction]').textContent = ['→', '↓', '←', '↑'][state.direction];
      form.querySelector(`[data-capy-cell="${state.x},${state.y}"]`).classList.add('is-visited');
      await new Promise(resolve => setTimeout(resolve, 180));
    }
    if (operation.cancelled || !form.isConnected || getPractice() !== practice) return;
    status.textContent = run.reached ? t('You reached the flag! Explain how your code works.', 'Флаг достигнут! Объясни, как работает твой код.', 'Жалауға жеттің! Кодыңның қалай жұмыс істейтінін түсіндір.') : run.blocked ? t('The path is blocked. Change your instructions.', 'Путь закрыт. Измени команды.', 'Жол жабық. Командаларды өзгерт.') : t('Not at the flag yet. Try another route.', 'Флаг ещё впереди. Попробуй другой маршрут.', 'Жалауға әлі жетпедің. Басқа жолды байқап көр.');
    form.querySelector('[data-practice-field="output"]').value = `${run.reached ? 'Goal reached' : run.blocked ? 'Blocked' : 'Goal not reached'}; position ${run.states.at(-1).x},${run.states.at(-1).y}; ${run.states.length - 1} actions`;
    save(form); cancel();
  });
  document.addEventListener('pointerdown', event => {
    const surface = event.target.closest?.('[data-drawing-surface]');
    if (!surface || event.button > 0 || getPractice()?.type !== 'drawing' || surface.hasAttribute('aria-disabled')) return;
    const form = surface.closest('form'), strokes = cleanStrokes(form.querySelector('[data-practice-field="strokes"]').value);
    if (strokes.length >= 12 || strokes.reduce((n, s) => n + s.points.length, 0) >= 62) {
      form.querySelector('[data-drawing-status]').textContent = t('Canvas full. Undo or clear to keep drawing.', 'Холст заполнен. Отмени штрих или очисти его.', 'Кенеп толды. Сызықты қайтар не тазала.'); return;
    }
    const rect = surface.getBoundingClientRect();
    const point = e => [e.clientX - rect.left, e.clientY - rect.top].map((n, i) => Math.round(Math.max(0, Math.min(100, n / (i ? rect.height : rect.width) * 100))));
    drawing = { surface, form, strokes, point, start: point(event), color: form.querySelector('[data-drawing-color]').value, tool: form.querySelector('[data-drawing-tool]').value, points: [point(event)], pointer: event.pointerId };
    surface.setPointerCapture(event.pointerId); event.preventDefault();
  });
  document.addEventListener('pointermove', event => {
    if (!drawing || event.pointerId !== drawing.pointer || !drawing.form.isConnected) return;
    const d = drawing, end = d.point(event), [x, y] = d.start;
    if (d.tool === 'rectangle') d.points = [[x, y], [end[0], y], end, [x, end[1]], [x, y]];
    else if (d.tool === 'circle') d.points = Array.from({ length: 21 }, (_, i) => [Math.round((x + end[0]) / 2 + Math.abs(end[0] - x) / 2 * Math.cos(i / 20 * 2 * Math.PI)), Math.round((y + end[1]) / 2 + Math.abs(end[1] - y) / 2 * Math.sin(i / 20 * 2 * Math.PI))]);
    else if (d.tool === 'line') d.points = [d.start, end];
    else if (Math.hypot(end[0] - d.points.at(-1)[0], end[1] - d.points.at(-1)[1]) >= 3 && d.points.length < 40) d.points.push(end);
    const points = d.points.map(p => p.join(',')).join(' ');
    let line = d.surface.querySelector('[data-live-stroke]');
    if (!line) { line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.setAttribute('data-live-stroke', ''); line.setAttribute('fill', 'none'); line.setAttribute('stroke', d.color); line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); d.surface.querySelector('svg').append(line); }
    line.setAttribute('points', points);
  });
  const finishDrawing = event => {
    if (!drawing || event.pointerId !== drawing.pointer) return;
    const d = drawing; drawing = null;
    if (!d.form.isConnected) return;
    paint(d.form, [...d.strokes, { color: d.color, width: 2, points: d.points.length === 1 ? [d.start, [d.start[0] + .1, d.start[1]]] : d.points }]); save(d.form);
  };
  document.addEventListener('pointerup', finishDrawing);
  document.addEventListener('pointercancel', finishDrawing);
  return { cancel };
}
