/** Mindora's bounded sample curriculum and transparent, code-based checks. */
export const COURSES = {
  design: {
    title: 'Design your first poster',
    category: 'Visual design',
    short: 'Give your idea a little presence.',
    outcome: 'An original poster you can save as an SVG.',
    accent: '#D9E7FF',
    minutes: 10,
    steps: [
      { title: 'Make one thing stand out', description: 'Discover how hierarchy, contrast, and a clear next step guide the eye.', type: 'learn' },
      { title: 'Train your design eye', description: 'Make three small decisions about a readable poster.', type: 'quiz' },
      { title: 'Make it yours', description: 'Create a poster with guided layout checks.', type: 'practice' },
      { title: 'Try a fresh brief', description: 'Apply the same principles to a different event, without hints.', type: 'challenge' },
    ],
    sources: [
      { title: 'Canva: Graphic Design Essentials', url: 'https://www.canva.com/design-school/courses/graphic-design-essentials/' },
      { title: 'W3C: Understanding contrast', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum' },
    ],
  },
  budget: {
    title: 'Build a budget tracker',
    category: 'Everyday spreadsheets',
    short: 'Make your numbers make sense.',
    outcome: 'A simple expense table you can save as a CSV.',
    accent: '#DDF0DF',
    minutes: 10,
    steps: [
      { title: 'Meet your first formula', description: 'Learn how cells, ranges, and SUM turn a list into a useful total.', type: 'learn' },
      { title: 'Think in cells', description: 'Choose the right range and understand what a formula does.', type: 'quiz' },
      { title: 'Build your own tracker', description: 'Enter three expenses and calculate their total.', type: 'practice' },
      { title: 'A new set of numbers', description: 'Use your formula on fresh expenses, without hints.', type: 'challenge' },
    ],
    sources: [
      { title: 'Google Sheets: Get started', url: 'https://support.google.com/a/users/answer/9282959?hl=en' },
      { title: 'Google Sheets: SUM', url: 'https://support.google.com/docs/answer/3093669?hl=en' },
    ],
  },
};

export const DESIGN_QUIZ = [
  {
    question: 'What should someone notice first on your event poster?',
    choices: ['Every detail at the same size', 'The main message or event name', 'The smallest footer text'],
    correctIndex: 1,
    explanation: 'A clear hierarchy gives the main message the most visual emphasis. Details support it.',
  },
  {
    question: 'Which combination is easiest to read?',
    choices: ['Pale yellow text on white', 'Dark text on a light background', 'Light gray text on slightly lighter gray'],
    correctIndex: 1,
    explanation: 'Strong contrast separates the text from its background. Our layout check uses a 4.5:1 contrast target.',
  },
  {
    question: 'Which line gives your reader a clear next step?',
    choices: ['Lots of exciting possibilities', 'Something good is coming', 'Visit us Saturday, 10–4'],
    correctIndex: 2,
    explanation: 'A specific action and useful detail tell the reader what to do after seeing the poster.',
  },
];

export const BUDGET_QUIZ = [
  {
    question: 'What does the cell name B2 mean?',
    choices: ['Column B, row 2', 'Row B, column 2', 'The second spreadsheet'],
    correctIndex: 0,
    explanation: 'Column letters come first, followed by row numbers. B2 is where column B meets row 2.',
  },
  {
    question: 'Which formula adds all three expenses in B2, B3, and B4?',
    choices: ['=SUM(B2:B3)', '=SUM(B2:B4)', '=SUM(B4:B5)'],
    correctIndex: 1,
    explanation: 'The colon includes every cell from B2 through B4, including both ends.',
  },
  {
    question: 'You change an expense in B3. What should the total do?',
    choices: ['Stay the same forever', 'Ask you to rewrite the formula', 'Recalculate using the new value'],
    correctIndex: 2,
    explanation: 'A formula refers to cells. Updating a referenced cell updates the result, which is why it is useful.',
  },
];

/** Matches only the two supported prototype tracks, rather than inventing a course. */
export function matchGoal(text) {
  const goal = String(text ?? '').toLocaleLowerCase();
  const design = /\b(poster|posters|design|designer|flyer|flyers|banner|banners|canva|typography)\b|social\s+(media\s+)?post|дизайн|постер|афиш|баннер|визуал|жарнама/u;
  const budget = /\b(budget|budgeting|expense|expenses|spreadsheet|spreadsheets|excel)\b|google\s+sheets|money\s+tracker|бюджет|расход|таблиц|эксель|шығын|кесте/u;
  if (budget.test(goal)) return 'budget';
  if (design.test(goal)) return 'design';
  return null;
}

function rgb(hex) {
  let value = String(hex ?? '').trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(value)) value = [...value].map(char => char + char).join('');
  if (!/^[\da-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex);
  if (!channels) return null;
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG relative luminance ratio; invalid colors deliberately fail with 0. */
export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a === null || b === null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function evaluatePoster(poster = {}) {
  const title = String(poster.title ?? '').trim();
  const subtitle = String(poster.subtitle ?? '').trim();
  const cta = String(poster.cta ?? '').trim();
  const titleSize = Number(poster.titleSize);
  const subtitleSize = Number(poster.subtitleSize);
  const ratio = contrastRatio(poster.textColor, poster.bgColor);
  const clearHierarchy = Number.isFinite(titleSize) && Number.isFinite(subtitleSize)
    && subtitleSize > 0 && titleSize >= subtitleSize * 1.5;
  const checks = [
    { label: 'A clear message', passed: Boolean(title && subtitle), detail: title && subtitle ? 'Your headline and supporting detail are both present.' : 'Add a headline and a supporting line.' },
    { label: 'Visual hierarchy', passed: clearHierarchy, detail: clearHierarchy ? 'Your headline is at least 1.5 times the supporting text size.' : 'Make the headline at least 1.5 times the supporting text size.' },
    { label: 'Readable contrast', passed: ratio >= 4.5, detail: ratio ? `Text contrast is ${ratio.toFixed(2)}:1. The target is at least 4.5:1.` : 'Choose valid text and background colors.' },
    { label: 'A next step', passed: Boolean(cta), detail: cta ? 'A call to action is present. Check that it tells your reader what to do.' : 'Add a clear next step for your reader.' },
  ];
  return { passed: checks.every(check => check.passed), checks };
}

/** Intentionally limited to one safe formula. Never evaluates JavaScript or arbitrary formulas. */
export function evaluateBudget(submission = {}, values = []) {
  const numbersValid = Array.isArray(values) && values.length === 3
    && values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const formula = String(submission.formula ?? '').trim();
  const formulaValid = /^=?\s*SUM\s*\(\s*B2\s*:\s*B4\s*\)$/i.test(formula);
  const answerText = String(submission.answer ?? '').trim();
  const answer = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(answerText) ? Number(answerText) : NaN;
  const total = numbersValid ? values.reduce((sum, value) => sum + value, 0) : NaN;
  const totalValid = numbersValid && Number.isFinite(answer) && Math.abs(answer - total) <= 0.0100000001;
  const checks = [
    { label: 'Three usable expenses', passed: numbersValid, detail: numbersValid ? 'All three expense cells contain non-negative numbers.' : 'Enter a valid, non-negative number in each of the three expense cells.' },
    { label: 'The complete range', passed: formulaValid, detail: formulaValid ? 'Your SUM formula includes B2, B3, and B4.' : 'Use SUM with the full B2:B4 range. This prototype supports this formula only.' },
    { label: 'The correct total', passed: totalValid, detail: totalValid ? 'Your answer matches the three expenses.' : 'Add all three expenses and check your answer, including decimals.' },
  ];
  return { passed: checks.every(check => check.passed), checks };
}

/** Reproducible fresh practice, with no network calls or hidden answer generation. */
export function makeBudgetChallenge(seed = 0) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const next = () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    return hash / 4294967296;
  };
  return [Math.floor(next() * 80) + 20, Math.floor(next() * 150) + 100, Math.floor(next() * 60) + 15];
}

/** For user-authored text inserted into HTML or XML templates. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
