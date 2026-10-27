/**
 * Входящие ссылки → маршруты приложения.
 * - Письма ведут на coldarms.com/verify-email?token=… и /reset-password?token=…, иногда с префиксом
 *   языка /en — у приложения такого префикса нет.
 * - Запуск с иконки в собранном приложении приходит как `coldarms:///` — без пути роутер его не узнаёт,
 *   поэтому свою схему сводим к пути внутри приложения (`coldarms://news/1` → `/news/1`).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    // Своя схема — регуляркой: URL в React Native разбирает нестандартные схемы ненадёжно.
    const own = /^coldarms:\/*([^?#]*)(\?[^#]*)?/i.exec(path);
    if (own) {
      const local = `/${own[1]}`.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
      return local + (own[2] ?? '');
    }
    const url = new URL(path, 'https://coldarms.com');
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const local = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
      return local + url.search;
    }
    return path;
  } catch {
    // Падать здесь нельзя — отдаём ссылку роутеру как есть.
    return path;
  }
}
