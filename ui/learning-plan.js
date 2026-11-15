import { escapeHtml as esc } from '../core/engine.js';
import { lessonPages } from '../core/learning-plan.js';
import { isAssessmentCorrect, isAssessmentReady, normalizeAssessmentResponse } from '../core/lesson-assessment.js';
import { timeOptions } from './budget-session.js';
import { icon } from './icons.js';
import { courseLanguageField, currentLanguage, languagePicker, t } from './language.js';
import { message } from './messages.js';
import { mentorForTopic, mentorScene, renderLessonTemplate } from './lesson-templates.js';
import { sceneForTopic } from './learning-scenes.js';
import { practiceEditor, practiceResult } from './lesson-practice.js';
import { isLogarithmTopic } from '../core/subject-mentor.js';
import { logExplorer } from './learning-labs.js';
import { renderLessonVisual } from './lesson-visual.js';
import { minoWaitScreen, minoWalk } from './mino-wait.js';

if (typeof document !== 'undefined' && !document.getElementById('mindora-template-styles')) {
  const stylesheet = document.createElement('link');
  stylesheet.id = 'mindora-template-styles';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./lesson-templates.css', import.meta.url).href;
  document.head.append(stylesheet);
  const practiceStyles = document.createElement('link');
  practiceStyles.rel = 'stylesheet';
  practiceStyles.href = new URL('./lesson-practice.css', import.meta.url).href;
  document.head.append(practiceStyles);
}

export function taskPreviewView(screen) {
  return `<div class="learning-plan ai-lesson has-course"><div class="reader-toolbar">
    <button class="icon-button ai-lesson-exit" type="button" data-view="course-path" aria-label="${t('Back to course', 'К курсу', 'Курсқа оралу')}">${icon('close', 21)}</button>
    <strong>${t('Practice preview', 'Пробный режим', 'Сынап көру')}</strong>
  </div>${screenView(screen.saved, screen.busy, screen.reviewError, true)}</div>`;
}

const pageName = page => ({
  explain: t('Understand', 'Разберись', 'Түсіну'),
  illustration: t('Illustration', 'Иллюстрация', 'Сурет'),
  example: t('See an example', 'Посмотри пример', 'Мысалды қарау'),
  check: t('Quick check', 'Проверь себя', 'Өзіңді тексеру'),
  recap: t('Remember', 'Запомни', 'Есте сақтау'),
  practice: t('Try it yourself', 'Попробуй сам', 'Өзің орындау'),
})[page];

// The same mentor stays with a learner through the explanation, attempt and feedback.
// This only selects presentation; the controller still owns every lesson transition.
function lessonMentor(plan) {
  return mentorForTopic(`${plan.goal ?? ''} ${plan.title ?? ''}`);
}

function mentorView(mentor, mood, content, extraClass = '', options = {}) {
  return mentorScene(mentor, mood, content, extraClass, options);
}

function reviewView(review, nested = false) {
  const heading = nested ? 'h4' : 'h3';
  return `<div class="ai-lesson-feedback">
    <${heading} lang="${esc(currentLanguage())}">${icon('spark', 20)} ${t('AI feedback', 'Разбор ИИ', 'ЖИ талдауы')}</${heading}>
    <p>${esc(review.observation)}</p>
    <p><strong lang="${esc(currentLanguage())}">${t('What to try next', 'Что попробовать дальше', 'Келесі қадам')}</strong><br>${esc(review.nextAction)}</p>
  </div>`;
}

