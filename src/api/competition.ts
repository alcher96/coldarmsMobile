import type { Competition, Fight } from './competitions';
import type { Round } from './fight';
import { apiFetch, apiGet, SITE_URL } from './http';

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
