import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { File, FileMode } from 'expo-file-system';
import { Platform } from 'react-native';

import { refreshSession } from '@/api/http';

import { analysisFetch, API_URL, authHeaders } from './api';
import { schedule } from './schedule';
import type { AnalysisResult, Answers, Quality } from './types';
import { cleanVideoCache, isPreparedVideo, releasePreparedVideo } from '../../../modules/video-prep';
import { isAbort, isNetworkError, UserError } from '@/lib/user-error';

export type { Quality, QualityIssue } from './types';

/** Разбор своего видео: задача на сервере (annotator/jobs.py, считает worker.py).
 *
 *  Задача принадлежит аккаунту coldarms.com: каждый запрос несёт токен входа (api.ts → analysisFetch), сервер отдаёт
 *  только свои разборы, чужой для него не отличается от несуществующего. «Мои разборы» — список с сервера (listJobs);
 *  телефон помнит только ссылку на свой файл, чтобы дослать видео после обрыва.
 *
 *  Видео уходит кусками по 2 МБ; сервер помнит, сколько получил. Обрыв связи, приложение свернули или закрыли —
 *  при следующем открытии спрашиваем «сколько есть?» и досылаем остальное (кусок, который сервер уже получил,
 *  он не примет повторно и подскажет правильную позицию).
 *
 *  Отмена (signal): каждый запрос принимает AbortSignal — ушли с экрана, удалили разбор — всё обрывается сразу. */

export type JobState = 'uploading' | 'queued' | 'running' | 'needs_input' | 'done' | 'failed' | 'cancelled';
export type Job = {
  id: string;
  name?: string;
  created?: number;
  state: JobState;
  size: number;
  received: number;
  stage: string | null;
  progress: number;
  /** чего ждёт сервер: kingsMe / kingsOpp / center (или кнопки, если их ещё нет) */
  questions: string[];
  answers: Answers;
  error: string | null;
  /** оценка видео до разбора (сразу после загрузки) */
  precheck?: Quality | null;
  etaS?: number | null;
  /** в очереди вне окна разбора: через сколько секунд MIRA проснётся */
  window?: { open: boolean; opensInS: number | null };
  result?: AnalysisResult & { quality?: Quality | null };
};

/** Что телефон помнит о своих загрузках (без видео — только ссылка на файл, чтобы дослать). */
export type LocalJob = {
  id: string;
  uri: string;
  name?: string;
  size: number;
  ratio?: number;
  trim?: [number, number];
  created: number;
  state: JobState;
};

const KEY = 'analysis.jobs.v1';

export async function loadLocalJobs(): Promise<LocalJob[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as LocalJob[]) : [];
    // сжатую копию стёрли (разбор готов — уборка, или система почистила кэш) — ссылки на неё нет: видео с сервера
    return list.map((j) => (j.uri && isPreparedVideo(j.uri) && !new File(j.uri).exists ? { ...j, uri: '' } : j));
  } catch {
    return [];
  }
}

export async function saveLocalJob(job: LocalJob) {
  // сжатую копию уже стёрли (видео на сервере) — не возвращать ссылку на несуществующий файл
  if (job.uri && isPreparedVideo(job.uri) && !new File(job.uri).exists) job = { ...job, uri: '' };
  const all = (await loadLocalJobs()).filter((j) => j.id !== job.id);
  await AsyncStorage.setItem(KEY, JSON.stringify([job, ...all].slice(0, 50))).catch(() => {});
}

