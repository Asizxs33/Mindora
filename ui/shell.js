import { brandNav, courseNames } from './dashboard.js';
import { icon } from './icons.js';
import { character, mountCharacters } from './characters.js';
import { mountPresentation } from './presentation.js';
import { mountLessonFlow, syncLessonFlow } from './lesson-flow.js';

const $ = selector => document.querySelector(selector);

// The controller redraws a quiz after each answer. Keep keyboard users at the
// same choice, or move them to the resulting feedback / next question.
function rememberQuizFocus(main, view) {
  if (view !== 'lesson' || main.dataset.page !== view) return null;
  const focused = document.activeElement;
  if (!focused || !main.contains(focused)) return null;
  if (focused.dataset.action === 'check-work') return { kind: 'check-work' };
  if (!main.querySelector('.mini-quiz')) return null;
  if (focused.hasAttribute('data-choice')) return { kind: 'choice', value: focused.dataset.choice };
  const action = focused.dataset.action;
  return action === 'check-quiz' || action === 'next-question' ? { kind: action } : null;
}

function restoreQuizFocus(main, remembered) {
  if (!remembered) return;
  if (remembered.kind === 'check-work') {
    const result = main.querySelector('.check-panel h2');
    if (result) {
      result.tabIndex = -1;
      result.focus({ preventScroll: true });
      result.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return;
  }
  if (!main.querySelector('.mini-quiz')) return;
  const target = remembered.kind === 'choice'
    ? [...main.querySelectorAll('[data-choice]')].find(button => button.dataset.choice === remembered.value && !button.disabled)
    : main.querySelector(remembered.kind === 'check-quiz' ? '.answer-feedback' : '.mini-quiz h1');
  if (!target) return;
  if (remembered.kind !== 'choice') target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: remembered.kind === 'choice' });
  if (remembered.kind !== 'choice') target.scrollIntoView({ block: 'center', behavior: 'instant' });
}

export function mountShell() {
  document.querySelector('#app').innerHTML = `<a class="skip-link" href="#main">Skip to learning</a>
  <header class="topbar">
    <a class="brand" data-home href="#discover" aria-label="Mindora home"><img class="brand-mark" src="ui/assets/brand-mark.svg" alt="" width="43" height="43"><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
    <nav id="top-navigation" aria-label="Main navigation"></nav>
    <div class="top-actions" id="top-actions"></div>
  </header>
  <aside class="sidebar" aria-label="Main menu">
    <nav id="navigation" aria-label="Main navigation"></nav>
    <div class="side-companion">${character('mino', 'welcome', 'sidebar-character')}<strong>Small steps.<br>Big possibilities.</strong><p>I’ll be here when you’re ready.</p><button class="text-link" data-action="about">Meet Mindora ${icon('arrow', 15)}</button></div>
  </aside>
  <div class="app-shell"><main id="main" tabindex="-1"></main></div>
  <nav class="mobile-navigation" id="mobile-navigation" aria-label="Main navigation"></nav>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" aria-labelledby="modal-title">
    <button class="modal-close icon-button" data-action="close-modal" aria-label="Close window">${icon('close', 22)}</button>
    <div id="modal-content"></div>
  </dialog>`;
  mountCharacters();
  mountPresentation();
  mountLessonFlow();
}

export function renderShell(view, state, stats, html) {
  const id = state.active;
  const main = $('#main');
  const quizFocus = rememberQuizFocus(main, view);
  const expandedPanels = view === 'lesson' && main.dataset.page === view
    ? ['.style-disclosure', '.practice-hint'].filter(selector => main.querySelector(`${selector}[open]`)) : [];
  $('#navigation').innerHTML = brandNav(icon, view, 'side');
  $('#top-navigation').innerHTML = brandNav(icon, view, 'top');
  $('#mobile-navigation').innerHTML = brandNav(icon, view, 'bottom');
  $('#top-actions').innerHTML = `<button class="header-pace" data-view="profile" aria-label="My daily pace: ${state.minutes} minutes">${icon('clock', 17)}<span>${state.minutes} min a day</span></button><button class="header-profile" data-view="profile" aria-label="Open my profile">${icon('user', 20)}</button>`;
  main.classList.toggle('dashboard-main', view === 'discover');
  main.classList.toggle('inside-main', view !== 'discover');
  main.dataset.page = view;
  document.body.classList.toggle('is-learning', view === 'lesson');
  main.innerHTML = html;
  expandedPanels.forEach(selector => { const panel = main.querySelector(selector); if (panel) panel.open = true; });
  syncLessonFlow(main);
  restoreQuizFocus(main, quizFocus);
  const titles = { discover: 'Learn', courses: 'My courses', practice: 'Practice', path: 'My learning path', lesson: courseNames[id], result: 'You did it', work: 'My work', achievements: 'Milestones', community: 'Community', profile: 'Profile' };
  document.title = `${titles[view] || 'Learn'} · Mindora`;
}
