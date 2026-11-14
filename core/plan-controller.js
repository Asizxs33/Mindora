import { lessonPages, normalizeTaskReview, planInput, restorePlan, taskReviewInput } from './learning-plan.js';
import { message } from '../ui/messages.js';

export function createPlanController({ state, save, render, isOpen }) {
  state.learningPlan = restorePlan(state.learningPlan);
  let goal = state.learningPlan?.plan.goal ?? '';
  let minutes = state.learningPlan?.plan.minutes ?? state.minutes;
  let busy = null;
  let error = '';
  let reviewError = '';
  let reviewErrorFor = null;

  function refresh() {
    if (isOpen()) render();
  }

  function focusPage() {
    if (isOpen()) {
      (document.getElementById('learning-page-title') || document.getElementById('learning-plan-complete'))?.focus();
    }
  }

  function currentLesson() {
    const saved = state.learningPlan;
    const index = saved?.completed;
    const step = saved?.plan.steps[index];
    if (!step) return null;
    const study = saved.study[index];
    const pages = lessonPages(step, index === saved.plan.steps.length - 1);
    return { saved, index, step, study, pages, page: pages[study.page] };
  }

  function passedCheckpoint({ step, study, pages }) {
    return !pages.includes('check') || (study.checked && study.choice === step.teaching.checkpoint.correctIndex);
  }

  function atPractice(lesson) {
    return lesson?.page === 'practice' && passedCheckpoint(lesson);
  }

  function activeReviewError() {
    return reviewErrorFor?.saved === state.learningPlan && reviewErrorFor.index === state.learningPlan?.completed
      ? reviewError : '';
  }

  async function generate(nextGoal, nextMinutes) {
    if (busy) return;
    goal = nextGoal;
    minutes = nextMinutes;
    const input = planInput(goal, minutes, state.language);
    if (!input) {
      error = 'Напиши цель от 3 до 180 символов и выбери время.';
      refresh();
      return;
    }
    if (state.learningPlan?.plan.goal === input.goal && state.learningPlan.plan.minutes === input.minutes
      && state.learningPlan.plan.language === input.language) {
      error = '';
      refresh();
      return;
    }
    if ((state.learningPlan?.answers.some(answer => answer.trim())
      || state.learningPlan?.study.some(entry => entry.page > 0 || entry.choice !== null || entry.checked))
      && !window.confirm(message('Новый маршрут заменит текущий маршрут и его ответы. Построить новый?'))) {
      refresh();
      return;
    }
    busy = 'plan';
    error = '';
    const previous = state.learningPlan;
    refresh();
    try {
      const response = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(57000),
      });
      const result = await response.json();
      if (state.learningPlan !== previous) return;
      if (!response.ok) throw new Error(result.error || 'Не удалось построить маршрут.');
      const saved = restorePlan({ plan: result.plan, answers: [], completed: 0 });
      if (!saved) throw new Error('Не удалось прочитать маршрут. Попробуй ещё раз.');
      state.learningPlan = saved;
      reviewError = '';
      reviewErrorFor = null;
      save();
    } catch (failure) {
      if (state.learningPlan !== previous) return;
      error = failure.name === 'TimeoutError' ? 'Поиск занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с сервисом. Попробуй ещё раз.'
        : failure.message;
    } finally {
      busy = null;
      refresh();
    }
  }

  async function reviewAnswer(answer) {
    const lesson = currentLesson();
    if (busy || !isOpen() || !atPractice(lesson)) return;
    const { saved, index, step } = lesson;
    if (saved.reviews[index]) return;
    const { goal, language } = saved.plan;
    const input = taskReviewInput({ goal, task: step.task, criterion: step.criterion, answer, language });
    if (!input) return;

    saved.answers[index] = input.answer;
    reviewError = '';
    reviewErrorFor = null;
    busy = 'review';
    const stillCurrent = () => state.learningPlan === saved && saved.completed === index && saved.answers[index] === input.answer;
    save();
    refresh();
    try {
      const response = await fetch('/api/task-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(32000),
      });
      const result = await response.json();
      if (!stillCurrent()) return;
      if (!response.ok) throw new Error(result.error || 'ИИ-разбор пока недоступен.');
      const review = normalizeTaskReview(result.review);
      if (!review) throw new Error('Не удалось прочитать разбор. Попробуй ещё раз.');
      saved.reviews[index] = { answer: input.answer, ...review };
      save();
    } catch (failure) {
      if (!stillCurrent()) return;
      reviewError = failure.name === 'TimeoutError' ? 'Разбор занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с ИИ. Попробуй ещё раз.'
        : failure.message;
      reviewErrorFor = { saved, index };
    } finally {
      busy = null;
      refresh();
      if (stillCurrent() && isOpen()) document.getElementById('learning-review-status')?.focus();
    }
  }

  document.addEventListener('input', event => {
    const lesson = currentLesson();
    if (busy || !isOpen() || event.target.form?.id !== 'learning-step-form' || event.target.name !== 'answer'
      || !atPractice(lesson) || lesson.saved.reviews[lesson.index]) return;
    lesson.saved.answers[lesson.index] = event.target.value.slice(0, 1500);
    save();
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'learning-plan-form') {
      event.preventDefault();
      void generate(event.target.elements.goal.value.trim(), Number(event.target.elements.minutes.value));
    }
    if (event.target.id === 'learning-step-form') {
      event.preventDefault();
      void reviewAnswer(event.target.elements.answer.value);
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-learning-page], button[data-learning-choice], button[data-learning-step]');
    const lesson = currentLesson();
    if (!button || button.disabled || busy || !isOpen() || !lesson) return;
    const { saved, index, study, pages, page } = lesson;
    const { learningPage, learningChoice, learningStep } = button.dataset;
    if (learningChoice !== undefined) {
      if (page !== 'check' || !/^[0-2]$/.test(learningChoice)) return;
      study.choice = Number(learningChoice);
      study.checked = false;
      save();
      refresh();
      if (isOpen()) document.querySelector(`button[data-learning-choice="${learningChoice}"]`)?.focus();
      return;
    }
    if (learningPage) {
      if (learningPage === 'check' && page === 'check' && study.choice !== null) {
        study.checked = true;
      } else if (learningPage === 'back' && study.page > 0) {
        study.page -= 1;
      } else if (learningPage === 'next' && study.page < pages.length - 1
        && (page !== 'check' || passedCheckpoint(lesson))) {
        study.page += 1;
      } else {
        return;
      }
      save();
      refresh();
      focusPage();
      return;
    }
    if (!atPractice(lesson)) return;
    if (learningStep === 'edit' && saved.reviews[index]) {
      saved.reviews[index] = null;
    } else if (learningStep === 'continue' && (saved.reviews[index] || activeReviewError())
      && saved.answers[index].trim()) {
      saved.completed += 1;
    } else {
      return;
    }
    reviewError = '';
    reviewErrorFor = null;
    save();
    refresh();
    if (isOpen()) {
      if (learningStep === 'edit') document.querySelector('#learning-step-form textarea')?.focus();
      else focusPage();
    }
  });

  return { generate, screen: () => ({ goal, minutes, busy, error, reviewError: activeReviewError(), saved: state.learningPlan }) };
}
