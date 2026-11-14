import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { ROADMAP_STAGE_KINDS, normalizeRoadmap, restoreRoadmap, roadmapStageKind, roadmapStageStatuses, updateRoadmapStage } from '../core/roadmap-model.js';
import { roadmapView } from '../ui/roadmap.js';
import { icon } from '../ui/icons.js';
import { setLanguage } from '../ui/language.js';

const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;
const id = index => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function course() {
  return {
    curriculumVersion: 2, goal: 'Learn practical Python', minutes: 10, language: 'en',
    level: 'beginner', levelReason: 'Start with supported examples.', title: 'Python step by step', outcome: 'Build a small useful program.',
    modules: Array.from({ length: 6 }, (_, index) => ({ title: `Goal ${index + 1}`, outcome: `Apply skill group ${index + 1}.`, startIndex: index * 4, count: 4 })),
    stages: Array.from({ length: 24 }, (_, index) => ({ title: `Step ${index + 1}`, objective: `Produce and explain result ${index + 1}.`, kind: ROADMAP_STAGE_KINDS[index % 4] })),
    sourceStatus: 'unavailable', sources: [],
  };
}

test('stage kinds survive normalization and saved progress restoration as optional exact enum values', () => {
  const raw = course();
  assert.deepEqual(normalizeRoadmap(raw), raw);
  const saved = restoreRoadmap(JSON.parse(JSON.stringify({ ...raw, id: id(1000) })));
  assert.deepEqual(saved.stages.map(stage => stage.kind), raw.stages.map(stage => stage.kind));
  for (const kind of [null, '', 'Practice', ' practice', 'quiz', 'chest', [], {}, 1, '<img src=x>']) {
    const invalid = course(); invalid.stages[8].kind = kind;
    assert.equal(normalizeRoadmap(invalid), null);
    assert.equal(restoreRoadmap(invalid), null);
  }
  const missing = course();
  missing.stages.forEach(stage => { delete stage.kind; });
  assert.deepEqual(normalizeRoadmap(missing), missing);
  assert.ok(restoreRoadmap(missing).stages.every(stage => !Object.hasOwn(stage, 'kind')));
});

test('legacy type inference uses only clear title clues and explicit kinds always win', () => {
  for (const [title, expected] of [
    ['Python basics', 'lesson'], ['Project management basics', 'lesson'], ['Проектирование функций', 'lesson'],
    ['Build your first project', 'mini-project'], ['Итоговая работа', 'mini-project'], ['Мини-проект: календарь', 'mini-project'], ['Шағын жоба', 'mini-project'],
    ['Review the basics', 'review'], ['Повторение: знакомство', 'review'], ['Самопроверка знаний', 'review'], ['Қайталау', 'review'],
    ['Practice writing', 'practice'], ['Практика: цвета', 'practice'], ['Применяем формулы', 'practice'], ['Жаттығу', 'practice'],
  ]) assert.equal(roadmapStageKind({ title }), expected, title);
  assert.equal(roadmapStageKind({ title: 'Final project', kind: 'lesson' }), 'lesson');
  assert.equal(roadmapStageKind({ title: 'Basics', objective: 'Review a project and practice.' }), 'lesson');
  assert.equal(roadmapStageKind(null), 'lesson');
  const { curriculumVersion, modules, sourceStatus, sources, ...legacy } = course();
  legacy.stages = legacy.stages.slice(0, 4).map(({ kind, ...stage }) => stage);
  assert.deepEqual(normalizeRoadmap(legacy), legacy);
});

test('every path point retains its type icon while lock, play and completion are separate badges', () => {
  let saved = restoreRoadmap(course());
  saved = updateRoadmapStage(saved, 0, id(1), true);
  saved = updateRoadmapStage(saved, 1, id(2));
  const doc = documentFor(roadmapView({ roadmap: saved, active: roadmapStageStatuses(saved) }));
  const rows = [...doc.querySelectorAll('.roadmap-stage')];
  assert.equal(rows.length, 24);
  assert.equal(doc.querySelectorAll('.roadmap-stage-node').length, 24);
  const svgFor = symbol => documentFor(icon(symbol, 34)).querySelector('svg').innerHTML;
  for (const [index, kindIcon, badge, disabled] of [[0, 'book', 'check', false], [1, 'edit', 'play', false], [2, 'target', 'lock', true], [3, 'work', 'lock', true], [23, 'trophy', 'lock', true]]) {
    const row = rows[index];
    assert.equal(row.dataset.roadmapKind, saved.stages[index].kind);
    assert.equal(row.querySelector('.roadmap-stage-kind-icon svg').innerHTML, svgFor(kindIcon));
    assert.equal(row.querySelector('.roadmap-stage-status svg').innerHTML, svgFor(badge));
    assert.equal(row.querySelector('button').hasAttribute('disabled'), disabled);
    assert.equal(row.querySelector('button').dataset.roadmapAction, 'start');
    assert.equal(Number(row.querySelector('button').dataset.roadmapStage), index);
    assert.equal(row.querySelector('.roadmap-stage-status').getAttribute('aria-hidden'), 'true');
  }
  assert.equal(rows[1].getAttribute('aria-current'), 'step');
  assert.match(rows[2].querySelector('button').getAttribute('aria-label'), /^Review\. Locked:/);
  const busy = documentFor(roadmapView({ roadmap: saved, active: roadmapStageStatuses(saved), busy: 'stage' }));
  assert.ok([...busy.querySelectorAll('.roadmap-stage-node')].every(button => button.hasAttribute('disabled')));
});

test('type captions are localized in all three supported interface languages', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    for (const [language, labels] of [
      ['en', ['Lesson', 'Practice', 'Review', 'Mini-project']],
      ['ru', ['Урок', 'Практика', 'Повторение', 'Мини-проект']],
      ['kk', ['Сабақ', 'Жаттығу', 'Қайталау', 'Шағын жоба']],
    ]) {
      setLanguage(language);
      const doc = documentFor(roadmapView({ roadmap: restoreRoadmap(course()) }));
      assert.deepEqual([...doc.querySelectorAll('.roadmap-stage-kind-label')].slice(0, 4).map(node => node.textContent), labels);
    }
  } finally {
    setLanguage('en');
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});
