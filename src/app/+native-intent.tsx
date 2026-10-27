/**
 * Входящие ссылки сайта → маршруты приложения. Письма ведут на coldarms.com/verify-email?token=…
 * и /reset-password?token=…, иногда с префиксом языка /en — у приложения такого префикса нет.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'coldarms://app');
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
