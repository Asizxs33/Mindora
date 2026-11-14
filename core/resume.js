// Additive browser progress. Existing stage completion and practice drafts stay intact.
export const RECAP_AFTER_MS = 24 * 60 * 60 * 1000;
const bounded = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

export function resumeCursor(state, id) {
  const progress = Math.min(4, Math.max(0, Math.floor(Number(state.progress?.[id]) || 0)));
  const saved = state.sessions?.[id]?.cursor;
  const step = saved && bounded(saved.step, Math.min(progress, 3)) ? saved.step : Math.min(progress, 3);
  return {
    step,
    page: step === 0 && bounded(saved?.page, 2) ? saved.page : 0,
    quizIndex: step === 1 && bounded(saved?.quizIndex, 2) ? saved.quizIndex : 0,
    quizChoice: step === 1 && bounded(saved?.quizChoice, 2) ? saved.quizChoice : null,
    quizFeedback: step === 1 && Boolean(saved?.quizFeedback),
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
