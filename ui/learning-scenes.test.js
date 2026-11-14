import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { normalizeLearningScene, renderLearningScene, sceneForTopic } from './learning-scenes.js';
import { learningSceneExamples } from './learning-scene-examples.js';
import { normalizeLessonTemplate, renderLessonTemplate } from './lesson-templates.js';

test('five scene objects validate and render their actual lesson content', () => {
  for (const { scene } of learningSceneExamples) {
    assert.ok(normalizeLearningScene(scene), scene.type);
    const { document } = parseHTML(renderLearningScene(scene));
    assert.equal(document.querySelector('[data-learning-scene]').dataset.learningScene, scene.type);
    assert.equal(document.querySelector('[role="group"]').getAttribute('aria-label'), scene.title);
  }
  const html = renderLearningScene(learningSceneExamples[2].scene);
  assert.match(html, /<table>/); assert.match(html, /197/);
});

test('unsafe or malformed scene data never becomes executable markup', () => {
  assert.equal(normalizeLearningScene({ type: 'iframe', title: 'Bad' }), null);
  assert.equal(normalizeLearningScene({ type: 'spreadsheet', title: 'Bad', columns: ['A', 'B'], rows: [['one']] }), null);
  const html = renderLearningScene({ type: 'monitor', title: '<img src=x>', lines: ['<script>alert(1)</script>'], style: 'background:url(https://evil.invalid)' });
  const { document } = parseHTML(html);
  assert.equal(document.querySelector('script,img,[style]'), null);
  assert.ok(document.querySelector('code').textContent.includes('<script>'));
});

test('illustration blocks accept exactly one image or structured scene', () => {
  const block = { type: 'illustration', title: 'A greeting', body: 'Read the result.', scene: learningSceneExamples[0].scene };
  assert.ok(normalizeLessonTemplate(block));
  assert.match(renderLessonTemplate(block), /data-learning-scene="monitor"/);
  assert.equal(normalizeLessonTemplate({ ...block, image: { url: '/ui/assets/a.png', alt: 'A' } }), null);
  assert.equal(sceneForTopic('Python programming'), 'monitor');
  assert.equal(sceneForTopic('Spreadsheet budget'), 'spreadsheet');
  assert.equal(sceneForTopic('An unrelated topic'), 'comparison');
});
