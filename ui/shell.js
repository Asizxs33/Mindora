import { brandNav, courseNames } from './dashboard.js';
import { icon } from './icons.js';
import { character, mountCharacters } from './characters.js';
import { mountPresentation } from './presentation.js';
import { mountLessonFlow, syncLessonFlow } from './lesson-flow.js';
import { mountAccount, getAccountState } from './account.js';

const $ = selector => document.querySelector(selector);

// The controller redraws a quiz after each answer. Keep keyboard users at the
// same choice, or move them to the resulting feedback / next question.
function rememberQuizFocus(main, view) {
  if (!['lesson', 'recap'].includes(view) || main.dataset.page !== view) return null;
  const focused = document.activeElement;
  if (!focused || !main.contains(focused)) return null;
  if (focused.dataset.action === 'check-work') return { kind: 'check-work' };
  if (!main.querySelector('.mini-quiz')) return null;
  if (focused.hasAttribute('data-recap-choice')) return { kind: 'recap-choice', value: focused.dataset.recapChoice };
  if (focused.hasAttribute('data-choice')) return { kind: 'choice', value: focused.dataset.choice };
  const action = focused.dataset.action;
  return ['check-quiz', 'next-question', 'recap-check', 'recap-next'].includes(action) ? { kind: action } : null;
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
  const isChoice = ['choice', 'recap-choice'].includes(remembered.kind);
  const target = remembered.kind === 'recap-choice'
    ? [...main.querySelectorAll('[data-recap-choice]')].find(button => button.dataset.recapChoice === remembered.value && !button.disabled)
    : remembered.kind === 'choice'
    ? [...main.querySelectorAll('[data-choice]')].find(button => button.dataset.choice === remembered.value && !button.disabled)
    : main.querySelector(['check-quiz', 'recap-check'].includes(remembered.kind) ? '.answer-feedback' : '.mini-quiz h1');
  if (!target) return;
  if (!isChoice) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: isChoice });
  if (!isChoice) target.scrollIntoView({ block: 'center', behavior: 'instant' });
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
  mountAccount();
  window.addEventListener('mindora:account-changed', updateAccountLinks);
}

function updateAccountLinks() {
  const { user, profile } = getAccountState();
  document.querySelectorAll('[data-account-entry]').forEach(button => {
    button.dataset.accountOpen = user ? 'profile' : 'signin';
    button.textContent = user ? 'My account' : 'Sign in';
  });
  document.querySelectorAll('[data-account-summary]').forEach(slot => {
    const name = slot.querySelector('[data-account-name]');
    const detail = slot.querySelector('[data-account-description]');
    if (name) name.textContent = user ? (profile?.name || user.name || 'Your account') : 'Make yourself at home';
    if (detail) detail.textContent = user ? user.email : 'Create your profile and choose what you enjoy.';
    const button = slot.querySelector('[data-account-open]');
    if (button) { button.dataset.accountOpen = user ? 'profile' : 'signup'; button.textContent = user ? 'Edit my profile' : 'Create account'; }
    slot.querySelector('[data-account-secondary]')?.toggleAttribute('hidden', Boolean(user));
  });
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
  $('#top-actions').innerHTML = `<button class="header-pace" data-view="profile" aria-label="My daily pace: ${state.minutes} minutes">${icon('clock', 17)}<span>${state.minutes} min a day</span></button><button class="header-account" data-account-entry data-account-open="signin">Sign in</button>`;
  main.classList.toggle('dashboard-main', view === 'discover');
  main.classList.toggle('inside-main', view !== 'discover');
  main.dataset.page = view;
  document.body.classList.toggle('is-learning', ['lesson', 'recap'].includes(view));
  main.innerHTML = html;
  updateAccountLinks();
  expandedPanels.forEach(selector => { const panel = main.querySelector(selector); if (panel) panel.open = true; });
  syncLessonFlow(main);
  restoreQuizFocus(main, quizFocus);
  const titles = { discover: 'Learn', courses: 'My courses', practice: 'Practice', path: 'My learning path', lesson: courseNames[id], recap: 'A quick refresh', certificate: 'Your certificate', result: 'You did it', work: 'My work', achievements: 'Milestones', community: 'Community', profile: 'Profile' };
  document.title = `${titles[view] || 'Learn'} · Mindora`;
}
