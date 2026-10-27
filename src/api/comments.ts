import { apiFetch, apiGet, apiPost } from './http';

/**
 * Обсуждение — один и тот же блок у боя и у новости, как на сайте. Отличается только адрес:
 * `base` — `/api/fights/{id}/comments` или `/api/news/{id}/comments`.
 */

export type Comment = {
  id: string;
  authorName: string | null;
  userId?: string | null;
  authorAvatarUrl: string | null;
  text: string;
  createdAt: string;
  parentCommentId?: string | null;
  isDeleted?: boolean;
  editedAt?: string | null;
  likes: number;
  dislikes?: number;
  myReaction: boolean | string | number | null;
  replies?: Comment[] | null;
};

export type CommentSort = 'newest' | 'popular' | 'oldest';

export const fightComments = (fightId: string) => `/api/fights/${fightId}/comments`;
export const newsComments = (newsId: string) => `/api/news/${newsId}/comments`;

export async function loadComments(base: string, sort: CommentSort = 'newest'): Promise<Comment[]> {
  return (await apiGet<Comment[]>(`${base}?page=1&pageSize=50&sortBy=${sort}`)) ?? [];
}

/** Новый комментарий; с `parentId` — ответ (сайт держит один уровень ответов). */
export function postComment(base: string, text: string, parentId: string | null = null) {
  return apiPost(base, { text, parentCommentId: parentId });
}

/** Лайк или дизлайк — тот же запрос, что у кнопок под комментарием на сайте. */
export function reactComment(base: string, commentId: string, isLike: boolean) {
  return apiPost(`${base}/${commentId}/reaction`, { isLike });
}

/** Какую реакцию поставил я: API отдаёт то bool, то строку. */
export function myReactionOf(c: Comment): 'like' | 'dislike' | null {
  const r = c.myReaction;
  if (r === true || r === 1 || (typeof r === 'string' && /^like$/i.test(r))) return 'like';
  if (r === false || r === -1 || (typeof r === 'string' && /^dislike$/i.test(r))) return 'dislike';
  return null;
}

export async function editComment(base: string, commentId: string, text: string) {
  const r = await apiFetch(`${base}/${commentId}/own`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return r.ok;
}

export async function deleteComment(base: string, commentId: string) {
  return (await apiFetch(`${base}/${commentId}/own`, { method: 'DELETE' })).ok;
}

export function reportComment(base: string, commentId: string, reason: string) {
  return apiPost(`${base}/${commentId}/report`, { reason });
}
