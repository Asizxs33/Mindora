import { COURSES, escapeHtml } from '../core/engine.js';
import { learningStats, dailyCourse } from '../core/progress.js';
import { icon } from './icons.js';
import { timeOptions } from './budget-session.js';

export const courseNames = {
  design: 'Дизайн постера',
  budget: 'Таблица расходов',
};

export const lessonNames = {
  design: ['Основы дизайна', 'Цвет и композиция', 'Работа с графикой', 'Самостоятельный постер'],
  budget: ['Основы таблиц', 'Ячейки и диапазоны', 'Таблица расходов', 'Новая задача'],
};

export function badge(icon, name, color, size = 22) {
  return `<span class="game-icon ${color}">${icon(name, size)}</span>`;
}

export function brandNav(icon, view, place) {
  const items = {
    discover: ['home', 'Главная'],
    courses: ['grid', 'Курсы'],
    path: ['map', 'Путь обучения'],
    practice: ['code', 'Практика'],
    achievements: ['trophy', 'Достижения'],
    work: ['folder', place === 'bottom' ? 'Работы' : place === 'top' ? 'Проекты' : 'Мои работы'],
    community: ['users', 'Сообщество'],
    profile: ['user', 'Профиль'],
  };
  const keys = {
    side: ['discover', 'courses', 'path', 'achievements', 'work', 'community'],
    top: ['courses', 'practice', 'work', 'community'],
    bottom: ['discover', 'courses', 'practice', 'work', 'profile'],
  }[place];
  return keys.map(key => {
    const [symbol, name] = items[key];
    const active = view === key || (key === 'path' && ['lesson', 'result'].includes(view));
    return `<button class="nav-item ${active ? 'active' : ''}" data-view="${key}" ${active ? 'aria-current="page"' : ''}>${icon(symbol, 23)}<span>${name}</span></button>`;
  }).join('');
}

function goalBanner(icon, minutes) {
  return `<section class="adventure-hero" aria-labelledby="welcome-title">
    <div class="adventure-scenery"></div>
    <div class="welcome-copy">
      <h1 id="welcome-title">Привет! Я Mindora! ${badge(icon, 'hand', 'gold', 28)}</h1>
      <p>Твой учебный напарник. Выбирай, чему хочешь научиться, проходи увлекательные уроки, выполняй задания и прокачивай навыки шаг за шагом!</p>
    </div>
    <div class="welcome-actions">
      <form id="goal-form" class="adventure-search">
        <label for="goal-input" class="search-icon"><span class="visually-hidden">Чему ты хочешь научиться?</span>${icon('search', 25)}</label>
        <input id="goal-input" placeholder="Чему ты хочешь научиться?" maxlength="180" required>
        <select id="time-select" class="profile-select" aria-label="Время на занятие">${timeOptions(minutes)}</select>
        <button type="submit" class="purple-button" aria-label="Построить путь">${icon('send', 23)}</button>
      </form>
      <div class="adventure-topics" aria-label="Темы обучения">
        <button data-course="design">${badge(icon, 'palette', 'pink', 20)}Дизайн</button>
        <button data-course="budget"><span class="excel-symbol" aria-hidden="true">X</span>Excel</button>
        <button data-action="programming"><span class="topic-code">${icon('code', 23)}</span><span class="code-desktop">Программирование</span><span class="code-mobile">Код</span></button>
        <button data-view="courses"><span class="topic-more">${icon('more', 20)}</span>Ещё</button>
      </div>
      <button class="secondary" data-view="learning-plan">Мой маршрут с ИИ</button>
    </div>
  </section>`;
}

function mapCard(state, icon) {
  const id = state.active || 'design';
  const progress = state.progress[id];
  const percent = progress * 25;
  const current = Math.min(progress, 3);
  const nodes = lessonNames[id].map((name, index) => {
    const done = index < progress;
    const locked = index > progress;
    const action = state.active ? `data-step="${index}"` : `data-course="${id}" data-start`;
    const symbol = done ? 'check' : locked ? 'lock' : 'play';
    return `<button class="map-node node-${index} ${done ? 'done' : locked ? 'locked' : 'current'}" ${action} ${locked ? 'disabled' : ''}>
      ${index === current ? '<span class="map-mascot mascot-study" aria-hidden="true"></span>' : ''}
      <span class="node-marker">${icon(symbol, 24)}</span>
      <span class="node-label">${index + 1}. ${name}</span>
    </button>`;
  }).join('');
  return `<section class="game-card game-map" aria-labelledby="map-title">
    <div class="game-map-head">
      <div class="map-title">${badge(icon, 'map', 'green', 39)}<div><h2 id="map-title">Мой путь обучения</h2><p>${id === 'design' ? 'Дизайн: от основ до своего постера' : 'Excel: от ячеек до своей таблицы'}</p></div></div>
      <div class="map-meter"><span>${progress} из 4 этапов</span><div><span class="segmented" role="progressbar" aria-label="Прогресс пути" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">${Array.from({ length: 8 }, (_, index) => `<i class="${index < progress * 2 ? 'filled' : ''}"></i>`).join('')}</span><strong>${percent}%</strong></div></div>
    </div>
    <div class="map-scene">${nodes}</div>
  </section>`;
}

