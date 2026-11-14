import { randomUUID } from 'node:crypto';
import { planInput, restorePlan } from '../core/learning-plan.js';
import { accountSession, allowedOrigin, cloudSettings, json, matchesLearningAccount, readBody } from './cloud-api.js';
import { generateDeepSeekPlan } from './deepseek-plan.js';
import { learningCourseStore } from './learning-course-store.js';

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
