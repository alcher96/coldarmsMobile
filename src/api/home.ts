import type { Competition, Fight } from './competitions';
import { apiGet, apiGetPaged } from './http';
import type { NewsItem } from './news';

export type { Competition } from './competitions';
export type { NewsItem } from './news';

export type HomeData = {
  competition: Competition | null;
  /** Главный бой турнира — ради id бойцов (аватары). */
  mainFight: Fight | null;
  news: NewsItem[];
};

/** Те же запросы, что делает главная сайта (src/lib/home.ts в Astro). */
export async function loadHome(lang: 'ru' | 'en' = 'ru'): Promise<HomeData> {
  // Каждый блок переживает падение своего эндпоинта — как на сайте.
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  // Блок «Данные, которые решают» грузится отдельно, когда до него долистали (src/api/analytics.ts).
  const [comps, news] = await Promise.all([
    safe(apiGetPaged<Competition>('/api/Competition?PageNumber=1&PageSize=1')),
    safe(apiGet<NewsItem[]>(`/api/news/latest?count=3&language=${lang}`)),
  ]);

  if (!comps && !news) {
    throw new Error('Не удалось загрузить данные');
  }

  const competition = comps?.items[0] ?? null;
  const fights = competition
    ? await safe(apiGet<Fight[]>(`/api/fights?competitionId=${competition.competitionId}`))
    : null;

  return {
    competition,
    mainFight: fights?.find((f) => f.isMainEvent) ?? null,
    news: news ?? [],
  };
}
