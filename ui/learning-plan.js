import { escapeHtml as esc } from '../core/engine.js';
import { pageBanner } from './dashboard.js';
import { timeOptions } from './budget-session.js';
import { icon } from './icons.js';
import { currentLanguage, t } from './language.js';
import { message } from './messages.js';

function reviewView(review) {
  return `<div class="hint-box">
    <h3>${t('DeepSeek feedback', 'Разбор DeepSeek', 'DeepSeek талдауы')}</h3>
    <p>${esc(review.observation)}</p>
    <p><strong>${t('What to try next', 'Что попробовать дальше', 'Келесі қадам')}</strong><br>${esc(review.nextAction)}</p>
  </div>`;
}

function resultView({ plan, answers, reviews }) {
  const finalTask = plan.steps.at(-1);
  const review = reviews.at(-1);
  return `<section class="game-card simple-panel learning-result" lang="${plan.language}">
    <h2 id="learning-plan-complete" tabindex="-1" lang="${currentLanguage()}">${t('Lesson complete', 'Занятие завершено', 'Сабақ аяқталды')}</h2>
    <p>${esc(plan.outcome)}</p>
    <h3 lang="${currentLanguage()}">${t('Your independent work', 'Твоя самостоятельная работа', 'Өздік жұмысың')}</h3>
    <p>${esc(finalTask.task)}</p>
    <p class="learning-answer">${esc(answers.at(-1))}</p>
    ${review ? reviewView(review) : `<div class="hint-box"><strong lang="${currentLanguage()}">${t('Self-check', 'Самопроверка', 'Өзін-өзі тексеру')}</strong><p>${esc(finalTask.criterion)}</p></div>`}
  </section>`;
}

function currentTask(step, answer, review, busy, reviewError, last) {
  const disabled = busy ? ' disabled' : '';
  return `
    ${last ? '' : `<p class="learning-answer">${esc(step.instruction)}</p>`}
    ${step.resource ? sourceIllustration(step.resource) : ''}
    ${step.resource && !step.resource.images?.length ? `<p class="small-note"><a class="source-link" href="${esc(step.resource.url)}" target="_blank" rel="noopener noreferrer">${esc(step.resource.title)} ${icon('arrow', 14)}</a></p>` : ''}
    <p><strong>${t('Task', 'Задание', 'Тапсырма')}</strong><br>${esc(step.task)}</p>
    ${last ? '' : `<p><strong>${t('Self-check', 'Самопроверка', 'Өзін-өзі тексеру')}</strong><br>${esc(step.criterion)}</p>`}
    ${review ? `
      <p class="learning-answer"><strong>${t('Your answer', 'Твой ответ', 'Жауабың')}</strong><br>${esc(answer)}</p>
      <div id="learning-review-status" tabindex="-1">${reviewView(review)}</div>
      <div class="lesson-actions">
        <button class="secondary" type="button" data-learning-step="edit"${disabled}>${t('Revise answer', 'Исправить ответ', 'Жауапты түзету')}</button>
        <button class="primary" type="button" data-learning-step="continue"${disabled}>${last ? t('See my result', 'Посмотреть результат', 'Нәтижені көру') : t('Next task', 'Дальше', 'Келесі тапсырма')}</button>
      </div>` : `
      <form id="learning-step-form">
        <label class="field"><span>${t('Record your result', 'Запиши результат', 'Нәтижеңді жаз')}</span><textarea name="answer" maxlength="1500" rows="4" required${disabled}>${esc(answer)}</textarea></label>
        <p class="small-note">${t('DeepSeek receives your answer and task for feedback.', 'Для разбора DeepSeek получит задание и твой ответ.', 'Талдау үшін тапсырма мен жауабың DeepSeek-ке жіберіледі.')}</p>
        <div class="lesson-actions">
          <button class="primary" type="submit"${disabled}>${reviewError ? t('Retry feedback', 'Повторить разбор', 'Қайта тексеру') : t('Get feedback', 'Получить разбор', 'Кері байланыс алу')}</button>
          ${reviewError ? `<button class="secondary" type="button" data-learning-step="continue"${disabled}>${t('Continue without feedback', 'Продолжить без разбора', 'Талдаусыз жалғастыру')}</button>` : ''}
        </div>
      </form>
      <p id="learning-review-status" role="status" tabindex="-1">${busy === 'review' ? t('Checking your answer…', 'DeepSeek проверяет ответ…', 'DeepSeek жауабыңды тексеріп жатыр…') : esc(message(reviewError))}</p>`}`;
}

