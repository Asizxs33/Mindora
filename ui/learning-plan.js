import { escapeHtml as esc } from '../core/engine.js';
import { lessonPages } from '../core/learning-plan.js';
import { character } from './characters.js';
import { timeOptions } from './budget-session.js';
import { icon } from './icons.js';
import { currentLanguage, t } from './language.js';
import { message } from './messages.js';

const pageName = page => ({
  explain: t('Understand', 'Разберись', 'Түсіну'),
  example: t('See an example', 'Посмотри пример', 'Мысалды қарау'),
  check: t('Quick check', 'Проверь себя', 'Өзіңді тексеру'),
  practice: t('Try it yourself', 'Попробуй сам', 'Өзің орындау'),
})[page];

// The same mentor stays with a learner through the explanation, attempt and feedback.
// This only selects presentation; the controller still owns every lesson transition.
function lessonMentor(plan) {
  const subject = `${plan.goal ?? ''} ${plan.title ?? ''}`.toLowerCase();
  if (/\b(code|coding|python|javascript|programming|html|css|sql)\b|программ|код|бағдарлам/.test(subject)) return 'sam';
  if (/\b(design|layout|poster|typography|figma)\b|дизайн|плакат/.test(subject)) return 'mia';
  if (/\b(art|draw|drawing|paint|painting)\b|рисова|сурет/.test(subject)) return 'artist';
  if (/\b(smm|social|marketing|instagram)\b|маркет|соцсет/.test(subject)) return 'smm';
  if (/\b(write|writing|copywriting|story|text)\b|писат|текст|жазу/.test(subject)) return 'copywriter';
  return 'mino';
}

function mentorView(mentor, mood, content, extraClass = '') {
  return `<div class="ai-lesson-mentor ${extraClass}">
    ${character(mentor, mood, 'ai-lesson-mentor-character')}
    <div class="ai-lesson-mentor-speech">${content}</div>
  </div>`;
}

function reviewView(review, nested = false) {
  const heading = nested ? 'h4' : 'h3';
  return `<div class="ai-lesson-feedback">
    <${heading} lang="${esc(currentLanguage())}">${icon('spark', 20)} ${t('DeepSeek feedback', 'Разбор DeepSeek', 'DeepSeek талдауы')}</${heading}>
    <p>${esc(review.observation)}</p>
    <p><strong lang="${esc(currentLanguage())}">${t('What to try next', 'Что попробовать дальше', 'Келесі қадам')}</strong><br>${esc(review.nextAction)}</p>
  </div>`;
}

function resultView({ plan, answers, reviews }) {
  const finalTask = plan.steps.at(-1);
  const review = reviews.at(-1);
  return `<section class="ai-lesson-result learning-result" lang="${esc(plan.language)}">
    ${mentorView(lessonMentor(plan), 'celebrate', `<span class="ai-lesson-result-icon" aria-hidden="true">${icon('check', 24)}</span><h2 id="learning-plan-complete" tabindex="-1" lang="${esc(currentLanguage())}">${t('Lesson complete', 'Занятие завершено', 'Сабақ аяқталды')}</h2><p lang="${esc(currentLanguage())}">${t('You put it into practice. Here is what you made.', 'Ты применил знания на практике. Вот твоя работа.', 'Біліміңді іс жүзінде қолдандың. Міне, жұмысың.')}</p>`, 'ai-lesson-mentor-result')}
    <h3 lang="${esc(currentLanguage())}">${t('Your independent work', 'Твоя самостоятельная работа', 'Өздік жұмысың')}</h3>
    <p>${esc(finalTask.task)}</p>
    <div class="ai-lesson-submission learning-answer">${esc(answers.at(-1))}</div>
    ${review ? reviewView(review) : `<div class="ai-lesson-note"><strong lang="${esc(currentLanguage())}">${t('Self-check', 'Самопроверка', 'Өзін-өзі тексеру')}</strong><p>${esc(finalTask.criterion)}</p></div>`}
    <button class="primary" type="button" data-view="courses">${t('My courses', 'Мои курсы', 'Курстарым')} ${icon('arrow', 18)}</button>
  </section>`;
}

