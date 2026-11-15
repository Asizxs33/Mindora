import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLessonPractice } from '../backend/practice-selection.js';

const choose = (goal, task, practice) => selectLessonPractice({ task, ...(practice === undefined ? {} : { practice }) }, { goal });

test('explicit valid workspaces take priority without changing another coding language', () => {
  assert.deepEqual(choose('Python', 'Write a program', { type: 'code', language: 'javascript', starter: 'let x = 1;' }), { type: 'code', language: 'javascript', starter: 'let x = 1;' });
  assert.deepEqual(choose('Python', 'Calculate a percentage', { type: 'calculation' }), { type: 'calculation' });
  assert.deepEqual(choose('Design', 'Write a short explanation', { type: 'palette' }), { type: 'palette' });
  assert.equal(choose('Python', 'Write code', { type: 'shell', language: 'bash' }), null);
  assert.equal(choose('Python', 'Write code', { type: 'code', language: 'python', starter: 'x'.repeat(501) }), null);
});

test('Python writing tasks receive a real editor even if DeepSeek omitted practice or selected text', () => {
  for (const [goal, task] of [
    ['Python loops', 'Write a program that prints three names.'],
    ['Python с нуля', 'Напиши цикл по списку и выведи каждое имя.'],
    ['Python бағдарламалау', 'Үш есімді шығаратын бағдарлама жаз.'],
    ['Python', 'Complete the function and explain your changes.'],
  ]) for (const practice of [undefined, { type: 'text' }]) {
    assert.deepEqual(choose(goal, task, practice), { type: 'code', language: 'python' });
  }
  assert.deepEqual(selectLessonPractice({ task: 'Fix the loop.' }, { goal: 'Automation', roadmapStage: { title: 'Python loops', objective: 'Process a list' } }), { type: 'code', language: 'python' });
  assert.deepEqual(selectLessonPractice({ task: 'Сначала предскажите итог, затем запустите код. В рабочем поле введите программу.' }, {
    goal: 'Обрабатывать CSV-отчёты', roadmapStage: { originalGoal: 'Python', title: 'Сводка CSV', objective: 'Посчитать сумму расходов' },
  }), { type: 'code', language: 'python' });
});

test('mentions, comparisons, setup and other-language tasks are not falsely turned into Python', () => {
  for (const task of [
    'Explain what a loop does.', 'Write an explanation of this program.',
    'Напиши описание программы.', 'Install Python and describe the setup.',
    'Write JavaScript code and compare it with Python.',
    'Write a loop in C.', 'Write Go code for this comparison.',
    'Select the colors for a Python-themed poster.',
  ]) assert.deepEqual(choose('Python', task), { type: 'text' }, task);
  assert.deepEqual(choose('Copywriting', 'Write a program announcement mentioning Python.'), { type: 'text' });
  assert.deepEqual(selectLessonPractice({ task: 'Write a function that adds two numbers.' }, { goal: 'Python and JavaScript', roadmapStage: { title: 'JavaScript functions' } }), { type: 'text' });
});

test('palette inference requires choosing colors and does not replace a drawing assignment', () => {
  for (const [goal, task] of [
    ['Design a poster', 'Choose three colors for a calm cafe palette.'],
    ['Дизайн', 'Подбери цвета для фона, текста и акцента.'],
    ['Дизайн', 'Фон мен мәтін үшін түстер таңда.'],
  ]) assert.deepEqual(choose(goal, task), { type: 'palette' });
  for (const task of ['Describe why the palette feels calm.', 'Build a layout with two columns.']) {
    assert.deepEqual(choose('Design', task), { type: 'text' }, task);
  }
  assert.deepEqual(choose('French vocabulary', 'Select the correct colors in French.'), { type: 'text' });
});

test('calculation inference needs numeric practice in a relevant subject, not every business task', () => {
  for (const [goal, task] of [
    ['Percentages', 'Calculate 15% of 200 and show your working.'],
    ['Математика', 'Реши уравнение 2x + 4 = 12.'],
    ['Пайыз', '200 санының 15 пайызын есепте.'],
  ]) assert.deepEqual(choose(goal, task), { type: 'calculation' });
  for (const [goal, task] of [
    ['Business', 'Solve a customer communication problem.'],
    ['Mathematics', 'Explain why percentages are useful.'],
    ['Python', 'Write a program to calculate percentages.'],
  ]) assert.deepEqual(choose(goal, task), goal === 'Python' ? { type: 'code', language: 'python' } : { type: 'text' });
  assert.deepEqual(selectLessonPractice(undefined), { type: 'text' });
});

test('polite Russian calculation tasks and numeric discounts select calculation without broadening word counts', () => {
  const task = 'Разберите пример ниже и ответьте на вопрос проверки. Затем в рабочем поле посчитайте размер скидки для товара за 240 ₽ со скидкой 10% и запишите первую строку: «Скидка: ... ₽».';
  assert.deepEqual(choose('Математика: проценты', task, { type: 'text' }), { type: 'calculation' });
  assert.deepEqual(choose('Скидки в магазине', 'Посчитай размер скидки 10% на товар за 240 ₽.'), { type: 'calculation' });
  assert.deepEqual(choose('Математика', 'Сосчитайте сумму 12 + 8.'), { type: 'calculation' });
  assert.deepEqual(choose('Математика', 'Посчитай 15% от 200.'), { type: 'calculation' });
  assert.deepEqual(choose('Копирайтинг', 'Посчитайте слова в заголовке.'), { type: 'text' });
  assert.deepEqual(choose('Реклама', 'Сосчитайте упоминания скидки в тексте.'), { type: 'text' });
  assert.deepEqual(choose('Скидки', 'Объясните, почему скидка 10% привлекает покупателей.'), { type: 'text' });
});

test('drawing or plotting tasks are not mapped to calculation-only controls', () => {
  for (const task of [
    'Нарисуй график функции и найди площадь под кривой.',
    'Построй график и вычисли площадь.',
    'Plot the function and calculate its area.',
  ]) assert.deepEqual(choose('Математика', task), { type: 'text' });
});
