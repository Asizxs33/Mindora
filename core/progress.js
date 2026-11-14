import { COURSES } from './engine.js';

export function learningStats(state) {
  const total = state.progress.design + state.progress.budget;
  const days = new Set(Array.isArray(state.studyDays) ? state.studyDays : []);
  const today = dayKey();
  const cursor = new Date();
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { total, streak, xp: total * 50, level: 1 + Math.floor(total / 4), today: days.has(today) };
}

export function dayKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
}

export function dailyCourse(state) {
  const current = state.active || 'design';
  return state.progress[current] < 4 ? current
    : Object.keys(COURSES).find(id => state.progress[id] < 4) || current;
}
