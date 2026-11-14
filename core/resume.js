import { readBudgetQuiz } from './budget-session.js';
// Additive browser progress. Existing stage completion and practice drafts stay intact.
export const RECAP_AFTER_MS = 24 * 60 * 60 * 1000;
const bounded = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

export function resumeCursor(state, id) {
  const progress = Math.min(4, Math.max(0, Math.floor(Number(state.progress?.[id]) || 0)));
  const saved = state.sessions?.[id]?.cursor;
  const step = saved && bounded(saved.step, Math.min(progress, 3)) ? saved.step : Math.min(progress, 3);
  const sameDuration = (saved?.minutes ?? 10) === (state.minutes ?? 10);
  const budgetQuiz = id === 'budget' && step === 1 ? readBudgetQuiz(
    state.budgetQuiz?.[state.minutes] || (sameDuration ? { index: saved?.quizIndex, choice: saved?.quizChoice, feedback: saved?.quizFeedback } : null), state.minutes,
  ) : null;
  return {
    step,
    page: step === 0 && bounded(saved?.page, 2) ? saved.page : 0,
    quizIndex: budgetQuiz ? budgetQuiz.index : step === 1 && bounded(saved?.quizIndex, 2) ? saved.quizIndex : 0,
    quizChoice: budgetQuiz ? budgetQuiz.choice : step === 1 && bounded(saved?.quizChoice, 2) ? saved.quizChoice : null,
    quizFeedback: budgetQuiz ? budgetQuiz.feedback : step === 1 && Boolean(saved?.quizFeedback),
  };
}

export function needsRecap(state, id, now = Date.now()) {
  const session = state.sessions?.[id];
  const lastSeen = Number(session?.lastSeen);
  const hasLearned = state.progress?.[id] > 0 || session?.cursor?.page > 0;
  return Boolean(hasLearned && Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen > RECAP_AFTER_MS);
}

export function certificateEligible(state, id) {
  return state.progress?.[id] === 4 && Boolean(state.works?.[id]?.challenge || state.certificates?.[id]?.completedAt);
}
