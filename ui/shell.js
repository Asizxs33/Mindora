import { brandNav, courseNames } from './dashboard.js';
import { icon } from './icons.js';

const $ = selector => document.querySelector(selector);

export function mountShell() {
  document.querySelector('#app').innerHTML = `<a class="skip-link" href="#main">К содержимому</a>
  <header class="topbar">
    <a class="brand" data-home href="#discover" aria-label="Mindora, главная"><span class="brand-mascot" aria-hidden="true"></span>Mindora</a>
    <nav id="top-navigation" aria-label="Разделы сайта"></nav>
    <div class="top-actions" id="top-actions"></div>
  </header>
  <aside class="sidebar" aria-label="Главное меню">
    <nav id="navigation" aria-label="Навигация"></nav>
    <button class="side-promo" data-action="about">
      <span class="promo-mascot mascot-study" aria-hidden="true"></span>
      <strong>Учись<br>с Mindora!</strong>
      <span>Короткие уроки, практика и реальный прогресс.</span>
    </button>
  </aside>
  <div class="app-shell">
    <main id="main" tabindex="-1"></main>
  </div>
  <nav class="mobile-navigation" id="mobile-navigation" aria-label="Главное меню"></nav>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" aria-labelledby="modal-title">
    <button class="modal-close icon-button" data-action="close-modal" aria-label="Закрыть окно">×</button>
    <div id="modal-content"></div>
  </dialog>`;
}

export function renderShell(view, state, stats, html) {
  const id = state.active;

  $('#navigation').innerHTML = brandNav(icon, view, 'side');
  $('#top-navigation').innerHTML = brandNav(icon, view, 'top');
  $('#mobile-navigation').innerHTML = brandNav(icon, view, 'bottom');
  $('#top-actions').innerHTML = `
    <button class="header-icon" data-action="notifications" aria-label="Уведомления">${icon('bell', 23)}</button>
    <span class="mobile-stat streak">${icon('flame', 15)} ${stats.streak} дн.</span>
    <span class="mobile-stat">${icon('zap', 15)} ${stats.xp} XP</span>
    <button class="header-profile" data-view="profile" aria-label="Профиль"><span class="brand-mascot"></span><span>Гость</span>${icon('chevron', 15)}</button>`;
  const main = $('#main');
  main.classList.toggle('dashboard-main', view === 'discover');
  main.classList.toggle('inside-main', view !== 'discover');
  main.dataset.page = view;
  main.innerHTML = html;
  const titles = { discover: 'Главная', courses: 'Курсы', practice: 'Практика', path: 'Путь обучения', lesson: courseNames[id], result: 'Результат', work: 'Мои работы', achievements: 'Достижения', community: 'Сообщество', profile: 'Профиль' };
  document.title = `${view === 'learning-plan' ? 'Мой маршрут' : titles[view]} · Mindora`;
}
