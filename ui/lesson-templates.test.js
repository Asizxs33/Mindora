import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { templateExamples } from './template-examples.js';
import { LESSON_TEMPLATES, normalizeLessonTemplate, renderLessonTemplate, checkTemplate, canCheckTemplate, mountLessonTemplate, mentorForTopic } from './lesson-templates.js';

test('ten topic-independent templates have valid examples, full mentor slots and escaped content', () => {
  assert.equal(Object.keys(LESSON_TEMPLATES).length, 10);
  assert.equal(new Set(templateExamples.map(b => b.type)).size, 10);
  for (const example of templateExamples) {
    assert.ok(normalizeLessonTemplate(example), example.type);
    const { document } = parseHTML(renderLessonTemplate({ ...example, title: '<script>alert(1)</script>', intro: '<img src=x onerror=alert(1)>' }));
    assert.ok(document.querySelector(`[data-lesson-template="${example.type}"]`));
    assert.ok(document.querySelector('[data-character-kind]'));
    assert.equal(document.querySelector('script, [onerror]'), null);
    assert.ok(document.querySelector('.mentor-dialogue h3').textContent.includes('<script>'));
  }
});

test('structured content rejects unsafe media, ambiguous answers and incomplete exercises', () => {
  assert.equal(normalizeLessonTemplate({ ...templateExamples[1], image: { url: 'javascript:alert(1)', alt: 'bad' } }), null);
  assert.equal(normalizeLessonTemplate({ ...templateExamples[3], answer: 3 }), null);
  assert.equal(normalizeLessonTemplate({ ...templateExamples[4], answers: [0, 0] }), null);
  assert.equal(normalizeLessonTemplate({ ...templateExamples[5], answer: [0, 1] }), null);
  assert.equal(normalizeLessonTemplate({ ...templateExamples[6], pairs: [{ left: 'A', right: 'X' }, { left: 'B', right: 'X' }] }), null);
  assert.equal(normalizeLessonTemplate({ type: 'unknown', title: 'Hello' }), null);
  assert.equal(normalizeLessonTemplate({ ...templateExamples[8], criterion: '' }), null);
});

test('checks reject empty or wrong answers and accept each supported assessment', () => {
  const [,,,choice, multi, order, match, gap, practice] = templateExamples;
  assert.equal(canCheckTemplate(choice, {}), false);
  assert.equal(checkTemplate(choice, { choice: 0 }).correct, false);
  assert.equal(checkTemplate(choice, { choice: 1 }).correct, true);
  assert.equal(checkTemplate(multi, { selected: [0] }).correct, false);
  assert.equal(checkTemplate(multi, { selected: [2, 0] }).correct, true);
  assert.equal(checkTemplate(order, {}).correct, false);
  assert.equal(checkTemplate(order, { order: [1, 2, 0] }).correct, true);
  assert.equal(canCheckTemplate(match, { matches: { 0: 0 } }), false);
  assert.equal(checkTemplate(match, { matches: { 0: 0, 1: 1, 2: 2 } }).correct, true);
  assert.equal(checkTemplate(gap, { value: '  ON  ' }).correct, true);
  assert.equal(checkTemplate(gap, { value: 'in' }).correct, false);
  assert.deepEqual(checkTemplate(practice, { value: 'My own result' }), { checked: true, correct: null });
});

test('presenter handles selection, feedback, answer emission and disposal without granting progress', () => {
  const { document, window } = parseHTML('<html><body><main></main></body></html>');
  const host = document.querySelector('main');
  const changes = [];
  const dispose = mountLessonTemplate(host, templateExamples[3], { onChange: state => changes.push(state) });
  host.querySelector('[data-template-choice="1"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(changes.at(-1).choice, 1);
  host.querySelector('[data-template-check]').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(changes.at(-1).correct, true);
  assert.ok(host.querySelector('[role="status"]'));
  assert.equal(host.querySelector('[data-template-choice="0"]').hasAttribute('disabled'), true);
  const count = changes.length;
  dispose();
  host.querySelector('[data-template-check]').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(changes.length, count);
});

test('mentor selection follows subject and uses Mino for unfamiliar topics', () => {
  assert.equal(mentorForTopic('JavaScript programming'), 'sam');
  assert.equal(mentorForTopic('English grammar'), 'copywriter');
  assert.equal(mentorForTopic('Poster design'), 'mia');
  assert.equal(mentorForTopic('Something completely new'), 'mino');
});
