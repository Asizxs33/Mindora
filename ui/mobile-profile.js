import { icon } from './icons.js';
import { t } from './language.js';
import { timeOptions } from './budget-session.js';
import { profileLearningPanels } from './workspace-pages.js';

export function mobileProfileView(state, stats, rewardProfile) {
  const tools = [
    ['work', 'work', t('My projects', 'Мои проекты', 'Жобаларым')],
    ['practice', 'edit', t('Practice', 'Практика', 'Жаттығу')],
    ['achievements', 'trophy', t('Milestones', 'Достижения', 'Жетістіктер')],
    ['shop', 'store', t('Shop', 'Магазин', 'Дүкен')],
  ];
  return `<section class="simple-profile mobile-profile" aria-labelledby="mobile-profile-title">
    <header class="simple-profile-heading"><h1 id="mobile-profile-title">${t('Profile', 'Профиль', 'Профиль')}</h1></header>
    <section class="account-profile-card" data-account-summary>
      <span class="profile-avatar" aria-hidden="true">${icon('user', 24)}</span>
      <h2 data-account-name>${t('Guest', 'Гость', 'Қонақ')}</h2>
      <p data-account-description>${t('Saved on this device', 'Сохраняется на этом устройстве', 'Осы құрылғыда сақталады')}</p>
      <div class="profile-account-actions">
        <button type="button" class="secondary" data-account-open="signup">${t('Create account', 'Создать аккаунт', 'Аккаунт ашу')}</button>
        <button type="button" class="text-link" data-account-secondary data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button>
        <button type="button" class="text-link profile-signout" data-account-signout hidden>${icon('logout', 17)}<span>${t('Sign out', 'Выйти', 'Шығу')}</span></button>
      </div>
    </section>
    <div class="mobile-profile-stats"><span><strong>${stats.total}</strong> ${t('steps done', 'этапов пройдено', 'кезең аяқталды')}</span><span><strong>${Object.keys(state.works).length}</strong> ${t('works saved', 'работ сохранено', 'жұмыс сақталды')}</span></div>
    <nav class="mobile-profile-tools" aria-label="${t('Learning tools', 'Учебные инструменты', 'Оқу құралдары')}">
      ${tools.map(([view, symbol, title]) => `<button type="button" data-view="${view}">${icon(symbol, 23)}<span>${title}</span></button>`).join('')}
    </nav>
    <h2 class="profile-settings-heading">${t('Settings', 'Настройки', 'Баптаулар')}</h2><section class="mobile-profile-preferences" aria-label="${t('Learning settings', 'Настройки обучения', 'Оқу баптаулары')}">
      <label class="mobile-preference-row" for="profile-minutes"><span class="mobile-preference-icon" aria-hidden="true">${icon('clock', 21)}</span><span>${t('Lesson time', 'Время на урок', 'Сабақ уақыты')}</span>
        <select class="profile-select" id="profile-minutes">${timeOptions(state.minutes)}</select>
      </label>
      <div class="mobile-preference-row"><span class="mobile-preference-icon" aria-hidden="true">${icon('play', 21)}</span><span>${t('Animations', 'Анимация', 'Анимация')}</span>
        <button type="button" class="motion-switch" role="switch" data-character-motion aria-label="${t('Character animations', 'Анимация персонажей', 'Кейіпкерлер анимациясы')}"><span>${t('Animations', 'Анимация', 'Анимация')}</span></button>
      </div>
    </section>
    ${profileLearningPanels(rewardProfile)}
    <button type="button" class="text-link mobile-profile-about" data-action="about">${icon('leaf', 19)} ${t('About Mindora', 'О Mindora', 'Mindora туралы')} ${icon('arrow', 16)}</button>
  </section>`;
}
