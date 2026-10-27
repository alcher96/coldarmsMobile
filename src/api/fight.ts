import { apiGet, apiPost, SITE_URL } from './http';
import type { Competition, Fight } from './competitions';
import { fightComments, loadComments, type Comment } from './comments';
import { loadFightOdds, type FightOdds } from './odds';

/**
 * Данные экрана боя — те же запросы, что делает страница боя сайта
 * (src/lib/fight.ts и src/lib/mira-block.ts в Astro).
 */

export type Hand = 'Right' | 'Left';

export type Wrestler = {
  armWrestlerId: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  weight: number | null;
  height: number | null;
  bicep: number | null;
  forearm: number | null;
  wristSize: number | null;
  /** Оценки по шкале до 10. */
  sidePressure: number | null;
  wrist: number | null;
  angle: number | null;
  stamina: number | null;
  pronaton: number | null;
  photoPath: string | null;
  thumbnailPath: string | null;
  birthDate: string | null;
};

/** Показатели формы и опыта; в `advanced` они есть общие и отдельно по рукам (`right` / `left`). */
export type Advanced = {
  careerWinRate: number | null;
  recentWinRate: number | null;
  recentSampleSize: number | null;
  formTrend: number | null;
  daysSinceLastFight: number | null;
  currentStreak: number | null;
  currentStreakType: string | null;
  longestWinStreak: number | null;
  longestLossStreak: number | null;
  totalFinishedFights: number | null;
  averageWinMargin: number | null;
  cleanSweepWins: number | null;
  cleanSweepLosses: number | null;
  closeWins: number | null;
  closeLosses: number | null;
  comebackWins: number | null;
  careerSpanYears: number | null;
  fightsPerYear: number | null;
  debutDate: string | null;
  lastFightDate: string | null;
  longestLayoffDays: number | null;
  averageOpponentWinRate: number | null;
  qualityWins: number | null;
  mainEventFights: number | null;
  mainEventWins: number | null;
  winRateLowerBound: number | null;
  winRateUpperBound: number | null;
  isSmallSample?: boolean | null;
  isActive?: boolean | null;
  mainEventWinRate?: number | null;
  undercardWinRate?: number | null;
  /** Качественные победы — над сильными соперниками. */
  signatureWins?: FightRefLite[] | null;
  /** Частые соперники: счёт личных встреч. */
  topOpponents?: { opponentId: string; opponentName: string; total: number; wins: number; losses: number }[] | null;
};

/** Ссылка на бой из статистики атлета (соперник, турнир, раунд). */
export type FightRefLite = {
  fightId: string;
  competitionName: string;
  competitionDate: string;
  opponentId: string;
  opponentName: string;
  roundNumber?: number;
};

export type AnthroPercentiles = Partial<Record<'height' | 'weight' | 'bicep' | 'forearm' | 'wrist', number | null>> & {
  cohortSize?: number | null;
};

export type GripWinRate = Record<string, number | null>;

export type WrestlerStats = {
  roundStats: ({ gripWinRate: GripWinRate | null } & Record<string, unknown>) | null;
  advanced:
    | (Advanced & { right?: Advanced | null; left?: Advanced | null; anthroPercentiles?: AnthroPercentiles | null })
    | null;
  flashPins: number | null;
  rightFlashPins: number | null;
  leftFlashPins: number | null;
  winsByFouls: number | null;
  totalFouls: number | null;
  efficiencyIndexRight: number | null;
  efficiencyIndexLeft: number | null;
  /** Закрыто для гостей сайта; null — нет данных. */
  /**
   * Оценки эффективности по рукам (`…Right` / `…Left`, как на странице атлета). «Общие» поля
   * без суффикса API заполняет значением левой руки, поэтому берём значения руки боя.
   */
  styleEffectiveness: Partial<Record<EffKey | `${EffKey}Right` | `${EffKey}Left`, number | null>> | null;
};

export type EffKey = 'technicalEfficiency' | 'tacticalEfficiency' | 'powerDominance' | 'reactionAndStart';

export type StyleUsage = { styleName: string; usageCount: number; rightHandCount: number; leftHandCount: number };

export type Round = {
  roundNumber: number;
  winnerName: string | null;
  styleUsed: string | null;
  isFlashPin: boolean;
  isFreeGrip: boolean;
  isRefereeGrip: boolean;
  isStrapAndRefereeGrip: boolean;
  isStrapAndFreeGrip: boolean;
  isWinnerByFouls: boolean;
};

type CompareFight = { competitionName: string; hand: string | null; isWin?: boolean; winnerName?: string | null };

export type CommonOpponent = {
  opponentId: string;
  opponentName: string;
  resultA: { wins: number; losses: number; fights: CompareFight[] };
  resultB: { wins: number; losses: number; fights: CompareFight[] };
};