function progressCard(state, stats, icon) {
  const percent = (state.active ? state.progress[state.active] : 0) * 25;
  const courses = Number(Boolean(state.goals.design)) + Number(Boolean(state.goals.budget));
  return `<section class="game-card game-progress">
    <div class="game-card-top"><h2>${badge(icon, 'chart', 'purple')}Мой прогресс</h2><button class="game-link" data-view="path">Подробнее ${icon('arrow', 16)}</button></div>
    <div class="progress-body"><div class="progress-ring" style="--progress:${percent}%" aria-label="${percent}% пути пройдено"><strong>${percent}%</strong></div>
    <ul><li>${badge(icon, 'book', 'blue', 17)}Начато курсов: <b>${courses}</b></li><li>${badge(icon, 'success', 'green', 17)}Пройдено этапов: <b>${stats.total}</b></li><li>${badge(icon, 'flame', 'orange', 17)}<b>${stats.streak}</b> дн. подряд</li></ul></div>
  </section>`;
}

function dailyCard(state, stats, icon) {
  const id = dailyCourse(state);
  const complete = state.progress[id] === 4;
  const name = courseNames[id];
  return `<section class="game-card game-daily">
    <div class="game-card-top"><h2>${badge(icon, 'target', 'purple')}Ежедневная задача</h2><span class="streak-pill">${icon('flame', 14)} ${stats.streak} дн. подряд</span></div>
    <div class="daily-content"><div class="daily-copy"><div class="task"><span class="task-box ${stats.today ? 'task-done' : ''}">${stats.today ? icon('check', 15) : ''}</span><div>${stats.today ? 'Задача выполнена' : `${complete ? 'Повтори практику' : 'Пройди следующий этап'}<br><strong>${name}</strong>`}${complete || stats.today ? '' : `<strong class="task-xp">${icon('zap', 15)} +50 XP за новый этап</strong>`}</div></div>
      <button class="purple-button" data-action="daily">${complete ? 'Повторить практику' : stats.today ? 'Продолжить обучение' : 'Выполнить урок'} ${icon('arrow', 18)}</button></div>
      <span class="daily-mascot mascot-cheer" aria-hidden="true"></span></div>
  </section>`;
}

function projectsCard(state, icon) {
  return `<section class="game-card game-projects">
    <div class="game-card-top"><h2>${badge(icon, 'folder', 'gold')}Мои работы</h2><button class="game-link" data-view="work">Все работы ${icon('arrow', 16)}</button></div>
    <p class="project-description">Проекты и упражнения, которыми можно гордиться.</p>
    <div class="project-previews"><span class="project-mascot mascot-study" aria-hidden="true"></span>
      ${Object.keys(COURSES).map(id => {
        const saved = state.works[id];
        const title = saved ? (id === 'design' ? saved.data.title : 'Моя таблица расходов') : courseNames[id];
        return `<button class="project-preview" ${saved ? 'data-view="work"' : `data-course="${id}"`}><span class="project-icon ${id}">${icon(id === 'design' ? 'image' : 'sheet', 41)}</span><strong>${escapeHtml(title)}</strong><small>${saved ? `${icon('success', 13)} Сохранено` : 'Учебный проект'}</small></button>`;
      }).join('')}
      <button class="project-preview project-code" data-action="programming"><span class="project-icon code">${icon('code', 41)}</span><strong>Бот-помощник</strong><small>Будущий курс</small></button>
      <button class="project-add" data-view="courses"><span>${icon('plus', 23)}</span>Начать<br>проект</button>
    </div>
  </section>`;
}

