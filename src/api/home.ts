import type { Competition, Fight } from './competitions';
import { apiGet, apiGetPaged } from './http';
import type { NewsItem } from './news';

export type { Competition } from './competitions';
export type { NewsItem } from './news';

export type RankingEntry = {
  armWrestlerId: string;
  fullName: string;
  country: string | null;
  thumbnailPath: string | null;
  score: number | null;
  rank: number;
};

type TopByCategories = Record<string, { entries?: RankingEntry[] } | null>;


export type HomeData = {
  competition: Competition | null;
  /** Главный бой турнира — ради id бойцов (аватары). */
  mainFight: Fight | null;
  technicalRight: RankingEntry[];
  news: NewsItem[];
};

/** Те же запросы, что делает главная сайта (src/lib/home.ts в Astro). */
export async function loadHome(lang: 'ru' | 'en' = 'ru'): Promise<HomeData> {
  // Каждый блок переживает падение своего эндпоинта — как на сайте.
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [comps, top, news] = await Promise.all([
    safe(apiGetPaged<Competition>('/api/Competition?PageNumber=1&PageSize=1')),
    safe(apiGet<TopByCategories>('/api/ArmWrestler/top-by-categories')),
    safe(apiGet<NewsItem[]>(`/api/news/latest?count=3&language=${lang}`)),
  ]);

  if (!comps && !top && !news) {
    throw new Error('Не удалось загрузить данные');
  }

  const competition = comps?.items[0] ?? null;
  const fights = competition
    ? await safe(apiGet<Fight[]>(`/api/fights?competitionId=${competition.competitionId}`))
    : null;

  return {
    competition,
    mainFight: fights?.find((f) => f.isMainEvent) ?? null,
    technicalRight: top?.mostTechnicalRight?.entries ?? [],
    news: news ?? [],
  };
}
