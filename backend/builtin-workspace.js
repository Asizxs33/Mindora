import { budgetDraftKey, SESSION_MINUTES } from '../core/budget-session.js';
import { restoreRoadmap } from '../core/roadmap-model.js';
import { normalizeRewards } from '../core/roadmap-rewards.js';

export const WORKSPACE_MAX_BYTES = 98_304;
const courses = ['design', 'budget'];
const budgetKeys = SESSION_MINUTES.flatMap(minutes => [2, 3].map(step => budgetDraftKey(step, minutes)));
const plain = value => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
const number = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const string = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000\u000b\u000c\u007f]/u.test(value);
const timestamp = value => string(value, 40) && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const choice = value => value === null || integer(value, 2);

function safeTree(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value !== 'object') return typeof value !== 'number' || Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 3660 && value.every(item => safeTree(item, depth + 1));
  return plain(value) && Object.keys(value).length <= 100
    && Object.entries(value).every(([key, item]) => !['__proto__', 'prototype', 'constructor'].includes(key) && safeTree(item, depth + 1));
}

function map(input, keys, read) {
  if (!plain(input) || Object.keys(input).some(key => !keys.includes(key))) return null;
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    const entry = read(value, key);
    if (entry === undefined) return null;
    result[key] = entry;
  }
  return result;
}

function poster(value) {
  if (!plain(value)) return undefined;
  const result = { title: '', subtitle: '', cta: '', titleSize: 34, subtitleSize: 16, textColor: '#263c31', bgColor: '#f7d667', seed: 0, ...value };
  if (!string(result.title, 48) || !string(result.subtitle, 100) || !string(result.cta, 55)
    || !number(result.titleSize, 200) || result.titleSize < 1 || !number(result.subtitleSize, 200) || result.subtitleSize < 1
    || !color(result.textColor) || !color(result.bgColor) || !integer(result.seed, 1_000_000)) return undefined;
  return Object.fromEntries(['title', 'subtitle', 'cta', 'titleSize', 'subtitleSize', 'textColor', 'bgColor', 'seed'].map(key => [key, result[key]]));
}

function budget(value, work = false) {
  if (!plain(value) || !Array.isArray(value.values) || value.values.length !== 3
    || value.values.some(item => item !== null && !number(item, 1_000_000))) return undefined;
  const { formula = '', answer = '', balance = '', seed = 0 } = value;
  if (![formula, answer, balance].every(item => string(item, 50)) || !integer(seed, 1_000_000)
    || (value.checked !== undefined && typeof value.checked !== 'boolean')
    || (work && value.limit !== undefined && value.limit !== null && !number(value.limit, 1_000_000))) return undefined;
  return { values: [...value.values], formula, answer, balance, seed,
    ...(value.checked !== undefined ? { checked: value.checked } : {}),
    ...(work && value.limit !== undefined ? { limit: value.limit } : {}),
  };
}

function session(value, id) {
  if (!plain(value) || !plain(value.cursor)) return undefined;
  const { lastSeen = 0 } = value;
  const { step = 0, page = 0, minutes = 10, quizIndex = 0, quizChoice = null, quizFeedback = false } = value.cursor;
  if (!integer(lastSeen, 8_640_000_000_000_000) || !integer(step, 3) || !integer(page, 2)
    || !SESSION_MINUTES.includes(minutes) || !integer(quizIndex, id === 'budget' ? 3 : 2)
    || !choice(quizChoice) || typeof quizFeedback !== 'boolean') return undefined;
  return { lastSeen, cursor: { step, page, minutes, quizIndex, quizChoice, quizFeedback } };
}

function day(value) {
  if (!string(value, 10) || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return false;
  const [year, month, date] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return year >= 2000 && year <= 9999 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
}

export function validateBuiltinWorkspace(input) {
  if (!plain(input) || !safeTree(input)) return null;
  try { if (Buffer.byteLength(JSON.stringify(input), 'utf8') > WORKSPACE_MAX_BYTES) return null; } catch { return null; }
  const { minutes = 10, active = null, practiceCount = 0, studyDays = [] } = input;
  if (!SESSION_MINUTES.includes(minutes) || (active !== null && !courses.includes(active))
    || !integer(practiceCount, 1_000_000) || !Array.isArray(studyDays) || studyDays.length > 3660 || !studyDays.every(day)) return null;
  const goals = map(input.goals ?? {}, courses, value => string(value, 180) ? value : undefined);
  const progress = map(input.progress ?? {}, courses, value => integer(value, 4) ? value : undefined);
  const drafts = map(input.drafts ?? {}, ['design-practice', 'design-challenge', ...budgetKeys], (value, key) => key.startsWith('design-') ? poster(value) : budget(value));
  const works = map(input.works ?? {}, courses, (value, id) => {
    if (!plain(value) || typeof value.challenge !== 'boolean' || !timestamp(value.savedAt)) return undefined;
    const data = id === 'design' ? poster(value.data) : budget(value.data, true);
    return data ? { data, challenge: value.challenge, savedAt: value.savedAt } : undefined;
  });
  const notes = map(input.notes ?? {}, courses, value => string(value, 600) ? value : undefined);
  const sessions = map(input.sessions ?? {}, courses, session);
  const certificates = map(input.certificates ?? {}, courses, value => plain(value) && string(value.name, 80)
    && timestamp(value.completedAt) && string(value.certificateId, 80) && /^[A-Za-z0-9-]+$/.test(value.certificateId)
    ? { name: value.name, completedAt: value.completedAt, certificateId: value.certificateId } : undefined);
  const budgetQuiz = map(input.budgetQuiz ?? {}, ['5', '10', '20'], (value, mode) => {
    if (!plain(value) || !integer(value.index, { 5: 0, 10: 2, 20: 3 }[mode])
      || !choice(value.choice) || typeof value.feedback !== 'boolean') return undefined;
    return { index: value.index, choice: value.choice, feedback: value.feedback };
  });
  if ([goals, progress, drafts, works, notes, sessions, certificates, budgetQuiz].some(value => value === null)) return null;
  let budgetActivity;
  if (input.budgetActivity !== undefined && input.budgetActivity !== null) {
    const value = input.budgetActivity;
    if (!plain(value) || !['path', 'lesson', 'result'].includes(value.view) || !integer(value.step, 3)) return null;
    budgetActivity = { view: value.view, step: value.step };
  }
  const learningRoadmap = input.learningRoadmap == null ? null : restoreRoadmap(input.learningRoadmap);
  const learningRewards = input.learningRewards == null ? null : normalizeRewards(input.learningRewards);
  if ((input.learningRoadmap != null && !learningRoadmap) || (input.learningRewards != null && !learningRewards)) return null;
  return { minutes, active, goals, progress: { design: 0, budget: 0, ...progress }, drafts, works, notes, sessions,
    certificates, practiceCount, studyDays: [...new Set(studyDays)], budgetQuiz, ...(budgetActivity ? { budgetActivity } : {}),
    ...(learningRoadmap ? { learningRoadmap } : {}), ...(learningRewards ? { learningRewards } : {}) };
}
