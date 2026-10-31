import type { Competition, Fight } from './competitions';
import type { Round } from './fight';
import { apiFetch, apiGet, SITE_URL } from './http';
import type { FightOdds } from './odds';

/**
 * Страница соревнования — те же запросы, что у /competition/{slug}/{id} сайта
 * (src/lib/competition.ts в Astro).
 */

export type CompetitionRound = Round & { fightId: string; descriptionRound: string | null };

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
  /** Коэффициенты предстоящих боёв, ключ — fightId. У отработанного карда не запрашиваются. */
  odds: Record<string, FightOdds> | null;
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
  const [competition, list, rounds, video, mira] = await Promise.all([
    apiGet<Competition>(`/api/Competition/${id}`),
    safe(apiGet<Fight[]>(`/api/fights?competitionId=${id}`)),
    safe(apiGet<CompetitionRound[]>(`/api/rounds/competition/${id}`)),
    safe(apiGet<{ hasMp4: boolean }>(`/api/Competition/${id}/video`)),
    safe(apiGet<{ avgConfidence: number; avgUpsetRisk: number }>(`/api/mira/accuracy-by-competition/${id}`)),
  ]);
  if (!competition) throw new Error('Турнир не найден');
  const fights = list ?? [];
  const rows = fights.map((f) => withRounds(f, (rounds ?? []).filter((r) => r.fightId === f.fightId)));
  const odds = rows.some((f) => !f.winner)
    ? await safe(apiGet<Record<string, FightOdds>>(`/api/odds/competition/${id}`))
    : null;
  // Главный бой — первым, дальше как в API.
  rows.sort((a, b) => Number(b.isMainEvent) - Number(a.isMainEvent));
  const me = rows.find((f) => f.isMainEvent);
  return {
    competition,
    fights: rows,
    odds,
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
  /** Пара как «Фамилия / Фамилия». */
  pair: string;
  winner: string;
  /** Шанс победителя по закрывающей линии букмекеров (без маржи), %. */
  winnerProbability: number;
  /** Победил андердог — бой добавил неожиданности. */
  upset: boolean;
  /** Сколько бой добавил бы при победе андердога; в сумме по турниру — 100. */
  ceiling: number;
};

export type Surprise = {
  /** Сколько «запаса неожиданности» турнира реализовалось, %. */
  percent: number;
  /** Ожидаемое значение при таких шансах, %. */
  expectedPercent: number;
  /** Порядок задаёт сервер: от наибольшего вклада к нулевым. */
  perFight: SurpriseFight[];
};

/** Границы зон шкалы, как на сайте: обычно / выше / редко / исключение. */
export const SURPRISE_ZONES = [
  { from: 0, to: 25, label: 'обычно' },
  { from: 25, to: 45, label: 'выше' },
  { from: 45, to: 60, label: 'редко' },
  { from: 60, to: 100, label: 'исключение' },
] as const;

/**
 * Шкала неожиданности турнира — как на сайте у вошедшего пользователя.
 * null (204) — считать не из чего: кард отработан не целиком или коэффициенты есть не по всем боям.
 */
export const loadSurprise = (competitionId: string) =>
  apiGet<Surprise>(`/api/odds/competition/${competitionId}/surprise`);
