/** Mindora's bounded sample curriculum and transparent, code-based checks. */
export const COURSES = {
  design: {
    title: 'Дизайн постера',
    category: 'Дизайн',
    short: 'Give your idea a little presence.',
    outcome: 'Свой постер, который можно скачать в SVG.',
    accent: '#D9E7FF',
    minutes: 10,
    steps: [
      { title: 'Make one thing stand out', description: 'Разберись, как размер, контраст и призыв к действию помогают читать постер.', type: 'learn' },
      { title: 'Train your design eye', description: 'Ответь на три вопроса о читаемости постера.', type: 'quiz' },
      { title: 'Make it yours', description: 'Собери постер и проверь его по подсказкам.', type: 'practice' },
      { title: 'Try a fresh brief', description: 'Сделай постер для другого события без подсказок.', type: 'challenge' },
    ],
    sources: [
      { title: 'Canva: Graphic Design Essentials', url: 'https://www.canva.com/design-school/courses/graphic-design-essentials/' },
      { title: 'W3C: Understanding contrast', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum' },
    ],
  },
  budget: {
    title: 'Таблица расходов',
    category: 'Электронные таблицы',
    short: 'Make your numbers make sense.',
    outcome: 'Таблица расходов, которую можно скачать в CSV.',
    accent: '#DDF0DF',
    minutes: 10,
    steps: [
      { title: 'Meet your first formula', description: 'Разберись, как ячейки, диапазоны и формула SUM помогают подсчитать расходы.', type: 'learn' },
      { title: 'Think in cells', description: 'Выбери нужный диапазон и проверь, как работает формула.', type: 'quiz' },
      { title: 'Build your own tracker', description: 'Введи три расхода и посчитай их сумму.', type: 'practice' },
      { title: 'A new set of numbers', description: 'Примени формулу к новым расходам без подсказок.', type: 'challenge' },
    ],
    sources: [
      { title: 'Google Sheets: Get started', url: 'https://support.google.com/a/users/answer/9282959?hl=en' },
      { title: 'Google Sheets: SUM', url: 'https://support.google.com/docs/answer/3093669?hl=en' },
    ],
  },
};

export const DESIGN_QUIZ = [
  {
    question: 'Что читатель должен первым заметить на постере?',
    choices: ['Все детали одинакового размера', 'Главную мысль или название события', 'Мелкий текст внизу'],
    correctIndex: 1,
    explanation: 'Заголовок притягивает внимание к главному. Остальные детали его дополняют.',
  },
  {
    question: 'Какое сочетание легче читать?',
    choices: ['Бледно-жёлтый текст на белом', 'Тёмный текст на светлом фоне', 'Светло-серый текст на чуть более светлом сером'],
    correctIndex: 1,
    explanation: 'Чем сильнее контраст, тем проще отличить текст от фона. В упражнении нужен контраст не ниже 4,5:1.',
  },
  {
    question: 'Какая фраза подсказывает читателю, что делать?',
    choices: ['Много интересных возможностей', 'Скоро будет что-то хорошее', 'Заходи в субботу с 10 до 16 часов'],
    correctIndex: 2,
    explanation: 'Конкретное действие и время визита помогают читателю понять, что делать дальше.',
  },
];

export const BUDGET_QUIZ = [
  {
    question: 'Что означает адрес B2?',
    choices: ['Столбец B, строка 2', 'Строка B, столбец 2', 'Вторая таблица'],
    correctIndex: 0,
    explanation: 'Сначала идёт буква столбца, затем номер строки. B2 — пересечение столбца B и второй строки.',
  },
  {
    question: 'Какая формула складывает расходы в B2, B3 и B4?',
    choices: ['=SUM(B2:B3)', '=SUM(B2:B4)', '=SUM(B4:B5)'],
    correctIndex: 1,
    explanation: 'Двоеточие задаёт диапазон от B2 до B4 включительно.',
  },
  {
    question: 'Что произойдёт с итогом, если изменить расход в B3?',
    choices: ['Останется прежним', 'Потребует переписать формулу', 'Пересчитается с новым значением'],
    correctIndex: 2,
    explanation: 'Формула ссылается на ячейки. Когда значение одной из них меняется, итог обновляется автоматически.',
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
    { label: 'Заголовок и детали', passed: Boolean(title && subtitle), detail: title && subtitle ? 'Заголовок и поясняющий текст добавлены.' : 'Добавь заголовок и короткое пояснение.' },
    { label: 'Размер заголовка', passed: clearHierarchy, detail: clearHierarchy ? 'Заголовок как минимум в 1,5 раза крупнее текста.' : 'Увеличь заголовок хотя бы в 1,5 раза относительно текста.' },
    { label: 'Контраст текста', passed: ratio >= 4.5, detail: ratio ? `Контраст текста — ${ratio.toFixed(2)}:1. Нужно не ниже 4,5:1.` : 'Выбери допустимые цвета текста и фона.' },
    { label: 'Призыв к действию', passed: Boolean(cta), detail: cta ? 'Призыв добавлен. Проверь, понятно ли читателю, что делать.' : 'Добавь понятный призыв к действию.' },
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
    { label: 'Три расхода', passed: numbersValid, detail: numbersValid ? 'Во всех трёх ячейках указаны неотрицательные числа.' : 'Введи неотрицательное число в каждую ячейку расходов.' },
    { label: 'Диапазон', passed: formulaValid, detail: formulaValid ? 'Формула SUM включает B2, B3 и B4.' : 'Примени SUM ко всему диапазону B2:B4.' },
    { label: 'Сумма', passed: totalValid, detail: totalValid ? 'Ответ совпадает с суммой трёх расходов.' : 'Сложи все три расхода и проверь ответ с учётом копеек.' },
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