export type Comparison = {
  directFights: (CompareFight & { fightId: string })[];
  commonOpponents: CommonOpponent[];
};

type Prediction = {
  mlProbabilityA: number | null;
  mlConfidence: number | null;
  winPropProbabilityA: number | null;
  modelsAgree: boolean | null;
  upsetRisk: number | null;
  layerContributions: { key: string; delta: number }[];
};

type Reliability = { accuracy: number; sampleSize: number };

export type Mira = {
  /** Шансы бойцов, в сумме 100. */
  w1Pct: number;
  w2Pct: number;
  /** Надёжность прогнозов такого типа (если есть выборка) или уверенность модели. */
  confidencePct: number;
  upsetPct: number;
  reliability: Reliability | null;
  /** Слои модели — шанс первого бойца, %. */
  layers: { name: string; pct: number }[];
};

export type VoteSide = {
  armWrestlerId: string;
  armWrestlerName: string;
  totalVotes: number;
  outcomeCounts: Record<string, number>;
};
export type VoteStats = { wrestler1Stats: VoteSide | null; wrestler2Stats: VoteSide | null; totalVotes: number };


export type FightPage = {
  fight: Fight;
  competition: Competition | null;
  wrestler1: Wrestler | null;
  wrestler2: Wrestler | null;
  statsA: WrestlerStats | null;
  statsB: WrestlerStats | null;
  stylesA: StyleUsage[];
  stylesB: StyleUsage[];
  /** % побед стиля бойца A (строка) против стиля B (столбец); индексы — STYLE_NAMES. */
  styleMatrix: number[][] | null;
  comparison: Comparison | null;
  mira: Mira | null;
  votes: VoteStats | null;
  /** Коэффициенты букмекеров; `null` — линии нет. */
  odds: FightOdds | null;
  comments: Comment[];
  rounds: Round[];
  w1Score: number;
  w2Score: number;
};

/** Порядок стилей, в котором API отдаёт матрицу стилей. */
export const STYLE_NAMES = ['Top roll', 'Hook', 'Kings move', 'Shoulder roll', 'Open top roll', 'Flop press', 'Side pressure'];

// Каждый блок переживает падение своего эндпоинта — как на сайте.
const safe = <T,>(p: Promise<T>) => p.catch(() => null);

export async function loadMira(fightId: string): Promise<Mira | null> {
  const res = await safe(
    apiGet<{ predictions: Prediction | null }>(`/api/ml/predictions/llm-analysis/${fightId}?language=ru`),
  );
  const pred = res?.predictions;
  if (!pred) return null;
  const w1Pct = Math.round((pred.mlProbabilityA ?? 0.5) * 100);
  const w2Pct = 100 - w1Pct;
  let upsetPct: number;
  if (pred.upsetRisk != null) upsetPct = Math.round(Math.min(1, Math.max(0, pred.upsetRisk)) * 100);
  else {
    const layer = pred.layerContributions.find((l) => l.key === 'UPSET');
    upsetPct = layer ? Math.min(100, Math.trunc((Math.abs(layer.delta) * 100) / 30)) : 0;
  }
  const layerPct = (key: string) => {
    const l = pred.layerContributions.find((x) => x.key === key);
    return l ? Math.round(l.delta + 50) : null;
  };
  const layers = [
    { name: 'ML', pct: layerPct('ML') },
    { name: 'Elo', pct: layerPct('ELO') },
    { name: 'Fusion', pct: layerPct('LOGIT') },
    { name: 'Антропом.', pct: pred.winPropProbabilityA != null ? Math.round(pred.winPropProbabilityA) : null },
  ].filter((l): l is { name: string; pct: number } => l.pct != null);

  const conf = Math.max(w1Pct, w2Pct) / 100;
  const reliability = await safe(
    apiGet<Reliability>(
      `/api/mira/reliability?confidence=${conf}&upsetRisk=${upsetPct / 100}&agree=${pred.modelsAgree}`,
    ),
  );
  const hasRel = !!reliability && reliability.sampleSize > 0;
  return {
    w1Pct,
    w2Pct,
    confidencePct: hasRel ? Math.round(reliability.accuracy) : Math.round((pred.mlConfidence ?? 0.5) * 100),
    upsetPct,
    reliability: hasRel ? reliability : null,
    layers,
  };
}

const statsUrl = (id: string, asOf?: string) => `/api/ArmWrestler/${id}/stats${asOf ? `?asOf=${asOf}` : ''}`;

