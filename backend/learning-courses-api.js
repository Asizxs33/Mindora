import { randomUUID } from 'node:crypto';
import { accountSession, allowedOrigin, cloudSettings, json, matchesLearningAccount, readBody } from './cloud-api.js';
import { COURSE_MAX_BYTES, courseId, learningCourseStore, normalizeSavedCourse } from './learning-course-store.js';

export async function learningCoursesApi(request, dependencies = {}) {
  if (!['GET', 'POST', 'PUT'].includes(request.method)) return json({ error: 'Метод недоступен.', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.method !== 'GET' && !allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.', code: 'ORIGIN_NOT_ALLOWED' }, 403);
  const settings = dependencies.settings ?? cloudSettings();
  if (!settings) return json({ error: 'Сохранённые курсы пока недоступны.', code: 'COURSES_UNAVAILABLE' }, 503);
  let cookies = [];
  try {
    const current = await (dependencies.session ?? accountSession)(request, settings);
    cookies = current.cookies;
    if (!current.user) return json({ error: 'Войди в аккаунт Mindora.', code: 'UNAUTHORIZED' }, 401, cookies);
    if (!matchesLearningAccount(request, current.user)) return json({ error: 'Аккаунт изменился. Войди снова.', code: 'ACCOUNT_CHANGED' }, 401, cookies);
    const store = (dependencies.store ?? learningCourseStore)(settings.databaseUrl);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (!url.searchParams.has('id')) return json({ courses: await store.list(current.user.id) }, 200, cookies);
      const id = courseId(url.searchParams.get('id'));
      if (!id) return json({ error: 'Некорректный идентификатор курса.', code: 'INVALID_COURSE' }, 400, cookies);
      const course = await store.read(current.user.id, id);
      return course ? json({ course }, 200, cookies) : json({ error: 'Курс не найден.', code: 'NOT_FOUND' }, 404, cookies);
    }
    const input = await readBody(request, COURSE_MAX_BYTES);
    const saved = normalizeSavedCourse(input?.saved);
    const id = request.method === 'POST' ? (dependencies.createId ?? randomUUID)() : courseId(input?.id);
    const revision = input?.revision;
    if (!saved || !courseId(id) || (request.method === 'PUT'
      && (!Number.isInteger(revision) || revision < 1 || revision > 2147483646))) {
      return json({ error: 'Некорректные данные курса.', code: 'INVALID_COURSE' }, 400, cookies);
    }
    const course = request.method === 'POST'
      ? await store.create(current.user.id, id, saved)
      : await store.write(current.user.id, id, saved, revision);
    if (!course) return json({ error: 'Курс изменён на другом устройстве. Открой сохранённую версию перед повторной записью.', code: 'CONFLICT' }, 409, cookies);
    return json({ course }, 200, cookies);
  } catch (error) {
    console.warn('Mindora courses request failed', error.code || error.name);
    return json({ error: 'Не удалось загрузить или сохранить курс. Попробуй ещё раз.', code: 'COURSES_UNAVAILABLE' }, 503, cookies);
  }
}
