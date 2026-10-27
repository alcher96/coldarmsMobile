import type { Competition, Fight } from './competitions';
import type { Round } from './fight';
import { apiFetch, apiGet, SITE_URL } from './http';
import type { FightOdds } from './odds';

/**
 * Страница соревнования — те же запросы, что у /competition/{slug}/{id} сайта
 * (src/lib/competition.ts в Astro).
 */

export type CompetitionRound = Round & { descriptionRound: string | null };

export type CompetitionFight = Fight & {
  rounds: CompetitionRound[];
  w1Score: number;
  w2Score: number;
  /** Победитель, если бой завершён (есть раунды и победитель). */
  winner: string | null;
};

export type CompetitionPage = {
  competition: Competition;
  fights: CompetitionFight[];
  /** Средние по прогнозам M.I.R.A. на турнир, %. */
  mira: { avgConfidence: number; avgUpsetRisk: number } | null;
  hasVideo: boolean;
  mainEvent: string | null;
};

const safe = <T,>(p: Promise<T>) => p.catch(() => null);

function withRounds(f: Fight, rounds: CompetitionRound[]): CompetitionFight {
  const sorted = rounds.slice().sort((a, b) => a.roundNumber - b.roundNumber);
  const s1 = sorted.filter((r) => r.winnerName === f.wrestler1Name).length;
  const s2 = sorted.filter((r) => r.winnerName === f.wrestler2Name).length;
  const fromScore = s1 > s2 ? f.wrestler1Name : s2 > s1 ? f.wrestler2Name : null;
  const named = f.winnerName && f.winnerName !== 'Draw' ? f.winnerName : null;
  const winner = sorted.length ? (named ?? fromScore) : null;
  return { ...f, rounds: sorted, w1Score: s1, w2Score: s2, winner };
}

export async function loadCompetitionPage(id: string): Promise<CompetitionPage> {
  const [competition, list, video, mira] = await Promise.all([
    apiGet<Competition>(`/api/Competition/${id}`),
    safe(apiGet<Fight[]>(`/api/fights?competitionId=${id}`)),
    safe(apiGet<{ hasMp4: boolean }>(`/api/Competition/${id}/video`)),
    safe(apiGet<{ avgConfidence: number; avgUpsetRisk: number }>(`/api/mira/accuracy-by-competition/${id}`)),
  ]);
  if (!competition) throw new Error('Турнир не найден');
  const fights = list ?? [];
  const rounds = await Promise.all(
    fights.map((f) => safe(apiGet<CompetitionRound[]>(`/api/rounds?fightId=${f.fightId}`))),
  );
  const rows = fights.map((f, i) => withRounds(f, rounds[i] ?? []));
  // Главный бой — первым, дальше как в API.
  rows.sort((a, b) => Number(b.isMainEvent) - Number(a.isMainEvent));
  const me = rows.find((f) => f.isMainEvent);
  return {
    competition,
    fights: rows,
    mira: mira && typeof mira.avgConfidence === 'number' ? mira : null,
    hasVideo: !!video?.hasMp4,
    mainEvent: competition.mainEvent?.trim() || (me ? `${me.wrestler1Name} vs ${me.wrestler2Name}` : null),
  };
}

/** Счётчик просмотров — отдельный POST, как на сайте; ответ не нужен. */
export function countView(id: string) {
  apiFetch(`/api/Competition/${id}/view`, { method: 'POST' }).catch(() => {});
}

export const competitionVideoUrl = (id: string) => `${SITE_URL}/api/Competition/${id}/video/file?format=mp4`;

/** Бой в разбивке шкалы неожиданности. */
export type SurpriseFight = {
  fightId: string;
  title: string;
  winner: string;
  /** Доля боя в «запасе неожиданности» турнира; в сумме по турниру — 100. */
  capacity: number;
  /** Шанс победителя до боя по консенсусу букмекеров (без маржи), %. */
  winnerPct: number;
  /** Победил андердог — бой добавил неожиданности. */
  upset: boolean;
};

export type Surprise = {
  /** Сколько «запаса неожиданности» турнира реализовалось, %. */
  value: number;
  /** Ожидаемое значение при таких шансах, %. */
  usual: number;
  fights: SurpriseFight[];
};

/** Границы зон шкалы, как на сайте: обычно / выше / редко / исключение. */
export const SURPRISE_ZONES = [
  { from: 0, to: 25, label: 'обычно' },
  { from: 25, to: 45, label: 'выше' },
  { from: 45, to: 60, label: 'редко' },
  { from: 60, to: 100, label: 'исключение' },
] as const;

const lastName = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? name : name.slice(i + 1);
};

/**
 * Шкала неожиданности турнира — как на сайте у вошедшего пользователя.
 * Шансы — консенсус букмекеров (/api/odds/competition/{id}, только для вошедших).
 * Вес боя — |logit| шанса фаворита: чем увереннее рынок, тем громче апсет.
 * Значение — доля веса боёв, где победил андердог; «обычный уровень» — её ожидание.
 */
export async function loadSurprise(competitionId: string, fights: CompetitionFight[]): Promise<Surprise | null> {
  const done = fights.filter((f) => f.winner === f.wrestler1Name || f.winner === f.wrestler2Name);
  const odds = await apiGet<Record<string, FightOdds>>(`/api/odds/competition/${competitionId}`);
  const rows = done.flatMap((f) => {
    const c = odds?.[f.fightId]?.consensus;
    const pA = c?.sources ? c.probability1 : null;
    if (pA == null || pA <= 0 || pA >= 1 || pA === 0.5) return [];
    const pWin = f.winner === f.wrestler1Name ? pA : 1 - pA;
    return [{ f, pWin, weight: Math.abs(Math.log(pA / (1 - pA))) }];
  });
  const total = rows.reduce((s, r) => s + r.weight, 0);
  if (!total) return null;
  const list: SurpriseFight[] = rows.map(({ f, pWin, weight }) => ({
    fightId: f.fightId,
    title: `${lastName(f.wrestler1Name)} / ${lastName(f.wrestler2Name)}`,
    winner: lastName(f.winner!),
    capacity: (weight / total) * 100,
    winnerPct: pWin * 100,
    upset: pWin < 0.5,
  }));
  // Сначала бои, давшие неожиданность, потом остальные; внутри — по весу.
  list.sort((a, b) => Number(b.upset) - Number(a.upset) || b.capacity - a.capacity);
  return {
    value: list.reduce((s, r) => s + (r.upset ? r.capacity : 0), 0),
    usual: rows.reduce((s, r) => s + r.weight * Math.min(r.pWin, 1 - r.pWin), 0) / total * 100,
    fights: list,
  };
}
