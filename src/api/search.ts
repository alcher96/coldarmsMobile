import type { Achievement, Activity, CompStat, Favorite } from './profile';
import { apiGet, SITE_URL } from './http';

/** Общий поиск — как выпадающий поиск в шапке сайта (GET /api/search). */

export type SearchResult = {
  wrestlers: { id: string; name: string; thumbnailPath: string | null; country: string | null }[];
  competitions: { id: string; name: string; photoPath: string | null; competitionDate?: string | null }[];
  users: { id: string; nickname: string; avatarUrl: string | null }[];
};

export async function search(q: string, limit = 8): Promise<SearchResult> {
  const r = await apiGet<SearchResult>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  return { wrestlers: r?.wrestlers ?? [], competitions: r?.competitions ?? [], users: r?.users ?? [] };
}

/** Аватар пользователя: внешний адрес (Google) как есть, свой — от корня сайта. */
export const userAvatarUrl = (url: string | null | undefined) =>
  !url ? null : url.startsWith('http') ? url : `${SITE_URL}/${url.replace(/^\/+/, '')}`;

/** Публичный профиль; разделы, скрытые пользователем в настройках приватности, приходят null. */
export type PublicProfile = {
  id: string;
  nickname: string;
  country: string | null;
  bio: string | null;
  memberSince: string | null;
  supporterTier: string | number | null;
  avatarUrl: string | null;
  stats: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number | null;
    totalComments: number;
    correctionsAccepted: number;
  };
  achievements: Achievement[] | null;
  activity: Activity[] | null;
  compStats: CompStat[] | null;
  favorites: Favorite[];
};

export async function loadPublicProfile(id: string) {
  const p = await apiGet<PublicProfile>(`/api/users/${id}/public-profile`);
  if (!p) throw new Error('Пользователь не найден');
  return p;
}
