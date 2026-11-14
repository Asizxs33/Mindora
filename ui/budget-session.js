import { budgetSession, normalizeMinutes, SESSION_MINUTES } from '../core/budget-session.js';
import { escapeHtml } from '../core/engine.js';

export function timeOptions(minutes) {
  return SESSION_MINUTES.map(value => (
    `<option value="${value}"${value === normalizeMinutes(minutes) ? ' selected' : ''}>${value} мин</option>`
  )).join('');
}

export function budgetSessionPanel(minutes) {
  const { title, questions } = budgetSession(minutes);
  return `<section class="side-panel" aria-label="Занятие по времени">
    <label for="budget-session-minutes">Время на занятие</label>
    <select id="budget-session-minutes" class="profile-select">${timeOptions(minutes)}</select>
    <h3>${title}</h3>
    <p>Вопросов в этом варианте: ${questions.length}. Ответы и черновик каждого варианта сохраняются отдельно.</p>
  </section>`;
}

export function budgetBalanceField(draft, limit) {
  if (limit === null) return '';
  return `<label class="field">
    <span>Сколько останется из $${limit}?</span>
    <input id="budget-balance" type="number" step="0.01" value="${escapeHtml(draft.balance)}">
  </label>`;
}
