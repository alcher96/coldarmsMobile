import type { Athlete } from './athletes';
import type { StyleUsage, WrestlerStats } from './fight';
import { apiFetch, apiGet, apiPost } from './http';

/**
 * Страница атлета — те же запросы, что у /athlete/{slug}/{id} сайта (src/lib/athlete.ts в Astro).
 */

export type FightRef = {
  fightId: string;
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  opponentId: string;
  opponentName: string;
  opponentThumbnail: string | null;
  roundNumber: number;
};

export type YearRate = {
  year: number;
  rightHandWinRate: number;
  leftHandWinRate: number;
  rightHandFights: number;
  leftHandFights: number;
};

export type AthleteStats = WrestlerStats & {
  rightArmWins: number;
  rightArmLosses: number;
  leftArmWins: number;
  leftArmLosses: number;
  rightArmWinDetails: FightRef[] | null;
  rightArmLossDetails: FightRef[] | null;
  leftArmWinDetails: FightRef[] | null;
  leftArmLossDetails: FightRef[] | null;
  yearlyWinRates: YearRate[] | null;
  rightFlashPinsDetails: FightRef[] | null;
  leftFlashPinsDetails: FightRef[] | null;
  roundStats:
    | (WrestlerStats['roundStats'] & {
        totalFights: number;
        totalRounds: number;
        totalMatchesInRounds: number;
        averageMatchesPerRound: number;
        freeGrip: number;
        refereeGrip: number;
        freeGripAndStrap: number;
        refereeGripAndStrap: number;
      })
    | null;
};

export type AthletePage = {
  athlete: Athlete;
  stats: AthleteStats | null;
  styles: StyleUsage[];
  hasVideo: boolean;
  isFavorite: boolean;
};

const safe = <T,>(p: Promise<T>) => p.catch(() => null);

export async function loadAthletePage(id: string): Promise<AthletePage> {
  const [athlete, stats, styles, video, fav] = await Promise.all([
    apiGet<Athlete>(`/api/ArmWrestler/${id}`),
    safe(apiGet<AthleteStats>(`/api/ArmWrestler/${id}/stats`)),
    safe(apiGet<{ styles: StyleUsage[] }>(`/api/ArmWrestler/style-statistics/${id}`)),
    safe(apiGet<{ hasMp4: boolean }>(`/api/ArmWrestler/${id}/video`)),
    safe(apiGet<{ isFavorite: boolean }>(`/profile/favorites/${id}`)),
  ]);
  if (!athlete) throw new Error('Атлет не найден');
  return {
    athlete,
    stats,
    styles: (styles?.styles ?? []).filter((s) => s.usageCount > 0).sort((a, b) => b.usageCount - a.usageCount),
    hasVideo: !!video?.hasMp4,
    isFavorite: !!fav?.isFavorite,
  };
}

/** Избранное: POST — добавить, DELETE — убрать (как кнопка-звёздочка на сайте). */
export async function setFavorite(id: string, on: boolean) {
  const r = await apiFetch(`/profile/favorites/${id}`, { method: on ? 'POST' : 'DELETE' });
  return r.ok;
}

/** «Предложить правку» — сообщение модераторам об ошибке в данных атлета. */
export function suggestCorrection(id: string, text: string) {
  return apiPost('/corrections', { targetType: 0, targetId: id, text });
}

export const winPct = (w: number, l: number) => (w + l > 0 ? Math.round((w / (w + l)) * 100) : 0);

/** Последние N результатов по обеим рукам, новые первыми. */
export function recentForm(stats: AthleteStats | null, count: number) {
  if (!stats) return [];
  const all: { r: 'W' | 'L'; date: string }[] = [];
  const push = (list: FightRef[] | null, r: 'W' | 'L') => (list ?? []).forEach((f) => all.push({ r, date: f.competitionDate }));
  push(stats.rightArmWinDetails, 'W');
  push(stats.rightArmLossDetails, 'L');
  push(stats.leftArmWinDetails, 'W');
  push(stats.leftArmLossDetails, 'L');
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all.slice(0, count).map((x) => x.r);
}