function historyView({ plan, answers, reviews, completed }) {
  // The final submission stays in the result; history keeps earlier guided work accessible.
  const steps = plan.steps.slice(0, Math.min(completed, plan.steps.length - 1));
  if (!steps.length) return '';
  return `<details class="ai-lesson-history">
    <summary lang="${esc(currentLanguage())}">${icon('folder', 18)} <span>${t('Completed work', 'Выполненные задания', 'Орындалған тапсырмалар')} (${steps.length})</span>${icon('chevron', 18)}</summary>
    <ol class="ai-lesson-history-list" lang="${esc(plan.language)}">${steps.map((step, index) => `<li>
      <h3>${esc(step.title)}</h3>
      <p class="ai-lesson-history-task">${esc(step.task)}</p>
      <h4 lang="${esc(currentLanguage())}">${t('Your answer', 'Твой ответ', 'Жауабың')}</h4>
      <div class="ai-lesson-submission learning-answer">${esc(answers[index])}</div>
      ${reviews[index] ? reviewView(reviews[index], true) : ''}
    </li>`).join('')}</ol>
  </details>`;
}

function sourceIllustration(resource) {
  return (resource.images ?? []).map(image => `<figure class="lesson-source-figure"><img src="${esc(image.url)}" alt="${esc(image.alt.replace(/^Image\s+\d+:\s*/i, ''))}" loading="lazy" referrerpolicy="no-referrer"></figure>`).join('');
}

function explanationView(step, mentor) {
  return `${mentorView(mentor, 'explaining', `<h3 lang="${esc(currentLanguage())}">${t('Let’s make it simple.', 'Разберёмся вместе.', 'Бірге түсініп алайық.')}</h3><p>${esc(step.teaching?.why ?? step.criterion)}</p>`)}
    <div class="ai-lesson-instruction learning-answer">${esc(step.instruction)}</div>
    ${step.resource ? sourceIllustration(step.resource) : ''}
    ${step.resource && !step.resource.images?.length ? `<p class="small-note"><a class="source-link" href="${esc(step.resource.url)}" target="_blank" rel="noopener noreferrer" lang="${esc(currentLanguage())}">${t('Open lesson material', 'Открыть материал урока', 'Сабақ материалын ашу')} ${icon('arrow', 14)}</a></p>` : ''}`;
}

function exampleView(teaching, mentor) {
  return `<div class="ai-lesson-example">
    <section class="ai-lesson-example-input"><h3 lang="${esc(currentLanguage())}">${icon('edit', 18)} ${t('Starting point', 'Исходные данные', 'Бастапқы деректер')}</h3><div class="learning-answer">${esc(teaching.example.input)}</div></section>
    <section class="ai-lesson-example-output"><h3 lang="${esc(currentLanguage())}">${icon('check', 18)} ${t('Worked result', 'Готовый результат', 'Дайын нәтиже')}</h3><div class="learning-answer">${esc(teaching.example.output)}</div></section>
    </div>${mentorView(mentor, 'explaining', `<h3 lang="${esc(currentLanguage())}">${t('Why it works', 'Почему это работает', 'Неліктен бұл жұмыс істейді')}</h3><p>${esc(teaching.example.explanation)}</p>`)} `;
}

function checkpointView(teaching, study, busy, mentor) {
  const checkpoint = teaching.checkpoint;
  const correct = study.checked && study.choice === checkpoint.correctIndex;
  return `<div class="ai-lesson-check">
    ${mentorView(mentor, study.checked ? correct ? 'celebrate' : 'encourage' : 'thinking', `<h3 id="learning-check-question">${esc(checkpoint.question)}</h3>`)}
    <div class="ai-lesson-choices" role="group" aria-labelledby="learning-check-question">
      ${checkpoint.choices.map((choice, index) => {
        const selected = study.choice === index;
        const state = selected && study.checked ? correct ? ' is-correct' : ' is-incorrect' : '';
        return `<button class="ai-lesson-choice${selected ? ' is-selected' : ''}${state}" type="button" data-learning-choice="${index}" aria-pressed="${selected}"${busy || correct ? ' disabled' : ''}><span class="ai-lesson-choice-mark" aria-hidden="true">${selected ? icon(correct ? 'check' : 'target', 18) : String.fromCharCode(65 + index)}</span><span>${esc(choice)}</span></button>`;
      }).join('')}
    </div>
    ${study.checked ? `<div class="ai-lesson-check-feedback${correct ? ' is-correct' : ''}" role="status"><strong lang="${esc(currentLanguage())}">${correct ? t('That’s right.', 'Верно.', 'Дұрыс.') : t('Try another answer.', 'Попробуй другой ответ.', 'Басқа жауапты таңда.')}</strong><p>${esc(checkpoint.explanation)}</p></div>` : `<p class="small-note" lang="${esc(currentLanguage())}">${t('Choose an answer, then check your reasoning.', 'Выбери ответ, затем проверь свои рассуждения.', 'Жауапты таңдап, ойыңды тексер.')}</p>`}
  </div>`;
}

