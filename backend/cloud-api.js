import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { validateWorkspace } from './budget-workspace.js';
import { draftStore } from './draft-store.js';
import { profileStore, validateProfile } from './profile-store.js';

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

export function cloudSettings() {
  const { DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } = process.env;
  if (!DATABASE_URL || !NEON_AUTH_BASE_URL || !NEON_AUTH_COOKIE_SECRET) return null;
  return { databaseUrl: DATABASE_URL, baseUrl: NEON_AUTH_BASE_URL.replace(/\/$/, ''), cookieSecret: NEON_AUTH_COOKIE_SECRET };
}

export function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}

// A stale tab must not act on a different shared-cookie account. The header is
// only a consistency check; identity always comes from the verified session.
export function matchesLearningAccount(request, user) {
  return typeof user?.id === 'string' && Boolean(user.id) && request.headers.get('X-Mindora-Account') === user.id;
}

export async function readBody(request, maxBytes = 16_384) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 98_304) return null;
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
      if (bytes > maxBytes) {
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

export async function accountSession(request, settings) {
  const response = await neonAuth(request, settings, 'get-session');
  if (!response.ok && response.status !== 401) throw new Error('Neon Auth session request failed: ' + response.status);
  const data = response.ok ? await response.json() : null;
  return { user: data?.user?.id ? data.user : null, cookies: response.headers.getSetCookie() };
}

// Auth mutations set the new session cookies on their response. Verify those
// cookies before attaching a profile to the newly authenticated identity.
function requestWithCookies(request, cookies) {
  const headers = new Headers(request.headers);
  const values = new Map();
  const append = pair => {
    const separator = pair.indexOf('=');
    if (separator > 0) values.set(pair.slice(0, separator).trim(), pair.slice(separator + 1));
  };
  for (const pair of (headers.get('cookie') || '').split(';')) append(pair.trim());
  for (const cookie of cookies) append(cookie.split(';', 1)[0]);
  if (values.size) headers.set('cookie', [...values].map(([name, value]) => `${name}=${value}`).join('; '));
  return new Request(request.url, { headers });
}

function publicUser(user, profile = null) {
  return user ? { id: user.id, name: profile?.name || user.name, email: user.email } : null;
}

export async function accountApi(request, dependencies = {}) {
  const settings = dependencies.settings ?? cloudSettings();
  if (!settings) return json({ available: false, user: null, profile: null }, request.method === 'GET' ? 200 : 503);
  const readSession = dependencies.session ?? accountSession;
  const auth = dependencies.auth ?? neonAuth;
  const store = () => (dependencies.store ?? profileStore)(settings.databaseUrl);
  let cookies = [];
  try {
    if (request.method === 'GET') {
      const current = await readSession(request, settings);
      cookies = current.cookies;
      const profile = current.user ? await store().read(current.user.id) : null;
      return json({ available: true, user: publicUser(current.user, profile), profile }, 200, cookies);
    }
    if (!['POST', 'PUT'].includes(request.method)) return json({ error: 'Метод недоступен.', code: 'METHOD_NOT_ALLOWED' }, 405);
    if (!allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.', code: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (request.method === 'PUT') {
      const current = await readSession(request, settings);
      cookies = current.cookies;
      if (!current.user) return json({ error: messages.unauthorized, code: 'UNAUTHORIZED' }, 401, cookies);
      const profile = validateProfile(await readBody(request));
      if (!profile) return json({ error: 'Проверь имя, возраст и интересы в профиле.', code: 'INVALID_PROFILE' }, 400, cookies);
      const saved = await store().write(current.user.id, profile);
      return json({ ok: true, user: publicUser(current.user, saved), profile: saved }, 200, cookies);
    }
    const input = await readBody(request);
    if (!input || !Object.hasOwn(routes, input.action)) return json({ error: 'Неверный запрос.', code: 'INVALID_REQUEST' }, 400);
    const body = {};
    let signupProfile = null;
    if (input.action !== 'signout') {
      if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
        || typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
        return json({ error: 'Введи email и пароль от 8 до 128 символов.', code: 'INVALID_CREDENTIALS' }, 400);
      }
      body.email = input.email.trim().toLowerCase();
      body.password = input.password;
      if (input.action === 'signup') {
        signupProfile = validateProfile({ ...input, name: input.name ?? body.email.split('@')[0].slice(0, 80) });
        if (!signupProfile) return json({ error: 'Проверь имя, возраст и интересы в профиле.', code: 'INVALID_PROFILE' }, 400);
        body.name = signupProfile.name;
      }
    }
    const response = await auth(request, settings, routes[input.action], body);
    cookies = response.headers.getSetCookie();
    if (!response.ok) {
      const code = await response.json().then(data => data.code).catch(() => null);
      console.warn('Neon Auth request failed', input.action, response.status, /^[A-Z_]{1,60}$/.test(code ?? '') ? code : '');
      const error = response.status === 429 ? 'Слишком много попыток. Попробуй позже.'
        : input.action === 'signup' ? 'Не удалось создать аккаунт. Если он уже есть, войди.'
        : input.action === 'signin' ? 'Не удалось войти. Проверь email, пароль и подтверждение почты.'
        : 'Не удалось выйти. Попробуй ещё раз.';
      return json({ error, code: response.status === 429 ? 'RATE_LIMITED' : 'AUTH_FAILED' }, response.status, cookies);
    }
    if (input.action === 'signout') return json({ ok: true, user: null, profile: null }, 200, cookies);
    const payload = await response.json().catch(() => null);
    const current = await readSession(requestWithCookies(request, cookies), settings);
    cookies.push(...current.cookies);
    // A pre-existing session must never receive a different signup's profile.
    const user = current.user?.email?.toLowerCase() === body.email
      && (!payload?.user?.id || current.user.id === payload.user.id) ? current.user : null;
    if (!user) {
      const verificationRequired = payload?.verificationRequired === true
        || (payload?.token === null && payload?.user?.emailVerified === false);
      if (input.action === 'signup' && verificationRequired) {
        return json({ ok: true, user: null, profile: null, verificationRequired: true }, 200, cookies);
      }
      return json({ error: 'Не удалось подтвердить вход. Попробуй войти ещё раз.', code: 'SESSION_UNCONFIRMED' }, 503, cookies);
    }
    if (signupProfile) {
      try {
        const profile = await store().write(user.id, signupProfile);
        return json({ ok: true, user: publicUser(user, profile), profile }, 200, cookies);
      } catch (error) {
        console.warn('Mindora signup profile save failed', error.name);
        return json({ ok: true, user: publicUser(user), profile: null, profilePending: true }, 200, cookies);
      }
    }
    const profile = await store().read(user.id);
    return json({ ok: true, user: publicUser(user, profile), profile }, 200, cookies);
  } catch (error) {
    console.warn('Mindora account request failed', error.name);
    return json({ error: messages.unavailable, code: 'ACCOUNT_UNAVAILABLE' }, 503, cookies);
  }
}

export async function budgetDraftApi(request, dependencies = {}) {
  const settings = dependencies.settings ?? cloudSettings();
  if (!settings) return json({ error: messages.unavailable }, 503);
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Метод недоступен.' }, 405);
  if (request.method === 'PUT' && !allowedOrigin(request)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  try {
    const { user, cookies } = await (dependencies.session ?? accountSession)(request, settings);
    if (!user) return json({ error: messages.unauthorized }, 401, cookies);
    if (request.headers.has('X-Mindora-Account') && !matchesLearningAccount(request, user)) {
      return json({ error: 'Аккаунт изменился. Войди снова.', code: 'ACCOUNT_CHANGED' }, 401, cookies);
    }
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
