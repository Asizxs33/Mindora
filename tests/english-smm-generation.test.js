import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { normalizeSavedCourse } from '../backend/learning-course-store.js';
import { lessonPages, restorePlan } from '../core/learning-plan.js';
import { isAssessmentCorrect } from '../core/lesson-assessment.js';
import { lessonTopic, topicVisualSchema } from '../backend/lesson-topic.js';

const dialogue = {
  type: 'dialogue', label: 'Знакомство с новым коллегой',
  turns: [
    { speaker: 'Alex', text: "Hi, I'm Alex.", translation: 'Привет, я Алекс.' },
    { speaker: 'Sam', text: "I'm Sam. Nice to meet you.", translation: 'Я Сэм. Приятно познакомиться.' },
  ],
};
const socialPost = {
  type: 'social-post', audience: 'Соседи, которые заходят за утренним кофе',
  hook: 'Кофе перед работой со скидкой 20%',
  body: 'В учебном примере кофейня предлагает скидку на фильтр-кофе по будням до 10:00.',
  cta: 'Сохраните адрес и загляните утром.',
};
const gap = {
  type: 'gap-fill', question: 'Дополните знакомство.', before: 'Hello,', after: 'Alex.',
  accepted: ["I'm", 'I’m'], explanation: 'Сокращение I’m означает I am.',
};
const choice = {
  type: 'choice', question: 'Какой призыв к действию конкретнее?',
  options: ['Сохраните адрес и зайдите утром.', 'Сделайте что-нибудь.', 'Никаких действий.'],
  answer: 0, explanation: 'Первый вариант предлагает понятное действие.',
};
const response = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });

function fixture({ visual, assessment, task, finalTask, source, outputForAttempt }) {
  const requests = { search: [], fetch: [], composition: [], compositionSignals: [], query: [] };
  const output = {
    formatVersion: 3, title: 'Практика на конкретном примере', outcome: 'Создать свой результат по образцу.',
    guided: [{
      title: 'Разберём пример', instruction: 'Сравни части примера и объясни, какую задачу решает каждая.',
      task, criterion: 'Результат подходит указанной ситуации и содержит все необходимые части.',
      practice: { type: 'text' }, sourceId: 0, imageIds: [],
      teaching: {
        why: 'Конкретный пример помогает применить идею самостоятельно.',
        example: { input: 'Изучите исходную ситуацию.', output: 'Выполненный пример соответствует исходной ситуации.', explanation: 'Каждая часть помогает получить нужный результат.', ...(visual ? { visual } : {}) },
        assessment, takeaway: 'Учитывайте ситуацию и цель вашего текста.',
      },
    }],
    final: { title: 'Самостоятельная работа', task: finalTask, criterion: 'Новый текст соответствует заданной ситуации.', practice: { type: 'text' } },
  };
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/v1/tools/search')) {
      requests.search.push(body);
      return Response.json({ results: [{ url: source, title: 'Guide with worked examples', content: 'This opened learning guide provides a concrete situation, an example response, and instructions for producing a clear original response matched to that situation.' }] });
    }
    if (url.endsWith('/v1/tools/fetch')) {
      requests.fetch.push(body);
      return Response.json({ error: { message: 'This fixture has no opened content for the suggested URL.' } }, { status: 404 });
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const data = JSON.parse(body.messages[1].content);
    if (!data.materials) {
      requests.query.push(body);
      return response({ query: 'Specific beginner guide with a worked example', githubQuery: '' });
    }
    requests.composition.push(body);
    requests.compositionSignals.push(options.signal);
    assert.equal(data.materials[0].url, source);
    return response(outputForAttempt ? outputForAttempt(structuredClone(output), requests.composition.length) : output);
  };
  return { requests, generate: input => generateDeepSeekPlan(input, 'test-only', fetcher, {
    readPage: async () => null, readRenderedPage: async () => null,
  }) };
}

function requiredVisual(request) {
  const line = request.messages[0].content.split('\n').find(item => item.startsWith('For this lesson, teaching.example.visual is required'));
  assert.ok(line, 'the selected domain requests its own visual example');
  const serialized = line.match(/Its JSON structure is (.+)\. Replace sample values/);
  assert.ok(serialized);
  return JSON.parse(serialized[1]);
}

