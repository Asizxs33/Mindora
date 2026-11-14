import { icon } from './icons.js';
import { t } from './language.js';
import { questRow } from './roadmap.js';

// The rail uses the controller's reward snapshot and existing action hooks.
// Course selection, unlocking, assessment and persistence remain in core.
export function desktopStudyView(html, { rewards, minutes, signedIn }) {
  const content = document.createElement('template');
  content.innerHTML = html;
  content.content.querySelector('.roadmap-aside')?.remove();
  return `<div class="desktop-study-layout"><div class="desktop-study-main">${content.innerHTML}</div>
    <aside class="desktop-study-rail" aria-label="${t('Learning activity', 'Учебная активность', 'Оқу белсенділігі')}">
      <section class="study-side-card study-daily-goals">
        <header><h2>${t('Daily goals', 'Задания дня', 'Күндік тапсырмалар')}</h2><button type="button" class="text-link" data-view="quests">${t('All', 'Все', 'Барлығы')} ${icon('arrow', 15)}</button></header>
        ${(rewards.quests || []).map(questRow).join('')}
      </section>
      <section class="study-side-card study-streak-card">
        <span class="study-card-symbol" aria-hidden="true">${icon('flame', 30)}</span>
        <div><h2>${rewards.streak ? t(`${rewards.streak} day streak`, `Серия: ${rewards.streak} дн.`, `${rewards.streak} күн қатарынан`) : t('Your first streak', 'Начни свою серию', 'Алғашқы серияң')}</h2>
          <p>${rewards.streak ? t('Come back for a short lesson tomorrow.', 'Возвращайся завтра на короткий урок.', 'Ертең шағын сабаққа қайта кел.') : t('Finish a lesson to get started.', 'Заверши занятие, чтобы начать.', 'Бастау үшін бір сабақты аяқта.')}</p>
          <button type="button" class="text-link" data-view="shop">${icon('shield', 16)} ${t('Streak protection', 'Защита серии', 'Серияны қорғау')}</button>
        </div>
      </section>
      ${signedIn ? `<section class="study-side-card study-pace-card"><span class="study-card-symbol" aria-hidden="true">${icon('clock', 25)}</span><div><h2>${minutes} ${t('minutes a lesson', 'минут на занятие', 'минут бір сабаққа')}</h2><p>${t('A pace that fits your day.', 'В удобном для тебя темпе.', 'Өзіңе ыңғайлы қарқынмен.')}</p><button type="button" class="text-link" data-view="profile">${t('Change pace', 'Изменить время', 'Уақытты өзгерту')} ${icon('arrow', 15)}</button></div></section>`
        : `<section class="study-side-card study-account-card"><h2>${t('Keep your progress', 'Сохрани свой прогресс', 'Үлгеріміңді сақта')}</h2><p>${t('An account keeps your courses ready on any device.', 'С аккаунтом курсы доступны на любом устройстве.', 'Аккаунтпен курстарың кез келген құрылғыда қолжетімді.')}</p><button type="button" class="primary" data-account-open="signup">${t('Create account', 'Создать аккаунт', 'Аккаунт ашу')}</button><button type="button" class="secondary" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button></section>`}
    </aside></div>`;
}
