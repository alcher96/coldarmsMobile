import { apiGet, apiGetPaged, SITE_URL } from './http';

/** Новости — те же запросы, что у /news и /news/{id} сайта. */

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  publishedAt: string;
  coverImagePath: string | null;
};

export type NewsArticle = NewsItem & {
  /** Текст новости — HTML, который сайт вставляет как есть. */
  bodyHtml: string | null;
  likeCount: number;
  likedByMe: boolean;
};

export const NEWS_PAGE_SIZE = 20;

/** Страница списка. Без заголовка X-Pagination считаем, что за полной страницей есть следующая. */
export async function loadNews(page: number, lang: 'ru' | 'en' = 'ru') {
  const { items, meta } = await apiGetPaged<NewsItem>(
    `/api/news?page=${page}&pageSize=${NEWS_PAGE_SIZE}&language=${lang}`,
  );
  const guessed = items.length === NEWS_PAGE_SIZE ? page + 1 : page;
  return { items, totalPages: Math.max(meta.totalPages, guessed) };
}

export async function loadArticle(id: string, lang: 'ru' | 'en' = 'ru') {
  const a = await apiGet<NewsArticle>(`/api/news/${id}?language=${lang}`);
  if (!a) throw new Error('Новость не найдена');
  return a;
}

const CATEGORIES: Record<string, string> = {
  Update: 'Обновление',
  News: 'Новость',
  Announcement: 'Анонс',
  Event: 'Событие',
  Release: 'Релиз',
};

/** Подпись категории, как бейдж на сайте («Update» → «Обновление»); незнакомую показываем как есть. */
export const categoryLabel = (c: string | null) => (c ? (CATEGORIES[c] ?? c) : null);

/** Сайт кладёт coverImagePath в <img src> как есть — путь от корня сайта или полный URL. */
export function newsCoverUrl(path: string | null) {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}

/** Буквы для плашки без обложки: «East vs West 27» → «EVW», «Обновление 27.09» → «ОБН». */
export function newsMonogram(title: string) {
  const words = title.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
}
