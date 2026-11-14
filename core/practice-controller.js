import { paletteContrast, practiceAnswer } from './lesson-practice.js';
import { runPython } from './python-runner.js';
import { t } from '../ui/language.js';

export function createPracticeController({ document, getPractice, onAnswer, executePython = runPython }) {
  let running = null;
  const cancel = () => {
    if (!running) return;
    const previous = running;
    running = null;
    previous.controller.abort();
    previous.cleanup(true);
  };
  function sync(form, practice) {
    const fields = Object.fromEntries([...form.querySelectorAll('[data-practice-field]')].map(field => [field.dataset.practiceField, field.value]));
    const answer = practiceAnswer(practice, fields);
    if (!answer) return;
    form.elements.answer.value = JSON.stringify(answer);
    onAnswer(form.elements.answer.value);
    if (practice.type === 'palette') {
      const preview = form.querySelector('[data-practice-preview]');
      preview.style.background = answer.background;
      preview.style.color = answer.foreground;
      preview.style.setProperty('--practice-accent', answer.accent);
      preview.querySelector('[data-practice-title]').textContent = answer.title || t('Your headline', 'Твой заголовок', 'Сенің тақырыбың');
      form.querySelector('[data-practice-contrast]').textContent = paletteContrast(answer.foreground, answer.background);
    }
  }
  document.addEventListener('input', event => {
    const field = event.target;
    if (!field.dataset?.practiceField || field.disabled || field.form?.id !== 'learning-step-form') return;
    const practice = getPractice();
    if (!practice) return;
    if (field.dataset.practiceField === 'code') {
      cancel();
      const output = field.form.querySelector('[data-practice-field="output"]');
      if (output) output.value = '';
      const preview = field.form.querySelector('[data-practice-output]');
      if (preview) preview.textContent = t('Code changed. Run it again.', 'Код изменён. Запусти его снова.', 'Код өзгерді. Қайта іске қос.');
    }
    sync(field.form, practice);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-practice-run], [data-practice-stop]');
    if (!button || button.disabled) return;
    if (button.dataset.practiceStop !== undefined) { cancel(); return; }
    const practice = getPractice();
    const form = button.form;
    if (!form || practice?.type !== 'code' || practice.language !== 'python') return;
    const code = form.querySelector('[data-practice-field="code"]').value;
    if (!code.trim()) { form.querySelector('[data-practice-field="code"]').focus(); return; }
    cancel();
    const status = form.querySelector('[data-practice-status]');
    const output = form.querySelector('[data-practice-output]');
    const stop = form.querySelector('[data-practice-stop]');
    const operation = { controller: new AbortController(), cleanup(stopped) {
      if (!form.isConnected) return;
      button.disabled = false;
      stop.hidden = true;
      if (stopped) status.textContent = t('Stopped.', 'Остановлено.', 'Тоқтатылды.');
    } };
    running = operation;
    const stillCurrent = () => running === operation && form.isConnected && getPractice() === practice && form.querySelector('[data-practice-field="code"]').value === code;
    button.disabled = true;
    stop.hidden = false;
    status.textContent = t('Loading Python… The first run can take a moment.', 'Загружаем Python… Первый запуск может занять немного времени.', 'Python жүктелуде… Алғашқы іске қосу біраз уақыт алады.');
    try {
      const result = await executePython(code, { signal: operation.controller.signal, document, onRunning: () => {
        if (stillCurrent()) status.textContent = t('Running…', 'Выполняется…', 'Орындалуда…');
      } });
      if (!stillCurrent() || operation.controller.signal.aborted) return;
      output.textContent = [result.output, result.error].filter(Boolean).join('\n') || t('(No output — try print())', '(Нет вывода — попробуй print())', '(Нәтиже жоқ — print() қолданып көр)');
      status.textContent = result.error ? t('Python reported an error. Revise your code.', 'Python сообщил об ошибке. Исправь код.', 'Python қате тапты. Кодыңды түзет.') : t('Executed in your browser.', 'Выполнено в твоём браузере.', 'Браузеріңде орындалды.');
      form.querySelector('[data-practice-field="output"]').value = (result.error ? `Error: ${result.error}` : result.output).slice(0, 100);
      sync(form, practice);
    } catch (error) {
      if (!stillCurrent()) return;
      status.textContent = error.message === 'cancelled' ? t('Stopped.', 'Остановлено.', 'Тоқтатылды.') : error.message === 'timeout'
        ? t('Stopped after 8 seconds. Check for an infinite loop.', 'Остановлено через 8 секунд. Проверь, нет ли бесконечного цикла.', '8 секундтан кейін тоқтатылды. Шексіз циклді тексер.')
        : t('Python could not load. Check your connection and try again. You can still save your code for feedback.', 'Не удалось загрузить Python. Проверь соединение и попробуй снова. Код можно сохранить и отправить на разбор.', 'Python жүктелмеді. Қосылымды тексеріп, қайталап көр. Кодты сақтап, тексеруге жіберуге болады.');
    } finally {
      if (running === operation) { operation.cleanup(false); running = null; }
    }
  });
  return { cancel };
}
