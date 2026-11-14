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
  design: 'Make a clear, colourful poster. Keep it as your own SVG file.',
  budget: 'Add up everyday expenses with a simple formula. Keep your table as a CSV file.',
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
    ${compact ? '' : `<div class="hero-character">${character('mino', 'welcome', 'home-character')}</div><div class="speech-bubble" aria-live="polite">Hi! I’m Mino. Let’s learn something.</div>`}
    <div class="goal-copy">
      <${compact ? 'h2' : 'h1'} id="welcome-title">${compact ? 'A little more curious?' : 'What do you want<br>to learn?'}</${compact ? 'h2' : 'h1'}>
      <p>${compact ? 'Pick another little project to explore.' : 'A small project. A few easy steps.<br>A little more confidence.'}</p>
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
    <p class="home-note">Two little courses to start with. Learn at your own pace.</p>
  </section>`;
}

function resumeCard(state) {
  const id = state.active, completed = state.progress[id], current = Math.min(completed, 3), done = completed === 4;
  return `<section class="return-home" aria-labelledby="return-title">
    <div class="return-heading"><span class="eyebrow">YOUR LITTLE LEARNING SPACE</span><h1 id="return-title">${done ? 'Look how far you’ve come.' : 'Ready for a little more?'}</h1><p>${done ? 'Your project is ready. Keep exploring when you feel like it.' : 'Your place is saved. Let’s take the next small step.'}</p></div>
    <section class="resume-card ${id}">
      <div class="resume-mentor">${character(guide(id), done ? 'celebrate' : 'explaining', 'resume-character')}<span>${guideName(id)}, your learning buddy</span></div>
      <div class="resume-body"><span class="eyebrow">${done ? 'COURSE COMPLETE' : 'PICK UP WHERE YOU LEFT OFF'}</span><h2>${courseNames[id]}</h2>
        <div class="resume-progress"><span>${completed} of 4 steps complete</span><strong>${completed * 25}%</strong></div>
        <div class="progress-bar" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${completed}"><i style="width:${completed * 25}%"></i></div>
        <p class="resume-next">${done ? 'One new skill. One project of your own.' : `Next: ${lessonNames[id][current]}`}</p>
        <button class="primary large" ${done ? 'data-view="work"' : `data-step="${current}"`}>${done ? 'See my work' : completed ? 'Continue learning' : 'Start my first lesson'} ${icon('arrow', 19)}</button>
        <button class="text-link" data-view="path">${done ? 'Revisit my learning path' : 'See my learning path'} ${icon('map', 16)}</button>
      </div>
    </section>
  </section>`;
}

export function dashboard(state) {
  return state.active && COURSES[state.active] ? `${resumeCard(state)}${goalBanner(state.minutes, true)}` : goalBanner(state.minutes);
}

export function coursesPage(state) {
  const ids = startedCourses(state);
  return `<section class="my-courses">${pageBanner('My courses', 'Your own little paths. Ready whenever you are.')}
    ${ids.length ? `<div class="course-grid">${ids.map(id => {
      const completed = state.progress[id], done = completed === 4;
      return `<article class="game-card catalog-tile ${id}">
        <div class="course-tile-top"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><span class="course-state ${done ? 'complete' : ''}">${done ? 'Completed' : `${completed} of 4 steps`}</span></div>
        <h2>${courseNames[id]}</h2><p>${descriptions[id]}</p>
        <div class="progress-bar" role="progressbar" aria-label="${courseNames[id]} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="4"><i style="width:${completed * 25}%"></i></div>
        <button class="primary" data-course="${id}">${done ? 'Revisit course' : 'Open my course'} ${icon('arrow', 18)}</button>
      </article>`;
    }).join('')}</div><button class="secondary new-course-button" data-home>${icon('plus', 18)} Explore another goal</button>` : `<div class="empty-state courses-empty">${character('mino', 'thinking', 'empty-character')}<h2>Your first little adventure.</h2><p>Tell Mino what you’d like to learn.<br>Your courses will live right here.</p><button class="primary large" data-home>Let’s begin ${icon('arrow', 18)}</button></div>`}
  </section>`;
}

export function pageBanner(title, description, mood = 'study') {
  const pose = mood === 'cheer' ? 'celebrate' : mood === 'study' ? 'explaining' : mood;
  return `<section class="page-banner page-banner-${mood}"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${character('mino', pose, 'page-character')}</section>`;
}

export function achievementsCard(state, stats, icon, full = false) {
  const awards = [
    ['flame', 'A little every day', 'Learn on 5 days in a row', stats.streak >= 5],
    ['book', 'Curious mind', 'Complete 4 learning steps', stats.total >= 4],
    ['star', 'Made by you', 'Finish 2 independent projects', Object.values(state.works).filter(work => work.challenge).length >= 2],
  ];
  return `<section class="game-card game-achievements">
    ${full ? '' : `<div class="game-card-top"><h2>Your little milestones</h2><button class="text-link" data-action="achievements">See all ${icon('arrow', 16)}</button></div>`}
    <div class="level-row"><div class="level-chip"><span class="level-medal">${icon('spark', 26)}</span><div><strong>Level ${stats.level}</strong><small>A curious explorer</small></div></div><div class="xp-track"><strong>${stats.xp} XP</strong><div class="xp-bar"><i style="width:${(stats.xp % 200) / 2}%"></i></div><small>${200 - stats.xp % 200} XP to level ${stats.level + 1}</small></div></div>
    <div class="awards">${awards.map(([symbol, title, detail, earned]) => `<div class="award ${earned ? 'earned' : ''}"><span class="award-icon">${icon(symbol, 27)}</span><strong>${title}</strong><small>${earned ? 'You earned this!' : detail}</small></div>`).join('')}</div>
  </section>`;
}

export function sidePage(view, state) {
  const stats = learningStats(state);
  if (view === 'practice') {
    return `${pageBanner('A little practice', 'Try an idea. Make something. Learn by doing.')}
      <div class="course-grid">${Object.keys(COURSES).map(id => {
        const unlocked = state.progress[id] >= 2;
        return `<section class="game-card practice-tile ${id}"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><h2>${courseNames[id]}</h2><p>${unlocked ? 'A fresh little challenge to make your new skill stick.' : 'Finish the lesson and three questions to unlock this practice.'}</p><button class="${unlocked ? 'primary' : 'secondary'}" ${unlocked ? `data-action="practice" data-id="${id}"` : `data-course="${id}"`}>${unlocked ? 'Let me try' : 'Go to my lessons'} ${icon(unlocked ? 'arrow' : 'lock', 18)}</button></section>`;
      }).join('')}</div>`;
  }
  if (view === 'achievements') return `${pageBanner('Look at you grow.', 'Every small step counts.', 'cheer')}${achievementsCard(state, stats, icon, true)}`;
  if (view === 'community') return `${pageBanner('Learning, together.', 'A little space for curious people.')}<section class="game-card community-preview"><span class="course-symbol">${icon('users', 28)}</span><h2>Our community is still growing.</h2><p>Sharing and discussions aren’t available yet. For now, keep your projects in My work.</p><button class="secondary" data-view="work">See my work ${icon('arrow', 18)}</button></section>`;
  return `${pageBanner('Your little corner', 'Every little step is worth keeping.')}
    <section class="profile-overview"><div class="profile-identity"><span class="profile-avatar">${icon('user', 25)}</span><div><h2>Curious learner</h2><p>Guest profile · Level ${stats.level}</p></div></div>
      <div class="profile-stats"><div><strong>${stats.total}</strong><span>Steps learned</span></div><div><strong>${Object.keys(state.works).length}</strong><span>Projects made</span></div><div><strong>${stats.xp}</strong><span>XP earned</span></div></div>
    </section>
    <section class="profile-settings"><div><h2>Your daily pace</h2><p>A little time can go a long way.</p></div><label class="visually-hidden" for="profile-minutes">Daily learning time</label><select class="profile-select" id="profile-minutes">${[5, 10, 20].map(minutes => `<option value="${minutes}" ${minutes === state.minutes ? 'selected' : ''}>${minutes} minutes</option>`).join('')}</select></section>
    <section class="profile-settings motion-preference"><div><h2>Character motion</h2><p>Gentle movement and little celebrations.</p><small data-character-motion-status></small></div><button type="button" class="motion-switch" role="switch" data-character-motion aria-label="Character motion"><span data-character-motion-label>Character motion</span></button></section>
    <nav class="profile-links" aria-label="More to explore">${[['practice', 'edit', 'A little practice', 'Try something you’ve learned'], ['achievements', 'trophy', 'My milestones', 'Celebrate your small wins'], ['community', 'users', 'Community', 'A space that’s still growing']].map(([target, symbol, title, text]) => `<button data-view="${target}"><span class="profile-link-icon">${icon(symbol, 23)}</span><span><strong>${title}</strong><small>${text}</small></span>${icon('arrow', 18)}</button>`).join('')}<button data-action="about"><span class="profile-link-icon">${icon('leaf', 23)}</span><span><strong>About Mindora</strong><small>Small steps. Real things you can make.</small></span>${icon('arrow', 18)}</button></nav>
    <p class="profile-note">${icon('lock', 14)} Your progress and projects stay in this browser.</p>`;
}
