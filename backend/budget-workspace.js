import { budgetDraftKey, SESSION_MINUTES } from '../core/budget-session.js';

const keys = new Set(SESSION_MINUTES.flatMap(minutes => [2, 3].map(step => budgetDraftKey(step, minutes))));

export function validateWorkspace(input) {
  if (!input || !SESSION_MINUTES.includes(input.minutes)
    || !Number.isInteger(input.progress) || input.progress < 2 || input.progress > 4
    || ![2, 3].includes(input.step) || input.step > input.progress
    || typeof input.goal !== 'string' || input.goal.length > 180
    || !input.drafts || typeof input.drafts !== 'object' || Array.isArray(input.drafts)) return null;

  const drafts = {};
  const entries = Object.entries(input.drafts);
  if (!entries.length || entries.length > keys.size) return null;
  for (const [key, draft] of entries) {
    if (!keys.has(key) || !draft || !Array.isArray(draft.values) || draft.values.length !== 3
      || !draft.values.every(value => value === null || (Number.isFinite(value) && value >= 0 && value <= 1_000_000))
      || !Number.isInteger(draft.seed) || draft.seed < 0 || draft.seed > 1_000_000) return null;
    const fields = [draft.formula, draft.answer, draft.balance ?? ''];
    if (!fields.every(field => typeof field === 'string' && field.length <= 50)) return null;
    drafts[key] = {
      values: [...draft.values],
      formula: fields[0],
      answer: fields[1],
      balance: fields[2],
      seed: draft.seed,
    };
  }
  if (!drafts[budgetDraftKey(input.step, input.minutes)]) return null;
  return { minutes: input.minutes, progress: input.progress, step: input.step, goal: input.goal.trim(), drafts };
}
