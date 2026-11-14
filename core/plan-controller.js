import { planInput, restorePlan } from './learning-plan.js';

export function createPlanController({ state, save, render, isOpen }) {
  state.learningPlan = restorePlan(state.learningPlan);
  let goal = state.learningPlan?.plan.goal ?? '';
  let minutes = state.learningPlan?.plan.minutes ?? state.minutes;
  let busy = false;
  let error = '';

  function refresh() {
    if (isOpen()) render();
  }

  async function generate(nextGoal, nextMinutes) {
    if (busy) return;
    goal = nextGoal;
    minutes = nextMinutes;
    const input = planInput(goal, minutes);
    if (!input) {
      error = 'Напиши цель от 3 до 180 символов и выбери время.';
      refresh();
      return;
    }
    if (state.learningPlan?.plan.goal === input.goal && state.learningPlan.plan.minutes === input.minutes) {
      error = '';
      refresh();
      return;
    }
    if (state.learningPlan?.answers.some(answer => answer.trim())
      && !window.confirm('Новый маршрут заменит текущий маршрут и его ответы. Построить новый?')) {
      refresh();
      return;
    }
    busy = true;
    error = '';
    refresh();
    try {
      const response = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(50000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось построить маршрут.');
      const saved = restorePlan({ plan: result.plan, answers: [], completed: 0 });
      if (!saved) throw new Error('Не удалось прочитать маршрут. Попробуй ещё раз.');
      state.learningPlan = saved;
      save();
    } catch (failure) {
      error = failure.name === 'TimeoutError' ? 'Поиск занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с сервисом. Попробуй ещё раз.'
        : failure.message;
    } finally {
      busy = false;
      refresh();
    }
  }

  document.addEventListener('input', event => {
    const saved = state.learningPlan;
    if (event.target.form?.id !== 'learning-step-form' || !saved || saved.completed >= saved.plan.steps.length) return;
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
      const saved = state.learningPlan;
      const answer = event.target.elements.answer.value.trim();
      if (busy || !saved || saved.completed >= saved.plan.steps.length || !answer) return;
      saved.answers[saved.completed] = answer.slice(0, 1500);
      saved.completed += 1;
      save();
      refresh();
      document.querySelector('#learning-step-form textarea')?.focus();
    }
  });

  return { generate, screen: () => ({ goal, minutes, busy, error, saved: state.learningPlan }) };
}
