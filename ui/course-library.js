import { t } from './language.js';

let query = '', currentOwner = '', mounted = false;
const cardSelector = '.learning-library-card, .course-row, .ready-course, .phone-catalog .report-entry';
const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase().trim();

export function filterCourses(root, value) {
  const terms = normalize(value).split(/\s+/).filter(Boolean);
  const cards = [...root.querySelectorAll(cardSelector)];
  let visible = 0;
  for (const card of cards) {
    const text = normalize(card.querySelector('h2,h3,.ready-course-copy')?.textContent || card.textContent);
    card.hidden = !terms.every(term => text.includes(term));
    if (!card.hidden) visible++;
  }
  const hasSaved = cards.some(card => !card.matches('.ready-course,.report-entry') && !card.hidden);
  const hasReady = cards.some(card => card.matches('.ready-course') && !card.hidden);
  const saved = root.querySelector('.course-saved-section');
  if (saved) saved.hidden = !hasSaved && !root.querySelector('.learning-library[aria-busy="true"],.learning-library-status.is-error,.learning-library-import');
  const catalog = root.querySelector('.phone-catalog');
  if (catalog) {
    catalog.hidden = Boolean(terms.length && !hasReady);
    if (terms.length && catalog.dataset.beforeSearch === undefined) catalog.dataset.beforeSearch = String(catalog.open);
    if (terms.length && hasReady) catalog.open = true;
    if (!terms.length && catalog.dataset.beforeSearch !== undefined) {
      catalog.open = catalog.dataset.beforeSearch === 'true';
      delete catalog.dataset.beforeSearch;
    }
  }
  const status = root.querySelector('[data-course-search-status]');
  if (status) status.textContent = terms.length
    ? visible ? t(`${visible} courses found`, `Найдено курсов: ${visible}`, `Табылған курс: ${visible}`)
      : t('No matching courses. Try another word or create your own.', 'Курсов не найдено. Попробуй другое слово или создай свой курс.', 'Курс табылмады. Басқа сөзді қолданып көр немесе өз курсыңды жаса.')
    : '';
  root.querySelector('[data-course-search-clear]')?.toggleAttribute('hidden', !terms.length);
  return visible;
}

export function captureCourseSearch(main) {
  const input = main.querySelector('[data-course-search]');
  if (!input) return null;
  const shelf = main.querySelector('.phone-catalog');
  return { expanded: shelf?.open, beforeSearch: shelf?.dataset.beforeSearch,
    selection: document.activeElement === input ? [input.selectionStart, input.selectionEnd] : null };
}

export function syncCourseSearch(main, owner, focus) {
  if (currentOwner !== owner) { query = ''; currentOwner = owner; focus = null; }
  const library = main.querySelector('.course-library');
  if (!library) return;
  const input = library.querySelector('[data-course-search]');
  const shelf = library.querySelector('.phone-catalog');
  if (shelf && focus) {
    shelf.open = Boolean(focus.expanded);
    if (focus.beforeSearch !== undefined) shelf.dataset.beforeSearch = focus.beforeSearch;
  }
  input.value = query;
  filterCourses(library, query);
  if (focus?.selection) { input.focus({ preventScroll: true }); input.setSelectionRange(...focus.selection); }
}

export function mountCourseSearch() {
  if (mounted) return;
  mounted = true;
  document.addEventListener('input', event => {
    if (!event.target.matches('[data-course-search]')) return;
    query = event.target.value;
    filterCourses(event.target.closest('.course-library'), query);
  });
  document.addEventListener('click', event => {
    const clear = event.target.closest('[data-course-search-clear]');
    if (!clear) return;
    query = '';
    const root = clear.closest('.course-library'), input = root.querySelector('[data-course-search]');
    input.value = ''; filterCourses(root, query); input.focus();
  });
}
