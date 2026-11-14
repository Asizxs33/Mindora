import { COURSES, escapeHtml } from '../core/engine.js';
import { learningStats } from '../core/progress.js';
import { icon } from './icons.js';
import { character } from './characters.js';

export const courseNames = { design: 'Your first poster', budget: 'Everyday spreadsheets' };
export const lessonNames = {
  design: ['Make one thing stand out', 'Train your design eye', 'Make it yours', 'Try a fresh brief'],
  budget: ['Meet your first formula', 'Think in cells', 'Build your own tracker', 'A new set of numbers'],
};
const descriptions = {
  design: 'Make a poster with a clear message.',
  budget: 'Track expenses with a simple formula.',
};
const guide = id => id === 'design' ? 'mia' : 'sam';
const guideName = id => id === 'design' ? 'Mia' : 'Sam';
const startedCourses = state => Object.keys(COURSES).filter(id => state.goals[id] || state.progress[id] || state.works[id]);

export function badge(icon, name, color, size = 22) {
  return `<span class="game-icon ${color}">${icon(name, size)}</span>`;
}

export function brandNav(icon, view, place) {
  const items = [['discover', 'home', 'Learn'], ['courses', 'book', 'My courses'], ['work', 'folder', 'My work'], ['profile', 'user', 'Profile']];
  return items.map(([key, symbol, name]) => {
    const active = view === key || (key === 'discover' && ['path', 'lesson', 'result'].includes(view))
      || (key === 'profile' && ['practice', 'achievements', 'community'].includes(view));
    return `<button class="nav-item ${active ? 'active' : ''}" data-view="${key}" ${active ? 'aria-current="page"' : ''}>${icon(symbol, place === 'bottom' ? 22 : 23)}<span>${name}</span></button>`;
  }).join('');
}

function goalBanner(minutes, compact = false) {
  return `<section class="learn-home ${compact ? 'new-goal-section' : ''}" aria-labelledby="welcome-title">
    ${compact ? '' : `<div class="hero-character">${character('mino', 'welcome', 'home-character')}</div><div class="speech-bubble" aria-live="polite">Hi! I’m Mino.</div>`}
    <div class="goal-copy">
      <${compact ? 'h2' : 'h1'} id="welcome-title">${compact ? 'Choose your next goal' : 'What do you want<br>to learn?'}</${compact ? 'h2' : 'h1'}>
      ${compact ? '' : '<p>Short lessons. One step at a time.</p>'}
    </div>
    <form id="goal-form" class="goal-form">
      <label class="visually-hidden" for="goal-input">What do you want to learn?</label>
      <input id="goal-input" name="goal" placeholder="I want to learn how to…" maxlength="180" required autocomplete="off">
      <input type="hidden" id="time-select" value="${minutes}">
      <button type="submit" class="primary large">Find my course ${icon('arrow', 19)}</button>
    </form>
    <div class="topic-shortcuts" aria-label="Available learning topics">
      <button class="topic-shortcut" data-course="design">${icon('palette', 18)} Make a poster</button>
      <button class="topic-shortcut" data-course="budget">${icon('sheet', 18)} Learn spreadsheets</button>
    </div>
    <p class="home-note">Posters and spreadsheets are available now.</p>
  </section>`;
}

function resumeCard(state) {
  const id = state.active, completed = state.progress[id], current = Math.min(completed, 3), done = completed === 4;
  return `<section class="return-home" aria-labelledby="return-title">
    <div class="return-heading"><h1 id="return-title">${done ? 'You did it!' : 'Welcome back.'}</h1></div>
    <section class="resume-card ${id}">
      <div class="resume-mentor">${character(guide(id), done ? 'celebrate' : 'explaining', 'resume-character')}<span>With ${guideName(id)}</span></div>
      <div class="resume-body"><h2>${courseNames[id]}</h2>
        <div class="resume-progress"><span>${done ? 'All 4 steps complete' : `Step ${current + 1} of 4`}</span></div>
        <div class="progress-bar" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${completed}"><i style="width:${completed * 25}%"></i></div>
        <p class="resume-next">${done ? 'Your finished project is saved.' : lessonNames[id][current]}</p>
        <button class="primary large" ${done ? 'data-view="work"' : `data-step="${current}"`}>${done ? 'View my work' : completed ? 'Continue learning' : 'Start lesson'} ${icon('arrow', 19)}</button>
      </div>
    </section>
  </section>`;
}

export function dashboard(state) {
  return state.active && COURSES[state.active]
    ? `${resumeCard(state)}<details class="goal-disclosure"><summary><span>Learn something else</span>${icon('chevron', 18)}</summary>${goalBanner(state.minutes, true)}</details>`
    : goalBanner(state.minutes);
}

