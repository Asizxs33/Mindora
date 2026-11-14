import { normalizeTaskReview, planInput, restorePlan, taskReviewInput } from './learning-plan.js';
import { message } from '../ui/messages.js';

export function createPlanController({ state, save, render, isOpen }) {
  state.learningPlan = restorePlan(state.learningPlan);
  let goal = state.learningPlan?.plan.goal ?? '';
  let minutes = state.learningPlan?.plan.minutes ?? state.minutes;
  let busy = null;
  let error = '';
  let reviewError = '';

  function refresh() {
    if (isOpen()) render();
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
    if (state.learningPlan?.answers.some(answer => answer.trim())
      && !window.confirm(message('Новый маршрут заменит текущий маршрут и его ответы. Построить новый?'))) {
      refresh();
      return;
    }
    busy = 'plan';
    error = '';
    refresh();
    try {
      const response = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(57000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось построить маршрут.');
      const saved = restorePlan({ plan: result.plan, answers: [], completed: 0 });
      if (!saved) throw new Error('Не удалось прочитать маршрут. Попробуй ещё раз.');
      state.learningPlan = saved;
      reviewError = '';
      save();
    } catch (failure) {
      error = failure.name === 'TimeoutError' ? 'Поиск занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с сервисом. Попробуй ещё раз.'
        : failure.message;
    } finally {
      busy = null;
      refresh();
    }
  }

  async function reviewAnswer(answer) {
    const saved = state.learningPlan;
    const index = saved?.completed;
    const step = saved?.plan.steps[index];
    if (busy || !step || saved.reviews[index]) return;
    const { goal, language } = saved.plan;
    const input = taskReviewInput({ goal, task: step.task, criterion: step.criterion, answer, language });
    if (!input) return;

    saved.answers[index] = input.answer;
    reviewError = '';
    busy = 'review';
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
      if (!response.ok) throw new Error(result.error || 'ИИ-разбор пока недоступен.');
      const review = normalizeTaskReview(result.review);
      if (!review) throw new Error('Не удалось прочитать разбор. Попробуй ещё раз.');
      saved.reviews[index] = { answer: input.answer, ...review };
      save();
    } catch (failure) {
      reviewError = failure.name === 'TimeoutError' ? 'Разбор занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с ИИ. Попробуй ещё раз.'
        : failure.message;
    } finally {
      busy = null;
      refresh();
      if (isOpen()) document.getElementById('learning-review-status')?.focus();
    }
  }

  document.addEventListener('input', event => {
    const saved = state.learningPlan;
    if (busy || event.target.form?.id !== 'learning-step-form' || event.target.name !== 'answer'
      || !saved || saved.reviews[saved.completed] || saved.completed >= saved.plan.steps.length) return;
    saved.answers[saved.completed] = event.target.value.slice(0, 1500);
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
    const action = event.target.closest('button[data-learning-step]')?.dataset.learningStep;
    const saved = state.learningPlan;
    if (!action || busy || !saved || !saved.plan.steps[saved.completed]) return;
    if (action === 'edit' && saved.reviews[saved.completed]) {
      saved.reviews[saved.completed] = null;
    } else if (action === 'continue' && (saved.reviews[saved.completed] || reviewError)
      && saved.answers[saved.completed].trim()) {
      saved.completed += 1;
    } else {
      return;
    }
    reviewError = '';
    save();
    refresh();
    if (isOpen()) {
      const target = document.querySelector('#learning-step-form textarea, #learning-plan-complete');
      target?.focus();
    }
  });

  return { generate, screen: () => ({ goal, minutes, busy, error, reviewError, saved: state.learningPlan }) };
}
