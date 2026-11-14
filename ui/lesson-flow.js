// Presentation-only paging. The controller still owns completion and progress.
const key = id => `mindora.reading.${id}.v1`;
let mounted = false;

function showPage(deck, index, moveFocus = false) {
  const pages = [...deck.querySelectorAll('[data-learn-page]')];
  const current = Math.max(0, Math.min(Number.isFinite(index) ? Math.trunc(index) : 0, pages.length - 1));
  pages.forEach((page, i) => { page.hidden = i !== current; });
  deck.dataset.index = String(current);
  const progress = deck.closest('.lesson-flow')?.querySelector('.lesson-progress-head [role="progressbar"]');
  if (progress) {
    const percent = Math.round((current / pages.length) * 25);
    progress.setAttribute('aria-valuenow', String(percent));
    progress.querySelector('i').style.width = `${percent}%`;
  }
  deck.querySelector('[data-learn-count]').textContent = `Idea ${current + 1} of ${pages.length}`;
  deck.querySelectorAll('[data-learn-dot]').forEach((dot, i) => {
    dot.classList.toggle('on', i <= current);
  });
  deck.querySelector('[data-learn-prev]').hidden = current === 0;
  deck.querySelector('[data-learn-next]').hidden = current === pages.length - 1;
  deck.querySelector('[data-action="finish-learn"]').hidden = current !== pages.length - 1;
  try { sessionStorage.setItem(key(deck.dataset.learnDeck), String(current)); } catch { /* Reading works without storage. */ }
  if (moveFocus) {
    const heading = pages[current].querySelector('h1');
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

export function syncLessonFlow(main) {
  const deck = main.querySelector('[data-learn-deck]');
  if (!deck) return;
  let index = 0;
  try { index = Number(sessionStorage.getItem(key(deck.dataset.learnDeck))) || 0; } catch { /* Start at the first idea. */ }
  showPage(deck, index);
}

export function mountLessonFlow() {
  if (mounted) return;
  mounted = true;
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    const deck = button?.closest('[data-learn-deck]');
    if (!deck) return;
    if (button.dataset.action === 'finish-learn') {
      try { sessionStorage.removeItem(key(deck.dataset.learnDeck)); } catch { /* Optional UI state. */ }
      return;
    }
    const direction = button.hasAttribute('data-learn-next') ? 1 : button.hasAttribute('data-learn-prev') ? -1 : 0;
    if (direction) showPage(deck, Number(deck.dataset.index) + direction, true);
  });
}