function reopen(plan, response) {
  const practice = lessonPages(plan.steps[0]).indexOf('practice');
  const saved = normalizeSavedCourse(JSON.parse(JSON.stringify({ plan, answers: ['Черновик моего ответа'], study: [{ page: practice, response, checked: true }] })));
  assert.ok(saved);
  const restored = restorePlan(JSON.parse(JSON.stringify(saved)));
  assert.ok(restored);
  assert.equal(restored.answers[0], 'Черновик моего ответа');
  assert.equal(restored.study[0].page, practice);
  return restored;
}

test('real English lesson composition keeps its dialogue and assigns typographic language matching before validation', async () => {
  const source = 'https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/meeting-new-people';
  const run = fixture({ visual: dialogue, assessment: gap, task: 'Write a new English introduction with your name.', finalTask: 'Write a short greeting and introduce a fictional colleague in English.', source });
  const plan = await run.generate({ goal: 'Представиться новому коллеге', minutes: 5, language: 'ru', roadmapStage: {
    goal: 'Простое знакомство на работе', originalGoal: 'English', title: 'Первое знакомство',
    objective: 'Представиться и ответить новому знакомому.', level: 'beginner', levelReason: 'Начинаем с простых фраз.',
  } });
  assert.equal(run.requests.composition.length, 1, 'apostrophe aliases must not cause structural regeneration');
  assert.equal(requiredVisual(run.requests.composition[0]).type, 'dialogue');
  assert.match(run.requests.composition[0].messages[0].content, /example utterances, sentence completion and written practice must use English/);
  const assessment = plan.steps[0].teaching.assessment;
  assert.equal(assessment.answerMode, 'language');
  assert.deepEqual(assessment.accepted, ["I'm"]);
  assert.equal(isAssessmentCorrect(assessment, 'I’m'), true);
  assert.equal(isAssessmentCorrect(assessment, 'Im'), false);
  assert.deepEqual(plan.steps[0].teaching.example.visual, dialogue);
  const restored = reopen(plan, 'I’m');
  assert.deepEqual(restored.plan.steps[0].teaching.example.visual, dialogue);
  assert.equal(restored.plan.steps[0].teaching.assessment.answerMode, 'language');
  assert.equal(restored.study[0].response, 'I’m');
});

test('a discounted SMM post requests and preserves a social-post example instead of a percent diagram', async () => {
  const source = 'https://buffer.com/resources/social-media-marketing-strategy/';
  const run = fixture({ visual: socialPost, assessment: choice,
    task: 'Напиши пост для кофейни со скидкой 20%, одной выгодой и призывом зайти до 10:00.',
    finalTask: 'Напиши другой пост о бесплатном стакане воды для соседей, которые приходят пешком.', source });
  const plan = await run.generate({ goal: 'Составить пост про скидку 20%', minutes: 5, language: 'ru', roadmapStage: {
    goal: 'Пост для кофейни', originalGoal: 'SMM', title: 'Пост о скидке',
    objective: 'Написать понятный пост с одной выгодой и призывом к действию.', level: 'beginner', levelReason: 'Начинаем с первого поста.',
  } });
  assert.equal(run.requests.composition.length, 1);
  assert.equal(requiredVisual(run.requests.composition[0]).type, 'social-post');
  assert.match(run.requests.composition[0].messages[0].content, /not mathematics even when a post mentions discounts/);
  assert.deepEqual(plan.steps[0].teaching.example.visual, socialPost);
  assert.equal(plan.steps[0].practice.type, 'text');
  assert.equal(plan.steps[1].practice.type, 'text');
  assert.equal(plan.steps[0].teaching.assessment.answerMode, undefined);
  const restored = reopen(plan, 0);
  assert.deepEqual(restored.plan.steps[0].teaching.example.visual, socialPost);
  assert.equal(restored.plan.steps[0].teaching.example.visual.type === 'percent', false);
});

