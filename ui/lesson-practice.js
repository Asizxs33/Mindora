import { escapeHtml as esc } from '../core/engine.js';
import { paletteContrast, restorePracticeAnswer } from '../core/lesson-practice.js';
import { t } from './language.js';
import { capyEditor, drawingEditor, logExplorer } from './learning-labs.js';
import { drawingSvg } from '../core/lab-models.js';
import { STUDIO_TYPES } from '../core/studio-practice.js';
import { studioEditor, studioResult } from './studio-practice.js';
import { icon } from './icons.js';

function preview(answer) {
  return `<div class="practice-palette-preview" data-practice-preview style="background:${answer.background};color:${answer.foreground};--practice-accent:${answer.accent}"><span>${t('Your design', 'Твой дизайн', 'Сенің дизайның')}</span><strong data-practice-title>${esc(answer.title || t('Your headline', 'Твой заголовок', 'Сенің тақырыбың'))}</strong><span class="practice-palette-sample">${t('Clear. Readable. Yours.', 'Понятно. Читаемо. По-твоему.', 'Түсінікті. Оқуға жеңіл. Өзіңдікі.')}</span><span class="practice-palette-button">${t('Learn more', 'Узнать больше', 'Толығырақ')}</span></div>`;
}

export function practiceEditor(practice, value, busy) {
  const disabled = busy ? ' disabled' : '';
  const answer = restorePracticeAnswer(practice, value);
  if (!answer) return `<label class="field"><span>${t('Record your result', 'Запиши результат', 'Нәтижеңді жаз')}</span><textarea name="answer" maxlength="1500" rows="5" required${disabled}>${esc(value)}</textarea></label>`;
  const field = (name, label, max, rows = 3, required = true) => `<label class="field"><span>${label}</span><textarea data-practice-field="${name}" maxlength="${max}" rows="${rows}"${required ? ' required' : ''}${disabled}>${esc(answer[name])}</textarea></label>`;
  let content;
  if (STUDIO_TYPES.includes(practice.type)) content = studioEditor(practice, answer, disabled);
  else if (practice.type === 'drawing') content = `${drawingEditor(answer, busy)}${field('explanation', t('What did you choose to draw, and why?', 'Что ты нарисовал и почему?', 'Не салдың және неге?'), 150, 2)}`;
  else if (practice.type === 'code') {
    const python = practice.language === 'python';
    const capy = practice.language === 'capy';
    content = `${capy ? capyEditor(practice) : ''}<div class="practice-editor-heading">${icon('code', 20)} <strong>${capy ? 'Mino Code' : esc(practice.language)}</strong></div>
      ${field('code', t('Write your code (up to 500 characters)', 'Напиши код (до 500 символов)', 'Кодыңды жаз (500 таңбаға дейін)'), 500, 8)}
      ${capy ? `<div class="practice-run-actions"><button class="primary" type="button" data-capy-run${disabled}>${icon('play', 16)} ${t('Run instructions', 'Запустить команды', 'Командаларды орындау')}</button><button class="secondary" type="button" data-capy-stop hidden>${t('Stop', 'Стоп', 'Тоқтату')}</button></div><p data-capy-status role="status"></p><input type="hidden" data-practice-field="output" value="${esc(answer.output)}">` : python ? `<div class="practice-run-actions"><button class="secondary" type="button" data-practice-run${disabled}>${icon('play', 16)} ${t('Run Python', 'Запустить Python', 'Python іске қосу')}</button><button class="text-link" type="button" data-practice-stop hidden>${t('Stop', 'Остановить', 'Тоқтату')}</button></div><p class="small-note">${t('Python runs in your browser. The first launch downloads the runtime; standard library only. No input() or file uploads.', 'Python запускается в браузере. При первом запуске загружается среда; доступна стандартная библиотека. Без input() и загрузки файлов.', 'Python браузерде орындалады. Алғашқы іске қосуда орта жүктеледі; стандартты кітапхана қолжетімді. input() және файл жүктеу жоқ.')}</p><p data-practice-status role="status" aria-live="polite"></p><pre class="practice-code-output" data-practice-output>${esc(answer.output || t('The output appears here.', 'Здесь появится вывод.', 'Нәтиже осында шығады.'))}</pre><input type="hidden" data-practice-field="output" value="${esc(answer.output)}">`
        : field('output', t('Expected output (code is not executed here)', 'Ожидаемый вывод (здесь код не выполняется)', 'Күтілетін нәтиже (код мұнда орындалмайды)'), 100, 2, false)}
      ${field('explanation', t('Explain one decision in your code', 'Объясни одно решение в коде', 'Кодтағы бір шешімді түсіндір'), 100, 2)}`;
  } else if (practice.type === 'palette') {
    content = `<div class="practice-palette-controls">${[['background', t('Background', 'Фон', 'Фон')], ['foreground', t('Text', 'Текст', 'Мәтін')], ['accent', t('Accent', 'Акцент', 'Акцент')]].map(([name, label]) => `<label><input type="color" data-practice-field="${name}" value="${answer[name]}"${disabled}><span>${label}</span></label>`).join('')}</div>
      ${field('title', t('Headline for your design', 'Заголовок твоего дизайна', 'Дизайныңның тақырыбы'), 80, 2)}${preview(answer)}
      <p class="small-note">${t('Text contrast', 'Контраст текста', 'Мәтін контрасты')}: <output data-practice-contrast>${paletteContrast(answer.foreground, answer.background)}</output>:1. ${t('Aim for at least 4.5:1 for normal text.', 'Для обычного текста ориентируйся на 4.5:1 и выше.', 'Қалыпты мәтін үшін кемінде 4.5:1 таңда.')}</p>
      ${field('explanation', t('Why do these colors suit the task?', 'Почему эти цвета подходят задаче?', 'Бұл түстер тапсырмаға неге сәйкес?'), 350)}`;
  } else content = `${['logarithm', 'graph'].includes(practice.visual) ? logExplorer(answer, true) : ''}${field('result', t('Your result, with units if needed', 'Твой результат, с единицами при необходимости', 'Нәтижең және қажет болса өлшем бірлігі'), 100, 2)}${field('working', t('Show the steps of your solution', 'Покажи ход решения', 'Шешу қадамдарын көрсет'), 450, 5)}`;
  return `<div class="practice-workspace" data-practice-type="${practice.type}">${content}<textarea name="answer" hidden aria-hidden="true">${esc(JSON.stringify(answer))}</textarea></div>`;
}

export function practiceResult(practice, value) {
  let stored;
  try { stored = JSON.parse(value); } catch { /* Preserve old text answers. */ }
  if (!stored || stored.type !== practice?.type) return esc(value);
  const answer = restorePracticeAnswer(practice, value);
  if (STUDIO_TYPES.includes(practice.type)) return studioResult(practice, answer);
  if (practice.type === 'drawing') return `<div class="drawing-result">${drawingSvg(answer.strokes)}</div><p>${esc(answer.explanation)}</p>`;
  if (practice.type === 'palette') return `${preview(answer)}<p>${esc(answer.explanation)}</p>`;
  if (practice.type === 'code') return `<pre class="practice-code-output">${esc(answer.code)}</pre><p><strong>${t('Recorded output', 'Сохранённый вывод', 'Сақталған нәтиже')}</strong></p><pre class="practice-code-output">${esc(answer.output)}</pre><p>${esc(answer.explanation)}</p>`;
  if (practice.type === 'calculation') return `<strong>${esc(answer.result)}</strong><p class="learning-answer">${esc(answer.working)}</p>`;
  return esc(value);
}
