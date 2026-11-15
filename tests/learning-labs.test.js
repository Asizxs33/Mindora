import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { runCapyCode, cleanStrokes, drawingSvg, relationModel } from '../core/lab-models.js';
import { practiceAnswer, normalizePractice } from '../core/lesson-practice.js';
import { mentorForTopic } from '../core/subject-mentor.js';
import { restoreRoadmap, roadmapStageStatuses, updateRoadmapStage } from '../core/roadmap-model.js';
import { selectLessonPractice } from '../backend/practice-selection.js';
import { mentorScene } from '../ui/mentor-scenes.js';
import { learningProjects } from '../ui/learning-projects.js';
import { getStarterCourse } from '../core/starter-courses.js';

test('Mino Code executes movement and bounded repeats without evaluating arbitrary code', () => {
  const run = runCapyCode('repeat(3) { forward(1) } left() forward(3)');
  assert.equal(run.reached, true);
  assert.deepEqual(run.states.at(-1), { x: 3, y: 0, direction: 3 });
  assert.equal(runCapyCode('left() forward(3)', 'north').reached, true);
  assert.equal(runCapyCode('forward(4)').blocked, true);
  for (const bad of ['fetch("https://example.com")', 'while(true){}', 'globalThis.alert(1)', 'repeat(12){repeat(12){forward(1)}}', 'forward(-1)', 'left() }', 'forward(0)', 'forward(999)']) {
    assert.throws(() => runCapyCode(bad), undefined, bad);
  }
});

test('drawings stay bounded, escaped and restorable inside a saved answer', () => {
  const strokes = Array.from({ length: 20 }, () => ({ color: '#123abc', width: 99, points: Array.from({ length: 30 }, () => [100, 100]) }));
  const answer = practiceAnswer({ type: 'drawing' }, { strokes, explanation: 'a'.repeat(200) });
  assert.ok(JSON.stringify(answer).length <= 1500);
  assert.equal(answer.strokes.reduce((n, s) => n + s.points.length, 0), 64);
  assert.deepEqual(cleanStrokes('[bad'), []);
  assert.deepEqual(cleanStrokes([{ color: 'url(javascript:alert(1))', width: 2, points: [[1, 2]] }]), []);
  const { document } = parseHTML(drawingSvg(strokes));
  assert.equal(document.querySelector('script,[onload],[onerror]'), null);
  assert.ok(document.querySelector('polyline'));
});

test('the reusable graph models calculate their own points and clamp invalid controls', () => {
  for (const base of [2, 3, 4, 5]) for (const exponent of [0, 1, 2, 3]) {
    const m = relationModel(base, exponent);
    assert.equal(m.x, base ** exponent);
    assert.equal(m.y, exponent);
  }
  assert.equal(relationModel(2, 3, 'linear').value, 6);
  assert.equal(relationModel(2, 3, 'quadratic').value, 18);
  assert.equal(relationModel(2, 3, 'exponential').value, 8);
  assert.equal(relationModel(-1, 100).base, 2);
  assert.equal(normalizePractice({ type: 'calculation', visual: 'graph' }).visual, 'graph');
});

test('the task selects an existing workspace for arbitrary subjects and keeps the subject mentor through feedback', () => {
  assert.deepEqual(selectLessonPractice({ task: 'Draw a diagram with three boxes and arrows.' }, { goal: 'Explain a business process' }), { type: 'drawing' });
  assert.deepEqual(selectLessonPractice({ task: 'Calculate log_2(8).' }, { goal: 'Logarithms' }), { type: 'calculation', visual: 'logarithm' });
  assert.deepEqual(selectLessonPractice({ task: 'Write forward commands to move Mino.' }, { goal: 'Code a capybara route' }), { type: 'code', language: 'capy' });
  for (const topic of ['logarithms', 'логарифм', 'логорифм', 'математика', 'теңдеу']) assert.equal(mentorForTopic(topic), 'sam');
  for (const [topic, mentor] of [['drawing a tree', 'artist'], ['poster design', 'mia'], ['English grammar', 'copywriter'], ['social marketing', 'smm']]) {
    assert.equal(mentorForTopic(topic), mentor);
    assert.match(mentorScene(mentor, 'celebrate', '<p>Well done</p>'), new RegExp(`data-character-kind="${mentor}"`));
  }
});

test('opening a later lesson is saved separately from completion and survives restoration', () => {
  let path = restoreRoadmap({ goal: 'Learn Python', title: 'Python', outcome: 'Build a small tool.', minutes: 5, language: 'en', level: 'beginner', levelReason: 'Start here.', stages: ['Read', 'Try', 'Build', 'Review'].map(title => ({ title, objective: title + ' a program.' })), progress: Array.from({ length: 4 }, () => ({ courseId: null, completed: false })) });
  const id = '12345678-1234-4000-8000-123456789012';
  path = { ...path, opened: [3] };
  path = updateRoadmapStage(path, 3, id);
  path = restoreRoadmap(JSON.parse(JSON.stringify(path)));
  assert.ok(path);
  assert.equal(roadmapStageStatuses(path)[3].status, 'active');
  assert.equal(path.progress.filter(s => s.completed).length, 0);
  assert.equal(path.progress[0].courseId, null);
  assert.deepEqual(restoreRoadmap({ ...path, opened: [] }).progress, path.progress, 'out-of-order course links are valid without a prior unlock');
});

test('completed course work becomes a downloadable project, while drafts remain private to the lesson', () => {
  const saved = getStarterCourse('drawing-studio', 'en', 5);
  saved.answers[0] = JSON.stringify(practiceAnswer({ type: 'drawing' }, { strokes: [{ color: '#bc4b00', width: 2, points: [[10, 10], [80, 80]] }], explanation: 'A line.' }));
  assert.equal(learningProjects(saved), '');
  saved.completed = 1;
  const { document } = parseHTML(learningProjects(saved));
  assert.equal(document.querySelector('a').getAttribute('download'), 'mindora-task-1.svg');
  assert.ok(document.querySelector('.drawing-result svg'));
});
