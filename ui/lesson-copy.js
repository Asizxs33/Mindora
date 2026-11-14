// Presentation-only English copy for the fixed sample curriculum.
// Unknown strings and all learner-authored text are left unchanged.
const copy = new Map([
  ['Сделать постер для кофейни', 'Make a poster for a café'],
  ['Собрать таблицу ежемесячных расходов', 'Build a monthly expense tracker'],
  ['Разберись, как размер, контраст и призыв к действию помогают читать постер.', 'Learn three simple ways to make your poster clear.'],
  ['Ответь на три вопроса о читаемости постера.', 'Try three quick questions about clear design.'],
  ['Собери постер и проверь его по подсказкам.', 'Make your first poster, with a little help along the way.'],
  ['Сделай постер для другого события без подсказок.', 'Try a fresh brief and put your new skills to work.'],
  ['Разберись, как ячейки, диапазоны и формула SUM помогают подсчитать расходы.', 'Meet cells, ranges, and one useful formula.'],
  ['Выбери нужный диапазон и проверь, как работает формула.', 'Try three quick questions about your spreadsheet.'],
  ['Введи три расхода и посчитай их сумму.', 'Add three expenses and find the total.'],
  ['Примени формулу к новым расходам без подсказок.', 'Use what you learned with a fresh set of numbers.'],
  ['Заголовок и детали', 'Headline and details'],
  ['Заголовок и поясняющий текст добавлены.', 'Your headline and details are in place.'],
  ['Добавь заголовок и короткое пояснение.', 'Add a headline and a few helpful details.'],
  ['Размер заголовка', 'Headline size'],
  ['Заголовок как минимум в 1,5 раза крупнее текста.', 'Your headline is at least 1.5 times larger than the detail text.'],
  ['Увеличь заголовок хотя бы в 1,5 раза относительно текста.', 'Make the headline at least 1.5 times larger than the detail text.'],
  ['Контраст текста', 'Easy-to-read colours'],
  ['Выбери допустимые цвета текста и фона.', 'Choose a text colour and a background colour.'],
  ['Призыв к действию', 'A clear next step'],
  ['Призыв добавлен. Проверь, понятно ли читателю, что делать.', 'Your invitation is in place. Is it clear what people should do?'],
  ['Добавь понятный призыв к действию.', 'Tell people what to do next.'],
  ['Текст помещается', 'Everything fits'],
  ['Текст переносится и остаётся в границах макета.', 'Your text wraps neatly inside the poster.'],
  ['Три расхода', 'Three expenses'],
  ['Во всех трёх ячейках указаны неотрицательные числа.', 'All three cells contain a number of zero or more.'],
  ['Введи неотрицательное число в каждую ячейку расходов.', 'Enter a number of zero or more for each expense.'],
  ['Диапазон', 'The right cells'],
  ['Формула SUM включает B2, B3 и B4.', 'Your SUM formula includes B2, B3 and B4.'],
  ['Примени SUM ко всему диапазону B2:B4.', 'Use SUM for the whole range B2:B4.'],
  ['Сумма', 'The total'],
  ['Ответ совпадает с суммой трёх расходов.', 'Your answer matches the three expenses.'],
  ['Сложи все три расхода и проверь ответ с учётом копеек.', 'Add all three expenses. Remember any decimal places.']
]);

export function uiText(value) {
  const text = String(value ?? '');
  if (copy.has(text)) return copy.get(text);
  const contrast = text.match(/^Контраст текста — ([\d.]+):1\. Нужно не ниже 4,5:1\.$/);
  if (contrast) return `Your colour contrast is ${contrast[1]}:1. Aim for at least 4.5:1.`;
  const sizes = text.match(/^На постере заголовок — ([\d.]+) px, текст — ([\d.]+) px\. Заголовок должен быть как минимум в 1,5 раза крупнее\.$/);
  if (sizes) return `Headline: ${sizes[1]} px. Details: ${sizes[2]} px. Make the headline at least 1.5 times larger.`;
  return text;
}

const questions = new Map([
  ['Что читатель должен первым заметить на постере?', {
    question: 'What should people notice first on a poster?',
    choices: ['Every detail at the same size', 'The main idea or event name', 'The tiny text at the bottom'],
    explanation: 'A headline draws attention to your main idea. The smaller details support it.'
  }],
  ['Какое сочетание легче читать?', {
    question: 'Which colours are easiest to read?',
    choices: ['Pale yellow words on white', 'Dark words on a light background', 'Light grey words on a slightly lighter grey'],
    explanation: 'Strong contrast makes words easier to see. For this exercise, aim for a ratio of at least 4.5:1.'
  }],
  ['Какая фраза подсказывает читателю, что делать?', {
    question: 'Which line tells people what to do next?',
    choices: ['So many exciting possibilities', 'Something good is coming soon', 'Visit on Saturday, from 10 am to 4 pm'],
    explanation: 'A clear action and a time help people know exactly what to do next.'
  }],
  ['Что означает адрес B2?', {
    question: 'What does the cell address B2 mean?',
    choices: ['Column B, row 2', 'Row B, column 2', 'The second spreadsheet'],
    explanation: 'The letter comes first, then the row number. B2 is where column B meets row 2.'
  }],
  ['Какая формула складывает расходы в B2, B3 и B4?', {
    question: 'Which formula adds B2, B3 and B4?',
    choices: ['=SUM(B2:B3)', '=SUM(B2:B4)', '=SUM(B4:B5)'],
    explanation: 'The colon means “through”. B2:B4 includes B2, B3 and B4.'
  }],
  ['Что произойдёт с итогом, если изменить расход в B3?', {
    question: 'What happens to the total when you change B3?',
    choices: ['It stays the same', 'You need to rewrite the formula', 'It updates with the new number'],
    explanation: 'A formula uses the values in its cells. Change a value and the total updates automatically.'
  }]
]);

export function quizCopy(question) {
  const translated = questions.get(question.question);
  // Keep the original object, correctIndex, and answer order untouched.
  return translated && translated.choices.length === question.choices.length
    ? { ...question, ...translated, choices: [...translated.choices] }
    : question;
}
