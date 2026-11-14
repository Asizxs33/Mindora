import test from 'node:test';
import assert from 'node:assert/strict';
import { starterCourses, getStarterCourse } from '../core/starter-courses.js';
import { restorePlan, lessonPages } from '../core/learning-plan.js';
import { isAssessmentCorrect, isAssessmentReady } from '../core/lesson-assessment.js';

const ids = ['ai-prompts', 'python-basics', 'everyday-english', 'clear-writing'];
const correct = { 'ai-prompts': 1, 'python-basics': '"Hello"', 'everyday-english': [1, 2, 0], 'clear-writing': [0, 2] };
const wrong = { 'ai-prompts': 0, 'python-basics': 'Hello', 'everyday-english': [0, 1, 2], 'clear-writing': [0, 1] };

test('all four ready courses in all three languages restore through the production v3 schema', () => {
  for (const language of ['en', 'ru', 'kk']) {
    const metadata = starterCourses(language);
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
