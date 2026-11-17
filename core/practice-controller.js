import { paletteContrast, practiceAnswer } from './lesson-practice.js';
import { mountLearningLabs } from './lab-controller.js';
import { runPython } from './python-runner.js';
import { sheetDiagnosis } from './studio-practice.js';
import { checkPythonCases, pythonPrograms } from './python-practice.js';
import { expressionIssue, studioPreview, updateWorkedStudio } from '../ui/studio-practice.js';
import { t } from '../ui/language.js';

export function createPracticeController({ document, getPractice, onAnswer, onMistake = () => {}, executePython = runPython }) {
  const labs = mountLearningLabs({ document, getPractice });
  let running = null;
  let verifiedRun = null;
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
    const studio = form.querySelector('[data-studio-preview]');
    if (studio) {
      studio.innerHTML = studioPreview(practice, answer);
      const expression = form.querySelector('[data-practice-field="expression"]');
      if (expression) {
        expression.setCustomValidity(expressionIssue(practice, expression.value));
      }
    }
    if (practice.type === 'palette') {
      const preview = form.querySelector('[data-practice-preview]');
      preview.style.background = answer.background;
      preview.style.color = answer.foreground;
      preview.style.setProperty('--practice-accent', answer.accent);
      preview.querySelector('[data-practice-title]').textContent = answer.title || t('Your headline', 'Твой заголовок', 'Сенің тақырыбың');
      form.querySelector('[data-practice-contrast]').textContent = paletteContrast(answer.foreground, answer.background);
    }
  }
  // Browser validation covers live edits. Revalidate restored drafts before a submit as well.
  document.addEventListener('invalid', event => {
    const field = event.target;
    if (field.form?.id !== 'learning-step-form' || field.dataset?.practiceField !== 'expression') return;
    const practice = getPractice();
    const diagnosis = practice?.type === 'sheet' ? sheetDiagnosis(practice, field.value) : null;
    if (diagnosis) onMistake(diagnosis.kind);
  }, true);
  document.addEventListener('submit', event => {
    if (event.target.id !== 'learning-step-form') return;
    const field = event.target.querySelector?.('[data-practice-field="expression"]');
    const practice = getPractice();
    if (practice?.pythonChecks) {
      const code = event.target.querySelector('[data-practice-field="code"]');
      if (verifiedRun?.form === event.target && verifiedRun.code === code?.value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = event.target.querySelector('[data-practice-status]');
      status.textContent = t('Run Python and pass both checks before submitting.', 'Запусти Python и пройди обе проверки перед отправкой.', 'Жауап жібермес бұрын Python-ды іске қосып, екі тексерістен өт.');
      event.target.querySelector('[data-practice-run]')?.focus();
      return;
    }
    if (!field || !['sql', 'sheet'].includes(practice?.type)) return;
    field.setCustomValidity(expressionIssue(practice, field.value));
    if (!field.reportValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('input', event => {
    const field = event.target;
    if (field.dataset?.studioExpression !== undefined) return updateWorkedStudio(field);
    if (!field.dataset?.practiceField || field.disabled || field.form?.id !== 'learning-step-form') return;
    const practice = getPractice();
    if (!practice) return;
    if (field.dataset.practiceField === 'code') {
      verifiedRun = null;
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
    verifiedRun = null;
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
      const checks = practice.pythonChecks;
      const result = await executePython(checks ? pythonPrograms(checks, code) : code, { signal: operation.controller.signal, document, onRunning: () => {
        if (stillCurrent()) status.textContent = t('Running…', 'Выполняется…', 'Орындалуда…');
      } });
      if (!stillCurrent() || operation.controller.signal.aborted) return;
      if (checks) {
        const passed = checkPythonCases(checks, result.cases);
        if (!passed) throw new Error('unavailable');
        const reports = result.cases.map((item, index) => {
          const label = t(`Case ${index + 1}`, `Набор ${index + 1}`, `${index + 1}-жиын`);
          return `${label} · ${passed[index] ? t('Passed', 'Верно', 'Дұрыс') : t('Check the output', 'Проверь вывод', 'Нәтижені тексер')}\n${item.error || item.output.trim() || '—'}`;
        });
        output.textContent = reports.join('\n\n');
        status.textContent = passed.every(Boolean)
          ? t('Both inputs passed.', 'Оба набора прошли проверку.', 'Екі жиын да тексерістен өтті.')
          : t('Revise your code and run both inputs again.', 'Исправь код и проверь оба набора ещё раз.', 'Кодты түзетіп, екі жиынды қайта тексер.');
        if (passed.every(Boolean)) verifiedRun = { form, code };
        else onMistake('python-output');
        form.querySelector('[data-practice-field="output"]').value = result.cases.map(item => item.output.trim()).join(' | ').slice(0, 100);
        sync(form, practice);
        return;
      }
      output.textContent = [result.output, result.error].filter(Boolean).join('\n') || t('(No output — try print())', '(Нет вывода — попробуй print())', '(Нәтиже жоқ — print() қолданып көр)');
      status.textContent = result.error ? t('Python reported an error. Revise your code.', 'Python сообщил об ошибке. Исправь код.', 'Python қате тапты. Кодыңды түзет.') : t('Executed in your browser.', 'Выполнено в твоём браузере.', 'Браузеріңде орындалды.');
      form.querySelector('[data-practice-field="output"]').value = (result.error ? `Error: ${result.error}` : result.output).slice(0, 100);
      sync(form, practice);
    } catch (error) {
      if (!stillCurrent()) return;
      status.textContent = error.message === 'cancelled' ? t('Stopped.', 'Остановлено.', 'Тоқтатылды.') : error.message === 'timeout'
        ? t('Stopped after 8 seconds. Check for an infinite loop.', 'Остановлено через 8 секунд. Проверь, нет ли бесконечного цикла.', '8 секундтан кейін тоқтатылды. Шексіз циклді тексер.')
        : practice.pythonChecks ? t('Python could not load. Check your connection and run the two checks again.', 'Не удалось загрузить Python. Проверь соединение и запусти проверку снова.', 'Python жүктелмеді. Қосылымды тексеріп, екі тексерісті қайта іске қос.')
          : t('Python could not load. Check your connection and try again. You can still save your code for feedback.', 'Не удалось загрузить Python. Проверь соединение и попробуй снова. Код можно сохранить и отправить на разбор.', 'Python жүктелмеді. Қосылымды тексеріп, қайталап көр. Кодты сақтап, тексеруге жіберуге болады.');
    } finally {
      if (running === operation) { operation.cleanup(false); running = null; }
    }
  });
  return { cancel() { cancel(); labs.cancel(); } };
}
