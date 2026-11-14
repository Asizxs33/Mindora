import { accountSession, allowedOrigin, cloudSettings, json, matchesLearningAccount, readBody } from './cloud-api.js';
import { validateBuiltinWorkspace, WORKSPACE_MAX_BYTES } from './builtin-workspace.js';
import { learningWorkspaceStore } from './learning-workspace-store.js';

export async function learningWorkspaceApi(request, dependencies = {}) {
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Метод недоступен.', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.method === 'PUT' && !allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.', code: 'ORIGIN_NOT_ALLOWED' }, 403);
  const settings = dependencies.settings ?? cloudSettings();
  if (!settings) return json({ error: 'Сохранённые курсы пока недоступны.', code: 'WORKSPACE_UNAVAILABLE' }, 503);
  let cookies = [];
  try {
    const current = await (dependencies.session ?? accountSession)(request, settings);
    cookies = current.cookies;
    if (!current.user) return json({ error: 'Войди в аккаунт Mindora.', code: 'UNAUTHORIZED' }, 401, cookies);
    if (!matchesLearningAccount(request, current.user)) return json({ error: 'Аккаунт изменился. Войди снова.', code: 'ACCOUNT_CHANGED' }, 401, cookies);
    const store = () => (dependencies.store ?? learningWorkspaceStore)(settings.databaseUrl);
    if (request.method === 'GET') return json({ workspace: await store().read(current.user.id) }, 200, cookies);
    const input = await readBody(request, WORKSPACE_MAX_BYTES);
    const data = validateBuiltinWorkspace(input?.data);
    const revision = input?.revision;
    if (!data || (revision !== null && (!Number.isInteger(revision) || revision < 1 || revision > 2147483646))) {
      return json({ error: 'Некорректные данные курса.', code: 'INVALID_WORKSPACE' }, 400, cookies);
    }
    const workspace = await store().write(current.user.id, data, revision);
    if (!workspace) return json({ error: 'Курсы изменены на другом устройстве. Сначала открой сохранённую версию.', code: 'CONFLICT' }, 409, cookies);
    return json({ workspace }, 200, cookies);
  } catch (error) {
    console.warn('Mindora learning workspace request failed', error.code || error.name);
    return json({ error: 'Не удалось загрузить или сохранить курсы. Попробуй ещё раз.', code: 'WORKSPACE_UNAVAILABLE' }, 503, cookies);
  }
}
