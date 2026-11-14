import test from 'node:test';
import assert from 'node:assert/strict';
import { isLessonTaskUsable } from '../backend/lesson-task-quality.js';

const textStep = (task, criterion = 'The result fits the situation.') => ({ task, criterion, practice: { type: 'text' } });

test('English and SMM text practice reject unavailable choice controls in all interface languages', () => {
  const tasks = [
    textStep('Прочитайте диалог. Затем выберите правильный ответ: какое приветствие лучше подходит?', 'Выберите вариант, подходящий для знакомства.'),
    textStep('Read the dialogue and choose the correct greeting.'),
    textStep('Select the best option for a short post.'),
    textStep('Диалогті оқып, дұрыс жауапты таңдаңыз.'),
    textStep('Ең жақсы нұсқаны белгілеңіз.'),
    textStep('Read the example.', 'Choose the correct answer.'),
    textStep('Выберите правильный ответ. Напишите номер выбранного варианта.'),
    textStep('Choose the right response. Write the letter of the correct answer.'),
    textStep('Choose the best greeting. Do not write a reply.'),
    textStep('Выберите правильное приветствие. Не пишите свой ответ.'),
    textStep('Дұрыс жауапты таңдаңыз. Өз жауабыңызды жазбаңыз.'),
  ];
  for (const subject of ['english', 'smm']) for (const step of tasks) {
    assert.equal(isLessonTaskUsable(step, subject), false, `${subject}: ${step.task}`);
  }
});

test('varied original text tasks and mixed choose-then-write work remain usable', () => {
  for (const task of [
    'Write a short introduction to a new colleague in English.',
    'Complete a two-turn exchange for your first day at work.',
    'Reply to Alex with your name and one polite question.',
    'Choose a greeting for a colleague, then compose your own two-line introduction.',
    'Выберите подходящий вариант ситуации и напишите свой диалог из двух реплик.',
    'Составьте пост для кофейни с одной выгодой и конкретным призывом.',
    'Отредактируйте начало поста для аудитории начинающих бегунов.',
    'Өзіңізді таныстыратын екі сөйлем жазыңыз.',
    'Дұрыс жауапты таңдаңыз, содан кейін өз диалогіңізді құрастырыңыз.',
    'Choose the best greeting. Do not write the option number; compose your own reply.',
  ]) assert.equal(isLessonTaskUsable(textStep(task), 'english'), true, task);
  assert.equal(isLessonTaskUsable(textStep('Choose your audience, then draft a post for it.'), 'smm'), true);
});

test('assessment choices and other domains or editors are outside the guard', () => {
  const step = { ...textStep('Write a new introduction.'), teaching: { assessment: {
    type: 'choice', question: 'Choose the correct answer.', options: ['Hi', 'Bye', 'No'], answer: 0,
  } } };
  assert.equal(isLessonTaskUsable(step, 'english'), true);
  const choice = textStep('Choose the correct option.');
  for (const subject of [null, undefined, 'python', 'math']) assert.equal(isLessonTaskUsable(choice, subject), true);
  assert.equal(isLessonTaskUsable({ ...choice, practice: { type: 'palette' } }, 'smm'), true);
  assert.equal(isLessonTaskUsable({ ...choice, practice: { type: 'code', language: 'python' } }, 'english'), true);
});

test('the targeted task guard stays bounded and does not infer a production request from the rubric', () => {
  assert.equal(isLessonTaskUsable(textStep('Choose the correct answer.', 'The learner writes an original sentence.'), 'english'), false);
  assert.equal(isLessonTaskUsable(textStep('x'.repeat(901)), 'english'), false);
  assert.equal(isLessonTaskUsable(textStep('Write a reply.', 'x'.repeat(321)), 'english'), false);
  assert.equal(isLessonTaskUsable(textStep(null), 'english'), false);
  assert.equal(isLessonTaskUsable(textStep(''), 'smm'), false);
});
