import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STARTER_DURATIONS, starterCourses, getStarterCourse } from '../core/starter-courses.js';
import { PLAN_DURATIONS, restorePlan, lessonPages } from '../core/learning-plan.js';
import { isAssessmentCorrect, isAssessmentReady } from '../core/lesson-assessment.js';

const ids = ['ai-prompts', 'python-basics', 'everyday-english', 'clear-writing'];
const correct = { 'ai-prompts': 1, 'python-basics': '"Hello"', 'everyday-english': [1, 2, 0], 'clear-writing': [0, 2] };
const wrong = { 'ai-prompts': 0, 'python-basics': 'Hello', 'everyday-english': [0, 1, 2], 'clear-writing': [0, 1] };

test('all four ready courses in all three languages restore through the production v3 schema', () => {
  for (const language of ['en', 'ru', 'kk']) {
    const metadata = starterCourses(language).filter(course => ids.includes(course.id));
    assert.deepEqual(metadata.map(course => course.id), ids);
    for (const card of metadata) {
      const saved = getStarterCourse(card.id, language);
      assert.ok(saved, `${card.id}/${language}`);
      assert.deepEqual(restorePlan(saved), saved);
      assert.equal(saved.plan.formatVersion, 3);
      assert.equal(saved.plan.language, language);
      assert.equal(saved.plan.title, card.title);
      assert.ok(card.description.length > 10);
      assert.equal(card.minutes, 5);
      assert.deepEqual(saved.plan.steps.map(step => step.minutes), [2, 3]);
      assert.equal(saved.completed, 0);
      assert.deepEqual(saved.answers, ['', '']);
      assert.deepEqual(saved.reviews, [null, null]);
      const [guided, independent] = saved.plan.steps;
      for (const step of [guided, independent]) {
        for (const key of ['title', 'instruction', 'task', 'criterion']) assert.ok(step[key].trim(), `${card.id}/${language}/${key}`);
      }
      assert.ok(guided.resource.url.startsWith('https://'));
      assert.deepEqual(guided.resource.images, []);
      assert.ok(guided.teaching.why && guided.teaching.example.input && guided.teaching.example.output && guided.teaching.takeaway);
      assert.equal(independent.teaching, undefined);
      assert.notEqual(guided.task, independent.task);
      assert.deepEqual(lessonPages(guided), ['explain', 'example', 'check', 'recap', 'practice']);
      assert.deepEqual(lessonPages(independent, true), ['practice']);
    }
  }
});

test('ready-course checks grade actual answers and keep practice locked after a wrong check', () => {
  for (const language of ['en', 'ru', 'kk']) for (const id of ids) {
    const saved = getStarterCourse(id, language);
    const assessment = saved.plan.steps[0].teaching.assessment;
    assert.equal(isAssessmentReady(assessment, correct[id]), true, `${id}/${language}`);
    assert.equal(isAssessmentCorrect(assessment, correct[id]), true);
    assert.equal(isAssessmentReady(assessment, wrong[id]), true);
    assert.equal(isAssessmentCorrect(assessment, wrong[id]), false);
    saved.study[0] = { page: 4, response: wrong[id], checked: true };
    assert.equal(restorePlan(saved).study[0].page, 2);
    saved.study[0] = { page: 4, response: correct[id], checked: true };
    assert.equal(restorePlan(saved).study[0].page, 4);
  }
  const python = getStarterCourse('python-basics').plan.steps[0].teaching.assessment;
  assert.equal(isAssessmentCorrect(python, "'Hello'"), true);
  assert.equal(isAssessmentCorrect(python, '"Hello'), false);
  assert.equal(isAssessmentCorrect(python, 'print("Hello")'), false);
});