export function achievementsCard(state, stats, icon, full = false) {
  const awards = [
    ['flame', 'Стрик', '5 дней подряд', stats.streak >= 5],
    ['book', 'Любознательный', 'Пройди 4 этапа', stats.total >= 4],
    ['star', 'Практик', 'Заверши 2 проекта', Object.values(state.works).filter(work => work.challenge).length >= 2],
  ];
  return `<section class="game-card game-achievements">
    ${full ? '' : `<div class="game-card-top"><h2>${badge(icon, 'trophy', 'gold')}Достижения и XP</h2><button class="game-link" data-action="achievements">Все достижения ${icon('arrow', 16)}</button></div>`}
    <div class="level-row"><div class="level-chip"><span class="level-medal">${icon('user', 24)}</span><div><strong>Уровень ${stats.level}</strong><small>Ученик-исследователь</small></div></div><div class="xp-track"><strong>${badge(icon, 'zap', 'gold', 16)} ${stats.xp} XP</strong><div class="xp-bar"><i style="width:${(stats.xp % 200) / 2}%"></i></div><small>До уровня ${stats.level + 1}: ${200 - stats.xp % 200} XP</small></div></div>
    <div class="awards">${awards.map(([symbol, title, detail, earned]) => `<div class="award ${earned ? 'earned' : ''}"><span class="award-icon">${icon(symbol, 23)}</span><strong>${title}</strong><small>${earned ? 'Получено' : detail}</small></div>`).join('')}</div>
  </section>`;
}

export function dashboard(state) {
  const stats = learningStats(state);
  return `${goalBanner(icon, state.minutes)}
    <div class="game-grid">
      ${mapCard(state, icon)}
      ${progressCard(state, stats, icon)}
      ${dailyCard(state, stats, icon)}
      ${projectsCard(state, icon)}
      ${achievementsCard(state, stats, icon)}
    </div>`;
}

export function coursesPage(state) {
  return `<div class="course-catalog">
    ${pageBanner('Курсы', 'Выбери проект, который хочешь сделать сам.')}
    <div class="course-grid">${Object.keys(COURSES).map(id => `<article class="game-card catalog-tile">
      <div class="project-icon ${id}">${icon(id === 'design' ? 'image' : 'sheet', 48)}</div>
      <h2>${courseNames[id]}</h2><p>${id === 'design' ? 'Создай свой первый постер и сохрани его как SVG.' : 'Посчитай расходы с помощью формулы SUM и сохрани таблицу как CSV.'}</p>
      <button class="purple-button" data-course="${id}">${state.progress[id] ? 'Продолжить' : 'Начать'} ${icon('arrow', 17)}</button>
    </article>`).join('')}</div>
  </div>`;
}

export function pageBanner(title, description, mood = 'study') {
  return `<section class="page-banner page-banner-${mood}">
    <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
    <span class="page-mascot mascot-${mood}" aria-hidden="true"></span>
  </section>`;
}

export function sidePage(view, state) {
  const stats = learningStats(state);
  if (view === 'practice') {
    return `${pageBanner('Практика', 'Примени знания в редакторе постера или в таблице.')}
      <div class="course-grid">${Object.keys(COURSES).map(id => {
        const unlocked = state.progress[id] >= 2;
        return `<section class="game-card simple-panel">
          <h2>${badge(icon, id === 'design' ? 'palette' : 'sheet', id === 'design' ? 'pink' : 'green')}${courseNames[id]}</h2>
          <p>${unlocked ? 'Выбери новый вариант задания для своего уровня.' : 'Пройди вводный урок и вопросы, чтобы открыть редактор.'}</p>
          <button class="purple-button" ${unlocked ? `data-action="practice" data-id="${id}"` : `data-course="${id}"`}>${unlocked ? 'Открыть практику' : 'Перейти к урокам'} ${icon(unlocked ? 'arrow' : 'lock', 17)}</button>
        </section>`;
      }).join('')}</div>`;
  }
  if (view === 'achievements') {
    return `${pageBanner('Достижения', 'Следи за уровнем, опытом и наградами.', 'cheer')}
      ${achievementsCard(state, stats, icon, true)}`;
  }
  if (view === 'community') {
    return `${pageBanner('Сообщество', 'Здесь появятся обсуждения и проекты участников.')}
      <section class="game-card simple-panel">
        <h2>${badge(icon, 'folder', 'gold')}Твои проекты</h2>
        <p>Создай свою работу в практикуме и сохрани её в портфолио.</p>
        <button class="purple-button" data-view="work">Открыть мои работы ${icon('arrow', 17)}</button>
      </section>`;
  }
  return `${pageBanner('Профиль', 'Твой прогресс хранится в этом браузере.')}
    <section class="game-card simple-panel">
      <h2>${badge(icon, 'user', 'purple')}Настройки обучения</h2>
      <p><strong>${stats.xp} XP</strong> · Уровень ${stats.level}</p>
      <label for="profile-minutes">Цель по времени на день</label>
      <select class="profile-select" id="profile-minutes">${[5, 10, 20].map(minutes => `<option value="${minutes}" ${minutes === state.minutes ? 'selected' : ''}>${minutes} мин</option>`).join('')}</select>
    </section>
    <section class="game-card simple-panel" data-cloud-panel="profile"></section>`;
}
