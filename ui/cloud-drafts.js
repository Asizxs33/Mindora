import { escapeHtml } from '../core/engine.js';

export function renderCloudPanel(slot, { user, available, busy, status }) {
  if (!slot) return;
  const previous = slot.querySelector('#mindora-account-form');
  const email = previous?.elements.email.value || '';
  const disabled = busy ? ' disabled' : '';
  const profile = slot.dataset.cloudPanel === 'profile';
  let content = '';
  if (available === false) {
    content = '<p>Облако пока недоступно. Черновики сохраняются в этом браузере.</p>';
  } else if (user) {
    content = `<p>Аккаунт: <strong>${escapeHtml(user.email)}</strong></p>
      <div class="lesson-actions">
        ${profile ? '' : `<button type="button" class="primary" data-cloud-action="save"${disabled}>Сохранить в аккаунте</button>`}
        <button type="button" class="secondary" data-cloud-action="load"${disabled}>Открыть из аккаунта</button>
        ${profile ? `<button type="button" class="ghost" data-cloud-action="signout"${disabled}>Выйти</button>` : ''}
      </div>`;
  } else if (profile && available) {
    content = `<form id="mindora-account-form">
      <label class="field"><span>Электронная почта</span><input name="email" type="email" autocomplete="email" maxlength="254" value="${escapeHtml(email)}" required></label>
      <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label>
      <div class="lesson-actions">
        <button class="primary" type="submit" value="signin"${disabled}>Войти</button>
        <button class="secondary" type="submit" value="signup"${disabled}>Создать аккаунт</button>
      </div>
    </form>`;
  } else if (available) {
    content = '<p>Войди, чтобы открыть этот черновик на другом устройстве.</p><button class="secondary" data-view="profile">Войти в аккаунт</button>';
  } else {
    content = '<p>Подключаемся к аккаунту…</p>';
  }
  slot.innerHTML = `<h2>Черновики в аккаунте</h2>${content}<p role="status">${escapeHtml(status)}</p>`;
}
