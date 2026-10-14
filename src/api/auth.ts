import { apiFetch, apiPost, parseApiJson } from './http';
import { clearTokens, saveTokensFrom } from './session';

export type User = { nickname: string | null; email: string | null; emailVerified: boolean };

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
  };
}

export async function logout() {
  try {
    await apiPost('/auth/logout', undefined, { retry: false });
  } catch {}
  await clearTokens();
}