export function coursesPage(state) {
  const ids = startedCourses(state);
  return `<section class="my-courses">${pageBanner('My courses', ids.length ? 'Pick up where you left off.' : '')}
    ${ids.length ? `<div class="course-grid">${ids.map(id => {
      const completed = state.progress[id], done = completed === 4;
      return `<article class="game-card catalog-tile ${id}">
        <div class="course-tile-top"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><span class="course-state ${done ? 'complete' : ''}">${done ? 'Completed' : `${completed} of 4 steps`}</span></div>
        <h2>${courseNames[id]}</h2><p>${descriptions[id]}</p>
        <div class="progress-bar" role="progressbar" aria-label="${courseNames[id]} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="4"><i style="width:${completed * 25}%"></i></div>
        <button class="primary" data-course="${id}">${done ? 'Review course' : 'Open course'} ${icon('arrow', 18)}</button>
      </article>`;
    }).join('')}</div><button class="secondary new-course-button" data-home>${icon('plus', 18)} Find a new course</button>` : `<div class="empty-state courses-empty"><h2>Your courses start here.</h2><p>Choose what you’d like to learn.</p><button class="primary large" data-home>Choose a topic ${icon('arrow', 18)}</button></div>`}
  </section>`;
}

export function pageBanner(title, description, mood = 'study') {
  const pose = mood === 'cheer' ? 'celebrate' : mood === 'study' ? 'explaining' : mood;
  return `<section class="page-banner page-banner-${mood}"><div><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${character('mino', pose, 'page-character')}</section>`;
}

export function achievementsCard(state, stats, icon, full = false) {
  const awards = [
    ['flame', 'Keep going', 'Learn 5 days in a row', stats.streak >= 5],
    ['book', 'Curious mind', 'Complete 4 learning steps', stats.total >= 4],
    ['star', 'Independent maker', 'Finish 2 projects on your own', Object.values(state.works).filter(work => work.challenge).length >= 2],
  ];
  return `<section class="game-card game-achievements">
    ${full ? '' : `<div class="game-card-top"><h2>Milestones</h2><button class="text-link" data-action="achievements">See all ${icon('arrow', 16)}</button></div>`}
    <p class="milestone-summary">${awards.filter(([, , , earned]) => earned).length} of ${awards.length} badges earned</p>
    <div class="awards">${awards.map(([symbol, title, detail, earned]) => `<div class="award ${earned ? 'earned' : ''}"><span class="award-icon">${icon(symbol, 27)}</span><strong>${title}</strong><small>${earned ? 'Earned' : detail}</small></div>`).join('')}</div>
  </section>`;
}

export function sidePage(view, state) {
  const stats = learningStats(state);
  if (view === 'practice') {
    return `${pageBanner('Practice', 'Put your new skills to work.')}
      <div class="course-grid">${Object.keys(COURSES).map(id => {
        const unlocked = state.progress[id] >= 2;
        return `<section class="game-card practice-tile ${id}"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><h2>${courseNames[id]}</h2><p>${unlocked ? 'Try a new task.' : 'Complete the lesson and quiz to unlock practice.'}</p><button class="${unlocked ? 'primary' : 'secondary'}" ${unlocked ? `data-action="practice" data-id="${id}"` : `data-course="${id}"`}>${unlocked ? 'Practise' : 'Open lessons'} ${icon(unlocked ? 'arrow' : 'lock', 18)}</button></section>`;
      }).join('')}</div>`;
  }
  if (view === 'achievements') return `${pageBanner('Milestones', 'See what you’ve achieved.', 'cheer')}${achievementsCard(state, stats, icon, true)}`;
  if (view === 'community') return `${pageBanner('Learning, together.', 'A little space for curious people.')}<section class="game-card community-preview"><span class="course-symbol">${icon('users', 28)}</span><h2>Our community is still growing.</h2><p>Sharing and discussions aren’t available yet. For now, keep your projects in My work.</p><button class="secondary" data-view="work">See my work ${icon('arrow', 18)}</button></section>`;
  return `${pageBanner('Profile', '')}
    <section class="profile-overview" aria-label="Your progress"><div class="profile-stats"><div><strong>${stats.total}</strong><span>Steps completed</span></div><div><strong>${Object.keys(state.works).length}</strong><span>Projects saved</span></div></div></section>
    <section class="profile-settings"><div><h2>Daily learning time</h2></div><label class="visually-hidden" for="profile-minutes">Daily learning time</label><select class="profile-select" id="profile-minutes">${[5, 10, 20].map(minutes => `<option value="${minutes}" ${minutes === state.minutes ? 'selected' : ''}>${minutes} minutes</option>`).join('')}</select></section>
    <section class="profile-settings motion-preference"><div><h2>Character motion</h2><small data-character-motion-status></small></div><button type="button" class="motion-switch" role="switch" data-character-motion aria-label="Character motion"><span data-character-motion-label>Character motion</span></button></section>
    <nav class="profile-links" aria-label="Learning tools">${[['practice', 'edit', 'Practice'], ['achievements', 'trophy', 'Milestones']].map(([target, symbol, title]) => `<button data-view="${target}"><span class="profile-link-icon">${icon(symbol, 23)}</span><span><strong>${title}</strong></span>${icon('arrow', 18)}</button>`).join('')}<button data-action="about"><span class="profile-link-icon">${icon('leaf', 23)}</span><span><strong>About Mindora</strong></span>${icon('arrow', 18)}</button></nav>
    <p class="profile-note">${icon('lock', 14)} Progress is saved in this browser.</p>`;
}
