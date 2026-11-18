import { planFetch } from '@/features/analysis/api';

import type { Catalog, Plan, Week } from './types';

// все запросы — от имени аккаунта (план строится только по своему разбору; сервер проверяет владельца)
export const fetchCatalog = () => planFetch('/api/plan/catalog').then((r) => r.json() as Promise<Catalog>);

/** Вид статики: при проигрыше в касание — только силовая (forced), иначе спортсмен выбирает. */
export const fetchStatic = (analysis: string) =>
  planFetch('/api/plan/static?analysis=' + encodeURIComponent(analysis)).then(
    (r) => r.json() as Promise<{ forced: boolean; types: Record<string, string> }>,
  );

export const fetchExampleWeek = () =>
  planFetch('/api/plan/example').then((r) => r.json() as Promise<{ days: Week }>);

/** Коррекция недели по разбору (сервер, annotator/training/plan.py — только код, без модели). */
export async function makePlan(
  analysis: string,
  week: Week,
  months: number,
  degree: string,
  starts: Record<string, number> = {}, // вес 1-й недели для упражнений, добавленных планом
  inventory: string[] | null = null, // что есть у спортсмена; null — есть всё
  staticType = 'strength', // вид статики: strength — силовая, endurance — на выносливость
): Promise<Plan> {
  const res = await planFetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis, week, months, degree, starts, inventory, static: staticType }),
  });
  if (!res.ok) throw new Error(`Сервер плана: ${res.status}`);
  return res.json();
}