function practiceView(step, answer, review, busy, reviewError, last, mentor) {
  const disabled = busy ? ' disabled' : '';
  return `${mentorView(mentor, busy === 'review' ? 'thinking' : review ? 'encourage' : 'explaining', `<h3 lang="${esc(currentLanguage())}">${t('Your turn.', 'Теперь твоя очередь.', 'Енді сенің кезегің.')}</h3><p class="learning-answer">${esc(step.task)}</p>`, 'ai-lesson-mentor-practice')}
    ${step.teaching && !last ? `<div class="ai-lesson-note"><strong lang="${esc(currentLanguage())}">${t('Keep in mind', 'Запомни', 'Есте сақта')}</strong><p>${esc(step.teaching.takeaway)}</p></div>` : ''}
    <div class="ai-lesson-criterion"><strong lang="${esc(currentLanguage())}">${t('Before you submit', 'Перед проверкой', 'Тексеруге жіберер алдында')}</strong><p>${esc(step.criterion)}</p></div>
    ${review ? `
      <h3 lang="${esc(currentLanguage())}">${t('Your answer', 'Твой ответ', 'Жауабың')}</h3>
      <div class="ai-lesson-submission learning-answer">${esc(answer)}</div>
      <div id="learning-review-status" tabindex="-1" role="status">${reviewView(review)}</div>
      <div class="lesson-actions">
        <button class="secondary" type="button" data-learning-step="edit"${disabled}>${t('Revise answer', 'Исправить ответ', 'Жауапты түзету')}</button>
        <button class="primary" type="button" data-learning-step="continue"${disabled}>${last ? t('See my result', 'Посмотреть результат', 'Нәтижені көру') : t('Next task', 'Следующее задание', 'Келесі тапсырма')} ${icon('arrow', 18)}</button>
      </div>` : `
      <form id="learning-step-form">
        <label class="field"><span lang="${esc(currentLanguage())}">${t('Record your result', 'Запиши результат', 'Нәтижеңді жаз')}</span><textarea name="answer" maxlength="1500" rows="5" required${disabled}>${esc(answer)}</textarea></label>
        <p class="small-note" lang="${esc(currentLanguage())}">${t('DeepSeek receives your answer and task for feedback.', 'Для разбора DeepSeek получит задание и твой ответ.', 'Талдау үшін тапсырма мен жауабың DeepSeek-ке жіберіледі.')}</p>
        <div class="lesson-actions">
          <button class="primary" type="submit"${disabled}>${busy === 'review' ? t('Checking…', 'Проверяем…', 'Тексеріліп жатыр…') : reviewError ? t('Retry feedback', 'Повторить разбор', 'Қайта тексеру') : t('Get feedback', 'Получить разбор', 'Кері байланыс алу')} ${icon('spark', 18)}</button>
          ${reviewError ? `<button class="secondary" type="button" data-learning-step="continue"${disabled}>${t('Continue without feedback', 'Продолжить без разбора', 'Талдаусыз жалғастыру')}</button>` : ''}
        </div>
      </form>
      <p id="learning-review-status" role="status" tabindex="-1" lang="${esc(currentLanguage())}">${busy === 'review' ? t('Checking your answer…', 'DeepSeek проверяет ответ…', 'DeepSeek жауабыңды тексеріп жатыр…') : esc(message(reviewError))}</p>`}`;
}

