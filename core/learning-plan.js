export const PLAN_DURATIONS = Object.freeze({
  5: Object.freeze([2, 3]),
  10: Object.freeze([2, 3, 5]),
  20: Object.freeze([3, 5, 5, 7]),
});

export function planInput(goal, minutes) {
  if (typeof goal !== 'string' || !Number.isInteger(minutes) || !Object.hasOwn(PLAN_DURATIONS, minutes)) return null;
  const text = goal.trim();
  return text.length >= 3 && text.length <= 180 ? { goal: text, minutes } : null;
}

export function sourceUrl(value) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value);
    const domain = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !/^(?:[a-z\d-]+\.)+[a-z]{2,}$/i.test(domain)
      || /\.(?:localhost|local|internal|test|example|invalid|onion)$/i.test(domain)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

// The server supplies the source map from provider results; free-form model URLs cannot become links.
export function normalizePlan(raw, input, sources) {
  if (!raw || !input || !Array.isArray(raw.steps)) return null;
  const durations = PLAN_DURATIONS[input.minutes];
  const title = text(raw.title, 90);
  const outcome = text(raw.outcome, 260);
  if (!durations || !title || !outcome || raw.steps.length !== durations.length) return null;
  const steps = [];
  for (const [id, item] of raw.steps.entries()) {
    const title = text(item?.title, 90);
    const instruction = text(item?.instruction, 480);
    const task = text(item?.task, 480);
    const criterion = text(item?.criterion, 320);
    if (!title || !instruction || !task || !criterion) return null;
    const resource = sources.get(sourceUrl(item.sourceUrl));
    steps.push({ id, title, instruction, task, criterion, minutes: durations[id], resource: resource ?? null });
  }
  if (!steps.some(step => step.resource)) return null;
  return { ...input, title, outcome, steps };
}

export function restorePlan(saved) {
  const input = planInput(saved?.plan?.goal, saved?.plan?.minutes);
  if (!input || !Array.isArray(saved.plan.steps)) return null;
  const sources = new Map();
  const steps = saved.plan.steps.map(step => {
    const url = sourceUrl(step?.resource?.url);
    const title = text(step?.resource?.title, 160);
    if (url && title) sources.set(url, { url, title });
    return { ...step, sourceUrl: url };
  });
  const plan = normalizePlan({ ...saved.plan, steps }, input, sources);
  if (!plan) return null;
  const answers = plan.steps.map(({ id }) => typeof saved.answers?.[id] === 'string' ? saved.answers[id].slice(0, 1500) : '');
  let completed = 0;
  while (completed < plan.steps.length && completed < saved.completed && answers[completed].trim()) completed++;
  return { plan, answers, completed };
}
