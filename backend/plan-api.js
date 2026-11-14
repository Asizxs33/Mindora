import { planInput } from '../core/learning-plan.js';
import { allowedOrigin, json, readBody } from './cloud-api.js';
import { generateDeepSeekPlan } from './deepseek-plan.js';
import { reserveGeneration } from './plan-quota.js';

export async function planApi(request, {
  apiKey = process.env.DEEPSEEK_API_KEY,
  databaseUrl = process.env.DATABASE_URL,
  reserve = reserveGeneration,
  generate = generateDeepSeekPlan,
} = {}) {
  if (request.method !== 'POST') return json({ error: 'Метод недоступен.' }, 405);
  if (!allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  const body = await readBody(request);
  const input = planInput(body?.goal, body?.minutes);
  if (!input) return json({ error: 'Напиши цель от 3 до 180 символов и выбери 5, 10 или 20 минут.' }, 400);
  if (!apiKey || !databaseUrl) return json({ error: 'Генерация пути пока недоступна. Можно начать с готового курса.' }, 503);

  try {
    if (!await reserve(request, databaseUrl, apiKey)) {
      return json({ error: 'Лимит новых маршрутов на сегодня исчерпан. Попробуй завтра или продолжи сохранённый путь.' }, 429);
    }
    return json({ plan: await generate(input, apiKey) });
  } catch (error) {
    console.warn('Mindora plan generation failed', error.name, Number(error.providerStatus) || '');
    if (error.providerStatus === 429) return json({ error: 'DeepSeek занят. Попробуй немного позже.' }, 429);
    return json({ error: 'Не удалось получить путь с материалами. Попробуй ещё раз или уточни цель.' }, 502);
  }
}
