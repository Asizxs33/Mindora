import { planInput, sourceUrl } from './learning-plan.js';

export const ROADMAP_STAGE_COUNT = 4;
export const ROADMAP_CURRICULUM_LIMITS = Object.freeze({
  minStages: 24, maxStages: 48, minModules: 4, maxModules: 8,
  minModuleLessons: 3, maxModuleLessons: 8, maxSources: 3,
});
export const ROADMAP_LIBRARY_LIMIT = 16;
export const ROADMAP_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);
export const ROADMAP_STAGE_KINDS = Object.freeze(['lesson', 'practice', 'review', 'mini-project']);
export const ROADMAP_LIMITS = Object.freeze({
  goal: 180, evidence: 360, title: 90, outcome: 300,
  stageTitle: 75, objective: 240, levelReason: 220, diagnosticQuestion: 320, diagnosticAnswer: 600,
});

const boundedString = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000\u000b\u000c\u007f]/u.test(value);
const text = (value, max) => boundedString(value, max) ? value.trim() || null : null;

// Old saved paths have no kind. Infer only from the lesson's own title, never
// from its topic or objective, so an incidental project example stays a lesson.
export function roadmapStageKind(stage) {
  if (ROADMAP_STAGE_KINDS.includes(stage?.kind)) return stage.kind;
  const title = typeof stage?.title === 'string' ? stage.title : '';
  if ((!/\bproject\s+(?:management|planning)\b|проектирован/iu.test(title)
    && /\bproject\b|(?:^|[^\p{L}])(?:проект|итог)\p{L}*|(?:^|[^\p{L}])жоба(?:$|[^\p{L}])/iu.test(title))) return 'mini-project';
  if (/\breview\b|(?:^|[^\p{L}])(?:повтор|самопров)\p{L}*|(?:^|[^\p{L}])қайталау(?:$|[^\p{L}])/iu.test(title)) return 'review';
  if (/\bpractice\b|(?:^|[^\p{L}])(?:практик|примен)\p{L}*|(?:^|[^\p{L}])жаттығу(?:$|[^\p{L}])/iu.test(title)) return 'practice';
  return 'lesson';
}

export function clarificationInput(raw) {
  const input = planInput(raw?.goal, raw?.minutes, raw?.language);
  return input && text(input.goal, ROADMAP_LIMITS.goal) ? input : null;
}

export function normalizeClarification(raw) {
  const question = text(raw?.question, 180);
  if (!question || !Array.isArray(raw?.directions) || raw.directions.length !== 3) return null;
  const directions = raw.directions.map(direction => ({
    title: text(direction?.title, 80),
    goal: text(direction?.goal, ROADMAP_LIMITS.goal),
    diagnosticQuestion: text(direction?.diagnosticQuestion, ROADMAP_LIMITS.diagnosticQuestion),
  }));
  if (directions.some(direction => !direction.title || !direction.goal || !direction.diagnosticQuestion)
    || new Set(directions.map(direction => direction.goal.toLowerCase())).size !== 3) return null;
  return { question, directions };
}

export function roadmapInput(raw) {
  const plan = planInput(raw?.goal, raw?.minutes, raw?.language);
  if (!plan || !text(plan.goal, ROADMAP_LIMITS.goal)
    || !['new', 'some', 'comfortable'].includes(raw.experience)
    || !['work', 'personal', 'career', 'curiosity'].includes(raw.motivation)) return null;
  const evidence = raw.evidence === undefined ? '' : raw.evidence;
  if (!boundedString(evidence, ROADMAP_LIMITS.evidence)) return null;
  const diagnostic = {};
  if (raw.diagnosticQuestion !== undefined || raw.diagnosticAnswer !== undefined) {
    diagnostic.diagnosticQuestion = text(raw.diagnosticQuestion, ROADMAP_LIMITS.diagnosticQuestion);
    diagnostic.diagnosticAnswer = text(raw.diagnosticAnswer, ROADMAP_LIMITS.diagnosticAnswer);
    if (!diagnostic.diagnosticQuestion || !diagnostic.diagnosticAnswer) return null;
  }
  if (raw.originalGoal !== undefined) {
    diagnostic.originalGoal = text(raw.originalGoal, ROADMAP_LIMITS.goal);
    if (!diagnostic.originalGoal) return null;
  }
  return { ...plan, experience: raw.experience, motivation: raw.motivation, evidence: evidence.trim(), ...diagnostic };
}

