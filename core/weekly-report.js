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
  return { day: days[0].completed && saved?.day === 1 ? 1 : 0, days,
    ...(typeof saved?.note === 'string' ? { note: saved.note.slice(0, 600) } : {}) };
}

// Projects, downloads and certificates share the same checked completion rule.
export function completedReport(saved) {
  const progress = reportProgress(saved);
  return progress.days.every(day => day.completed) ? progress : null;
}

export function weeklyReportCsv(saved) {
  const progress = completedReport(saved);
  if (!progress) return null;
  const { days } = progress;
  const totals = days.map(day => Number(day.total));
  const rows = [
    ['Expense', 'Week 1 (USD)', 'Week 2 (USD)'],
    ...['Supplies', 'Delivery', 'Printing', 'Packing'].map((label, index) => [label, ...REPORT_WEEKS.map(week => week.amounts[index] ?? '')]),
    ['Total', ...totals],
    ['Budget', ...REPORT_WEEKS.map(week => week.budget)],
    ['Remaining', ...REPORT_WEEKS.map((week, index) => week.budget - totals[index])],
    ['Decision', ...days.map(day => day.decision === 'over' ? 'Over budget' : 'Within budget')],
    ['Checks used', ...days.map(day => day.attempts ?? '')],
    ['Completed at', ...days.map(day => {
      const date = new Date(day.completedAt);
      return day.completedAt && Number.isFinite(date.getTime()) ? date.toISOString() : '';
    })],
    // These refer to the exercise table, not the export's different columns.
    ['Formula used in lesson', ...days.map(day => `'${day.formula}`)],
    ['My note', progress.note ? `'${progress.note}` : '', ''],
  ];
  const cell = value => /[",\r\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value);
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
