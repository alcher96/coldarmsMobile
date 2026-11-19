import { dropAccessToken, getAccessToken, getRefreshToken, saveTokensFrom } from './session';

export const SITE_URL = 'https://coldarms.com';

const TIMEOUT_MS = 10_000;

/** Из .env.local (EXPO_PUBLIC_CA_CLIENT_KEY); для сборок EAS — из переменных окружения EAS. */
const CLIENT_KEY = process.env.EXPO_PUBLIC_CA_CLIENT_KEY;

/** Заголовок ключа приложения для запросов к coldarms.com мимо rawFetch (сервер MIRA, загрузка видео). */
export const clientKeyHeaders = (): Record<string, string> => (CLIENT_KEY ? { 'X-CA-Client': CLIENT_KEY } : {});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message?: string,
  ) {
    super(message ?? (status === 429 ? 'Слишком много запросов, попробуйте позже' : `API ${status}: ${path}`));
  }
}

/**
 * .NET сериализует NaN и бесконечности строками ("NaN", "Infinity") — например, у бойца
 * без боёв. Превращаем их в null, как это делает сайт.
 */
export function parseApiJson(text: string): unknown {
  return JSON.parse(text, (_key, value) =>
    value === 'NaN' || value === 'Infinity' || value === '-Infinity' ? null : value,
  );
}

export type Pagination = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
};

/** Вызывается, когда сессию не удалось продлить — провайдер авторизации выводит на вход. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  const token = getAccessToken();
  if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
  // Ключ приложения: без него сайт снаружи отдаёт 404 на всё API, кроме нужного браузеру.
  // ⚠️ Временный — перед публикацией в стор заменить на токен установки (см. TODO.md).
  if (CLIENT_KEY && !headers.has('x-ca-client')) headers.set('x-ca-client', CLIENT_KEY);
  // Запрос из приложения: при входе сервер выдаёт долгую сессию (оффлайн-токен Keycloak) и отдаёт токен продления
  // в теле — вход «навсегда», пока приложением пользуются (BlackArm AppClientExtensions).
  if (!headers.has('x-ca-device')) headers.set('x-ca-device', 'app');
  // Запрос из приложения: при входе сервер выдаёт долгую сессию (оффлайн-токен Keycloak) и отдаёт токен продления
  // в теле — вход «навсегда», пока приложением пользуются (BlackArm AppClientExtensions).
  if (!headers.has('x-ca-device')) headers.set('x-ca-device', 'app');
  try {
    // credentials: 'include' — куки сессии из нативного cookie-jar уходят вместе с запросом.
    return await fetch(SITE_URL + path, { ...init, headers, credentials: 'include', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Один общий рефреш на пачку одновременных 401 — как на сайте.
let inflightRefresh: Promise<boolean> | null = null;

/**
 * Продление сессии токеном из защищённого хранилища (заголовком X-Refresh-Token): сервер отвечает новым токеном
 * продления (прежний перестаёт действовать — ротация) и новым токеном доступа. Нет своего токена (вошли до перехода на
 * долгую сессию) — продление кукой, как раньше. Пароль на телефоне не хранится: истекла сессия — вход заново.
 */
async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  const r = await rawFetch('/auth/refresh', { method: 'POST', headers: refresh ? { 'x-refresh-token': refresh } : {} });
  if (!r.ok) return false;
  if (!(await saveTokensFrom(await readJson(r)))) await dropAccessToken();
  return true;
}

export function refreshSession(): Promise<boolean> {
  // один запрос продления на пачку одновременных 401: с ротацией токена второй параллельный запрос пришёл бы со старым
  inflightRefresh ??= tryRefresh()
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (inflightRefresh = null), 3000);
    });
  return inflightRefresh;
}

async function readJson(r: Response): Promise<unknown> {
  const text = await r.text();
  if (!text) return null;
  try {
    return parseApiJson(text);
  } catch {
    return text;
  }
}

/** Запрос с продлением сессии: 401 → /auth/refresh (или тихий вход) → повтор. */
export async function apiFetch(path: string, init?: RequestInit, { retry = true } = {}): Promise<Response> {
  const r = await rawFetch(path, init);
  if (r.status !== 401 || !retry) return r;
  if (await refreshSession()) {
    const again = await rawFetch(path, init);
    if (again.status !== 401) return again;
  }
  onSessionExpired?.();
  return r;
}

async function request(path: string): Promise<Response> {
  const r = await apiFetch(path);
  if (!r.ok) throw new ApiError(r.status, path);
  return r;
}

export async function apiGet<T>(path: string): Promise<T | null> {
  const r = await request(path);
  if (r.status === 204) return null;
  return parseApiJson(await r.text()) as T;
}

/** POST с JSON. Ответ — разобранное тело (JSON или строка). */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  opts?: { retry?: boolean; headers?: Record<string, string> },
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const r = await apiFetch(
    path,
    {
      method: 'POST',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...opts?.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { retry: opts?.retry },
  );
  return { ok: r.ok, status: r.status, data: (await readJson(r)) as T | null };
}

/** Список + разбивка из заголовка X-Pagination ({"CurrentPage":1,"TotalPages":7,...}). */
export async function apiGetPaged<T>(path: string): Promise<{ items: T[]; meta: Pagination }> {
  const r = await request(path);
  const body = r.status === 204 ? [] : parseApiJson(await r.text());
  // Одни списки приходят массивом, другие — объектом { items, metaData } (атлеты).
  const items = (Array.isArray(body) ? body : ((body as { items?: T[] } | null)?.items ?? [])) as T[];
  const meta: Pagination = {
    currentPage: 1,
    totalPages: 1,
    pageSize: items.length,
    totalCount: items.length,
  };
  const raw = r.headers.get('x-pagination');
  if (raw) {
    try {
      const p = JSON.parse(raw);
      meta.currentPage = p.CurrentPage ?? meta.currentPage;
      meta.totalPages = p.TotalPages ?? meta.totalPages;
      meta.pageSize = p.PageSize ?? meta.pageSize;
      meta.totalCount = p.TotalCount ?? meta.totalCount;
    } catch {}
  }
  return { items, meta };
}