export function normalizeRoadmap(raw, input = raw) {
  const context = planInput(input?.goal, input?.minutes, input?.language);
  const curriculum = raw?.curriculumVersion === 2;
  const bounds = ROADMAP_CURRICULUM_LIMITS;
  if (!context || !text(context.goal, ROADMAP_LIMITS.goal) || !ROADMAP_LEVELS.includes(raw?.level)
    || (raw.curriculumVersion !== undefined && !curriculum)
    || !Array.isArray(raw.stages) || (curriculum
      ? raw.stages.length < bounds.minStages || raw.stages.length > bounds.maxStages
      : raw.stages.length !== ROADMAP_STAGE_COUNT)) return null;
  if (input.originalGoal !== undefined) {
    const originalGoal = text(input.originalGoal, ROADMAP_LIMITS.goal);
    if (!originalGoal) return null;
    context.originalGoal = originalGoal;
  }
  const title = text(raw.title, ROADMAP_LIMITS.title);
  const outcome = text(raw.outcome, ROADMAP_LIMITS.outcome);
  const levelReason = text(raw.levelReason, ROADMAP_LIMITS.levelReason);
  if (!title || !outcome || !levelReason) return null;
  const stages = Array.from(raw.stages, stage => ({
    title: text(stage?.title, ROADMAP_LIMITS.stageTitle),
    objective: text(stage?.objective, ROADMAP_LIMITS.objective),
    ...(stage?.kind !== undefined ? { kind: stage.kind } : {}),
  }));
  if (stages.some(stage => !stage.title || !stage.objective || (stage.kind !== undefined && !ROADMAP_STAGE_KINDS.includes(stage.kind)))
    || new Set(stages.map(stage => stage.title.toLocaleLowerCase(context.language))).size !== stages.length) return null;
  let syllabus = {};
  if (curriculum) {
    if (!Array.isArray(raw.modules) || raw.modules.length < bounds.minModules || raw.modules.length > bounds.maxModules
      || !['verified', 'unavailable'].includes(raw.sourceStatus)) return null;
    const modules = [];
    let nextIndex = 0;
    for (const module of raw.modules) {
      const title = text(module?.title, ROADMAP_LIMITS.stageTitle);
      const outcome = text(module?.outcome, ROADMAP_LIMITS.objective);
      if (!title || !outcome || !Number.isInteger(module.startIndex) || module.startIndex !== nextIndex
        || !Number.isInteger(module.count) || module.count < bounds.minModuleLessons || module.count > bounds.maxModuleLessons) return null;
      modules.push({ title, outcome, startIndex: nextIndex, count: module.count });
      nextIndex += module.count;
    }
    if (nextIndex !== stages.length || new Set(modules.map(module => module.title.toLocaleLowerCase(context.language))).size !== modules.length) return null;
    const rawSources = raw.sources === undefined ? [] : raw.sources;
    if (!Array.isArray(rawSources) || rawSources.length > bounds.maxSources) return null;
    const sources = Array.from(rawSources, source => ({ title: text(source?.title, 160), url: sourceUrl(source?.url) }));
    if (sources.some(source => !source.title || !source.url) || new Set(sources.map(source => source.url)).size !== sources.length
      || (raw.sourceStatus === 'verified' ? sources.length === 0 : sources.length !== 0)) return null;
    syllabus = { curriculumVersion: 2, modules, sourceStatus: raw.sourceStatus, sources };
  } else if (raw.modules !== undefined || raw.sources !== undefined || raw.sourceStatus !== undefined) return null;
  return { ...context, ...syllabus, level: raw.level, levelReason, title, outcome, stages };
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
  if (saved !== undefined && (!Array.isArray(saved) || saved.length !== roadmap.stages.length)) return null;
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
