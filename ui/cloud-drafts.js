import { escapeHtml } from '../core/engine.js';
import { t } from './language.js';
import { message } from './messages.js';

export function renderCloudPanel(slot, { user, available, busy, status }) {
  if (!slot) return;
  const previous = slot.querySelector('#mindora-account-form');
  const email = previous?.elements.email.value || '';
  const disabled = busy ? ' disabled' : '';
  const profile = slot.dataset.cloudPanel === 'profile';
  let content = '';
  if (available === false) {
    content = `<p>${t('Cloud storage is unavailable. Drafts stay in this browser.','Облако пока недоступно. Черновики сохраняются в этом браузере.','Бұлттық сақтау қазір қолжетімсіз. Нобайлар осы браузерде сақталады.')}</p>`;
  } else if (user) {
    content = `<p>${t('Account','Аккаунт','Аккаунт')} <strong>${escapeHtml(user.email)}</strong></p>
      <div class="lesson-actions">
        ${profile ? '' : `<button type="button" class="primary" data-cloud-action="save"${disabled}>${t('Save to my account','Сохранить в аккаунте','Аккаунтқа сақтау')}</button>`}
        <button type="button" class="secondary" data-cloud-action="load"${disabled}>${t('Open from my account','Открыть из аккаунта','Аккаунттан ашу')}</button>
        ${profile ? `<button type="button" class="ghost" data-cloud-action="signout"${disabled}>${t('Sign out','Выйти','Шығу')}</button>` : ''}
      </div>`;
  } else if (profile && available) {
    content = `<form id="mindora-account-form">
      <label class="field"><span>${t('Email','Электронная почта','Электрондық пошта')}</span><input name="email" type="email" autocomplete="email" maxlength="254" value="${escapeHtml(email)}" required></label>
      <label class="field"><span>${t('Password','Пароль','Құпиясөз')}</span><input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label>
      <div class="lesson-actions">
        <button class="primary" type="submit" value="signin"${disabled}>${t('Sign in','Войти','Кіру')}</button>
        <button class="secondary" type="submit" value="signup"${disabled}>${t('Create account','Создать аккаунт','Аккаунт ашу')}</button>
      </div>
    </form>`;
  } else if (available) {
    content = `<p>${t('Sign in to open this draft on another device.','Войди, чтобы открыть этот черновик на другом устройстве.','Осы нобайды басқа құрылғыда ашу үшін аккаунтқа кір.')}</p><button class="secondary" data-view="profile">${t('Sign in','Войти','Кіру')}</button>`;
  } else {
    content = `<p>${t('Connecting…','Подключаемся…','Қосылып жатыр…')}</p>`;
  }
  slot.innerHTML = `<h2>${t('Cloud drafts','Черновики в аккаунте','Аккаунттағы нобайлар')}</h2>${content}<p role="status">${escapeHtml(message(status))}</p>`;
}
