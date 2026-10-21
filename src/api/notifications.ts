import { apiFetch, apiGet, SITE_URL } from './http';
import { getAccessToken } from './session';

/**
 * Уведомления — как колокольчик сайта: список из GET /notifications, живые — через SignalR-хаб
 * /hubs/notifications (событие «notification» в личной группе по Keycloak sub).
 */

export type NotificationType =
  | 'CorrectionAccepted'
  | 'CorrectionRejected'
  | 'CommentReply'
  | 'FightAdded'
  | 'FavoriteAthleteFight'
  | 'CommentDeleted'
  | 'AchievementUnlocked'
  | 'CompetitionAnnounced'
  | 'FavoriteAthleteResult'
  | string;

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string | null;
  message: string | null;
  /** JSON-строка: ключи шаблонов (titleKey, msgKey) и параметры для подстановки. */
  data: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

export const loadNotifications = async () => (await apiGet<AppNotification[]>('/notifications')) ?? [];

export const markAllRead = () => apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => null);
export const markRead = (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }).catch(() => null);
export async function deleteNotification(id: string) {
  return (await apiFetch(`/notifications/${id}`, { method: 'DELETE' })).ok;
}

export const HUB_URL = `${SITE_URL}/hubs/notifications`;
/** Токен для хаба: в WebSocket заголовок не поставить, SignalR передаст его параметром. */
export const hubToken = () => getAccessToken() ?? '';

// ── Тексты: те же шаблоны, что у сайта (ключи titleKey / msgKey в data) ──

const RU: Record<string, string> = {
  'notif.achievement.title': 'Новое достижение',
  'notif.achievement.msg': '«{achName}» — {achDesc}',
  'notif.commentDeleted.title': 'Комментарий удалён',
  'notif.commentDeleted.msg': 'Ваш комментарий был удалён модератором за нарушение правил.',
  'notif.commentReply.title': 'Ответ на ваш комментарий',
  'notif.commentReply.msg': 'Кто-то ответил на ваш комментарий: «{excerpt}»',
  'notif.compAnnounced.title': 'Анонсирован турнир',
  'notif.compAnnounced.msg': 'Анонсирован {name}',
  'notif.corrAccepted.title': 'Правка принята ✓',
  'notif.corrAccepted.msg': 'Ваша правка была рассмотрена и принята. Спасибо за помощь в улучшении базы данных!',
  'notif.corrRejected.title': 'Правка отклонена',
  'notif.corrRejected.msg': 'Ваша правка была отклонена.',
  'notif.favFight.title': 'Бой отслеживаемого атлета',
  'notif.favFight.msg': '{fav} участвует в {competition} против {other}',
  'notif.favFightBoth.title': 'Бой двух отслеживаемых атлетов',
  'notif.favFightBoth.msg': '{w1} vs {w2} — вы отслеживаете обоих, на {competition}',
  'notif.favResultLoss.title': 'Поражение отслеживаемого атлета',
  'notif.favResultLoss.msg': '{loser} проиграл {winner} на {competition}',
  'notif.favResultWin.title': 'Победа отслеживаемого атлета',
  'notif.favResultWin.msg': '{winner} одолел {loser} на {competition}',
  'notif.fightAdded.title': 'Новый бой у отслеживаемого атлета',
  'notif.fightAdded.msg': '{w1} vs {w2}',
};

function parseData(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

export function notifTitle(n: AppNotification) {
  const d = parseData(n.data);
  return (d?.titleKey && RU[d.titleKey]) || n.title || 'Уведомление';
}

export function notifMessage(n: AppNotification) {
  const d = parseData(n.data);
  const template = d?.msgKey ? RU[d.msgKey] : null;
  if (!d || !template) return n.message ?? '';
  // У достижения имя и описание приходят в данных (переводы сайта по ключу ачивки сюда не тянем).
  const vars: Record<string, string> = { achName: d.achTitle ?? '', ...d };
  return Object.entries(vars).reduce((t, [k, v]) => t.split(`{${k}}`).join(String(v ?? '')), template);
}

export const notifIcon = (type: string) =>
  ({
    CorrectionAccepted: '✓',
    CorrectionRejected: '✕',
    CommentReply: '💬',
    FightAdded: '🥊',
    FavoriteAthleteFight: '⭐',
    CommentDeleted: '🚫',
    AchievementUnlocked: '🏆',
    CompetitionAnnounced: '📣',
    FavoriteAthleteResult: '🏁',
  })[type] ?? '•';

export type AppRoute =
  | { pathname: '/fight/[id]'; params: { id: string } }
  | { pathname: '/athlete/[id]'; params: { id: string } }
  | { pathname: '/competition/[id]'; params: { id: string } }
  | { pathname: '/profile' };

const GUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Ссылку сайта (/fight/slug/id, /athlete/…, /competition/…, /profile) — в экран приложения. */
export function routeFor(linkUrl: string | null): AppRoute | null {
  if (!linkUrl) return null;
  const path = linkUrl.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/en(?=\/)/, '').split(/[?#]/)[0];
  const m = (prefix: string) => path.match(new RegExp(`^/${prefix}/(?:[^/]+/)?(${GUID})`, 'i'))?.[1];
  const fight = m('fight');
  if (fight) return { pathname: '/fight/[id]', params: { id: fight } };
  const athlete = m('athlete') ?? m('armprofile');
  if (athlete) return { pathname: '/athlete/[id]', params: { id: athlete } };
  const comp = m('competition') ?? m('competition-details');
  if (comp) return { pathname: '/competition/[id]', params: { id: comp } };
  if (path.startsWith('/profile')) return { pathname: '/profile' };
  return null;
}

/** «только что» / «5 мин» / «3 ч» / «2 д», дальше — дата. API отдаёт UTC без пояса. */
export function notifTime(iso: string) {
  const dt = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  const min = (Date.now() - dt.getTime()) / 6e4;
  if (min < 1) return 'только что';
  if (min < 60) return `${Math.trunc(min)} мин`;
  if (min < 1440) return `${Math.trunc(min / 60)} ч`;
  if (min < 10080) return `${Math.trunc(min / 1440)} д`;
  const m = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${dt.getUTCDate()} ${m[dt.getUTCMonth()]}`;
}
