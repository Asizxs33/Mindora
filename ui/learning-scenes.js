import { escapeHtml as esc } from '../core/engine.js';
import { t } from './language.js';

// A small visual vocabulary, not executable model-authored markup.
export const LEARNING_SCENES = Object.freeze({
  monitor: { label: 'Computer', use: 'Code, commands, AI prompts and a worked result.' },
  canvas: { label: 'Canvas', use: 'Poster hierarchy, drawing, composition and presentation.' },
  spreadsheet: { label: 'Spreadsheet', use: 'Cells, columns, quantities and formulas.' },
  notebook: { label: 'Notebook', use: 'Writing, languages, planning and short notes.' },
  comparison: { label: 'Before and after', use: 'Any topic where two concrete versions explain a difference.' },
});

const clean = (value, max) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
export function normalizeLearningScene(raw) {
  if (!raw || !Object.hasOwn(LEARNING_SCENES, raw.type)) return null;
  const title = clean(raw.title, 100);
  if (!title) return null;
  const scene = { type: raw.type, title };
  if (raw.caption !== undefined) { scene.caption = clean(raw.caption, 180); if (!scene.caption) return null; }
  const lines = (value, max = 6) => Array.isArray(value) && value.length > 0 && value.length <= max && value.every(item => clean(item, 180)) ? value.map(item => item.trim()) : null;
  switch (scene.type) {
    case 'monitor':
      scene.lines = lines(raw.lines, 8);
      if (!scene.lines) return null;
      if (raw.output !== undefined) { scene.output = clean(raw.output, 400); if (!scene.output) return null; }
      break;
    case 'canvas':
      scene.headline = clean(raw.headline, 120); scene.detail = clean(raw.detail, 240);
      if (!scene.headline || !scene.detail) return null;
      if (raw.action !== undefined) { scene.action = clean(raw.action, 100); if (!scene.action) return null; }
      break;
    case 'spreadsheet':
      scene.columns = lines(raw.columns, 3);
      if (!scene.columns || !Array.isArray(raw.rows) || !raw.rows.length || raw.rows.length > 5) return null;
      if (raw.rows.some(row => !Array.isArray(row) || row.length !== scene.columns.length || row.some(cell => !clean(cell, 100)))) return null;
      scene.rows = raw.rows.map(row => row.map(cell => cell.trim()));
      if (raw.formula !== undefined) { scene.formula = clean(raw.formula, 120); if (!scene.formula) return null; }
      break;
    case 'notebook':
      scene.lines = lines(raw.lines);
      if (!scene.lines) return null;
      break;
    case 'comparison':
      scene.before = clean(raw.before, 400); scene.after = clean(raw.after, 400);
      if (!scene.before || !scene.after) return null;
      break;
  }
  return scene;
}

export function sceneForTopic(topic = '') {
  const value = String(topic).toLowerCase();
  if (/spreadsheet|excel|budget|таблиц|кесте|бюджет/.test(value)) return 'spreadsheet';
  if (/coding|python|javascript|programming|html|css|sql|prompt|программ|код|бағдарлам/.test(value)) return 'monitor';
  if (/design|poster|drawing|painting|presentation|дизайн|плакат|сурет/.test(value)) return 'canvas';
  if (/writing|language|grammar|story|copywriting|текст|жазу|граммат|язык/.test(value)) return 'notebook';
  return 'comparison';
}

// html is trusted UI markup only; model values must use renderLearningScene.
// A frame surrounds existing material, so it never adds a second example.
export function learningSceneFrame(type, html, label = '') {
  if (!Object.hasOwn(LEARNING_SCENES, type)) type = 'comparison';
  return `<div class="learning-scene scene-${type}" data-learning-scene="${type}"${label ? ` role="group" aria-label="${esc(label)}"` : ''}>
    ${type === 'monitor' ? '<div class="scene-window-bar" aria-hidden="true"><i></i><i></i><i></i></div>' : ''}
    <div class="scene-content">${html}</div>
  </div>`;
}

export function renderLearningScene(raw) {
  const scene = normalizeLearningScene(raw);
  if (!scene) return '';
  let body;
  if (scene.type === 'monitor') body = `<pre><code>${scene.lines.map(esc).join('\n')}</code></pre>${scene.output ? `<div class="scene-output"><span>${t('Result', 'Результат', 'Нәтиже')}</span><p>${esc(scene.output)}</p></div>` : ''}`;
  if (scene.type === 'canvas') body = `<div class="scene-poster"><h3>${esc(scene.headline)}</h3><p>${esc(scene.detail)}</p>${scene.action ? `<strong>${esc(scene.action)}</strong>` : ''}</div>`;
  if (scene.type === 'spreadsheet') body = `<table><caption class="visually-hidden">${esc(scene.title)}</caption><thead><tr>${scene.columns.map(column => `<th scope="col">${esc(column)}</th>`).join('')}</tr></thead><tbody>${scene.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${scene.formula ? `<p class="scene-formula"><code>${esc(scene.formula)}</code></p>` : ''}`;
  if (scene.type === 'notebook') body = `<ol class="scene-notes">${scene.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ol>`;
  if (scene.type === 'comparison') body = `<div class="scene-versions"><section><h3>${t('Before', 'До', 'Бұрын')}</h3><p>${esc(scene.before)}</p></section><section><h3>${t('After', 'После', 'Кейін')}</h3><p>${esc(scene.after)}</p></section></div>`;
  return `<figure class="lesson-visual">${learningSceneFrame(scene.type, body, scene.title)}${scene.caption ? `<figcaption>${esc(scene.caption)}</figcaption>` : ''}</figure>`;
}
