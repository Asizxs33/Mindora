import { randomUUID } from 'node:crypto';
import { planInput, restorePlan } from '../core/learning-plan.js';
import { ROADMAP_LEVELS, ROADMAP_LIMITS } from '../core/roadmap-model.js';
import { accountSession, allowedOrigin, cloudSettings, json, matchesLearningAccount, readBody } from './cloud-api.js';
import { generateDeepSeekPlan } from './deepseek-plan.js';
import { learningCourseStore } from './learning-course-store.js';

function roadmapStageInput(raw) {
  if (!raw || !ROADMAP_LEVELS.includes(raw.level)) return null;
  const stage = { level: raw.level };
  for (const [field, bound] of [['goal', 'goal'], ['title', 'stageTitle'], ['objective', 'objective'], ['levelReason', 'levelReason']]) {
    if (typeof raw[field] !== 'string' || raw[field].length > ROADMAP_LIMITS[bound]) return null;
    const value = raw[field].trim();
    if (!value || /[\u0000\u000b\u000c\u007f]/u.test(value)) return null;
    stage[field] = value;
  }
  if (raw.previousStages !== undefined) {
    if (!Array.isArray(raw.previousStages) || raw.previousStages.length > 3) return null;
    const previousStages = raw.previousStages.map(previous => {
      if (!previous || typeof previous.title !== 'string' || typeof previous.objective !== 'string') return null;
      const title = previous.title.trim(), objective = previous.objective.trim();
      return title && objective && title.length <= ROADMAP_LIMITS.stageTitle && objective.length <= ROADMAP_LIMITS.objective
        && !/[\u0000\u000b\u000c\u007f]/u.test(title + objective) ? { title, objective } : null;
    });
    if (previousStages.some(previous => !previous)) return null;
    stage.previousStages = previousStages;
  }
  return stage;
}

export async function planApi(request, {
  apiKey = process.env.DEEPSEEK_API_KEY,
  settings = cloudSettings(),
  session = accountSession,
  generate = generateDeepSeekPlan,
  store = learningCourseStore,
  createId = randomUUID,
} = {}) {
  if (request.method !== 'POST') return json({ error: 'Метод недоступен.' }, 405);
  if (!allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  if (!settings) return json({ error: 'Генерация пути пока недоступна.' }, 503);
  let cookies = [];
  try {
    const current = await session(request, settings);
    cookies = current.cookies;
    if (!current.user) return json({ error: 'Войди в аккаунт Mindora.', code: 'UNAUTHORIZED' }, 401, cookies);
    if (!matchesLearningAccount(request, current.user)) return json({ error: 'Аккаунт изменился. Войди снова.', code: 'ACCOUNT_CHANGED' }, 401, cookies);
    const body = await readBody(request);
    const input = planInput(body?.goal, body?.minutes, body?.language);
    if (!input) return json({ error: 'Напиши цель от 3 до 180 символов и выбери 5, 10 или 20 минут.' }, 400, cookies);
    if (body.roadmapStage !== undefined) {
      const stage = roadmapStageInput(body.roadmapStage);
      if (!stage) return json({ error: 'Не удалось открыть этот этап пути.', code: 'INVALID_ROADMAP_STAGE' }, 400, cookies);
      input.roadmapStage = stage;
    }
    if (!apiKey) return json({ error: 'Генерация пути пока недоступна.' }, 503, cookies);
    const plan = await generate(input, apiKey);
    const saved = restorePlan({ plan });
    if (!saved) throw new Error('Invalid generated course');
    const course = await store(settings.databaseUrl).create(current.user.id, createId(), saved);
    return json({ plan: course.saved.plan, course }, 200, cookies);
  } catch (error) {
    console.warn('Mindora plan generation failed', error.name, Number(error.providerStatus) || '');
    if (error.providerStatus === 429) return json({ error: 'DeepSeek занят. Попробуй немного позже.' }, 429, cookies);
    return json({ error: 'Не удалось получить и сохранить путь с материалами. Попробуй ещё раз или уточни цель.' }, 502, cookies);
  }
}
