import { apiFetch, apiGet, apiPost, SITE_URL } from './http';
import { getAccessToken } from './session';

/**
 * Личный кабинет — те же семь запросов, что у /profile сайта (src/lib/profile.ts в Astro).
 */

export type MyProfile = {
  id: string;
  nickname: string | null;
  email: string;
  emailVerified: boolean;
  country: string | null;
  bio: string | null;
  createdAt: string | null;
  supporterTier: string | number | null;
};

export type Achievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string | null;
  category: 'activity' | 'predictions' | 'community' | 'special' | string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type Favorite = {
  armWrestlerId: string;
  firstName: string;
  lastName: string;
  country: string | null;
  winRate: number;
};

export type Activity = {
  type: 'prediction' | 'comment' | 'correction' | string;
  target: string | null;
  detail: string | null;
  date: string;
  result?: 'correct' | 'wrong' | null;
  status?: 'accepted' | 'rejected' | string | null;
};

export type CompStat = {
  competitionName: string;
  accuracy: number;
  miraAccuracy: number;
  userPredicted: number;
  totalFights: number;
};

export type Settings = {
  notifNewFights: boolean;
  notifResults: boolean;
  notifReplies: boolean;
  privacySearchVisible: boolean;
  privacyShowAchievements: boolean;
  privacyShowActivity: boolean;
  privacyShowCompStats: boolean;
};

export type TelegramStatus = {
  available: boolean;
  linked: boolean;
  username: string | null;
  notificationsEnabled: boolean;
  roundsEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  notifNewFights: true,
  notifResults: true,
  notifReplies: true,
  privacySearchVisible: true,
  privacyShowAchievements: true,
  privacyShowActivity: true,
  privacyShowCompStats: true,
};

export type ProfilePage = {
  profile: MyProfile;
  achievements: Achievement[];
  favorites: Favorite[];
  activity: Activity[];
  compStats: CompStat[];
  settings: Settings;
  telegram: TelegramStatus | null;
};

const safe = <T,>(p: Promise<T>) => p.catch(() => null);

/** Свой id на сайте (не Keycloak sub) — чтобы отличать себя в поиске и комментариях. */
let myIdCache: Promise<string | null> | null = null;
export function loadMyId() {
  myIdCache ??= apiGet<MyProfile>('/profile')
    .then((p) => p?.id ?? null)
    .catch(() => {
      myIdCache = null;
      return null;
    });
  return myIdCache;
}

/** Забыть свой id — при выходе, чтобы следующий аккаунт не считался «собой». */
export const resetMyId = () => {
  myIdCache = null;
};

export async function loadMyProfile(): Promise<ProfilePage> {
  const [profile, achievements, favorites, activity, compStats, settings, telegram] = await Promise.all([
    apiGet<MyProfile>('/profile'),
    safe(apiGet<Achievement[]>('/achievements')),
    safe(apiGet<Favorite[]>('/profile/favorites')),
    safe(apiGet<Activity[]>('/profile/activity')),
    safe(apiGet<CompStat[]>('/profile/accuracy-by-competition')),
    safe(apiGet<Partial<Settings>>('/profile/settings')),
    safe(apiGet<TelegramStatus>('/api/telegram/status')),
  ]);
  if (!profile) throw new Error('Профиль недоступен');
  return {
    profile,
    achievements: achievements ?? [],
    favorites: favorites ?? [],
    activity: activity ?? [],
    compStats: compStats ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    telegram,
  };
}

async function put(path: string, body: unknown) {
  const r = await apiFetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let message = '';
  if (!r.ok) message = (await r.text().catch(() => '')).replace(/^"|"$/g, '').trim();
  return { ok: r.ok, status: r.status, message };
}

export const saveProfile = (p: { nickname: string; country: string | null; bio: string | null }) => put('/profile', p);
export const saveSettings = (s: Settings) => put('/profile/settings', s);
export const saveTelegramSettings = (t: { notificationsEnabled: boolean; roundsEnabled: boolean }) =>
  put('/api/telegram/settings', t);

export async function removeFavorite(id: string) {
  return (await apiFetch(`/profile/favorites/${id}`, { method: 'DELETE' })).ok;
}

export function resendVerification() {
  return apiPost('/auth/resend-verification');
}

/** Привязка Telegram: сервер выдаёт ссылку на бота с одноразовым кодом. */
export async function startTelegramLink(): Promise<string | null> {
  const r = await apiPost<{ deepLink?: string; DeepLink?: string }>('/api/telegram/link/start');
  return (r.ok && (r.data?.deepLink ?? r.data?.DeepLink)) || null;
}

export async function unlinkTelegram() {
  return (await apiFetch('/api/telegram/link', { method: 'DELETE' })).ok;
}

/** Загрузка аватарки: multipart, поле «photo», как на сайте. */
export async function uploadAvatar(uri: string, mimeType: string, name: string) {
  const form = new FormData();
  form.append('photo', { uri, type: mimeType, name } as unknown as Blob);
  const r = await apiFetch('/photo', { method: 'POST', body: form });
  return r.ok;
}

/** Своё фото: адрес + заголовок с токеном (если он есть; иначе спасут куки сессии). */
export function avatarSource(version: number) {
  const token = getAccessToken();
  return {
    uri: `${SITE_URL}/photo?v=${version}`,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  };
}
