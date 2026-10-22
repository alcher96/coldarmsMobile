import { apiGet } from './http';

/**
 * Коэффициенты букмекеров на бой — как блок «Коэффициенты» на странице боя сайта.
 * Эндпоинты /api/odds/* отдают данные только вошедшему пользователю.
 */

export type BookmakerOdds = {
  bookmaker: string;
  odds1: number | null;
  odds2: number | null;
  /** 0 — линия открыта; иначе рынок закрыт и коэффициентов нет. */
  marketStatus: number;
  impliedProb1: number | null;
  impliedProb2: number | null;
};

export type FightOdds = {
  fightId: string;
  bookmakers: BookmakerOdds[];
  consensus: { probability1: number; probability2: number; sources: number } | null;
};

export const loadFightOdds = (fightId: string) => apiGet<FightOdds>(`/api/odds/fight/${fightId}`);

const isOpen = (b: BookmakerOdds) => b.marketStatus === 0 && b.odds1 != null && b.odds2 != null;

/** Средние коэффициенты по открытым линиям; `null`, если ни одной линии нет. */
export function averageOdds(o: FightOdds | null): { odds1: number; odds2: number; sources: number } | null {
  const open = (o?.bookmakers ?? []).filter(isOpen);
  if (!open.length) return null;
  const mean = (pick: (b: BookmakerOdds) => number) => open.reduce((s, b) => s + pick(b), 0) / open.length;
  return { odds1: mean((b) => b.odds1!), odds2: mean((b) => b.odds2!), sources: open.length };
}

/** Насколько оценка рынка (без маржи) расходится с прогнозом модели, в процентных пунктах. */
export function modelGap(o: FightOdds | null, modelPct1: number): number | null {
  const p = o?.consensus?.probability1;
  return p == null || !o?.consensus?.sources ? null : Math.round(Math.abs(p * 100 - modelPct1));
}

export const formatOdds = (v: number | null) => (v == null ? '—' : v.toFixed(2));