function screenView(saved, busy, reviewError) {
  const { plan, answers, reviews, completed } = saved;
  const step = plan.steps[completed];
  const last = completed === plan.steps.length - 1;
  const pages = lessonPages(step, last);
  const study = saved.study?.[completed] ?? { page: 0, choice: null, checked: false };
  const pageIndex = Math.max(0, Math.min(study.page, pages.length - 1));
  const page = pages[pageIndex];
  const checkedCorrect = study.checked && study.choice === step.teaching?.checkpoint.correctIndex;
  const mentor = lessonMentor(plan);
  const content = page === 'explain' ? explanationView(step, mentor)
    : page === 'example' ? exampleView(step.teaching, mentor)
      : page === 'check' ? checkpointView(step.teaching, study, busy, mentor)
        : practiceView(step, answers[completed], reviews[completed], busy, reviewError, last, mentor);
  return `<section class="ai-lesson-reader" aria-label="${t('Current lesson task', 'Текущее задание', 'Ағымдағы тапсырма')}" lang="${esc(plan.language)}" aria-busy="${Boolean(busy)}">
    <div class="ai-lesson-task-meta" lang="${esc(currentLanguage())}"><span>${t(`Task ${completed + 1} of ${plan.steps.length}`, `Задание ${completed + 1} из ${plan.steps.length}`, `${plan.steps.length} тапсырманың ${completed + 1}-і`)}</span><span>${icon('clock', 16)} ${t(`${step.minutes} min`, `${step.minutes} мин`, `${step.minutes} мин`)}</span></div>
    <ol class="ai-lesson-stages" aria-label="${t('Task screens', 'Экраны задания', 'Тапсырма экрандары')}" lang="${esc(currentLanguage())}">${pages.map((name, index) => `<li class="${index === pageIndex ? 'is-current' : index < pageIndex ? 'is-done' : ''}"${index === pageIndex ? ' aria-current="step"' : ''}><span class="ai-lesson-stage-dot" aria-hidden="true">${index < pageIndex ? icon('check', 12) : index + 1}</span><span>${pageName(name)}</span></li>`).join('')}</ol>
    <article class="ai-lesson-page">
      <header class="ai-lesson-page-heading">
        ${page === 'explain' ? '' : `<p class="ai-lesson-context">${esc(step.title)}</p>`}
        <h2 id="learning-page-title" tabindex="-1"${page === 'explain' ? '' : ` lang="${esc(currentLanguage())}"`}>${page === 'explain' ? esc(step.title) : last ? t('Independent task', 'Самостоятельная работа', 'Өздік жұмыс') : pageName(page)}</h2>
      </header>
      ${content}
    </article>
    <nav class="ai-lesson-page-navigation" aria-label="${t('Lesson navigation', 'Навигация по занятию', 'Сабақ бойынша навигация')}" lang="${esc(currentLanguage())}">
      <button class="secondary" type="button" data-learning-page="back"${busy || pageIndex === 0 ? ' disabled' : ''}>${icon('back', 18)} ${t('Back', 'Назад', 'Артқа')}</button>
      <span class="ai-lesson-page-count">${t(`Screen ${pageIndex + 1} of ${pages.length}`, `Экран ${pageIndex + 1} из ${pages.length}`, `${pages.length} экранның ${pageIndex + 1}-і`)}</span>
      ${page === 'practice' ? '' : page === 'check' && !checkedCorrect ? `<button class="primary ai-lesson-check-button" type="button" data-learning-page="check"${busy || !Number.isInteger(study.choice) ? ' disabled' : ''}>${study.checked ? t('Check again', 'Проверить ещё раз', 'Қайта тексеру') : t('Check answer', 'Проверить ответ', 'Жауапты тексеру')}</button>` : `<button class="primary" type="button" data-learning-page="next"${busy ? ' disabled' : ''}>${page === 'check' ? t('Try it yourself', 'Перейти к практике', 'Өзің орындау') : t('Continue', 'Продолжить', 'Жалғастыру')} ${icon('arrow', 18)}</button>`}
    </nav>
  </section>`;
}