function sourceIllustration(resource) {
  return (resource.images ?? []).map(image => `<figure class="lesson-source-figure"><img src="${esc(image.url)}" alt="${esc(image.alt.replace(/^Image\s+\d+:\s*/i, ''))}" loading="lazy" referrerpolicy="no-referrer"></figure>`).join('');
}

function stepsView({ plan, answers, reviews, completed }, busy, reviewError) {
  const steps = plan.steps.map((step, index) => {
    const last = index === plan.steps.length - 1;
    const done = index < completed;
    const current = index === completed;
    const review = reviews[index];
    return `<li class="game-card simple-panel">
      <h3>${last ? t('Independent task', 'Самостоятельная работа', 'Өздік жұмыс') : esc(step.title)} <span class="tag">${t(`${step.minutes} min`, `${step.minutes} мин`, `${step.minutes} мин`)}</span></h3>
      ${done ? `<details><summary>${t('View my answer', 'Посмотреть ответ', 'Жауапты көру')}</summary><p class="learning-answer">${esc(answers[index])}</p>${review ? reviewView(review) : ''}</details>` : ''}
      ${done && step.resource && !step.resource.images?.length ? `<p><a class="source-link" href="${esc(step.resource.url)}" target="_blank" rel="noopener noreferrer">${t('Lesson material', 'Материал урока', 'Сабақ материалы')} ${icon('arrow', 14)}</a></p>` : ''}
      ${current ? currentTask(step, answers[index], review, busy, reviewError, last) : ''}
      ${!done && !current ? `<p>${t('Opens after the previous task.', 'Откроется после предыдущего задания.', 'Алдыңғы тапсырмадан кейін ашылады.')}</p>` : ''}
    </li>`;
  }).join('');
  return `<section aria-label="${t('Lesson tasks', 'Задания занятия', 'Сабақ тапсырмалары')}">
    <h2>${esc(plan.title)}</h2>
    <p>${esc(plan.goal)}</p>
    <p>${t(`${completed} of ${plan.steps.length} tasks · ${plan.minutes} minutes`, `${completed} из ${plan.steps.length} заданий · ${plan.minutes} мин`, `${plan.steps.length} тапсырманың ${completed} орындалды · ${plan.minutes} мин`)}</p>
    ${completed === plan.steps.length ? resultView({ plan, answers, reviews }) : ''}
    <ol class="learning-task-list">${steps}</ol>
    <p class="small-note">${t('Answers and feedback stay in this browser.', 'Ответы и разборы сохраняются в этом браузере.', 'Жауаптар мен талдау осы браузерде сақталады.')}</p>
  </section>`;
}

export function learningPlanView({ goal, minutes, busy, error, reviewError, saved }) {
  return `<div class="learning-plan">
    ${pageBanner(t('My lesson', 'Моё занятие', 'Сабағым'), t('Choose a goal and time for one practical lesson.', 'Выбери цель и время для одного занятия с практикой.', 'Практикалық сабақтың мақсаты мен уақытын таңда.'))}
    <section class="game-card simple-panel">
      <form id="learning-plan-form">
        <label class="field"><span>${t('What do you want to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?')}</span><input name="goal" value="${esc(goal)}" maxlength="180" minlength="3" required${busy ? ' disabled' : ''}></label>
        <label class="field"><span>${t('Time for this lesson', 'Время на занятие', 'Сабақ уақыты')}</span><select name="minutes" class="profile-select"${busy ? ' disabled' : ''}>${timeOptions(minutes)}</select></label>
        <div class="lesson-actions">
          <button class="primary" type="submit"${busy ? ' disabled' : ''}>${t('Build my lesson', 'Построить занятие', 'Сабақ құру')}</button>
          <button class="secondary" type="button" data-view="courses">${t('My courses', 'Мои курсы', 'Курстарым')}</button>
        </div>
      </form>
      <p role="status">${busy === 'plan' ? t('Finding materials and preparing tasks…', 'Подбираем материалы и готовим задания…', 'Материалдар іздеп, тапсырмалар дайындап жатырмыз…') : esc(message(error))}</p>
    </section>
    ${saved ? stepsView(saved, busy, reviewError) : ''}</div>`;
}
