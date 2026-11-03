import type { Hand } from './fight';
import { apiGet } from './http';

/**
 * Аналитика по всей базе — те же эндпоинты, что у блока «Данные, которые решают» на главной сайта
 * (вкладки грузятся из /home/analytics?tab=…). Вкладки «Стили борьбы» и «Разнообразие стилей»
 * пока не делаем — см. TODO.md.
 */

export type Summary = { totalCount: number; eliteCount: number; countryCount: number };

export type FightExperience = {
  buckets: { label: string; athleteCount: number }[];
  athletesWithFights: number;
  athletesWithoutFights: number;
  averageFightsPerAthlete: number;
  maxFights: number;
  veterans: { armWrestlerId: string; fullName: string; country: string | null; fights: number; winRate: number }[];
};

export type ComebackFight = {
  fightId: string;
  competitionId: string;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  competitionName: string;
  date: string;
  hand: Hand;
  score: string;
  fromTwoDown: boolean;
};

export type Rivalry = {
  wrestlerAId: string;
  nameA: string;
  countryA: string | null;
  winsA: number;
  wrestlerBId: string;
  nameB: string;
  countryB: string | null;
  winsB: number;
  totalFights: number;
  lastMeeting: string;
  lastCompetitionName: string;
};

export type MatchInsights = {
  favorites: {
    fightsCounted: number;
    favoriteWins: number;
    upsetCount: number;
    favoriteWinRate: number;
    biggestUpset: {
      winnerId: string;
      winnerName: string;
      loserId: string;
      loserName: string;
      hand: Hand;
      date: string;
      winnerChance: number;
    } | null;
  };
  firstRound: {
    fightsCounted: number;
    firstRoundWinnerTookMatch: number;
    firstRoundWinnerMatchRate: number;
    /** Матчи, выигранные после проигранного первого раунда (включая 0–2). */
    comebacks: number;
    comebacksFromTwoDown: number;
    comebackFights: ComebackFight[];
  };
  scores: {
    fightsCounted: number;
    scores: { score: string; count: number }[];
    sweepCount: number;
    sweepRate: number;
    deciderCount: number;
    deciderRate: number;
  };
  rivalries: Rivalry[];
  styleMatchups: { fightsCounted: number; pairs: { styleA: string; styleB: string; winsA: number; winsB: number; total: number }[] };
};

/** Интервал перерыва: win rate с доверительным интервалом; `isReliable` — выборка достаточна. */
export type RestBucket = {
  key: string;
  label: string;
  n: number;
  winRate: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  averageRestDays: number | null;
  isReliable: boolean;
};

export type RestCrossTable = {
  key: string;
  rowLabel: string;
  columns: string[];
  rows: { key: string; group: string; cells: RestBucket[] }[];
};

export type RestAthlete = {
  armWrestlerId: string;
  fullName: string;
  country: string | null;
  weight: number | null;
  isElite: boolean;
  breaks: number;
  medianRestDays: number;
  minRestDays: number;
  maxRestDays: number;
  fights: number;
  winRate: number;
};

export type RestAnalytics = {
  sample: { fights: number; competitionCount: number; medianRestDays: number };
  buckets: RestBucket[];
  paired: { fights: number; restedWon: number; inRhythmWon: number; equalRest: number; restedSharePct: number };
  gapSpread: RestBucket[];
  crossTables: RestCrossTable[];
  athletes: RestAthlete[];
};

export type TriangleScore = { cases: number; hits: number; winRate: number | null };
type TriangleSet = { rule: TriangleScore; ruleComparable: TriangleScore; strength: TriangleScore; even: TriangleScore; disputed: TriangleScore };

export type TriangleCase = {
  fightId: string;
  competitionName: string;
  date: string;
  hand: Hand;
  pickedId: string;
  pickedName: string;
  otherId: string;
  otherName: string;
  winnerId: string;
  winnerName: string;
  ruleWasRight: boolean;
  disputed: boolean;
  via: { armWrestlerId: string; fullName: string }[];
};

