import { brandNav, courseHomeView, courseNames } from './dashboard.js';
import { icon } from './icons.js';
import { mountCharacters } from './characters.js';
import { mountPresentation } from './presentation.js';
import { languagePicker, t } from './language.js';
import { mountLessonFlow, syncLessonFlow } from './lesson-flow.js';
import { mountAccount, getAccountState } from './account.js';
import { rewardBalance } from './roadmap.js';
import { desktopStudyView } from './desktop-study.js';

const $ = selector => document.querySelector(selector);
let desktopLayout;
let resizeGreeting;

function openDesktopLibrary(panel = $('.course-home-library')) {
  if (panel) panel.open = desktopLayout.matches;
}

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
  const guidedStyles = document.createElement('link'); guidedStyles.rel = 'stylesheet';
  guidedStyles.href = new URL('./guided-start.css', import.meta.url).href; document.head.append(guidedStyles);
  const roadmapStyles = document.createElement('link');
  roadmapStyles.rel = 'stylesheet';
  roadmapStyles.href = new URL('./roadmap.css', import.meta.url).href;
  document.head.append(roadmapStyles);
  const courseHomeStyles = document.createElement('link');
  courseHomeStyles.rel = 'stylesheet';
  courseHomeStyles.href = new URL('./course-home.css', import.meta.url).href;
  document.head.append(courseHomeStyles);
  const mobileStyles = document.createElement('link'); mobileStyles.rel = 'stylesheet';
  mobileStyles.href = new URL('./mobile-profile.css', import.meta.url).href; document.head.append(mobileStyles);
  const rewardStyles = document.createElement('link'); rewardStyles.rel = 'stylesheet';
  rewardStyles.href = new URL('./rewards.css', import.meta.url).href; document.head.append(rewardStyles);
  const studyStyles = document.createElement('link'); studyStyles.rel = 'stylesheet';
  studyStyles.href = new URL('./desktop-study.css', import.meta.url).href; document.head.append(studyStyles);
  document.querySelector('#app').innerHTML = `<a class="skip-link" href="#main">Skip to learning</a>
  <header class="topbar">
    <a class="brand" data-home href="#discover" aria-label="Mindora home"><img class="brand-mark" src="ui/assets/brand-mark.svg" alt="" width="40" height="40"><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
    <nav id="top-navigation" aria-label="Main navigation"></nav>
    <div class="top-actions" id="top-actions"></div>
  </header>
  <aside class="sidebar" aria-label="Main menu">
    <nav id="navigation" aria-label="Main navigation"></nav>
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
  desktopLayout = window.matchMedia('(min-width: 921px)');
  desktopLayout.addEventListener('change', () => {
    if (resizeGreeting) resizeGreeting();
    else openDesktopLibrary();
  });
  window.addEventListener('mindora:account-changed', updateAccountLinks);
}

// Library sync should never replace an input while someone is writing. Keeping
// the composer connected also keeps the mobile keyboard and selection intact.
function updateCourseHome(main, html, sameView) {
  const current = sameView && main.querySelector('.course-home');
  if (!current || !html.includes('class="course-home"')) return false;
  const template = document.createElement('template');
  template.innerHTML = html;
  const next = template.content.querySelector('.course-home');
  if (!next) return false;
  const currentNav = main.querySelector('.phone-course-nav');
  const nextNav = template.content.querySelector('.phone-course-nav');
  if (Boolean(currentNav) !== Boolean(nextNav)) return false;
  const sameLanguage = current.dataset.language === next.dataset.language;
  if (currentNav && !sameLanguage) currentNav.replaceWith(nextNav);
  const goalValue = current.querySelector('#goal-input')?.value;
  const retained = new Set();
  const ordered = [];
  for (const nextChild of [...next.children]) {
    const existing = [...current.children].find(child => child.className === nextChild.className);
    const preserve = sameLanguage && ['course-home-heading', 'course-home-composer'].includes(nextChild.className);
    if (existing && preserve) {
      retained.add(existing);
      ordered.push(existing);
      if (nextChild.classList.contains('course-home-composer') && !existing.contains(document.activeElement)) {
        existing.querySelector('#time-select').value = nextChild.querySelector('#time-select').value;
      }
      continue;
    }
    if (existing) {
      if (existing.tagName === 'DETAILS') nextChild.open = existing.open;
      existing.replaceWith(nextChild);
    } else {
      if (nextChild.classList.contains('course-home-library')) openDesktopLibrary(nextChild);
      current.append(nextChild);
    }
    retained.add(nextChild);
    ordered.push(nextChild);
  }
  [...current.children].filter(child => !retained.has(child)).forEach(child => child.remove());
  ordered.forEach((child, index) => { if (current.children[index] !== child) current.insertBefore(child, current.children[index] || null); });
  current.dataset.language = next.dataset.language;
  if (!sameLanguage && goalValue !== undefined) current.querySelector('#goal-input').value = goalValue;
  // The controller reattaches its current sync notice after rendering.
  main.querySelector(':scope > [data-builtin-sync-panel]')?.remove();
  return true;
}

function updateAccountLinks() {
  const { user, profile } = getAccountState();
  document.querySelectorAll('[data-account-entry]').forEach(button => {
    button.hidden = Boolean(user);
    button.dataset.accountOpen = user ? 'profile' : 'signin';
    if (user) { button.dataset.view = 'profile'; delete button.dataset.accountOpen; }
    else delete button.dataset.view;
    button.innerHTML = `${icon('user', 18)}<span>${user ? t('Profile','Профиль','Профиль') : t('Sign in','Войти','Кіру')}</span>`;
  });
  document.querySelectorAll('[data-account-summary]').forEach(slot => {
    const name = slot.querySelector('[data-account-name]');
    const detail = slot.querySelector('[data-account-description]');
    const compact = Boolean(slot.closest('.mobile-profile'));
    if (name) name.textContent = user ? (profile?.name || user.name || t('Your account','Твой аккаунт','Аккаунтың')) : compact ? t('Guest','Гость','Қонақ') : t('Make yourself at home','Добро пожаловать','Қош келдің');
    if (detail) detail.textContent = user ? user.email : compact ? t('Saved on this device','Сохраняется на этом устройстве','Осы құрылғыда сақталады') : t('Create your profile and choose what you enjoy.','Создай профиль и выбери, что тебе интересно.','Профиль жасап, қызығушылығыңды таңда.');
    const button = slot.querySelector('[data-account-open]');
    if (button) { button.dataset.accountOpen = user ? 'profile' : 'signup'; button.innerHTML = `${icon(user ? 'edit' : 'plus', 17)}<span>${user ? t('Edit profile','Изменить профиль','Профильді өзгерту') : t('Create account','Создать аккаунт','Аккаунт жасау')}</span>`; }
    slot.querySelector('[data-account-secondary]')?.toggleAttribute('hidden', Boolean(user));
    slot.querySelector('[data-account-signout]')?.toggleAttribute('hidden', !user);
  });
}

export function renderShell(view, state, stats, html, rewards) {
  const id = state.active;
  const main = $('#main');
  const sameView = main.dataset.page === view;
  const wasStudyLayout = main.classList.contains('has-desktop-study');
  const quizFocus = rememberQuizFocus(main, view);
  const disclosureSelectors = view === 'lesson' ? ['.style-disclosure', '.practice-hint']
    : view === 'courses' ? ['.phone-catalog']
    : view === 'profile' ? ['.profile-rewards', '.profile-draft', '.profile-more'] : [];
  const expandedPanels = sameView
    ? disclosureSelectors.filter(selector => main.querySelector(`${selector}[open]`)) : [];
  const owner = getAccountState().user?.id || '';
  const signedIn = Boolean(owner);
  const guestGreeting = !signedIn && html.includes('data-guided-step="0"');
  const originalHtml = html;
  resizeGreeting = guestGreeting ? () => renderShell(view, state, stats, originalHtml, rewards) : null;
  if (guestGreeting && desktopLayout.matches) html = courseHomeView(state, { guest: true });
  const guided = html.includes('data-guided-step=');
  const studyLayout = Boolean(desktopLayout.matches && rewards && /class="(?:quiet-home|learning-path course-path|roadmap-layout)/.test(html));
  main.classList.toggle('has-desktop-study', studyLayout);
  if (studyLayout) html = desktopStudyView(html, { rewards, minutes: state.minutes, signedIn });
  $('#navigation').innerHTML = brandNav(icon, view, 'side', signedIn);
  $('#top-navigation').innerHTML = brandNav(icon, view, 'top', signedIn);
  $('#mobile-navigation').classList.remove('has-roadmap');
  $('#mobile-navigation').innerHTML = brandNav(icon, view, 'bottom', signedIn);
  $('#top-actions').classList.toggle('has-reward-balance', Boolean(rewards));
  $('#top-actions').innerHTML = guided ? '' : `${rewardBalance(rewards)}${languagePicker({ compact: Boolean(rewards) && !desktopLayout.matches })}<button class="header-account" data-account-entry data-account-open="signin">${t('Sign in','Войти','Кіру')}</button>`;
  $('.skip-link').textContent = t('Skip to learning','К содержимому','Мазмұнға өту');
  $('.modal-close').setAttribute('aria-label', t('Close window','Закрыть окно','Терезені жабу'));
  main.classList.toggle('dashboard-main', view === 'discover');
  main.classList.toggle('inside-main', view !== 'discover');
  main.dataset.page = view;
  document.body.classList.toggle('is-learning', ['lesson', 'learning-plan', 'recap', 'return-review'].includes(view));
  document.body.classList.toggle('is-guided', guided);
  document.body.classList.add('quiet-shell');
  document.body.classList.toggle('has-course-home', html.includes('class="course-home"'));
  if (!updateCourseHome(main, html, sameView && main.dataset.courseHomeOwner === owner)) {
    main.innerHTML = html;
    openDesktopLibrary();
  }
  main.dataset.courseHomeOwner = owner;
  updateAccountLinks();
  if (studyLayout && (!sameView || !wasStudyLayout)) requestAnimationFrame(() => {
    if (!main.classList.contains('has-desktop-study')) return;
    const currentStep = main.querySelector('.learning-hub-node[aria-current="step"], .roadmap-stage.is-active .roadmap-stage-node, .roadmap-stage.is-ready .roadmap-stage-node, .course-path-node[aria-current="step"]');
    if (currentStep && currentStep.getBoundingClientRect().bottom > innerHeight - 24) {
      currentStep.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
  expandedPanels.forEach(selector => { const panel = main.querySelector(selector); if (panel) panel.open = true; });
  syncLessonFlow(main);
  restoreQuizFocus(main, quizFocus);
  const titles = { discover: t('Learn','Обучение','Оқу'), courses: t('My courses','Мои курсы','Курстарым'), practice: t('Practice','Практика','Жаттығу'), path: t('My learning path','Мой маршрут','Оқу жолым'), lesson: courseNames[id], 'learning-plan': t('My lesson','Моё занятие','Сабағым'), recap: t('A quick refresh','Повторение','Қайталау'), certificate: t('Your certificate','Твой сертификат','Сертификатың'), result: t('You did it','Готово','Дайын'), work: t('My work','Мои работы','Жұмыстарым'), achievements: t('Milestones','Достижения','Жетістіктер'), community: t('Community','Сообщество','Қауымдастық'), profile: t('Profile','Профиль','Профиль') };
  const roadmapTitles = { roadmap: t('My learning path','Мой путь обучения','Оқу жолым'), 'course-path': t('My learning path','Мой путь обучения','Оқу жолым'), 'builtin-path': t('My learning path','Мой путь обучения','Оқу жолым'), quests: t('Daily quests','Задания дня','Күндік тапсырмалар'), shop: t('Gem shop','Магазин алмазов','Алмас дүкені'), 'return-review': t('A quick refresh','Повторение','Қайталау') };
  document.title = `${titles[view] || roadmapTitles[view] || 'Learn'} · Mindora`;
}
