/**
 * Ошибки, которые видит человек. На экран попадает только наш понятный текст: системные сообщения (адрес и порт
 * сервера, классы Java, пути API, стек) — подсказка злоумышленнику и пугают людей. Их заменяем общими словами.
 */

/** Ошибка с текстом для человека: наш, по-русски, без технических подробностей. Только её текст показываем как есть. */
export class UserError extends Error {}

/** Запрос не дошёл до сервера: нет интернета, сервер недоступен, обрыв. fetch бросает свои ошибки — узнаём по тексту. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof UserError) return false;
  if (e instanceof TypeError) return true; // fetch в браузере и React Native: «Network request failed»
  const m = String((e as { message?: unknown })?.message ?? e);
  return /network|fetch failed|failed to connect|connect|timeout|timed out|unable to resolve|unreachable|socket|ssl|tls|econn|eai_again|host/i.test(m);
}

/** Отмена (ушли с экрана) — не ошибка для человека. */
export const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError';

export const NETWORK_TEXT = 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
export const GENERIC_TEXT = 'Что-то пошло не так. Попробуй ещё раз.';

/** Текст ошибки для экрана: наш — как есть, сеть — «нет связи», остальное — общими словами (fallback). */
export function userMessage(e: unknown, fallback: string = GENERIC_TEXT): string {
  if (e instanceof UserError) return e.message || fallback;
  if (isNetworkError(e)) return NETWORK_TEXT;
  const status = (e as { status?: unknown })?.status;
  if (status === 401) return 'Войди в аккаунт заново.';
  if (status === 429) return 'Слишком много запросов. Подожди немного и попробуй снова.';
  if (typeof status === 'number' && status >= 500) return 'Сервер временно недоступен. Попробуй позже.';
  return fallback;
}
