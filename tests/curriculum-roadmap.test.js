import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { normalizeRoadmap, restoreRoadmap, restoreRoadmapArchive, roadmapStageStatuses, updateRoadmapStage } from '../core/roadmap-model.js';
import { roadmapView } from '../ui/roadmap.js';
import { setLanguage } from '../ui/language.js';

const id = index => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function course(counts = [4, 4, 4, 4, 4, 4]) {
  let next = 0;
  const modules = counts.map((count, index) => {
    const module = { title: `Module ${index + 1}`, outcome: `Complete project milestone ${index + 1}.`, startIndex: next, count };
    next += count;
    return module;
  });
  return {
    curriculumVersion: 2, goal: 'Learn Python', originalGoal: 'Python', minutes: 10, language: 'en',
    level: 'beginner', levelReason: 'Begin with supported examples.', title: 'Practical Python', outcome: 'Create a useful program step by step.',
    modules, stages: Array.from({ length: next }, (_, index) => ({ title: `Lesson ${index + 1}`, objective: `Apply skill ${index + 1} in a small original example.` })),
    sourceStatus: 'verified', sources: [{ title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/' }],
  };
}
function legacy() {
  const { curriculumVersion, modules, sources, sourceStatus, ...value } = course();
  return { ...value, stages: value.stages.slice(0, 4) };
}
const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;

test('full curricula preserve 24–48 lessons and source/module metadata through JSON restoration', () => {
  for (const counts of [[4, 4, 4, 4, 4, 4], [8, 8, 8, 8, 8, 8], [6, 6, 6, 6], [3, 3, 3, 3, 3, 3, 3, 3]]) {
    const raw = course(counts);
    const normalized = normalizeRoadmap(raw);
    assert.deepEqual(normalized, raw);
    const saved = restoreRoadmap(JSON.parse(JSON.stringify({ ...normalized, id: id(1000) })));
    assert.equal(saved.progress.length, raw.stages.length);
    assert.deepEqual(saved.modules, raw.modules);
    assert.deepEqual(saved.sources, raw.sources);
    assert.equal(saved.curriculumVersion, 2);
    assert.equal(roadmapStageStatuses(saved)[0].status, 'ready');
    assert.ok(roadmapStageStatuses(saved).slice(1).every(stage => stage.status === 'locked'));
  }
});

test('module validation rejects incomplete, overlapping, unordered or out-of-bound curricula', () => {
  for (const mutate of [
    value => { value.stages.pop(); },
    value => { value.stages = Array.from({ length: 49 }, (_, index) => ({ title: `L${index}`, objective: 'Learn a skill.' })); },
    value => { value.modules[0].startIndex = 1; },
    value => { value.modules[1].startIndex = 3; },
    value => { [value.modules[1], value.modules[2]] = [value.modules[2], value.modules[1]]; },
    value => { value.modules[5].count = 3; },
    value => { value.modules[0].count = 4.5; },
    value => { value.modules[0].title = 'x'.repeat(76); },
    value => { value.modules[0].outcome = 'x'.repeat(241); },
    value => { value.modules[1].title = value.modules[0].title; },
    value => { delete value.modules; },
    value => { delete value.curriculumVersion; },
    value => { value.curriculumVersion = 3; },
  ]) {
    const value = course(); mutate(value);
    assert.equal(normalizeRoadmap(value), null);
  }
  for (const counts of [[8, 8, 8], [3, 3, 3, 3, 3, 3, 3, 3, 3], [2, 4, 4, 4, 4, 6], [9, 3, 3, 3, 3, 3]]) assert.equal(normalizeRoadmap(course(counts)), null);
});

test('source evidence must be complete, safe, unique and consistent with its status', () => {
  const unavailable = { ...course(), sourceStatus: 'unavailable' };
  delete unavailable.sources;
  assert.deepEqual(normalizeRoadmap(unavailable).sources, []);
  assert.equal(normalizeRoadmap({ ...course(), sourceStatus: 'unavailable' }), null);
  assert.equal(normalizeRoadmap({ ...course(), sources: [] }), null);
  assert.equal(normalizeRoadmap({ ...course(), sourceStatus: undefined }), null);
  assert.equal(normalizeRoadmap({ ...course(), sources: [course().sources[0], course().sources[0]] }), null);
  assert.equal(normalizeRoadmap({ ...course(), sources: Array(4).fill(course().sources[0]) }), null);
  const sparse = [course().sources[0]]; sparse.length = 2;
  assert.equal(normalizeRoadmap({ ...course(), sources: sparse }), null);
  for (const url of ['http://example.org/course', 'javascript:alert(1)', 'https://127.0.0.1/course', 'https://user:password@example.org/course']) {
    assert.equal(normalizeRoadmap({ ...course(), sources: [{ title: 'Guide', url }] }), null);
  }
  assert.equal(normalizeRoadmap({ ...course(), sources: [{ title: '', url: course().sources[0].url }] }), null);
  assert.equal(normalizeRoadmap({ ...course(), sources: [{ title: 'x'.repeat(161), url: course().sources[0].url }] }), null);
});

test('lesson progression works beyond the fourth lesson without allowing skips or duplicate saved lessons', () => {
  let saved = restoreRoadmap({ ...course(), id: id(1000) });
  for (let index = 0; index < 9; index++) {
    assert.equal(roadmapStageStatuses(saved)[index].status, 'ready');
    saved = updateRoadmapStage(saved, index, id(index + 1));
    assert.equal(roadmapStageStatuses(saved)[index].status, 'active');
    saved = updateRoadmapStage(saved, index, id(index + 1), true);
  }
  saved = restoreRoadmap(JSON.parse(JSON.stringify(saved)));
  assert.ok(saved.progress.slice(0, 9).every(stage => stage.completed));
  assert.equal(roadmapStageStatuses(saved)[9].status, 'ready');
  assert.equal(updateRoadmapStage(saved, 10, id(20)), saved);
  assert.equal(updateRoadmapStage(saved, 9, id(1)), saved);
  assert.equal(restoreRoadmap({ ...saved, progress: saved.progress.slice(0, 4) }), null);
  const skipped = structuredClone(saved); skipped.progress[10] = { courseId: id(11), completed: false };
  assert.equal(restoreRoadmap(skipped), null);
  const duplicated = structuredClone(saved); duplicated.progress[1].courseId = id(1);
  assert.equal(restoreRoadmap(duplicated), null);
});

test('legacy four-lesson paths keep their original schema and coexist with full curricula', () => {
  const old = legacy();
  assert.deepEqual(normalizeRoadmap(old), old);
  assert.equal(restoreRoadmap(old).progress.length, 4);
  assert.equal(normalizeRoadmap({ ...old, stages: old.stages.slice(0, 3) }), null);
  const current = restoreRoadmap({ ...course(), id: id(1000) });
  const archive = restoreRoadmapArchive([{ ...old, id: id(1001) }], current);
  assert.equal(archive.length, 1);
  assert.equal(archive[0].stages.length, 4);
  assert.equal(archive[0].curriculumVersion, undefined);
  const doc = documentFor(roadmapView({ roadmap: restoreRoadmap(old) }));
  assert.equal(doc.querySelectorAll('[data-roadmap-stage]').length, 4);
  assert.equal(doc.querySelector('[data-roadmap-module]'), null);
});

test('syllabus groups global lesson indexes, opens the current module and shows the full course scale', () => {
  let saved = restoreRoadmap(course());
  for (let index = 0; index < 8; index++) saved = updateRoadmapStage(saved, index, id(index + 1), true);
  const doc = documentFor(roadmapView({ roadmap: saved, active: roadmapStageStatuses(saved) }));
  const modules = [...doc.querySelectorAll('[data-roadmap-module]')];
  assert.equal(modules.length, 6);
  assert.deepEqual(modules.filter(module => module.hasAttribute('open')).map(module => module.dataset.roadmapModule), ['2']);
  assert.deepEqual([...doc.querySelectorAll('[data-roadmap-stage]')].map(button => Number(button.dataset.roadmapStage)), Array.from({ length: 24 }, (_, index) => index));
  assert.equal(doc.querySelector('[data-roadmap-stage="8"]').hasAttribute('disabled'), false);
  assert.equal(doc.querySelector('[data-roadmap-stage="9"]').hasAttribute('disabled'), true);
  assert.equal(doc.querySelectorAll('.roadmap-stage-connector').length, 18);
  assert.match(doc.querySelector('.roadmap-course-scale').textContent, /24 daily lessons/);
  assert.match(doc.querySelector('.roadmap-course-scale').textContent, /10 min a day/);
  assert.match(doc.querySelector('.roadmap-course-scale').textContent, /4 weeks/);
  const source = doc.querySelector('.roadmap-sources a');
  assert.equal(source.getAttribute('href'), course().sources[0].url);
  assert.equal(source.getAttribute('rel'), 'noopener noreferrer');
});

test('course provenance notices remain visible and generated headings are escaped', () => {
  const raw = { ...course(), title: '<img src=x onerror=alert(1)>', sourceStatus: 'unavailable', sources: [] };
  raw.modules[0].title = '<script>alert(1)</script>';
  const doc = documentFor(roadmapView({ roadmap: restoreRoadmap(raw) }));
  assert.equal(doc.querySelector('script, img[onerror], [onerror]'), null);
  const notice = doc.querySelector('.roadmap-source-notice');
  assert.ok(notice);
  assert.equal(notice.closest('details'), null);
  assert.equal(doc.querySelector('.roadmap-sources a'), null);
});

test('course scope labels support all interface languages', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    for (const [language, phrase] of [['en', '10 min a day'], ['ru', '10 мин в день'], ['kk', 'Күніне 10 минут']]) {
      setLanguage(language);
      const doc = documentFor(roadmapView({ roadmap: restoreRoadmap(course()) }));
      assert.ok(doc.querySelector('.roadmap-course-scale').textContent.includes(phrase));
    }
  } finally {
    setLanguage('en');
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});