export async function forgetLocalJob(id: string) {
  const list = await loadLocalJobs();
  list.filter((j) => j.id === id && j.uri).forEach((j) => releasePreparedVideo(j.uri));
  const all = list.filter((j) => j.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
}

/** Ошибка сервера анализа или наша проверка: текст — для человека (наш или из ответа сервера, без подробностей). */
export class ApiError extends UserError {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown> = {}) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await analysisFetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 401 ? 'Войди в аккаунт заново.' : (data.error ?? `Сервер анализа: ${res.status}`);
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

/** Мои разборы — с сервера, только этого аккаунта, свежие сверху. */
export const listJobs = (signal?: AbortSignal) => call<Job[]>('GET', '/api/jobs', undefined, signal);
export const getJob = (id: string, signal?: AbortSignal) => call<Job>('GET', `/api/jobs/${id}`, undefined, signal);

/**
 * Окно разбора с сервера (там же отладочное «всегда открыто / закрыто») и на связи ли MIRA: online = false — движок
 * разбора не отзывается (рабочий выключен или компьютер спит), разбор только в очередь. Нет связи с сервером — окно по
 * часам телефона, MIRA считаем на связи (как раньше).
 */
export async function getSchedule(signal?: AbortSignal): Promise<{ open: boolean; changeInS: number; online: boolean }> {
  try {
    const s = await call<{ open: boolean; changeInS: number; online?: boolean }>('GET', '/api/schedule', undefined, signal);
    return { ...s, online: s.online !== false };
  } catch {
    const s = schedule();
    return { open: s.open, changeInS: Math.round(s.left * 60), online: true };
  }
}

/** Удалить разбор: сервер останавливает расчёт и стирает видео и всё насчитанное; телефон забывает ссылку на файл. */
export async function deleteJob(id: string, signal?: AbortSignal) {
  try {
    await call<{ deleted: boolean }>('DELETE', `/api/jobs/${id}`, undefined, signal);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;   // уже нет на сервере — забыть и на телефоне
  }
  await forgetLocalJob(id);
}
/** «Загрузить другое видео» — то же удаление. */
export const cancelJob = deleteJob;
/** Ответы-кнопки — в любой момент, даже пока видео ещё грузится. */
export const sendAnswers = (id: string, answers: Partial<Answers> & { center?: string }, signal?: AbortSignal) =>
  call<Job>('POST', `/api/jobs/${id}/answers`, answers, signal);

/** Три кадра для точек «где я, где соперник» (после приведения видео к стандарту; раньше — 409 «видео ещё готовится»). */
export type TapFrames = { width: number; height: number; frames: { frame: number; t: number; url: string }[] };
export const getFrames = (id: string, signal?: AbortSignal) => call<TapFrames>('GET', `/api/jobs/${id}/frames`, undefined, signal);
/** Точки в пикселях кадра: только числа, сервер проверяет их по размеру кадра. */
export type Tap = { frame: number; me: [number, number]; opp: [number, number] };
export const sendTaps = (id: string, taps: Tap[], signal?: AbortSignal) =>
  call<Job>('POST', `/api/jobs/${id}/taps`, { taps }, signal);

/** Новая задача: сервер выдаёт номер, телефон его запоминает до первого байта видео. */
export async function createJob(
  uri: string, size: number, name?: string, ratio?: number, trim?: [number, number], signal?: AbortSignal,
) {
  const up = await call<{ id: string; chunkSize: number }>('POST', '/api/uploads', { size, name }, signal);
  const local: LocalJob = { id: up.id, uri, name, size, ratio, trim, created: Date.now(), state: 'uploading' };
  await saveLocalJob(local);
  return local;
}

/** Чтение видео кусками без загрузки целиком в память. Телефон — expo-file-system (дескриптор файла: позиция + байты);
 *  браузер — Blob.slice. */
async function openReader(uri: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return { read: async (off: number, n: number): Promise<Blob> => blob.slice(off, off + n), close: () => {} };
  }
  const handle = new File(uri).open(FileMode.ReadOnly);
  return {
    read: async (off: number, n: number): Promise<Uint8Array> => {
      handle.offset = off;
      return handle.readBytes(n);
    },
    close: () => handle.close(),
  };
}

/** Кусок видео на сервер (позиция — заголовком Upload-Offset). Ответ — сколько сервер теперь имеет: при 409 он сам
 *  подсказывает правильную позицию. На телефоне — fetch из пакета expo: байты уходят как есть (у fetch React Native
 *  0.88 кусок Blob приходил на сервер пустым — загрузка «зависала» на месте). */
async function putChunk(path: string, off: number, body: Uint8Array | Blob, signal?: AbortSignal): Promise<number> {
  const url = `${API_URL}${path}`;
  const send = () => {
    const init = {
      method: 'PUT',
      signal,
      headers: { 'Upload-Offset': String(off), 'Content-Type': 'application/octet-stream', ...authHeaders() },
      body,
    };
    return Platform.OS === 'web' ? fetch(url, init as RequestInit) : expoFetch(url, init as never);
  };
  let res = await send();
  if (res.status === 401 && !signal?.aborted && (await refreshSession())) res = await send();
  const data = (await res.json().catch(() => ({}))) as { received?: number; error?: string };
  if ((res.ok || res.status === 409) && typeof data.received === 'number') return data.received;
  throw new ApiError(res.status === 401 ? 'Войди в аккаунт заново.' : (data.error ?? `Сервер анализа: ${res.status}`), res.status);
}

/** Дослать видео с того места, где сервер остановился, и поставить в очередь. onProgress — 0…1 по байтам.
 *  signal — отмена (ушли с экрана): отправка обрывается сразу, досылается при следующем открытии.
 *  Сервер трижды подряд не сдвинулся с места — ошибка, а не бесконечный цикл. */
