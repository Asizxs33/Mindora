import { escapeHtml as esc } from '../core/engine.js';
import { pageBanner } from './dashboard.js';
import { timeOptions } from './budget-session.js';
import { icon } from './icons.js';

function reviewView(review) {
  return `<h4>Разбор DeepSeek</h4>
    <p>${esc(review.observation)}</p>
    <p><strong>Что попробовать</strong><br>${esc(review.nextAction)}</p>`;
}

function stepsView({ plan, answers, reviews, completed }, busy, reviewError) {
  const steps = plan.steps.map((step, index) => {
    const done = index < completed;
    const current = index === completed;
    const resource = step.resource;
    const review = reviews[index];
    return `<li class="game-card simple-panel">
      <h3>${index + 1}. ${esc(step.title)} <span class="tag">${step.minutes} мин</span></h3>
      ${done ? `<p>${icon('check', 16)} Выполнено</p><p>${esc(answers[index])}</p>` : ''}
      ${done && review ? reviewView(review) : ''}
      ${resource ? `<p><a class="source-link" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${esc(resource.title)} ${icon('arrow', 14)}</a></p>` : ''}
      ${current ? `
        <p>${esc(step.instruction)}</p>
        <p><strong>Задание</strong><br>${esc(step.task)}</p>
        <p><strong>Как проверить себя</strong><br>${esc(step.criterion)}</p>
        ${review ? `
          <p><strong>Твой ответ</strong><br>${esc(answers[index])}</p>
          <div id="learning-review-status" tabindex="-1">${reviewView(review)}</div>
          <div class="lesson-actions">
            <button class="secondary" type="button" data-learning-step="edit"${busy ? ' disabled' : ''}>Исправить ответ</button>
            <button class="primary" type="button" data-learning-step="continue"${busy ? ' disabled' : ''}>${index === plan.steps.length - 1 ? 'Завершить занятие' : 'Перейти дальше'}</button>
          </div>` : `<form id="learning-step-form">
          <label class="field"><span>Запиши результат</span><textarea name="answer" maxlength="1500" rows="4" required${busy ? ' disabled' : ''}>${esc(answers[index])}</textarea></label>
          <p class="small-note">Для разбора ответ и задание отправляются в DeepSeek.</p>
          <div class="lesson-actions">
            <button class="primary" type="submit"${busy ? ' disabled' : ''}>${reviewError ? 'Повторить разбор' : 'Получить разбор'}</button>
            ${reviewError ? `<button class="secondary" type="button" data-learning-step="continue"${busy ? ' disabled' : ''}>Продолжить без разбора</button>` : ''}
          </div>
        </form>
        <p id="learning-review-status" role="status" tabindex="-1">${busy === 'review' ? 'DeepSeek сверяет ответ с заданием…' : esc(reviewError)}</p>`}` : ''}
      ${!done && !current ? '<p>Откроется после предыдущего задания.</p>' : ''}
    </li>`;
  }).join('');
  return `<section aria-label="Учебные задания">
    <h2>${esc(plan.title)}</h2>
    <p>Твоя цель — ${esc(plan.goal)}</p>
    <p>Результат занятия — ${esc(plan.outcome)}</p>
    <p>${completed} из ${plan.steps.length} шагов · ${plan.minutes} минут</p>
    ${completed === plan.steps.length ? '<p id="learning-plan-complete" role="status" tabindex="-1"><strong>Занятие завершено. Твои ответы сохранены.</strong></p>' : ''}
    <ol class="principle-list" style="list-style:none;padding:0">${steps}</ol>
    <p class="small-note">Ответы и разборы сохраняются в этом браузере.</p>
  </section>`;
}

export function learningPlanView({ goal, minutes, busy, error, reviewError, saved }) {
  return `${pageBanner('Мой маршрут', 'Выбери цель и время, чтобы получить практику и материалы для одного занятия.')}
    <section class="game-card simple-panel">
      <form id="learning-plan-form">
        <label class="field"><span>Чему хочешь научиться?</span><input name="goal" value="${esc(goal)}" maxlength="180" minlength="3" required${busy ? ' disabled' : ''}></label>
        <label class="field"><span>Время на занятие</span><select name="minutes" class="profile-select"${busy ? ' disabled' : ''}>${timeOptions(minutes)}</select></label>
        <div class="lesson-actions">
          <button class="primary" type="submit"${busy ? ' disabled' : ''}>Построить маршрут</button>
          <button class="secondary" type="button" data-view="courses">Готовые курсы</button>
        </div>
      </form>
      <p role="status">${busy === 'plan' ? 'DeepSeek ищет материалы и готовит задания…' : esc(error)}</p>
    </section>
    ${saved ? stepsView(saved, busy, reviewError) : ''}`;
}
