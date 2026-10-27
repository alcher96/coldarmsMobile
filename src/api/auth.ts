import { apiFetch, apiPost, parseApiJson } from './http';
import { clearCredentials, clearTokens, saveCredentials, saveTokensFrom } from './session';

export type User = {
  nickname: string | null;
  email: string | null;
  emailVerified: boolean;
  /** Идентификатор Keycloak — по нему хаб уведомлений держит личную группу пользователя. */
  sub: string | null;
};

type Claim = { type: string; value: string };

/** Текст ошибки из ответа API: строка («такой ник занят») или JSON { message }. */
function messageOf(data: unknown): string {
  if (typeof data === 'string') return data.trim();
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  return '';
}

export class AuthError extends Error {}

function failure(status: number, data: unknown, fallback: string): AuthError {
  if (status === 429) return new AuthError('Слишком много попыток. Подождите немного и попробуйте снова');
  // Текст 5xx — внутренняя ошибка сервера, пользователю его не показываем.
  return new AuthError((status < 500 && messageOf(data)) || fallback);
}

async function call<T>(path: string, body: unknown) {
  try {
    // retry: false — 401 тут значит «неверные данные», продлевать сессию бессмысленно.
    return await apiPost<T>(path, body, { retry: false });
  } catch {
    throw new AuthError('Нет соединения с сервером');
  }
}

export async function login(email: string, password: string) {
  // Старый токен в заголовке не должен мешать новому входу.
  await clearTokens();
  const r = await call('/login', { email, password });
  if (r.status === 401) throw new AuthError('Неверная почта или пароль');
  if (!r.ok) throw failure(r.status, r.data, 'Не удалось войти. Попробуйте позже');
  await saveTokensFrom(r.data);
  // Чтобы не вводить пароль снова, когда сессия на сервере истечёт (см. silentLogin в http.ts).
  await saveCredentials({ email, password });
}

export type RegisterInput = {
  nickname: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  acceptPersonalData: boolean;
};

export async function register(input: RegisterInput) {
  const r = await call('/register', input);
  if (!r.ok) throw failure(r.status, r.data, 'Не удалось зарегистрироваться. Попробуйте позже');
}

export async function forgotPassword(email: string) {
  const r = await call('/auth/forgot-password', { email });
  if (!r.ok) throw failure(r.status, r.data, 'Не удалось отправить письмо. Попробуйте позже');
}

/**
 * Вход через Telegram — как кнопка на сайте: сервер выдаёт ссылку на бота и одноразовый токен,
 * человек подтверждает вход в боте, а мы раз в 2 секунды спрашиваем, подтвердил ли он.
 */
export async function startTelegramLogin(): Promise<{ deepLink: string; token: string }> {
  await clearTokens();
  const r = await call<{ deepLink?: string; token?: string }>('/auth/telegram/start', undefined);
  if (!r.ok || !r.data?.deepLink || !r.data.token) {
    throw failure(r.status, r.data, 'Не удалось начать вход через Telegram. Попробуйте позже');
  }
  return { deepLink: r.data.deepLink, token: r.data.token };
}

/** Один опрос: `ok` — вход подтверждён (сессия уже выдана), `pending` — ждём, `expired` — токен истёк. */
export async function pollTelegramLogin(token: string): Promise<'ok' | 'pending' | 'expired'> {
  const r = await apiFetch(`/auth/telegram/poll?token=${encodeURIComponent(token)}`, undefined, { retry: false });
  const data = r.ok ? parseApiJson(await r.text()) : null;
  const status = data && typeof data === 'object' && 'status' in data ? data.status : null;
  if (status === 'ok') {
    // Сессия приходит куками (как на сайте); если сервер положил токены и в тело — сохраним их.
    await saveTokensFrom(data);
    // Пароля нет — тихий повторный вход по почте здесь невозможен, старые данные не нужны.
    await clearCredentials();
    return 'ok';
  }
  return status === 'expired' ? 'expired' : 'pending';
}

/** Статус ссылки из письма — как отвечает API на /auth/verify-email и /auth/reset-password/*. */
export type LinkStatus = 'ok' | 'already' | 'expired' | 'invalid';

const statusOf = (data: unknown): LinkStatus => {
  const s = data && typeof data === 'object' && 'status' in data ? data.status : null;
  return s === 'ok' || s === 'already' || s === 'expired' ? s : 'invalid';
};

/** Подтверждение почты по токену из письма (страница /verify-email сайта). */
export async function verifyEmail(token: string): Promise<LinkStatus> {
  const r = await call('/auth/verify-email', { token });
  return statusOf(r.data);
}

/** Жив ли токен сброса пароля — проверяем до показа формы, как сайт. */
export async function validateResetToken(token: string): Promise<LinkStatus> {
  const r = await call('/auth/reset-password/validate', { token });
  return statusOf(r.data);
}

/** Новый пароль по токену из письма; `ok` — пароль сменён. */
export async function resetPassword(token: string, newPassword: string): Promise<LinkStatus> {
  const r = await call('/auth/reset-password', { token, newPassword });
  if (r.ok) return 'ok';
  const raw = r.data && typeof r.data === 'object' && 'status' in r.data ? r.data.status : null;
  if (raw === 'expired' || raw === 'invalid') return raw;
  throw failure(r.status, r.data, 'Не удалось сохранить пароль, попробуйте ещё раз');
}

/** Текущий пользователь по claims из /auth/me; null — сессии нет. */
export async function fetchMe(): Promise<User | null> {
  const r = await apiFetch('/auth/me');
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw new Error(`auth/me ${r.status}`);
  const claims = (parseApiJson(await r.text()) ?? []) as Claim[];
  const claim = (type: string) => claims.find((c) => c.type === type)?.value ?? null;
  return {
    nickname: claim('nickname') ?? claim('preferred_username'),
    email:
      claim('email') ?? claim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    emailVerified: claim('email_verified')?.toLowerCase() === 'true',
    sub: claim('sub') ?? claim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'),
  };
}

export async function logout() {
  try {
    await apiPost('/auth/logout', undefined, { retry: false });
  } catch {}
  await Promise.all([clearTokens(), clearCredentials()]);
}
