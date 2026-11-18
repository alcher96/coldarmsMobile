// Силовые: рост, вес, пол, результаты по упражнениям (правая и левая рука), видеоподтверждение, таблицы лидеров.
// Сейчас — сервер разбора (coldarmsAI/annotator/strength.py), потом — основной бэкенд coldarms.com: при переезде
// меняется этот файл, а не экраны. Уровень считает сервер; levelOf здесь — только подсказка до отправки.
import { analysisFetch } from '@/features/analysis/api';
import { ApiError, sendFile } from '@/features/analysis/jobs';

export type Sex = 'm' | 'f';
export type Arm = 'right' | 'left';
export type Level = { id: string; name: string; proof: boolean };
export type Exercise = { id: string; name: string; estimated?: boolean; about?: string };
export type Standards = {
  levels: Level[];
  classes: Record<Sex, (number | null)[]>;
  exercises: Exercise[];
  /** table[упражнение][пол][рука][класс] = 6 весов (кг) — по уровню */
  table: Record<string, Record<Sex, Record<Arm, number[][]>>>;
};
export type ResultStatus = 'ok' | 'needs_video' | 'processing' | 'pending' | 'approved' | 'rejected';
export type Result = {
  id: string; exercise: string; arm: Arm; kg: number; level: number; classIdx: number; sex: Sex;
  status: ResultStatus; created: number; reviewNote?: string | null;
};
export type MyResult = { exercise: string; arm: Arm; best: Result | null; latest: Result | null };
export type Tendency = 'attack' | 'defense';
/** styles — стиль борьбы: до трёх техник по порядку (первая — основная); tendency — чаще атакует или защищается */
export type Body = {
  sex: Sex | null; heightCm: number | null; weightKg: number | null; classIdx: number | null; name?: string;
  styles: string[]; tendency: Tendency | null;
};
export type StrengthData = { standards: Standards; body: Body; results: MyResult[] };
export type Leader = { rank: number; name: string; kg: number; level: number; me: boolean };
/** Смена лидера в таблице: кто первый теперь (top[0]), кого сместил, когда; new — за последнюю неделю. */
export type LeaderChange = {
  exercise: string; arm: Arm; sex: Sex; cls: number; top: Leader[]; total: number;
  leaderSince: number; new: boolean; previous: { name: string; kg: number };
};
export type Highlights = { items: LeaderChange[]; levels: Level[]; exercises: Exercise[]; classes: Standards['classes'] };

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal) {
  const res = await analysisFetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status === 401 ? 'Войди в аккаунт заново.' : (data.error ?? `Сервер: ${res.status}`), res.status, data);
  return data as T;
}

export const getStrength = (signal?: AbortSignal) => call<StrengthData>('GET', '/api/strength', undefined, signal);
export const saveBody = (b: { sex?: Sex; heightCm?: number; weightKg?: number; styles?: string[]; tendency?: Tendency }) =>
  call<{ body: Body; results: MyResult[] }>('PUT', '/api/strength/body', b);
export const submitResult = (exercise: string, arm: Arm, kg: number) =>
  call<Result>('POST', '/api/strength/results', { exercise, arm, kg });
export const getHighlights = (signal?: AbortSignal) => call<Highlights>('GET', '/api/strength/highlights', undefined, signal);
export const getLeaders = (exercise: string, arm: Arm, sex: Sex, cls: number, signal?: AbortSignal) =>
  call<{ items: Leader[]; me: Leader | null; total: number }>(
    'GET', `/api/strength/leaders?exercise=${exercise}&arm=${arm}&sex=${sex}&cls=${cls}`, undefined, signal);

/** Видеоподтверждение: начать (или продолжить) загрузку, дослать кусками, отправить на проверку. */
export async function uploadProof(
  resultId: string, video: { uri: string; size: number; name?: string }, onProgress: (p: number) => void, signal?: AbortSignal,
) {
  const path = `/api/strength/results/${resultId}/video`;
  let from = 0;
  const st = await call<{ received: number; size: number | null; status: ResultStatus }>('GET', path, undefined, signal);
  if (st.status === 'pending' || st.status === 'processing') return;   // видео уже принято
  if (st.status === 'needs_video' && st.size === video.size) from = st.received;
  else await call('POST', path, { size: video.size, name: video.name }, signal);
  if (!(await sendFile(video.uri, video.size, path, from, onProgress, signal))) throw new ApiError('Отменено', 0);
  await call('POST', `${path}/finish`, {}, signal);
}

export function classOf(std: Standards, sex: Sex, kg: number) {
  const tops = std.classes[sex];
  const i = tops.findIndex((t) => t === null || kg <= t);
  return i < 0 ? tops.length - 1 : i;
}

/** Индекс уровня 0…5 по весу; −1 — ниже первого. */
export function levelOf(std: Standards, exercise: string, sex: Sex, arm: Arm, cls: number, kg: number) {
  const row = std.table[exercise]?.[sex]?.[arm]?.[cls] ?? [];
  let lv = -1;
  row.forEach((need, i) => {
    if (kg >= need) lv = i;
  });
  return lv;
}

export const STATUS_RU: Record<ResultStatus, string> = {
  ok: 'засчитан',
  approved: 'подтверждён видео',
  needs_video: 'нужно видео',
  processing: 'видео обрабатывается',
  pending: 'видео на проверке',
  rejected: 'видео отклонено',
};
