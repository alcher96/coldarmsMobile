import { clientKeyHeaders, refreshSession, SITE_URL } from '@/api/http';
import { getAccessToken } from '@/api/session';

import type { AnalysisResult, DemoItem } from './types';
import { UserError } from '@/lib/user-error';

/**
 * Сервер MIRA: разбор, ColdArms Token, силовые и лидерборды, план тренировок — основной бэкенд coldarms.com (BlackArm).
 * Для стенда (сервер прототипа annotator/api_server.py на этом компьютере) — EXPO_PUBLIC_ANALYSIS_API=http://127.0.0.1:8058.
 */
export const API_URL = process.env.EXPO_PUBLIC_ANALYSIS_API ?? SITE_URL;

/** Заголовки запроса от имени аккаунта: токен входа coldarms.com и ключ приложения (без ключа сайт отдаёт 404). */
export function authHeaders(): Record<string, string> {
  const t = getAccessToken();
  return { ...clientKeyHeaders(), ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

/** Запрос к серверу MIRA от имени аккаунта. 401 — продлить сессию coldarms.com и повторить один раз.
 *  signal — токен отмены: ушли с экрана, удалили разбор — запрос обрывается сразу. */
export async function analysisFetch(path: string, init: RequestInit = {}, base: string = API_URL): Promise<Response> {
  const go = () =>
    fetch(base + path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...authHeaders() } });
  let res = await go();
  if (res.status === 401 && !init.signal?.aborted && (await refreshSession())) res = await go();
  return res;
}

/** Картинка или видео с сервера разбора (кадры для точек, видео разбора) — с теми же заголовками. */
export const mediaSource = (path: string) => ({ uri: API_URL + path, headers: authHeaders() });

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await analysisFetch(path, { signal });
  if (!res.ok) throw new UserError(res.status === 401 ? 'Войди в аккаунт заново.' : 'Не удалось получить разбор. Попробуй позже.');
  return res.json() as Promise<T>;
}

export const fetchDemo = (signal?: AbortSignal) => get<DemoItem[]>('/api/analysis/demo', signal);
export const fetchAnalysis = (id: string, signal?: AbortSignal) =>
  get<AnalysisResult>(`/api/analysis/${encodeURIComponent(id)}`, signal);
/** Видео разбора для плеера (expo-video принимает заголовки в источнике). */
export const videoSource = (r: AnalysisResult) => mediaSource(r.videoUrl);