function resultView({ plan, answers, reviews }, onRoadmap, nextStage) {
  const finalTask = plan.steps.at(-1);
  const review = reviews.at(-1);
  return `<section class="ai-lesson-result learning-result" lang="${esc(plan.language)}">
    ${mentorView(lessonMentor(plan), 'celebrate', `<span class="ai-lesson-result-icon" aria-hidden="true">${icon('check', 24)}</span><h2 id="learning-plan-complete" tabindex="-1" lang="${esc(currentLanguage())}">${t('Lesson complete', 'Занятие завершено', 'Сабақ аяқталды')}</h2><p lang="${esc(currentLanguage())}">${t('You put it into practice. Here is what you made.', 'Ты применил знания на практике. Вот твоя работа.', 'Біліміңді іс жүзінде қолдандың. Міне, жұмысың.')}</p>`, 'ai-lesson-mentor-result')}
    <h3 lang="${esc(currentLanguage())}">${t('Your independent work', 'Твоя самостоятельная работа', 'Өздік жұмысың')}</h3>
    <p>${esc(finalTask.task)}</p>
    <div class="ai-lesson-submission learning-answer">${practiceResult(finalTask.practice, answers.at(-1))}</div>
    ${review ? reviewView(review) : `<div class="ai-lesson-note"><strong lang="${esc(currentLanguage())}">${t('Self-check', 'Самопроверка', 'Өзін-өзі тексеру')}</strong><p>${esc(finalTask.criterion)}</p></div>`}
    ${Number.isInteger(nextStage) ? `<button class="primary" type="button" data-action="next-path-lesson">${t('Next lesson', 'Следующий урок', 'Келесі сабақ')} ${icon('arrow', 18)}</button>` : ''}
    <button class="${Number.isInteger(nextStage) ? 'text-link' : 'primary'}" type="button" data-view="${onRoadmap ? 'my-path' : 'course-path'}">${t('Back to my path', 'К карте обучения', 'Оқу жолыма оралу')} ${icon('arrow', 18)}</button>
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
      ${sourceMaterialLink(step.resource)}
      <h4 lang="${esc(currentLanguage())}">${t('Your answer', 'Твой ответ', 'Жауабың')}</h4>
      <div class="ai-lesson-submission learning-answer">${practiceResult(step.practice, answers[index])}</div>
      ${reviews[index] ? reviewView(reviews[index], true) : ''}
    </li>`).join('')}</ol>
  </details>`;
}

function sourceMaterialLink(resource) {
  if (!resource || resource.images?.length) return '';
  return '<p class="small-note"><a class="source-link" href="' + esc(resource.url) + '" target="_blank" rel="noopener noreferrer" lang="' + esc(currentLanguage()) + '">' + t('Open lesson material', 'Открыть материал урока', 'Сабақ материалын ашу') + ' ' + icon('arrow', 14) + '</a></p>';
}

function explanationView(step, mentor) {
  const images = step.teaching?.assessment ? [] : step.resource?.images;
  return `${renderLessonTemplate({ type: 'theory', intro: step.teaching?.why ?? step.criterion, body: step.instruction, images }, {}, { external: true, mentor })}
    ${sourceMaterialLink(step.resource)}`;
}

function illustrationView(step) {
  return renderLessonTemplate({ type: 'illustration', images: step.resource.images }, {}, { external: true });
}

function exampleView(teaching, mentor, topic) {
  const codeExample = /\b(python|javascript|programming|coding|html|css|sql)\b|программ|бағдарлам/i.test(topic);
  return (isLogarithmTopic(topic) ? logExplorer() : '') + renderLessonVisual(teaching.example.visual) + renderLessonTemplate({ type: 'comparison', prompt: t('Why it works', 'Почему это работает', 'Неліктен бұл жұмыс істейді'), intro: teaching.example.explanation, before: teaching.example.input, after: teaching.example.output, explanation: teaching.example.explanation, sceneFrame: sceneForTopic(topic), codeExample,
    ...(codeExample ? { beforeLabel: t('Code', 'Код', 'Код'), afterLabel: t('Output', 'Результат', 'Нәтиже') } : {}),
  }, {}, { external: true, mentor });
}

function checkpointView(teaching, study, busy, mentor) {
  const checkpoint = teaching.checkpoint;
  const correct = study.checked && study.choice === checkpoint.correctIndex;
  return `<div class="ai-lesson-check">
    ${mentorView(mentor, study.checked ? correct ? 'celebrate' : 'encourage' : 'thinking', `<h3 id="learning-check-question">${esc(checkpoint.question)}</h3>`, '', { hint: study.checked ? checkpoint.explanation : t('Compare each answer with the example you just saw.', 'Сравни каждый ответ с предыдущим примером.', 'Әр жауапты жаңа ғана көрген мысалмен салыстыр.'), focus: t('See the answers', 'К вариантам', 'Жауаптарға өту') })}
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

