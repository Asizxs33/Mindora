import { roadmapCourseId } from './roadmap-model.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_HEARTS = 5;
const MAX_GEMS = 1_000_000;
const MAX_COUNT = 1_000_000;
const LEDGER_LIMIT = 256;
const QUESTS = Object.freeze([
  { id: 'finish-lesson', field: 'lessons', target: 1, reward: 10 },
  { id: 'correct-check', field: 'correct', target: 2, reward: 8 },
]);
const SHOP = Object.freeze([
  { id: 'hearts', cost: 12 },
  { id: 'freeze', cost: 25 },
]);

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const validGems = value => integer(value, 0, MAX_GEMS);
const validCount = value => integer(value, 0, MAX_COUNT);

function calendarDay(now) {
  const date = new Date(now);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

const validDay = value => integer(value, 0, 100_000_000);
const freshDaily = (day = null) => ({ day, lessons: 0, correct: 0, claimed: [] });

export function normalizeRewards(raw) {
  if (!raw || !integer(raw.hearts, 0, MAX_HEARTS) || !validGems(raw.gems)
    || !integer(raw.heartAt, 0, 8_640_000_000_000_000) || !integer(raw.freezes, 0, 1)
    || !validCount(raw.streak) || !validCount(raw.lessons)
    || (raw.lastDay === null ? raw.streak !== 0 : !validDay(raw.lastDay) || raw.streak === 0)
    || !Array.isArray(raw.lessonIds) || raw.lessonIds.length > LEDGER_LIMIT || raw.lessonIds.length > raw.lessons
    || !Array.isArray(raw.checks) || raw.checks.length > LEDGER_LIMIT) return null;
  const lessonIds = Array.from(raw.lessonIds, roadmapCourseId);
  if (lessonIds.includes(null) || new Set(lessonIds).size !== lessonIds.length) return null;
  const checkIds = new Set();
  const checks = [];
  for (const entry of raw.checks) {
    const courseId = roadmapCourseId(entry?.courseId);
    if (!courseId || checkIds.has(courseId) || !integer(entry.mask, 1, 15)) return null;
    checkIds.add(courseId);
    checks.push({ courseId, mask: entry.mask });
  }
  const daily = raw.daily;
  if (!daily || (daily.day === null ? daily.lessons !== 0 || daily.correct !== 0 : !validDay(daily.day))
    || !validCount(daily.lessons) || !validCount(daily.correct)
    || !Array.isArray(daily.claimed) || daily.claimed.length > QUESTS.length
    || new Set(daily.claimed).size !== daily.claimed.length
    || Array.from(daily.claimed).some(id => !QUESTS.some(quest => quest.id === id && daily[quest.field] >= quest.target))) return null;
  return {
    hearts: raw.hearts, heartAt: raw.heartAt, gems: raw.gems, freezes: raw.freezes,
    streak: raw.streak, lastDay: raw.lastDay, lessons: raw.lessons, lessonIds, checks,
    daily: { day: daily.day, lessons: daily.lessons, correct: daily.correct, claimed: [...daily.claimed] },
  };
}

export function restoreRewards(raw) {
  return normalizeRewards(raw) ?? {
    hearts: MAX_HEARTS, heartAt: 0, gems: 20, freezes: 0, streak: 0, lastDay: null,
    lessons: 0, lessonIds: [], checks: [], daily: freshDaily(),
  };
}

function stateAt(raw, now) {
  const state = restoreRewards(raw);
  const day = calendarDay(now);
  if (state.daily.day === null || day > state.daily.day) state.daily = freshDaily(day);
  if (state.hearts < MAX_HEARTS && now >= state.heartAt + HOUR_MS) {
    const restored = Math.min(MAX_HEARTS - state.hearts, Math.floor((now - state.heartAt) / HOUR_MS));
    state.hearts += restored;
    state.heartAt = state.hearts === MAX_HEARTS ? 0 : state.heartAt + restored * HOUR_MS;
  }
  return { state, day };
}

export function rewardScreen(raw, now = Date.now()) {
  const { state, day } = stateAt(raw, now);
  const elapsed = state.lastDay === null ? Infinity : day - state.lastDay;
  const streak = elapsed <= 1 || (elapsed === 2 && state.freezes) ? state.streak : 0;
  const daily = state.daily.day === day ? state.daily : freshDaily(day);
  const quests = QUESTS.map(({ id, field, target, reward }) => {
    const progress = Math.min(target, daily[field]);
    const claimed = daily.claimed.includes(id);
    return { id, target, progress, reward, claimed, claimable: !claimed && progress === target };
  });
  const items = SHOP.map(({ id, cost }) => ({
    id, cost, available: state.gems >= cost && (id === 'hearts' ? state.hearts < MAX_HEARTS : state.freezes === 0),
  }));
  return {
    hearts: state.hearts, maxHearts: MAX_HEARTS, gems: state.gems, streak, freezes: state.freezes,
    lessons: state.lessons, correct: daily.correct, quests, items,
  };
}

export function recordLessonReward(raw, value, now = Date.now()) {
  const courseId = roadmapCourseId(value);
  const { state, day } = stateAt(raw, now);
  if (!courseId || state.lessonIds.includes(courseId)) return state;
  state.lessonIds = [...state.lessonIds, courseId].slice(-LEDGER_LIMIT);
  state.lessons = Math.min(MAX_COUNT, state.lessons + 1);
  state.gems = Math.min(MAX_GEMS, state.gems + 5);
  if (state.daily.day === day) state.daily.lessons = Math.min(MAX_COUNT, state.daily.lessons + 1);
  if (state.lastDay === null || day > state.lastDay) {
    const elapsed = state.lastDay === null ? Infinity : day - state.lastDay;
    const covered = elapsed === 2 && state.freezes === 1;
    if (covered) state.freezes = 0;
    state.streak = elapsed === 1 || covered ? Math.min(MAX_COUNT, state.streak + 1) : 1;
    state.lastDay = day;
  }
  return state;
}

export function recordCheckReward(raw, value, stepIndex, correct, now = Date.now()) {
  const courseId = roadmapCourseId(value);
  const { state, day } = stateAt(raw, now);
  if (!courseId || !integer(stepIndex, 0, 3) || typeof correct !== 'boolean') return state;
  const bit = 1 << stepIndex;
  const prior = state.checks.find(entry => entry.courseId === courseId);
  if (prior?.mask & bit) return state;
  if (correct) {
    if (prior) prior.mask |= bit;
    else state.checks = [...state.checks, { courseId, mask: bit }].slice(-LEDGER_LIMIT);
    if (state.daily.day === day) state.daily.correct = Math.min(MAX_COUNT, state.daily.correct + 1);
  } else if (state.hearts > 0) {
    if (state.hearts === MAX_HEARTS) state.heartAt = now;
    state.hearts--;
  }
  return state;
}

export function claimDailyQuest(raw, questId, now = Date.now()) {
  const { state, day } = stateAt(raw, now);
  const quest = QUESTS.find(entry => entry.id === questId);
  if (!quest || state.daily.day !== day || state.daily[quest.field] < quest.target || state.daily.claimed.includes(questId)) return state;
  state.daily.claimed.push(questId);
  state.gems = Math.min(MAX_GEMS, state.gems + quest.reward);
  return state;
}

export function buyRewardItem(raw, itemId, now = Date.now()) {
  const { state } = stateAt(raw, now);
  const item = SHOP.find(entry => entry.id === itemId);
  if (!item || state.gems < item.cost) return state;
  if (itemId === 'hearts') {
    if (state.hearts === MAX_HEARTS) return state;
    state.hearts = MAX_HEARTS;
    state.heartAt = 0;
  } else {
    if (state.freezes) return state;
    state.freezes = 1;
  }
  state.gems -= item.cost;
  return state;
}
