import { dayKey } from '../core/progress.js';
import { icon } from './icons.js';
import { currentLanguage, t } from './language.js';
import { questRow } from './roadmap.js';

const alarmClock = new URL('./assets/study-alarm-clock.webp', import.meta.url).href;

function activityWeek(studyDays, lastLessonDay) {
  const days = new Set((studyDays || []).map(day => String(day).split('-').map(Number).join('-')));
  const monday = new Date();
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const weekday = new Intl.DateTimeFormat(currentLanguage(), { weekday: 'short' });
  const fullDate = new Intl.DateTimeFormat(currentLanguage(), { weekday: 'long', day: 'numeric', month: 'long' });
  const label = t('Study days recorded this week', 'Дни с занятиями на этой неделе', 'Осы аптадағы сабақ өткен күндер');
  return `<ul class="study-week" aria-label="${label}">${Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    const rewardDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    const studied = days.has(dayKey(date)) || rewardDay === lastLessonDay;
    return `<li class="study-week-day${studied ? ' is-studied' : ''}">
      <span class="visually-hidden">${fullDate.format(date)}${studied ? t(', lesson recorded', ', есть занятие', ', сабақ бар') : ''}</span>
      <span aria-hidden="true">${weekday.format(date)}</span><span class="study-week-mark" aria-hidden="true">${studied ? icon('check', 16) : ''}</span>
    </li>`;
  }).join('')}</ul>`;
}

function streakLabel(streak) {
  const form = new Intl.PluralRules('ru').select(streak);
  const day = form === 'one' ? 'день' : form === 'few' ? 'дня' : 'дней';
  return t(`${streak} ${streak === 1 ? 'day' : 'days'} in a row`, `${streak} ${day} подряд`, `${streak} күн қатарынан`);
}

// The rail uses the controller's reward snapshot and existing action hooks.
// Course selection, unlocking, assessment and persistence remain in core.
export function desktopStudyView(html, { rewards, minutes, signedIn, studyDays, lastLessonDay }) {
  const content = document.createElement('template');
  content.innerHTML = html;
  content.content.querySelector('.roadmap-aside')?.remove();
  return `<div class="desktop-study-layout"><div class="desktop-study-main">${content.innerHTML}</div>
    <aside class="desktop-study-rail" aria-label="${t('Learning activity', 'Учебная активность', 'Оқу белсенділігі')}">
      <section class="study-side-card study-daily-goals">
        <header><h2>${icon('calendar', 24)} ${t('Daily goals', 'Задания дня', 'Күндік тапсырмалар')}</h2><button type="button" class="text-link" data-view="quests">${t('All', 'Все', 'Барлығы')} ${icon('arrow', 18)}</button></header>
        <ul class="study-quest-list">${(rewards.quests || []).map(quest => questRow(quest, { compact: true })).join('')}</ul>
      </section>
      <section class="study-side-card study-streak-card">
        <header class="study-streak-heading">
          <span class="study-card-symbol" aria-hidden="true">${icon('flame', 34)}</span>
          <div><h2>${t('Learning streak', 'Серия обучения', 'Оқу сериясы')}</h2><p>${streakLabel(rewards.streak)}</p></div>
          <button type="button" class="icon-button study-streak-link" data-view="shop" aria-label="${t('Streak protection', 'Защита серии', 'Серияны қорғау')}" title="${t('Streak protection', 'Защита серии', 'Серияны қорғау')}">${icon('chevron', 22)}</button>
        </header>
        ${activityWeek(studyDays, lastLessonDay)}
      </section>
      ${signedIn ? `<section class="study-side-card study-pace-card"><span class="study-card-symbol" aria-hidden="true">${icon('clock', 27)}</span><div class="study-pace-copy"><h2>${minutes} ${t('minutes a lesson', 'минут на занятие', 'минут бір сабаққа')}</h2><p>${t('A pace that fits your day.', 'В удобном для тебя темпе.', 'Өзіңе ыңғайлы қарқынмен.')}</p><button type="button" class="text-link" data-view="profile">${t('Change pace', 'Изменить время', 'Уақытты өзгерту')} ${icon('arrow', 17)}</button></div><img class="study-pace-art" src="${alarmClock}" width="384" height="384" alt="" decoding="async"></section>`
        : `<section class="study-side-card study-account-card"><h2>${t('Keep your progress', 'Сохрани свой прогресс', 'Үлгеріміңді сақта')}</h2><p>${t('An account keeps your courses ready on any device.', 'С аккаунтом курсы доступны на любом устройстве.', 'Аккаунтпен курстарың кез келген құрылғыда қолжетімді.')}</p><button type="button" class="primary" data-account-open="signup">${t('Create account', 'Создать аккаунт', 'Аккаунт ашу')}</button><button type="button" class="secondary" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button></section>`}
    </aside></div>`;
}
