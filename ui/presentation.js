// Presentation-only localization. The controller and saved learner data stay unchanged.
const notices = new Map([
  ['Заверши текущий этап, чтобы открыть следующий.', 'Finish this step to unlock the next one.'],
  ['Этап завершён. Прогресс сохранён.', 'Little step complete. Your progress is saved.'],
  ['Пройди урок и ответь на вопросы, чтобы открыть практику.', 'Finish the lesson and questions to unlock practice.'],
  ['Открыт новый вариант задания.', 'A fresh little challenge is ready.'],
  ['Заверши этап практики, чтобы сохранить первую работу.', 'Finish your practice to save your first project.'],
  ['Файл готов к скачиванию.', 'Your file is ready to download.'],
]);
let mounted = false;
export function mountPresentation() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  document.documentElement.lang = 'en';
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) { favicon.href = new URL('./assets/brand-mark.svg', import.meta.url).href; favicon.type = 'image/svg+xml'; }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
  document.querySelector('meta[name="description"]')?.setAttribute('content', 'Mindora makes learning a little easier. Short lessons, friendly guides, and real projects you can keep.');
  // The controller saves this preference without a full render. Mirror the
  // current select value in the visible header without changing app state.
  document.addEventListener('change', event => {
    if (event.target?.id !== 'profile-minutes') return;
    const minutes = Number(event.target.value);
    if (![5, 10, 20].includes(minutes)) return;
    const pace = document.querySelector('.header-pace');
    const label = pace?.querySelector('span');
    if (label) label.textContent = `${minutes} min a day`;
    pace?.setAttribute('aria-label', `My daily pace: ${minutes} minutes`);
  });
  const toast = document.querySelector('#toast');
  if (toast) new MutationObserver(() => {
    const translated = notices.get(toast.textContent);
    if (translated) toast.textContent = translated;
  }).observe(toast, { childList: true, characterData: true, subtree: true });
}
