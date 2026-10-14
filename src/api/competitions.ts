import { apiGet, apiGetPaged, SITE_URL } from './http';

export type Competition = {
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  photoPath: string | null;
  location: string | null;
  mainEvent: string | null;
  viewCount: number;
  fightCount: number;
};

export type Fight = {
  fightId: string;
  competitionId: string;
  wrestler1Id: string;
  wrestler2Id: string;
  wrestler1Name: string;
  wrestler2Name: string;
  winnerName: string | null;
  bestOf: string | null;
  hand: string | null;
  isMainEvent: boolean;
};

/** Фильтр серий, как на странице турниров сайта; сам фильтр считает бэкенд. */
export type Series = 'all' | 'eastvswest' | 'kingofthetable';

export const SERIES: { key: Series; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'eastvswest', label: 'East vs West' },
  { key: 'kingofthetable', label: 'King of the Table' },
];

const seriesParam = (s: Series) => (s === 'all' ? '' : `&series=${s}`);

/** Страница списка турниров, новые сверху; `search` ищет по названию (как поиск на сайте). */
export function loadCompetitionsPage(series: Series, page: number, pageSize = 20, search = '') {
  const q = search.trim() ? `&searchTerm=${encodeURIComponent(search.trim())}` : '';
  return apiGetPaged<Competition>(
    `/api/Competition?pageNumber=${page}&pageSize=${pageSize}&orderBy=datedesc${seriesParam(series)}${q}`,
  );
}

/** Турнир ещё впереди, если его дата — сегодня или позже (дата приходит без времени). */
export function isUpcoming(c: Competition, now = new Date()) {
  const d = new Date(c.competitionDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(d.getTime()) && d >= today;
}

export type CompetitionsOverview = {
  /** Ближайший предстоящий турнир. */
  upcoming: Competition | null;
  /** Главный бой ближайшего турнира — нужен ради id бойцов (аватары). */
  mainFight: Fight | null;
  /** Последние прошедшие турниры. */
  archive: Competition[];
};

export async function loadCompetitionsOverview(series: Series, archiveSize = 5): Promise<CompetitionsOverview> {
  const { items } = await loadCompetitionsPage(series, 1, 30);
  // Список отсортирован по убыванию даты: последний из будущих — ближайший.
  const future = items.filter((c) => isUpcoming(c));
  const upcoming = future.at(-1) ?? null;
  const archive = items.filter((c) => !isUpcoming(c)).slice(0, archiveSize);

  let mainFight: Fight | null = null;
  if (upcoming) {
    const fights = await apiGet<Fight[]>(`/api/fights?competitionId=${upcoming.competitionId}`).catch(() => null);
    mainFight = fights?.find((f) => f.isMainEvent) ?? null;
  }
  return { upcoming, mainFight, archive };
}

/** Обложка отдаётся файловым эндпоинтом; есть ли она — видно по photoPath, как на сайте. */
export const coverUrl = (c: Competition) =>
  c.photoPath?.trim() ? `${SITE_URL}/api/Competition/${c.competitionId}/cover-photo/file` : null;

export const thumbnailUrl = (armWrestlerId: string) => `${SITE_URL}/api/ArmWrestler/${armWrestlerId}/thumbnail/file`;

/** Слаг как на сайте (src/lib/urls.ts): «East vs West 27» → «east-vs-west-27». */
function makeSlug(text: string | null | undefined, fallback: string) {
  if (!text?.trim()) return fallback;
  let out = '';
  let lastDash = false;
  for (const ch of text.trim().toLowerCase().normalize('NFD')) {
    if (/\p{Mn}/u.test(ch)) continue;
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch;
      lastDash = false;
    } else if (!lastDash && out.length > 0) {
      out += '-';
      lastDash = true;
    }
  }
  out = out.replace(/^-+|-+$/g, '');
  return out || fallback;
}

export const competitionPageUrl = (c: Competition) =>
  `${SITE_URL}/competition/${makeSlug(c.competitionName, 'event')}/${c.competitionId}`;