export async function loadFightPage(fightId: string): Promise<FightPage> {
  const fight = await apiGet<Fight>(`/api/fights/${fightId}`);
  if (!fight) throw new Error('Бой не найден');
  const a = fight.wrestler1Id;
  const b = fight.wrestler2Id;
  const [competition, wrestler1, wrestler2, rounds, comparison, statsA, statsB, stylesA, stylesB, matrix, mira, votes, odds, comments] =
    await Promise.all([
      safe(apiGet<Competition>(`/api/Competition/${fight.competitionId}`)),
      safe(apiGet<Wrestler>(`/api/ArmWrestler/${a}`)),
      safe(apiGet<Wrestler>(`/api/ArmWrestler/${b}`)),
      safe(apiGet<Round[]>(`/api/rounds?fightId=${fightId}`)),
      safe(apiGet<Comparison>(`/api/fights/compare/${fightId}?hand=${fight.hand ?? ''}`)),
      safe(apiGet<WrestlerStats>(statsUrl(a))),
      safe(apiGet<WrestlerStats>(statsUrl(b))),
      safe(apiGet<{ styles: StyleUsage[] }>(`/api/ArmWrestler/style-statistics/${a}`)),
      safe(apiGet<{ styles: StyleUsage[] }>(`/api/ArmWrestler/style-statistics/${b}`)),
      safe(apiGet<number[][]>(`/api/StyleMatrix/${a}/${b}`)),
      loadMira(fightId),
      safe(apiGet<VoteStats>(`/api/fightsPredictions/${fightId}/vote-stats`)),
      safe(loadFightOdds(fightId)),
      loadComments(fightComments(fightId)).catch(() => []),
    ]);
  const list = (rounds ?? []).slice().sort((x, y) => x.roundNumber - y.roundNumber);
  return {
    fight,
    competition,
    wrestler1,
    wrestler2,
    statsA,
    statsB,
    stylesA: stylesA?.styles ?? [],
    stylesB: stylesB?.styles ?? [],
    styleMatrix: Array.isArray(matrix) && matrix.length ? matrix : null,
    comparison,
    mira,
    votes,
    odds,
    comments,
    rounds: list,
    w1Score: list.filter((r) => r.winnerName === fight.wrestler1Name).length,
    w2Score: list.filter((r) => r.winnerName === fight.wrestler2Name).length,
  };
}

/** Статистика обоих бойцов «на момент боя» (дата турнира) — для завершённых боёв. */
export async function loadStatsAsOf(fight: Fight, date: string) {
  const asOf = date.slice(0, 10);
  const [statsA, statsB] = await Promise.all([
    safe(apiGet<WrestlerStats>(statsUrl(fight.wrestler1Id, asOf))),
    safe(apiGet<WrestlerStats>(statsUrl(fight.wrestler2Id, asOf))),
  ]);
  return { statsA, statsB };
}

/**
 * Развёрнутый разбор M.I.R.A. от языковой модели.
 * Сервер отдаёт его только из кеша: `null` — этот бой ещё не разбирали.
 */
export async function loadMiraAnalysis(fightId: string): Promise<string | null> {
  const d = await apiGet<{ llmAnalysis: string | null }>(
    `/api/ml/predictions/llm-analysis/${fightId}?withLlm=true&language=ru`,
  );
  return d?.llmAnalysis?.trim() ? d.llmAnalysis : null;
}

/** Варианты исхода в голосовании; `key` — как в API (outcomeCounts), индекс — outcomeType. */
export const VOTE_OUTCOMES = [
  { key: 'ConfidentVictory', label: 'Уверенная победа', hint: '4–0 или 4–1' },
  { key: 'ProlongedStruggle', label: 'Затяжная борьба', hint: '4–2 или 4–3' },
  { key: 'Comeback', label: 'Победа с отыгрышем', hint: 'после 0–2 и хуже' },
  { key: 'FoulVictory', label: 'Победа по фолам', hint: 'соперник нарушает' },
] as const;

export function voteFight(fightId: string, armWrestlerId: string, outcomeType: number) {
  return apiPost(`/api/fightsPredictions/${fightId}/vote`, { armWrestlerId, outcomeType });
}

export async function loadVotes(fightId: string) {
  return apiGet<VoteStats>(`/api/fightsPredictions/${fightId}/vote-stats`);
}

/** Показатели для руки боя (сайт: selectHand). */
export function advancedFor(stats: WrestlerStats | null, hand: Hand): Advanced | null {
  const a = stats?.advanced;
  if (!a) return null;
  return (hand === 'Right' ? a.right : a.left) ?? a;
}

/** Голосование открыто до дня турнира (по UTC, как на сайте). */
export function votingOpen(competition: Competition | null) {
  if (!competition) return true;
  const [y, m, d] = competition.competitionDate.slice(0, 10).split('-').map(Number);
  const now = new Date();
  return Date.UTC(y, m - 1, d) > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export const wrestlerPhotoUrl = (id: string) => `${SITE_URL}/api/ArmWrestler/${id}/photo/file`;

/** Возраст по дате рождения (вне рендера — `new Date()` здесь допустим). */
export function ageOf(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 100 ? age : null;
}