function assessmentView(assessment, response, checked, correct, busy, mentor) {
  const state = { checked, correct };
  const hints = {
    'multi-choice': t('Select all answers that apply.', 'Выбери все подходящие ответы.', 'Барлық дұрыс жауапты таңда.'),
    match: t('Use each option once.', 'Используй каждый вариант один раз.', 'Әр нұсқаны бір рет қолдан.'),
  };
  const responseField = { choice: 'choice', 'multi-choice': 'selected', order: 'order', match: 'matches', 'gap-fill': 'value' }[assessment.type];
  state[responseField] = response;
  return `<div class="ai-lesson-check">
    ${renderLessonTemplate({ ...assessment, prompt: assessment.question }, state, { external: true, busy, mentor })}
    ${hints[assessment.type] ? `<p class="small-note" lang="${esc(currentLanguage())}">${hints[assessment.type]}</p>` : ''}
    ${checked ? `<div id="learning-check-feedback" class="ai-lesson-check-feedback${correct ? ' is-correct' : ''}" role="status" tabindex="-1"><strong lang="${esc(currentLanguage())}">${correct ? t('That’s right.', 'Верно.', 'Дұрыс.') : t('Try again.', 'Попробуй ещё раз.', 'Қайта байқап көр.')}</strong><p>${esc(assessment.explanation)}</p></div>` : ''}
  </div>`;
}

function recapView(teaching, mentor) {
  return renderLessonTemplate({ type: 'recap', points: [teaching.takeaway] }, {}, { external: true, mentor });
}

function practiceView(step, answer, review, busy, reviewError, last, mentor, useTemplates) {
  const disabled = busy ? ' disabled' : '';
  const mood = busy === 'review' ? 'thinking' : review ? 'encourage' : 'explaining';
  const prompt = t('Your turn.', 'Теперь твоя очередь.', 'Енді сенің кезегің.');
  const task = useTemplates
    ? renderLessonTemplate({ type: 'practice', prompt, body: step.task, criterion: step.criterion }, {}, { external: true, mentor, sceneMood: mood })
    : `${mentorView(mentor, mood, `<h3 lang="${esc(currentLanguage())}">${prompt}</h3><p class="learning-answer">${esc(step.task)}</p>`, 'ai-lesson-mentor-practice', { hint: step.teaching?.takeaway || step.criterion, focus: t('What to check', 'Что проверить', 'Нені тексеру керек') })}
      ${step.teaching && !last ? `<div class="ai-lesson-note"><strong lang="${esc(currentLanguage())}">${t('Keep in mind', 'Запомни', 'Есте сақта')}</strong><p>${esc(step.teaching.takeaway)}</p></div>` : ''}
      <div class="ai-lesson-criterion"><strong lang="${esc(currentLanguage())}">${t('Before you submit', 'Перед проверкой', 'Тексеруге жіберер алдында')}</strong><p>${esc(step.criterion)}</p></div>`;
  return `${task}
    ${review ? `
      <h3 lang="${esc(currentLanguage())}">${t('Your answer', 'Твой ответ', 'Жауабың')}</h3>
      <div class="ai-lesson-submission learning-answer">${practiceResult(step.practice, answer)}</div>
      <div id="learning-review-status" tabindex="-1" role="status">${reviewView(review)}</div>
      <div class="lesson-actions">
        <button class="secondary" type="button" data-learning-step="edit"${disabled}>${t('Revise answer', 'Исправить ответ', 'Жауапты түзету')}</button>
        <button class="primary" type="button" data-learning-step="continue"${disabled}>${last ? t('See my result', 'Посмотреть результат', 'Нәтижені көру') : t('Next task', 'Следующее задание', 'Келесі тапсырма')} ${icon('arrow', 18)}</button>
      </div>` : `
      <form id="learning-step-form">
        ${practiceEditor(step.practice, answer, busy)}
        <div class="lesson-actions">
          <button class="primary" type="submit"${disabled}>${busy === 'review' ? t('Checking…', 'Проверяем…', 'Тексеріліп жатыр…') : reviewError ? t('Retry feedback', 'Повторить разбор', 'Қайта тексеру') : t('Get feedback', 'Получить разбор', 'Кері байланыс алу')} ${icon('spark', 18)}</button>
          ${reviewError ? `<button class="secondary" type="button" data-learning-step="continue"${disabled}>${t('Continue without feedback', 'Продолжить без разбора', 'Талдаусыз жалғастыру')}</button>` : ''}
        </div>
      </form>
      <p id="learning-review-status"${busy === 'review' ? ' class="mino-wait-inline"' : ''} role="status" tabindex="-1" lang="${esc(currentLanguage())}">${busy === 'review' ? `${minoWalk()}<span>${t('Checking your answer…', 'Проверяем ответ…', 'Жауабың тексеріліп жатыр…')}</span>` : esc(message(reviewError))}</p>`}`;
}

