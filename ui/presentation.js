import { t } from './language.js';
let mounted = false;
export function mountPresentation() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
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
    if (label) label.textContent = t(`${minutes} min a day`, `${minutes} мин в день`, `Күніне ${minutes} мин`);
  });
}
