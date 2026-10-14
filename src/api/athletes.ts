import type { Hand, Wrestler } from './fight';
import { apiGet, apiGetPaged } from './http';

/**
 * Список атлетов — те же запросы и правила, что у страницы /armwrestlers сайта
 * (src/lib/athletes.ts в Astro).
 */

export type Athlete = Wrestler & {
  nickName: string | null;
  gender: string | null;
  rArmWins: number;
  rArmLosses: number;
  lArmWins: number;
  lArmLosses: number;
};

export type AthleteSort = 'winRate' | 'name';

export type AthleteFilters = {
  search: string;
  hand: Hand | 'all';
  country: string;
  elite: boolean;
  sort: AthleteSort;
};

export const DEFAULT_FILTERS: AthleteFilters = { search: '', hand: 'all', country: '', elite: false, sort: 'winRate' };

export function loadAthletesPage(f: AthleteFilters, page: number, pageSize = 24) {
  const p = new URLSearchParams({
    pageNumber: String(page),
    pageSize: String(pageSize),
    orderBy: f.sort === 'name' ? 'name' : 'winrate',
  });
  if (f.search.trim()) p.set('searchTerm', f.search.trim());
  if (f.hand !== 'all') p.set('hand', f.hand);
  if (f.country) p.set('country', f.country);
  if (f.elite) p.set('eliteOnly', 'true');
  return apiGetPaged<Athlete>(`/api/ArmWrestler?${p.toString()}`);
}

/** Коды стран для фильтра. В базе встречаются коды с ведущим табом («\tLV») — обрезаем, иначе дубликаты. */
export async function loadCountryCodes() {
  const list = (await apiGet<string[]>('/api/ArmWrestler/countries')) ?? [];
  return [...new Set(list.map((c) => c.trim().toUpperCase()).filter((c) => c.length === 2))];
}

/** Лучшая рука и её винрейт — та же логика, что на сайте. */
export function bestHand(w: Athlete): { winRate: number; hand: Hand; fights: number } {
  const rTotal = w.rArmWins + w.rArmLosses;
  const lTotal = w.lArmWins + w.lArmLosses;
  const r = rTotal > 0 ? (w.rArmWins / rTotal) * 100 : 0;
  const l = lTotal > 0 ? (w.lArmWins / lTotal) * 100 : 0;
  return r >= l ? { winRate: r, hand: 'Right', fights: rTotal } : { winRate: l, hand: 'Left', fights: lTotal };
}

/** Elite — рука с винрейтом ≥ 75% и минимум 3 боя на ней (как фильтр eliteOnly на бэкенде). */
export function isElite(w: Athlete) {
  const rTotal = w.rArmWins + w.rArmLosses;
  const lTotal = w.lArmWins + w.lArmLosses;
  return (rTotal >= 3 && w.rArmWins * 4 >= rTotal * 3) || (lTotal >= 3 && w.lArmWins * 4 >= lTotal * 3);
}

/** Цвет винрейта — пороги как на сайте. */
export const winRateColor = (rate: number) =>
  rate >= 80 ? '#4AC87C' : rate >= 55 ? '#C8A04A' : rate > 0 ? '#C84A4A' : '#565B66';
