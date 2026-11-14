import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreRoadmap, restoreRoadmapArchive, updateRoadmapStage } from '../core/roadmap-model.js';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';

const id = index => `12345678-1234-4000-8000-${String(index).padStart(12, '0')}`;
const roadmap = (goal, roadmapId) => restoreRoadmap({
  goal, minutes: 10, language: 'en', level: 'beginner', levelReason: 'Start with one example.',
  title: goal, outcome: 'Apply the skill without hints.',
  stages: ['Try the basics', 'Check your result', 'Practice variation', 'Apply independently']
    .map(title => ({ title, objective: 'Build on the previous stage.' })),
  ...(roadmapId ? { id: roadmapId } : {}),
});

test('legacy maps and several separate course paths retain their own progress in a saved workspace', () => {
  const legacy = roadmap('Learn SUMIF');
  const current = roadmap('Learn Python', id(2));
  const prior = updateRoadmapStage({ ...legacy, id: id(1) }, 0, id(4), true);
  assert.equal(legacy.id, undefined);
  assert.deepEqual(validateBuiltinWorkspace({ learningRoadmap: legacy }).learningRoadmap, legacy);
  const workspace = validateBuiltinWorkspace({ learningRoadmap: current, learningRoadmaps: [prior] });
  assert.deepEqual(workspace.learningRoadmap, current);
  assert.deepEqual(workspace.learningRoadmaps, [prior]);
  assert.equal(workspace.learningRoadmap.progress[0].courseId, null);
  assert.equal(workspace.learningRoadmaps[0].progress[0].courseId, id(4));
});

test('one lesson or path ID cannot be assigned to two saved paths', () => {
  const current = updateRoadmapStage(roadmap('Learn SUMIF', id(1)), 0, id(4));
  assert.equal(restoreRoadmapArchive([roadmap('Learn Python', id(1))], current), null);
  assert.equal(restoreRoadmapArchive([updateRoadmapStage(roadmap('Learn Python', id(2)), 0, id(4))], current), null);
});