function screenView(saved, busy, reviewError, preview = false) {
  const { plan, answers, reviews, completed } = saved;
  const step = plan.steps[completed];
  const last = completed === plan.steps.length - 1;
  const pages = lessonPages(step, last);
  const study = saved.study?.[completed] ?? { page: 0, choice: null, checked: false };
  const { teaching } = step;
  const assessment = teaching?.assessment;
  const response = assessment ? normalizeAssessmentResponse(assessment, study.response) : null;
  const canCheck = assessment ? isAssessmentReady(assessment, response) : Number.isInteger(study.choice);
  const checkedCorrect = study.checked && (assessment ? isAssessmentCorrect(assessment, response) : study.choice === teaching?.checkpoint?.correctIndex);
  const mentor = lessonMentor(plan);
  const checkIndex = pages.indexOf('check');
  const visible = checkIndex >= 0 && !checkedCorrect ? pages.slice(0, checkIndex + 1) : pages;
  const sections = visible.map((page, index) => {
    let content;
    switch (page) {
      case 'explain': content = explanationView(step, mentor); break;
      case 'illustration': content = illustrationView(step); break;
      case 'example': content = exampleView(teaching, mentor, `${plan.goal || ''} ${plan.title}`); break;
      case 'check': content = assessment
        ? assessmentView(assessment, response, study.checked, checkedCorrect, busy, mentor)
        : checkpointView(teaching, study, busy, mentor); break;
      case 'recap': content = recapView(teaching, mentor); break;
      default: content = practiceView(step, answers[completed], reviews[completed], busy, reviewError, last, mentor, plan.formatVersion === 3);
    }
    const title = page === 'explain' || (last && page === 'practice') ? step.title : pageName(page);
    const checkButton = page === 'check' && !checkedCorrect
      ? `<button class="primary stream-check" type="button" data-learning-page="check"${busy || !canCheck ? ' disabled' : ''}>${t('Check answer', 'Проверить ответ', 'Жауапты тексеру')}</button>` : '';
    return `<section class="reader-section" data-reader-section="${index}" data-lesson-phase="${page}">
      <h2 tabindex="-1"${index === study.page ? ' id="learning-page-title"' : ''} lang="${esc(page === 'explain' || last ? plan.language : currentLanguage())}">${esc(title)}</h2>
      ${content}${checkButton}
    </section>`;
  });
  return `<div class="ai-lesson-reader lesson-stream" data-reader-step="${completed}" data-reader-cursor="${study.page}" tabindex="0" role="region" aria-label="${esc(step.title)}" lang="${esc(plan.language)}">
    ${preview ? '' : historyView(saved)}
    <article class="ai-lesson-page">${sections.join('')}</article>
  </div>`;
}

