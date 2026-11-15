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

export function reportProgress(saved) {
  const days = REPORT_WEEKS.map((_, i) => {
    const draft = Object.fromEntries(['formula', 'total', 'decision'].map(field => [field, String(saved?.days?.[i]?.[field] ?? '').slice(0, 80)]));
    return { ...draft, completed: Boolean(saved?.days?.[i]?.completed && Object.values(checkWeeklyReport(i, draft)).every(Boolean)) };
  });
  return { day: days[0].completed && saved?.day === 1 ? 1 : 0, days };
}
