import { BUDGET_QUIZ, evaluateBudget, makeBudgetChallenge } from './engine.js';

export const SESSION_MINUTES = [5, 10, 20];

const limitQuestion = {
  question: 'На расходы выделено $300. По таблице получилось $260. Сколько осталось?',
  choices: ['$40', '$260', '$560'],
  correctIndex: 0,
  explanation: 'Остаток — это лимит минус сумма расходов: 300 − 260 = 40.',
};

const sessions = {
  5: {
    title: 'Посчитай сумму готовых расходов',
    intro: 'Найди три суммы в столбце B и сложи их. Формула SUM умеет складывать весь диапазон за один раз.',
    questions: [BUDGET_QUIZ[1]],
    limit: null,
    values: [12, 35, 8],
  },
  10: {
    title: 'Введи формулу и проверь итог',
    intro: 'Пройди три вопроса о ячейках и диапазонах. Затем запиши формулу и посчитай сумму расходов.',
    questions: BUDGET_QUIZ,
    limit: null,
    values: [48, 125, 24],
  },
  20: {
    title: 'Составь таблицу и проверь бюджет',
    intro: 'Введи расходы, посчитай их по формуле и сравни сумму с лимитом. Если остаток отрицательный, план превышает бюджет.',
    questions: [...BUDGET_QUIZ, limitQuestion],
    limit: 320,
    values: [34.50, 146.25, 27.90],
  },
};

export function normalizeMinutes(value) {
  const minutes = Number(value);
  return SESSION_MINUTES.includes(minutes) ? minutes : 10;
}

export function budgetSession(minutes) {
  return sessions[normalizeMinutes(minutes)];
}

export function budgetDraftKey(step, minutes) {
  const stage = step === 3 ? 'challenge' : 'practice';
  const mode = normalizeMinutes(minutes);
  // Existing browser drafts belong to the original, ten-minute exercise.
  return mode === 10 ? `budget-${stage}` : `budget-${stage}-${mode}`;
}

export function createBudgetDraft(step, minutes, seed = 0) {
  const mode = normalizeMinutes(minutes);
  const session = budgetSession(mode);
  let values = [...session.values];
  if (step === 3 || seed > 0) {
    const amounts = makeBudgetChallenge(mode === 10 ? seed : `${mode}:${seed}`);
    if (mode === 5) values = amounts.map(amount => Math.floor(amount / 4));
    else if (mode === 20) values = amounts.map((amount, index) => amount + [0.5, 0.25, 0.9][index]);
    else values = amounts;
  }
  return { values, formula: mode === 5 && step === 2 ? '=SUM(B2:B4)' : '', answer: '', balance: '', seed };
}

export function evaluateBudgetSession(draft, minutes) {
  const result = evaluateBudget(draft, draft.values);
  const { limit } = budgetSession(minutes);
  if (limit === null) return result;

  const text = String(draft.balance ?? '').trim();
  const balance = /^-?\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
  const totalCents = result.checks[0].passed
    ? draft.values.reduce((total, value) => total + Math.round(value * 100), 0)
    : NaN;
  const passed = Number.isSafeInteger(totalCents) && Number.isFinite(balance)
    && Math.round(balance * 100) === limit * 100 - totalCents;
  return {
    passed: result.passed && passed,
    checks: [...result.checks, {
      label: 'Остаток бюджета',
      passed,
      detail: passed ? 'Лимит и расходы учтены верно.' : 'Вычти сумму расходов из лимита. При перерасходе введи отрицательное число.',
    }],
  };
}

export function readBudgetQuiz(saved, minutes) {
  const questions = budgetSession(minutes).questions;
  const index = Number.isInteger(saved?.index) && saved.index >= 0 && saved.index < questions.length
    ? saved.index : 0;
  const question = questions[index];
  const choice = Number.isInteger(saved?.choice) && saved.choice >= 0 && saved.choice < question.choices.length
    ? saved.choice : null;
  return { index, choice, feedback: choice !== null && saved.feedback === true };
}

export function readBudgetResume(state) {
  const activity = state.budgetActivity;
  if (state.active !== 'budget' || !activity) return null;
  const { view, step } = activity;
  if (view === 'path') return { view, step: 0 };
  if (view === 'result' && state.progress.budget === 4 && state.works.budget) return { view, step: 3 };
  if (view === 'lesson' && Number.isInteger(step) && step >= 0 && step < 4 && step <= state.progress.budget) {
    return { view, step };
  }
  return null;
}

export function budgetCsv(draft) {
  const [transport, groceries, subscriptions] = draft.values;
  const rows = [
    'Expense,Amount',
    `Transport,${transport}`,
    `Groceries,${groceries}`,
    `Subscriptions,${subscriptions}`,
    'Total,=SUM(B2:B4)',
  ];
  if (Number.isFinite(draft.limit)) {
    rows.push(`Budget limit,${draft.limit}`, 'Remaining,=B6-B5');
  }
  return rows.join('\r\n') + '\r\n';
}
