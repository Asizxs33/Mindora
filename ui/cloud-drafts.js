import { escapeHtml } from '../core/engine.js';
import { t } from './language.js';
import { message } from './messages.js';

export function renderCloudPanel(slot, { user, available, busy, status }) {
  if (!slot) return;
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
        ${profile ? `<button type="button" class="ghost" data-account-open="profile">${t('Manage account','Настроить аккаунт','Аккаунтты басқару')}</button>` : ''}
      </div>`;
  } else if (profile && available) {
    content = `<p>${t('Sign in to open your saved drafts.','Войди, чтобы открыть сохранённые черновики.','Сақталған нобайларды ашу үшін аккаунтқа кір.')}</p>
      <div class="lesson-actions">
        <button class="primary" type="button" data-account-open="signin">${t('Sign in','Войти','Кіру')}</button>
        <button class="secondary" type="button" data-account-open="signup">${t('Create account','Создать аккаунт','Аккаунт ашу')}</button>
      </div>`;
  } else if (available) {
    content = `<p>${t('Sign in to open this draft on another device.','Войди, чтобы открыть этот черновик на другом устройстве.','Осы нобайды басқа құрылғыда ашу үшін аккаунтқа кір.')}</p><button type="button" class="secondary" data-account-open="signin">${t('Sign in','Войти','Кіру')}</button>`;
  } else {
    content = `<p>${t('Connecting…','Подключаемся…','Қосылып жатыр…')}</p>`;
  }
  slot.innerHTML = `<h2>${t('Cloud drafts','Черновики в аккаунте','Аккаунттағы нобайлар')}</h2>${content}<p role="status">${escapeHtml(message(status))}</p>`;
}