export async function upload(local: LocalJob, onProgress: (p: number) => void, signal?: AbortSignal) {
  const status = await call<{ received: number; size: number; state: JobState }>('GET', `/api/uploads/${local.id}`, undefined, signal);
  if (status.state === 'uploading') {
    if (!(await sendFile(local.uri, local.size, `/api/uploads/${local.id}`, status.received, onProgress, signal))) return false;
  }
  const job = await call<Job>(
    'POST',
    `/api/uploads/${local.id}/finish`,
    local.trim ? { trimStart: local.trim[0], trimEnd: local.trim[1] } : {},
    signal,
  );
  await saveLocalJob({ ...local, state: job.state });
  onProgress(1);
  return true;
}

/** Файл на сервер кусками по 2 МБ с позиции from (докачка: сервер на каждый кусок отвечает, сколько у него есть).
 *  path — адрес приёма (PUT с Upload-Offset): видео разбора, видеоподтверждение силовых. false — отменили (signal). */
export async function sendFile(
  uri: string, size: number, path: string, from: number, onProgress: (p: number) => void, signal?: AbortSignal,
) {
  const chunk = 2 * 1024 * 1024;
  let off = from;
  let stalls = 0;
  onProgress(off / size);
  const reader = await openReader(uri);
  try {
    while (off < size) {
      if (signal?.aborted) return false;
      const part = await reader.read(off, Math.min(chunk, size - off));
      const n = part instanceof Uint8Array ? part.length : part.size;
      if (!n) throw new ApiError('Не получилось прочитать видео на телефоне — выбери его заново.', 0);
      const got = await putChunk(path, off, part, signal);
      stalls = got > off ? 0 : stalls + 1;
      if (stalls >= 3) throw new ApiError('Видео не уходит на сервер — проверь связь и попробуй ещё раз.', 0);
      off = got;
      onProgress(off / size);
    }
  } finally {
    reader.close();
  }
  return true;
}

/** Подпись состояния для «Моих разборов». */
export function stateLabel(state: JobState, stage?: string | null) {
  if (state === 'uploading') return 'видео не догружено';
  if (state === 'queued') return schedule().open ? 'в очереди' : 'в очереди · начнётся в 21:00 МСК';
  if (state === 'running') return STAGE_RU[stage ?? ''] ?? 'считается';
  if (state === 'needs_input') return 'MIRA ждёт ответа';
  if (state === 'done') return 'разбор готов';
  if (state === 'failed') return 'не получилось';
  return 'отменён';
}

export const STAGE_RU: Record<string, string> = {
  ingest: 'Готовлю видео',
  precheck: 'Проверяю качество видео',
  detect: 'Нахожу руки и корпус',
  pair: 'Нахожу тебя и соперника',
  prep3d: 'Восстанавливаю позы',
  sam3db: 'Восстанавливаю позы',
  build: 'Восстанавливаю ход схватки',
  kings: 'Восстанавливаю ход схватки',
  analysis: 'Пишу разбор',
  center: 'Сверяю с ответами',
  quality: 'Проверяю качество видео',
};

/** Разбор закончен: готов, упал или отменён — сжатая копия видео на телефоне больше не нужна. */
const FINISHED: JobState[] = ['done', 'failed', 'cancelled'];

/**
 * Уборка на телефоне. Сжатая копия видео живёт, пока разбор не закончен: вернулись проверить статус хоть 7 раз — видео
 * на месте (вступление и скан — по нему), ничего не качаем. Закончен — копию стираем; кадры прерванных вступлений —
 * всегда. server — свежий список разборов с сервера (состояние на телефоне могло устареть); нет связи — по телефону.
 */
export async function cleanupLocalVideos(server?: Job[]) {
  const state = new Map((server ?? []).map((j) => [j.id, j.state] as const));
  const keep = (await loadLocalJobs())
    .filter((j) => j.uri && !FINISHED.includes(state.get(j.id) ?? j.state))
    .map((j) => j.uri);
  cleanVideoCache(keep);
}

/** Повторять, пока нет связи: запрос не дошёл до сервера — ждём и пробуем снова (2, 4, 8 … 15 с), пока экран открыт.
 *  Загрузка продолжается с того места, где сервер остановился (upload спрашивает его об этом). onWait(true) — ждём
 *  связь (показать «жду интернет»), onWait(false) — связь есть. Наши ошибки (UserError) и отмена — сразу наружу. */
export async function retryWhileOffline<T>(
  fn: () => Promise<T>, signal?: AbortSignal, onWait?: (waiting: boolean) => void,
): Promise<T> {
  let delay = 2000;
  for (;;) {
    try {
      const r = await fn();
      onWait?.(false);
      return r;
    } catch (e) {
      if (signal?.aborted || isAbort(e) || !isNetworkError(e)) throw e;
      onWait?.(true);
      await new Promise<void>((res) => {
        const t = setTimeout(res, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          res();
        }, { once: true });
      });
      if (signal?.aborted) throw e;
      delay = Math.min(15000, delay * 2);
    }
  }
}