export type TriangleAnalytics = TriangleSet & {
  sample: { fights: number; withCommonOpponent: number; decisive: number };
  right: TriangleSet;
  left: TriangleSet;
  cases: TriangleCase[];
};

export type AnthroKey = 'wrist' | 'forearm' | 'bicep' | 'weight' | 'height';

export type AnthroEntry = {
  armWrestlerId: string;
  fullName: string;
  country: string | null;
  rank: number;
  value: number;
  bestHand: Hand;
  bestHandWinRate: number;
};

export type AnthroTop = { categories: Partial<Record<AnthroKey, AnthroEntry[]>> };

/**
 * Данные меняются только после турниров, а ответы весят десятки килобайт — держим их в памяти,
 * чтобы главная и экран аналитики не грузили одно и то же. `force` — обновление жестом.
 */
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

function cached<T>(path: string, force = false): Promise<T> {
  const hit = cache.get(path);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;
  const promise = apiGet<T>(path).then((data) => {
    if (data == null) throw new Error('Нет данных');
    return data;
  });
  cache.set(path, { at: Date.now(), promise });
  // Ошибку не кэшируем: следующий заход попробует снова.
  promise.catch(() => cache.delete(path));
  return promise;
}

export const loadSummary = (force?: boolean) => cached<Summary>('/api/ArmWrestler/summary', force);
export const loadFightExperience = (force?: boolean) => cached<FightExperience>('/api/ArmWrestler/fight-experience', force);
export const loadMatchInsights = (force?: boolean) => cached<MatchInsights>('/api/ArmWrestler/match-insights', force);
export const loadRestAnalytics = (force?: boolean) => cached<RestAnalytics>('/api/ArmWrestler/rest-analytics', force);
export const loadTriangle = (force?: boolean) => cached<TriangleAnalytics>('/api/ArmWrestler/triangle-analytics', force);
export const loadAnthroTop = (force?: boolean) => cached<AnthroTop>('/api/ArmWrestler/anthropometric-top', force);

export type Kpi = { value: string; label: string };

/**
 * Итоговые цифры блока. На сайте ещё «средний win rate» и «стилей на атлета», но эндпоинта
 * под них пока нет — вместо них страны и бои на атлета (см. TODO.md, лёгкий эндпоинт для главной).
 */
export async function loadKpis(force?: boolean): Promise<Kpi[]> {
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [summary, triangle, experience] = await Promise.all([
    safe(loadSummary(force)),
    safe(loadTriangle(force)),
    safe(loadFightExperience(force)),
  ]);
  const kpis: (Kpi | null)[] = [
    summary ? { value: String(summary.totalCount), label: 'Атлетов в базе' } : null,
    triangle ? { value: String(triangle.sample.fights), label: 'Матчей' } : null,
    summary ? { value: String(summary.countryCount), label: 'Стран' } : null,
    experience ? { value: formatNumber(experience.averageFightsPerAthlete), label: 'Боёв на атлета' } : null,
  ];
  const list = kpis.filter((k): k is Kpi => k != null);
  if (!list.length) throw new Error('Не удалось загрузить аналитику');
  return list;
}

export type AnalyticsSection = 'anthro' | 'rest' | 'triangle' | 'experience' | 'patterns' | 'rivalries';

/** Порядок — как во вкладках сайта (без «Стилей борьбы» и «Разнообразия стилей»). */
export const SECTIONS: { key: AnalyticsSection; label: string }[] = [
  { key: 'anthro', label: 'Антропометрический топ' },
  { key: 'rest', label: 'Простои' },
  { key: 'triangle', label: 'Треугольник' },
  { key: 'experience', label: 'Боевой опыт' },
  { key: 'patterns', label: 'Паттерны побед' },
  { key: 'rivalries', label: 'Соперники и стили' },
];

export const isSection = (s: unknown): s is AnalyticsSection => SECTIONS.some((x) => x.key === s);

/** Карточка-инсайт на главной: одна мысль — крупная цифра и строка пояснения. */
export type Insight = { key: string; section: AnalyticsSection; title: string; value: string; text: string; foot: string };