test('each start is an independent fresh copy and unsupported IDs cannot open a course', () => {
  const first = getStarterCourse('ai-prompts', 'kk');
  first.answers[0] = 'My own work';
  first.plan.steps[0].teaching.assessment.options[0] = 'changed';
  const second = getStarterCourse('ai-prompts', 'kk');
  assert.deepEqual(second.answers, ['', '']);
  assert.notEqual(second.plan.steps[0].teaching.assessment.options[0], 'changed');
  const cards = starterCourses('ru'); cards[0].title = 'changed';
  assert.notEqual(starterCourses('ru')[0].title, 'changed');
  assert.equal(getStarterCourse('not-a-course'), null);
  assert.equal(getStarterCourse('__proto__'), null);
  assert.equal(getStarterCourse('ai-prompts', 'unsupported').plan.language, 'en');
  assert.equal(new Set(['en', 'ru', 'kk'].map(language => getStarterCourse('ai-prompts', language).plan.title)).size, 3);
});

test('all 72 variants contain the selected duration and distinct, valid lessons', () => {
  for (const language of ['en', 'ru', 'kk']) for (const minutes of STARTER_DURATIONS) {
    const cards = starterCourses(language, minutes);
    assert.equal(cards.length, 8);
    for (const card of cards) {
      const saved = getStarterCourse(card.id, language, minutes);
      assert.ok(saved, `${card.id}/${language}/${minutes}`);
      assert.equal(card.minutes, minutes);
      assert.deepEqual(card.durations, [5, 10, 20]);
      assert.equal(card.stepCount, PLAN_DURATIONS[minutes].length);
      assert.equal(saved.plan.minutes, minutes);
      assert.equal(saved.plan.language, language);
      assert.deepEqual(saved.plan.steps.map(step => step.minutes), PLAN_DURATIONS[minutes]);
      assert.equal(saved.plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
      assert.deepEqual(restorePlan(JSON.parse(JSON.stringify(saved))), saved);
      const steps = saved.plan.steps;
      assert.equal(new Set(steps.map(step => step.title)).size, steps.length);
      assert.equal(new Set(steps.map(step => step.task)).size, steps.length);
      assert.equal(new Set(steps.map(step => step.instruction)).size, steps.length);
      assert.equal(new Set(steps.slice(0, -1).map(step => step.teaching.example.input)).size, steps.length - 1);
      for (const step of steps.slice(0, -1)) {
        assert.deepEqual(lessonPages(step), ['explain', 'example', 'check', 'recap', 'practice']);
        assert.ok(step.teaching.why && step.teaching.example.output && step.teaching.example.explanation && step.teaching.takeaway);
      }
      assert.equal(steps.at(-1).teaching, undefined);
      if (minutes > 5) {
        assert.notEqual(steps.at(-1).task, getStarterCourse(card.id, language).plan.steps.at(-1).task);
      }
    }
  }
});

const extensionCorrect = {
  'ai-prompts': [[0, 2], 1], 'python-basics': ['name', [2, 0, 1]],
  'everyday-english': ['is', 1], 'clear-writing': [1, [1, 2, 0]],
};
const extensionWrong = {
  'ai-prompts': [[0, 1], 0], 'python-basics': ['"name"', [0, 1, 2]],
  'everyday-english': ['are', 2], 'clear-writing': [2, [0, 1, 2]],
};

test('new lessons check distinct skills and preserve their own position and answers on reload', () => {
  for (const language of ['en', 'ru', 'kk']) for (const id of ids) for (const minutes of [10, 20]) {
    const saved = getStarterCourse(id, language, minutes);
    for (let index = 1; index < saved.plan.steps.length - 1; index++) {
      const assessment = saved.plan.steps[index].teaching.assessment;
      const right = extensionCorrect[id][index - 1], incorrect = extensionWrong[id][index - 1];
      assert.equal(isAssessmentReady(assessment, right), true, `${id}/${language}/${minutes}/${index}`);
      assert.equal(isAssessmentCorrect(assessment, right), true);
      assert.equal(isAssessmentReady(assessment, incorrect), true);
      assert.equal(isAssessmentCorrect(assessment, incorrect), false);
      saved.study[index] = { page: 4, response: incorrect, checked: true };
      assert.equal(restorePlan(saved).study[index].page, 2);
      saved.study[index] = { page: 3, response: right, checked: true };
      saved.answers[index] = `My draft for ${id}, ${language}, ${minutes}, lesson ${index}`;
      const reloaded = restorePlan(JSON.parse(JSON.stringify(saved)));
      assert.equal(reloaded.study[index].page, 3);
      assert.deepEqual(reloaded.study[index].response, right);
      assert.equal(reloaded.answers[index], saved.answers[index]);
    }
    saved.answers[0] = 'My completed first task';
    saved.completed = 1;
    assert.equal(restorePlan(saved).completed, 1);
    for (const otherMinutes of STARTER_DURATIONS) {
      const fresh = getStarterCourse(id, language, otherMinutes);
      assert.equal(fresh.completed, 0);
      assert.ok(fresh.answers.every(answer => answer === ''));
      assert.ok(fresh.study.every(study => study.page === 0 && !study.checked));
    }
  }
});

test('unsupported durations fail closed rather than silently opening a different course', () => {
  for (const minutes of [0, 1, 7, 15, 30, '10', null, {}, NaN, Infinity]) {
    assert.deepEqual(starterCourses('en', minutes), []);
    assert.equal(getStarterCourse('ai-prompts', 'en', minutes), null);
  }
  const metadata = starterCourses('en', 10);
  metadata[0].durations.push(30);
  assert.deepEqual(starterCourses('en', 10)[0].durations, [5, 10, 20]);
});

test('published five-minute saved plans remain exactly unchanged', () => {
  // Digests captured before adding duration variants protect existing course
  // identity, text, answers, resource links and assessment/restoration defaults.
  const published = {
    'en/ai-prompts': '14bb87388e254abc948f1427d4b8649c3c96f1794ff17ef50836f3a0cf47c63c',
    'en/python-basics': 'dfff5536da8ee86144389bb3774df02b071576d835606f0ba97faaa2efeccd3f',
    'en/everyday-english': '1bc2f9458c49ce601dd410ba1b0f6f65133820e87db85bc3af74c6006d84dd67',
    'en/clear-writing': '9a90e96cbc10ce6a599dd38abc6dff902dd422ad361ed5a1bbb20ceb6162b0da',
    'ru/ai-prompts': '7a312033f74eb98d0a5d5a8bece5986a50679e8538f6cab3c7c4e31c39c6f8e5',
    'ru/python-basics': 'db1a03c147ea140a867420279faf690afc46b09b8a41b0992747b32c690c0849',
    'ru/everyday-english': 'b93806a3ebb311acfaf6c8cf765cd9ea2b891d785d5a0097bb9903ab1a963428',
    'ru/clear-writing': '50caf571f9b30b67a4ece349be3030e54864d1355fde3cde153495f87ee8fd4a',
    'kk/ai-prompts': '16a43df30fac08f56c198db4689fc68fe0351fababbbd593f94e4c567010129d',
    'kk/python-basics': '5294b13e393a5a1e3e5214f163a93a646ee2df7d115a69d62bdc55342170e5d4',
    'kk/everyday-english': 'c2be9d3c798ffc579b3982d0f5498d5826f579f6eaadf82a44e0f78d18aaf36d',
    'kk/clear-writing': '3f81bc61260dcf63aa0d75aa7ed496f2d54542b74f8cce87cd348c1a853b2f87',
  };
  for (const [key, expected] of Object.entries(published)) {
    const [language, id] = key.split('/');
    const saved = getStarterCourse(id, language, 5);
    assert.deepEqual(saved, getStarterCourse(id, language));
    assert.equal(createHash('sha256').update(JSON.stringify(saved)).digest('hex'), expected, key);
  }
});
