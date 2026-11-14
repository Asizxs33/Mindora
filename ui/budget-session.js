import { budgetSession, normalizeMinutes, SESSION_MINUTES } from '../core/budget-session.js';
import { escapeHtml } from '../core/engine.js';
import { t } from './language.js';

export function timeOptions(minutes) {
  return SESSION_MINUTES.map(value => (
    `<option value="${value}"${value === normalizeMinutes(minutes) ? ' selected' : ''}>${t(`${value} minutes`, `${value} мин`, `${value} минут`)}</option>`
  )).join('');
}

export function budgetSessionPanel(minutes) {
  const { questions } = budgetSession(minutes);
  return `<section class="side-panel" aria-label="Spreadsheet lesson duration">
    <label for="budget-session-minutes">${t('Time for this lesson','Время на занятие','Сабақ уақыты')}</label>
    <select id="budget-session-minutes" class="profile-select">${timeOptions(minutes)}</select>
    <p>${t(`${questions.length} ${questions.length === 1 ? 'quiz question' : 'quiz questions'}`, `Вопросов в тесте: ${questions.length}`, `Тесттегі сұрақ саны: ${questions.length}`)}</p>
  </section>`;
}

export function budgetBalanceField(draft, limit) {
  if (limit === null) return '';
  return `<label class="field">
    <span>${t(`How much is left from $${limit}?`, `Сколько осталось из $${limit}?`, `$${limit} сомасынан қанша қалды?`)}</span>
    <input id="budget-balance" type="number" step="0.01" value="${escapeHtml(draft.balance)}">
  </label>`;
}
