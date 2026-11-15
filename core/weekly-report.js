export const REPORT_WEEKS = [
  { amounts: [24, 38, 18], budget: 100 },
  { amounts: [16, 42, 27, 18], budget: 100 },
];

export function checkWeeklyReport(day, draft) {
  const { amounts, budget } = REPORT_WEEKS[day];
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return {
    formula: String(draft.formula).replace(/\s/g, '').toUpperCase() === '=SUM(B2:B' + (amounts.length + 1) + ')',
    total: String(draft.total).trim() !== '' && Number(draft.total) === total,
    decision: draft.decision === (total > budget ? 'over' : 'within'),
  };
}

function calendarDay(value) {
  const d = new Date(value);
  return [d.getFullYear(), d.getMonth(), d.getDate()].join('-');
}

export function reportReturnDue(saved, now = Date.now()) {
  const first = saved?.days?.[0], second = saved?.days?.[1];
  return Boolean(first?.completed && first.completedAt > 0 && first.completedAt < now
    && !second?.completed && calendarDay(first.completedAt) !== calendarDay(now));
}

export function submitReport(day, draft, now = Date.now()) {
  const checks = checkWeeklyReport(day, draft);
  draft.attempts = Math.min((draft.attempts || 0) + 1, 10000);
  draft.completed = Object.values(checks).every(Boolean);
  if (draft.completed) draft.completedAt = now;
  return checks;
}

export function reportProgress(saved) {
  const days = REPORT_WEEKS.map((_, i) => {
    const draft = Object.fromEntries(['formula', 'total', 'decision'].map(field => [field, String(saved?.days?.[i]?.[field] ?? '').slice(0, 80)]));
    const entry = saved?.days?.[i];
    const completed = Boolean(entry?.completed && Object.values(checkWeeklyReport(i, draft)).every(Boolean));
    return { ...draft, completed,
      ...(Number.isInteger(entry?.attempts) && entry.attempts > 0 ? { attempts: Math.min(entry.attempts, 10000) } : {}),
      ...(completed && Number.isSafeInteger(entry.completedAt) && entry.completedAt > 0 ? { completedAt: entry.completedAt } : {}) };

  });
  return { day: days[0].completed && saved?.day === 1 ? 1 : 0, days };
}
