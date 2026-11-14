import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { validateWorkspace } from './budget-workspace.js';
import { draftStore } from './draft-store.js';

const routes = { signup: 'sign-up/email', signin: 'sign-in/email', signout: 'sign-out' };
const messages = {
  unavailable: 'Облако недоступно. Черновик остаётся в этом браузере.',
  unauthorized: 'Войди в аккаунт Mindora.',
  conflict: 'На другом устройстве сохранена другая версия. Сначала открой её или подтверди замену.',
};

export function json(data, status = 200, cookies = []) {
  const response = Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}

function config() {
  const { DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } = process.env;
  if (!DATABASE_URL || !NEON_AUTH_BASE_URL || !NEON_AUTH_COOKIE_SECRET) return null;
  return { databaseUrl: DATABASE_URL, baseUrl: NEON_AUTH_BASE_URL.replace(/\/$/, ''), cookieSecret: NEON_AUTH_COOKIE_SECRET };
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}

async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch {
    return null;
  }
}

async function neonAuth(request, settings, path, body) {
  const headers = new Headers();
  for (const name of ['cookie', 'origin', 'user-agent']) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  }
  if (body) headers.set('content-type', 'application/json');
  const authRequest = new Request(new URL('/api/auth/' + path, request.url), {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleAuthProxyRequest({ request: authRequest, path, baseUrl: settings.baseUrl, cookieSecret: settings.cookieSecret });
}

async function session(request, settings) {
  const response = await neonAuth(request, settings, 'get-session');
  if (!response.ok && response.status !== 401) throw new Error('Neon Auth session request failed: ' + response.status);
  const data = response.ok ? await response.json() : null;
  return { user: data?.user?.id ? data.user : null, cookies: response.headers.getSetCookie() };
}

export async function accountApi(request) {
  const settings = config();
  if (!settings) return json({ available: false, user: null }, request.method === 'GET' ? 200 : 503);
  try {
    if (request.method === 'GET') {
      const { user, cookies } = await session(request, settings);
      return json({ available: true, user: user ? { name: user.name, email: user.email } : null }, 200, cookies);
    }
    if (request.method !== 'POST') return json({ error: 'Метод недоступен.' }, 405);
    if (!allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.' }, 403);
    const input = await readBody(request);
    if (!input || !Object.hasOwn(routes, input.action)) return json({ error: 'Неверный запрос.' }, 400);
    const body = {};
    if (input.action !== 'signout') {
      if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
        || typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
        return json({ error: 'Введи email и пароль от 8 до 128 символов.' }, 400);
      }
      body.email = input.email.trim().toLowerCase();
      body.password = input.password;
      if (input.action === 'signup') {
        body.name = String(input.name ?? '').trim().slice(0, 60) || body.email.split('@')[0].slice(0, 60);
      }
    }
    const response = await neonAuth(request, settings, routes[input.action], body);
    const cookies = response.headers.getSetCookie();
    if (!response.ok) {
      const code = await response.json().then(data => data.code).catch(() => null);
      console.warn('Neon Auth request failed', input.action, response.status, /^[A-Z_]{1,60}$/.test(code ?? '') ? code : '');
      const error = response.status === 429 ? 'Слишком много попыток. Попробуй позже.'
        : input.action === 'signup' ? 'Не удалось создать аккаунт. Если он уже есть, войди.'
        : input.action === 'signin' ? 'Не удалось войти. Проверь email, пароль и подтверждение почты.'
        : 'Не удалось выйти. Попробуй ещё раз.';
      return json({ error }, response.status, cookies);
    }
    return json({ ok: true }, 200, cookies);
  } catch (error) {
    console.warn('Mindora account request failed', error.name);
    return json({ error: messages.unavailable }, 503);
  }
}

export async function budgetDraftApi(request, dependencies = {}) {
  const settings = dependencies.settings ?? config();
  if (!settings) return json({ error: messages.unavailable }, 503);
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Метод недоступен.' }, 405);
  if (request.method === 'PUT' && !allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  try {
    const { user, cookies } = await (dependencies.session ?? session)(request, settings);
    if (!user) return json({ error: messages.unauthorized }, 401, cookies);
    const store = (dependencies.store ?? draftStore)(settings.databaseUrl);
    if (request.method === 'GET') return json({ draft: await store.read(user.id) }, 200, cookies);

    const input = await readBody(request);
    const workspace = validateWorkspace(input?.workspace);
    const revision = input?.revision;
    if (!workspace || (revision !== null && (!Number.isInteger(revision) || revision < 1 || revision > 2147483646))) {
      return json({ error: 'Некорректный черновик таблицы.' }, 400, cookies);
    }
    const written = await store.write(user.id, workspace, revision);
    if (!written) return json({ error: messages.conflict }, 409, cookies);
    return json({ draft: written }, 200, cookies);
  } catch (error) {
    console.warn('Mindora draft request failed', error.code || error.name);
    return json({ error: messages.unavailable }, 503);
  }
}
