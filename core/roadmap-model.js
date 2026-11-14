import { planInput } from './learning-plan.js';

export const ROADMAP_STAGE_COUNT = 4;
export const ROADMAP_LIBRARY_LIMIT = 16;
export const ROADMAP_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);
export const ROADMAP_LIMITS = Object.freeze({
  goal: 180, evidence: 360, title: 90, outcome: 300,
  stageTitle: 75, objective: 240, levelReason: 220,
});

const boundedString = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000\u000b\u000c\u007f]/u.test(value);
const text = (value, max) => boundedString(value, max) ? value.trim() || null : null;

export function roadmapInput(raw) {
  const plan = planInput(raw?.goal, raw?.minutes, raw?.language);
  if (!plan || !text(plan.goal, ROADMAP_LIMITS.goal)
    || !['new', 'some', 'comfortable'].includes(raw.experience)
    || !['work', 'personal', 'career', 'curiosity'].includes(raw.motivation)) return null;
  const evidence = raw.evidence === undefined ? '' : raw.evidence;
  if (!boundedString(evidence, ROADMAP_LIMITS.evidence)) return null;
  return { ...plan, experience: raw.experience, motivation: raw.motivation, evidence: evidence.trim() };
}

export function normalizeRoadmap(raw, input = raw) {
  const context = planInput(input?.goal, input?.minutes, input?.language);
  if (!context || !text(context.goal, ROADMAP_LIMITS.goal) || !ROADMAP_LEVELS.includes(raw?.level)
    || !Array.isArray(raw.stages) || raw.stages.length !== ROADMAP_STAGE_COUNT) return null;
  const title = text(raw.title, ROADMAP_LIMITS.title);
  const outcome = text(raw.outcome, ROADMAP_LIMITS.outcome);
  const levelReason = text(raw.levelReason, ROADMAP_LIMITS.levelReason);
  if (!title || !outcome || !levelReason) return null;
  const stages = Array.from(raw.stages, stage => ({
    title: text(stage?.title, ROADMAP_LIMITS.stageTitle),
    objective: text(stage?.objective, ROADMAP_LIMITS.objective),
  }));
  if (stages.some(stage => !stage.title || !stage.objective)
    || new Set(stages.map(stage => stage.title.toLocaleLowerCase(context.language))).size !== ROADMAP_STAGE_COUNT) return null;
  return { ...context, level: raw.level, levelReason, title, outcome, stages };
}

export function roadmapCourseId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function restoreRoadmap(raw) {
  const roadmap = normalizeRoadmap(raw);
  if (!roadmap) return null;
  const id = roadmapCourseId(raw.id);
  if (raw.id !== undefined && !id) return null;
  const saved = raw.progress;
  const progress = [];
  const ids = new Set();
  let locked = false;
  if (saved !== undefined && (!Array.isArray(saved) || saved.length !== ROADMAP_STAGE_COUNT)) return null;
  for (const index of roadmap.stages.keys()) {
    const entry = saved === undefined ? { courseId: null, completed: false } : saved[index];
    const courseId = roadmapCourseId(entry?.courseId);
    if (typeof entry?.completed !== 'boolean' || (entry.courseId !== null && !courseId)
      || (entry.completed && !courseId) || (locked && courseId) || (courseId && ids.has(courseId))) return null;
    if (courseId) ids.add(courseId);
    progress.push({ courseId, completed: entry.completed });
    if (!entry.completed) locked = true;
  }
  return { ...roadmap, ...(id ? { id } : {}), progress };
}

export function restoreRoadmapArchive(raw, active) {
  if (!Array.isArray(raw) || raw.length >= ROADMAP_LIBRARY_LIMIT) return null;
  const ids = new Set(active?.id ? [active.id] : []);
  const courseIds = new Set(active?.progress.flatMap(stage => stage.courseId ? [stage.courseId] : []) ?? []);
  const archive = [];
  for (const entry of raw) {
    const roadmap = restoreRoadmap(entry);
    if (!roadmap?.id || ids.has(roadmap.id)) return null;
    ids.add(roadmap.id);
    for (const { courseId } of roadmap.progress) {
      if (!courseId) continue;
      if (courseIds.has(courseId)) return null;
      courseIds.add(courseId);
    }
    archive.push(roadmap);
  }
  return archive;
}

export function roadmapStageStatuses(roadmap) {
  const progress = roadmap?.progress ?? [];
  const next = progress.findIndex(stage => !stage.completed);
  return progress.map((stage, index) => ({
    courseId: stage.courseId,
    status: stage.completed ? 'completed' : index !== next ? 'locked' : stage.courseId ? 'active' : 'ready',
  }));
}

export function updateRoadmapStage(roadmap, index, value, completed = false) {
  const courseId = roadmapCourseId(value);
  const current = roadmap?.progress?.[index];
  if (!courseId || !Number.isInteger(index) || !current || current.completed
    || roadmap.progress.findIndex(stage => !stage.completed) !== index
    || roadmap.progress.some((stage, position) => position !== index && stage.courseId === courseId)
    || (current.courseId && current.courseId !== courseId)) return roadmap;
  const progress = roadmap.progress.map((stage, position) => position === index
    ? { courseId, completed: completed === true } : stage);
  return { ...roadmap, progress };
}