function lessonView(saved, busy, reviewError) {
  const { plan, completed } = saved;
  return `<header class="ai-lesson-heading" lang="${esc(plan.language)}">
    <div class="ai-lesson-heading-meta" lang="${esc(currentLanguage())}"><span>${icon('book', 18)} ${t('My lesson', 'Моё занятие', 'Сабағым')}</span><span>${icon('clock', 16)} ${t(`${plan.minutes} minutes`, `${plan.minutes} минут`, `${plan.minutes} минут`)}</span></div>
    <h1>${esc(plan.title)}</h1><p>${esc(plan.outcome)}</p>
    <div class="ai-lesson-overall"><progress max="${plan.steps.length}" value="${completed}" aria-label="${t('Completed tasks', 'Выполненные задания', 'Орындалған тапсырмалар')}"></progress><span lang="${esc(currentLanguage())}">${t(`${completed} of ${plan.steps.length} tasks complete`, `Выполнено ${completed} из ${plan.steps.length} заданий`, `${plan.steps.length} тапсырманың ${completed} орындалды`)}</span></div>
  </header>
  ${completed === plan.steps.length ? resultView(saved) : screenView(saved, busy, reviewError)}
  ${historyView(saved)}
  <p class="small-note ai-lesson-storage-note">${t('Answers and feedback stay in this browser.', 'Ответы и разборы сохраняются в этом браузере.', 'Жауаптар мен талдау осы браузерде сақталады.')}</p>`;
}

function goalForm({ goal, minutes, busy, error }) {
  return `<form id="learning-plan-form">
    <label class="field"><span>${t('What do you want to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?')}</span><input name="goal" value="${esc(goal)}" placeholder="${t('For example, design my first poster', 'Например, создать свой первый плакат', 'Мысалы, алғашқы постерімді жасау')}" maxlength="180" minlength="3" required${busy ? ' disabled' : ''}></label>
    <label class="field"><span>${t('Time for this lesson', 'Время на занятие', 'Сабақ уақыты')}</span><select name="minutes" class="profile-select"${busy ? ' disabled' : ''}>${timeOptions(minutes)}</select></label>
    <div class="lesson-actions">
      <button class="primary" type="submit"${busy ? ' disabled' : ''}>${busy === 'plan' ? t('Preparing your lesson…', 'Готовим занятие…', 'Сабақ дайындалып жатыр…') : t('Build my lesson', 'Построить занятие', 'Сабақ құру')} ${icon('arrow', 18)}</button>
      <button class="secondary" type="button" data-view="courses"${busy ? ' disabled' : ''}>${t('My courses', 'Мои курсы', 'Курстарым')}</button>
    </div>
  </form>
  <p role="status">${busy === 'plan' ? t('Finding materials and preparing your lesson…', 'Подбираем материалы и готовим занятие…', 'Материалдар іздеп, сабақ дайындап жатырмыз…') : esc(message(error))}</p>`;
}

export function learningPlanView(screen) {
  const { saved, busy, error, reviewError } = screen;
  return `<div class="learning-plan ai-lesson">
    ${saved ? lessonView(saved, busy, reviewError) : `<header class="ai-lesson-welcome"><p class="ai-lesson-eyebrow">${t('A little time. A new skill.', 'Немного времени. Новый навык.', 'Аз уақыт. Жаңа дағды.')}</p><h1>${t('What will we learn today?', 'Чему научимся сегодня?', 'Бүгін не үйренеміз?')}</h1>${mentorView('mino', busy === 'plan' ? 'thinking' : 'welcome', `<p>${t('Tell me your goal. We’ll learn one idea, see an example, then try it together.', 'Расскажи о своей цели. Разберём идею, посмотрим пример и попробуем вместе.', 'Мақсатыңды айт. Бір ойды түсініп, мысалды қарап, бірге орындап көреміз.')}</p>`)}</header>`}
    ${saved ? `<details class="ai-lesson-settings"${busy === 'plan' || error ? ' open' : ''}><summary>${icon('edit', 18)} <span>${t('Change goal or lesson time', 'Изменить цель или время занятия', 'Мақсатты немесе сабақ уақытын өзгерту')}</span>${icon('chevron', 18)}</summary><div class="ai-lesson-settings-body">${goalForm(screen)}</div></details>` : `<section class="game-card simple-panel">${goalForm(screen)}</section>`}
  </div>`;
}