/** Пять инсайтов для карусели на главной — самые сильные цифры из вкладок сайта, самый интересный первым. */
export async function loadInsights(force?: boolean): Promise<Insight[]> {
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [mi, rest, tri] = await Promise.all([
    safe(loadMatchInsights(force)),
    safe(loadRestAnalytics(force)),
    safe(loadTriangle(force)),
  ]);
  const list: (Insight | null)[] = [
    mi
      ? {
          key: 'first-round',
          section: 'patterns',
          title: 'Цена первого раунда',
          value: formatPct(mi.firstRound.firstRoundWinnerMatchRate),
          text: 'взявших первый раунд выигрывают весь матч',
          foot: `${mi.firstRound.fightsCounted} матчей с записанными раундами`,
        }
      : null,
    mi
      ? {
          key: 'favorites',
          section: 'patterns',
          title: 'Фаворит против андердога',
          value: formatPct(mi.favorites.favoriteWinRate),
          text: 'боёв выигрывает явный фаворит — перевес от 50 пунктов Elo',
          foot: `Апсетов — ${mi.favorites.upsetCount} из ${mi.favorites.fightsCounted}`,
        }
      : null,
    mi
      ? {
          key: 'comebacks',
          section: 'patterns',
          title: 'Камбэки',
          value: String(mi.firstRound.comebacks),
          text: 'матчей выиграно после проигранного первого раунда',
          foot: `${mi.firstRound.comebacksFromTwoDown} из них — после 0–2`,
        }
      : null,
    rest
      ? {
          key: 'rest',
          section: 'rest',
          title: 'Простои',
          value: formatPct(rest.paired.restedSharePct),
          text: 'побед у того, кто отдыхал дольше соперника',
          foot: `${rest.paired.restedWon} против ${rest.paired.inRhythmWon} · ${rest.paired.equalRest} с равным перерывом`,
        }
      : null,
    tri && tri.rule.winRate != null
      ? {
          key: 'triangle',
          section: 'triangle',
          title: 'Правило треугольника',
          value: formatPct(tri.rule.winRate, 0),
          text: 'боёв угадывает правило «победил общего соперника — сильнее»',
          foot: `${tri.rule.hits} из ${tri.rule.cases} боёв`,
        }
      : null,
  ];
  const insights = list.filter((x): x is Insight => x != null);
  if (!insights.length) throw new Error('Не удалось загрузить аналитику');
  return insights;
}

/** Подписи интервалов — как на сайте (API отдаёт «28-60 дн»). */
const REST_LABELS: Record<string, string> = {
  d28_60: 'до 2 месяцев',
  d61_90: '2–3 месяца',
  d91_120: '3–4 месяца',
  d121_180: '4–6 месяцев',
  d181_365: '6–12 месяцев',
  d365plus: 'больше года',
  s1_90: 'до 3 месяцев',
  s91_180: '3–6 месяцев',
  s181_365: '6–12 месяцев',
  s365plus: 'больше года',
  b_le4m: 'до 4 месяцев',
  b_4_12m: '4–12 месяцев',
  b_12mplus: 'больше года',
  w_lt95: 'до 95 кг',
  w_95_115: '95–115 кг',
  w_115plus: '115+ кг',
  a_lt30: 'до 30 лет',
  a_30_37: '30–37 лет',
  a_38plus: '38+ лет',
};

export const restLabel = (key: string, fallback: string) => REST_LABELS[key] ?? fallback;

/** 61 → «61%», 45.9 → «45,9%»; `digits` — знаков после запятой. */
export function formatPct(v: number | null | undefined, digits = 1) {
  return v == null ? '—' : `${formatNumber(v, digits)}%`;
}

/** 3.8 → «3,8», 4.0 → «4». */
export function formatNumber(v: number, digits = 1) {
  const s = v.toFixed(digits);
  return (s.includes('.') ? s.replace(/\.?0+$/, '') : s).replace('.', ',');
}

/** Медиана перерыва в днях → «9 мес». */
export const restMonths = (days: number) => `${Math.max(1, Math.round(days / 30.4))} мес`;

export const handName = (h: Hand | null | undefined) => (h === 'Left' ? 'Левая' : h === 'Right' ? 'Правая' : '');