function lessonView(saved, busy, reviewError, onRoadmap, nextStage) {
  const { plan, completed } = saved;
  const lengths = plan.steps.map((step, i) => lessonPages(step, i === plan.steps.length - 1).length);
  const base = lengths.slice(0, completed).reduce((total, n) => total + n, 0);
  const total = lengths.reduce((sum, n) => sum + n, 0);
  const value = base + (saved.study?.[completed]?.page || 0);
  return `<div class="reader-toolbar">
    <button type="button" class="icon-button ai-lesson-exit" data-view="${onRoadmap ? 'my-path' : 'course-path'}" aria-label="${t('Save and leave', 'Сохранить и выйти', 'Сақтап шығу')}">${icon('close', 21)}</button>
    <progress class="reader-progress" data-reader-base="${base}" max="${total}" value="${value}" aria-label="${t('Lesson progress', 'Прогресс занятия', 'Сабақ барысы')}"></progress>
    ${languagePicker({ compact: true, id: 'reader-language' })}
  </div>
  ${completed === plan.steps.length ? resultView(saved, onRoadmap, nextStage) + historyView(saved) : screenView(saved, busy, reviewError)}`;
}

function goalForm({ goal, minutes, error, courseLanguage }) {
  return `<form id="learning-plan-form">
    <label class="field"><span>${t('What do you want to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?')}</span><input name="goal" value="${esc(goal)}" placeholder="${t('For example, design my first poster', 'Например, создать свой первый плакат', 'Мысалы, алғашқы постерімді жасау')}" maxlength="180" minlength="3" required></label>
    ${courseLanguageField(courseLanguage)}
    <label class="field"><span>${t('Time for this lesson', 'Время на занятие', 'Сабақ уақыты')}</span><select name="minutes" class="profile-select">${timeOptions(minutes)}</select></label>
    <div class="lesson-actions">
      <button class="primary" type="submit">${t('Build my lesson', 'Построить занятие', 'Сабақ құру')} ${icon('arrow', 18)}</button>
      <button class="secondary" type="button" data-view="courses">${t('My courses', 'Мои курсы', 'Курстарым')}</button>
    </div>
  </form>
  <p role="status">${esc(message(error))}</p>`;
}

export function learningPlanView(screen) {
  const { saved, busy, reviewError, onRoadmap } = screen;
  if (!saved && busy === 'plan') return minoWaitScreen(
    t('Finding materials and preparing your lesson…', 'Подбираем материалы и готовим занятие…', 'Материалдар іздеп, сабақ дайындап жатырмыз…'),
    t('Think of a small example you could try on your own.', 'Придумай маленький пример, который сможешь выполнить сам.', 'Өз бетіңше орындай алатын шағын мысал ойлап көр.'),
  );
  return `<div class="learning-plan ai-lesson${saved ? ' has-course' : ''}">
    ${saved ? '' : `<button type="button" class="icon-button ai-lesson-exit" data-view="${onRoadmap ? 'my-path' : 'discover'}" aria-label="${t('Save and leave', 'Сохранить и выйти', 'Сақтап шығу')}">${icon('close',22)}</button>`}
    ${saved ? lessonView(saved, busy, reviewError, onRoadmap, screen.nextStage) : `<header class="ai-lesson-welcome"><p class="ai-lesson-eyebrow">${t('A little time. A new skill.', 'Немного времени. Новый навык.', 'Аз уақыт. Жаңа дағды.')}</p><h1>${t('What will we learn today?', 'Чему научимся сегодня?', 'Бүгін не үйренеміз?')}</h1>${mentorView('mino', 'listening', `<p>${t('Tell me your goal. We’ll learn one idea, see an example, then try it together.', 'Расскажи о своей цели. Разберём идею, посмотрим пример и попробуем вместе.', 'Мақсатыңды айт. Бір ойды түсініп, мысалды қарап, бірге орындап көреміз.')}</p>`)}</header>`}
    ${saved || onRoadmap ? '' : `<section class="game-card simple-panel">${goalForm(screen)}</section>`}
  </div>`;
}