test('English and SMM regenerate choice-only text practice once while preserving research and the original deadline', async () => {
  for (const subject of ['english', 'smm']) {
    const run = fixture({ visual: subject === 'english' ? dialogue : socialPost, assessment: choice,
      task: subject === 'english' ? 'Напишите две новые реплики знакомства на английском.' : 'Составьте пост для кофейни с одной выгодой и призывом.',
      finalTask: subject === 'english' ? 'Напишите приветствие и вопрос новому коллеге на английском.' : 'Напишите новый пост для покупателей вечернего кофе.',
      source: subject === 'english' ? 'https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/meeting-new-people' : 'https://buffer.com/resources/social-media-marketing-strategy/',
      outputForAttempt(output, attempt) {
        if (attempt === 1) {
          const step = subject === 'english' ? output.guided[0] : output.final;
          step.task = 'Прочитайте диалог. Затем выберите правильный ответ: какое приветствие лучше подходит?';
          step.criterion = 'Выберите вариант, подходящий для знакомства.';
        }
        return output;
      },
    });
    const plan = await run.generate({ goal: subject === 'english' ? 'English introductions' : 'SMM coffee posts', minutes: 5, language: 'ru' });
    assert.equal(run.requests.composition.length, 2);
    assert.equal(run.requests.compositionSignals[0], run.requests.compositionSignals[1]);
    assert.equal(run.requests.query.length, 1, 'research query is not regenerated');
    const [first, second] = run.requests.composition;
    assert.deepEqual(second.messages.slice(0, first.messages.length), first.messages);
    assert.equal(second.messages.length, first.messages.length + 1);
    assert.equal(second.max_tokens, first.max_tokens);
    assert.doesNotMatch(second.messages.at(-1).content, /какое приветствие лучше подходит/, 'raw failed task is not replayed as instructions');
    assert.ok(plan.steps.every(step => step.practice.type === 'text'));
    assert.match(plan.steps[0].task, /Напишите|Составьте/);
    assert.match(plan.steps.at(-1).task, /Напишите/);
  }
});

test('a second unusable English text task fails instead of publishing phantom choice controls', async () => {
  const run = fixture({ visual: dialogue, assessment: gap,
    task: 'Read the dialogue and choose the correct greeting.', finalTask: 'Write a new English greeting for a colleague.',
    source: 'https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/meeting-new-people',
  });
  await assert.rejects(run.generate({ goal: 'English greetings', minutes: 5, language: 'en' }), { name: 'LessonContentInvalid' });
  assert.equal(run.requests.composition.length, 2);
  assert.equal(run.requests.compositionSignals[0], run.requests.compositionSignals[1]);
  assert.equal(run.requests.query.length, 1);
});

test('programming that mentions English text keeps exact code gaps and does not request a language dialogue', async () => {
  const source = 'https://docs.python.org/3/tutorial/introduction.html';
  const run = fixture({ assessment: { ...gap, before: 'print(', after: ')', accepted: ["'Hello'"] },
    task: 'Write Python code that prints an English greeting.', finalTask: 'Write Python code that prints two English greetings.', source });
  const plan = await run.generate({ goal: 'Python: print English greetings', minutes: 5, language: 'en' });
  const assessment = plan.steps[0].teaching.assessment;
  assert.equal(assessment.answerMode, undefined);
  assert.equal(isAssessmentCorrect(assessment, "'Hello'"), true);
  assert.equal(isAssessmentCorrect(assessment, '‘Hello’'), false);
  assert.doesNotMatch(run.requests.composition[0].messages[0].content, /This is English language learning/);
  assert.equal(plan.steps[0].practice.type, 'code');
  assert.equal(plan.steps[0].practice.language, 'python');
});

test('language classification excludes programming tools while retaining everyday English uses of go', () => {
  for (const topic of [
    'Ruby: print English greetings', 'C++: display an English sentence', 'C#: English text strings',
    'Kotlin: an English welcome message', 'PHP: English page content', 'Swift: an English greeting',
    'Go programming: print English greetings', 'Go language: English strings', 'English messages using the language Go',
  ]) {
    assert.equal(lessonTopic(topic), null, topic);
    assert.equal(topicVisualSchema(topic), null, topic);
  }
  for (const topic of ['English: go to a cafe', 'Learn English: I go to work', 'English: where should we go?']) {
    assert.equal(lessonTopic(topic), 'english', topic);
    assert.equal(topicVisualSchema(topic).type, 'dialogue', topic);
  }
});
