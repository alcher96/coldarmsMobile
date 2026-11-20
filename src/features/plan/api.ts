import { analysisFetch } from '@/features/analysis/api';
import type { Unit } from '@/features/strength/units';
import { UserError } from '@/lib/user-error';

import type { ActivePlan, Log, TrackMode } from './track';
import type { Catalog, Plan, Week } from './types';

// План тренировок — основной бэкенд coldarms.com (BlackArm, /api/plan…): план строится по своему разбору, неделя,
// инвентарь и начатый план с отметками хранятся на сервере за аккаунтом. Все запросы — от имени аккаунта.

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await analysisFetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const reason = await res
      .json()
      .then((j: { error?: string; reason?: string }) => j)
      .catch(() => null);
    // текст сервера — только для «нет данных для плана» (он про сам разбор); остальное — общими словами
    const msg =
      reason?.reason === 'no_basis' && reason.error
        ? reason.error
        : res.status === 404
          ? 'Разбор не найден.'
          : 'Не удалось связаться с сервером. Попробуй позже.';
    throw Object.assign(new UserError(msg), { status: res.status });
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const fetchCatalog = () => call<Catalog>('GET', '/api/plan/catalog');

/** Вид статики: при проигрыше в касание — только силовая (forced), иначе спортсмен выбирает. */
export const fetchStatic = (analysis: string) =>
  call<{ forced: boolean; types: Record<string, string> }>('GET', '/api/plan/static?analysis=' + encodeURIComponent(analysis));

export const fetchExampleWeek = () => call<{ days: Week }>('GET', '/api/plan/example');

/** Параметры плана: неделя, срок, степень, веса 1-й недели (для добавленных планом), инвентарь, вид статики. */
export type PlanParams = {
  week: Week;
  months: number;
  degree: string;
  starts?: Record<string, number>;
  inventory?: string[] | null; // что есть у спортсмена; null — есть всё
  static?: string; // strength — силовая, endurance — на выносливость
};

/** Коррекция недели по разбору — для просмотра, не сохраняется. */
export const makePlan = (analysis: string, p: PlanParams) => call<Plan>('POST', '/api/plan', { analysis, ...p });

/** Всё, что хранит сервер: неделя, инвентарь (null — не спрашивали), начатый план, кг или фунты. */
export type PlanState = { week: Week; inventory: string[] | null; active: ActivePlan | null; unit: Unit };
export const fetchState = (signal?: AbortSignal) => call<PlanState>('GET', '/api/plan/state', undefined, signal);

export const saveWeek = (week: Week) => call<{ week: Week }>('PUT', '/api/plan/week', { week });
export const saveInventory = (inventory: string[]) => call<{ inventory: string[] }>('PUT', '/api/plan/inventory', { inventory });

/** «Начать этот план»: сервер строит план заново по тем же параметрам и сохраняет вместо прежнего. */
export const startActive = (analysis: string, p: PlanParams, mode: TrackMode) =>
  call<ActivePlan>('POST', '/api/plan/active', { analysis, ...p, mode });

export const saveMode = (mode: TrackMode) => call<void>('PUT', '/api/plan/active/mode', { mode });
export const saveLog = (key: string, log: Log | null) => call<void>('PUT', '/api/plan/active/log', { key, log });
export const dropActive = () => call<void>('DELETE', '/api/plan/active');
