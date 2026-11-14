import { LESSON_TEMPLATES, mountLessonTemplate } from './lesson-templates.js';
import { templateExamples } from './template-examples.js';
import { mountCharacters } from './characters.js';

const picker = document.getElementById('template-picker');
const host = document.getElementById('template-stage');
const key = 'mindora.template-studio.v1';
let index = 0, answers = {}, unmount = () => {};
try { answers = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Preview still works without storage. */ }
for (const [i, block] of templateExamples.entries()) {
  const option = document.createElement('option'); option.value = i;
  option.textContent = `${i + 1}. ${LESSON_TEMPLATES[block.type].label}`; picker.append(option);
}
function show() {
  unmount(); picker.value = index;
  const block = templateExamples[index];
  document.getElementById('template-counter').textContent = `Template ${index + 1} of ${templateExamples.length} · ${LESSON_TEMPLATES[block.type].label}`;
  document.getElementById('template-progress').style.width = `${(index + 1) / templateExamples.length * 100}%`;
  document.getElementById('template-next').textContent = index === templateExamples.length - 1 ? 'Back to the first →' : 'Next template →';
  unmount = mountLessonTemplate(host, block, { state: answers[block.id] || {}, onChange(state) { answers[block.id] = state; try { localStorage.setItem(key, JSON.stringify(answers)); } catch { /* Session remains usable. */ } } });
}
picker.addEventListener('change', () => { index = Number(picker.value); show(); });
document.getElementById('template-next').addEventListener('click', () => { index = (index + 1) % templateExamples.length; show(); const title = host.querySelector('h3'); if (title) { title.tabIndex = -1; title.focus(); } window.scrollTo({ top: 0 }); });
document.getElementById('template-reset').addEventListener('click', () => { delete answers[templateExamples[index].id]; try { localStorage.setItem(key, JSON.stringify(answers)); } catch {} show(); });
mountCharacters(); show();
