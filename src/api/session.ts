import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Токены сессии. Основной носитель — httpOnly-куки, которые ставит API (их хранит нативный
 * cookie-jar iOS/Android). Если API отдаёт токены и в теле ответа, держим их здесь и шлём
 * заголовком Authorization — это переживает очистку куков системой.
 */
const ACCESS_KEY = 'ca_access_token';
const REFRESH_KEY = 'ca_refresh_token';
const CREDENTIALS_KEY = 'ca_credentials';

// На вебе SecureStore нет — там только память (веб-сборка нужна лишь для превью).
const memory = new Map<string, string>();
const canSecure = Platform.OS !== 'web';

let accessToken: string | null = null;
let refreshToken: string | null = null;

async function read(key: string) {
  return canSecure ? SecureStore.getItemAsync(key) : (memory.get(key) ?? null);
}

async function write(key: string, value: string | null) {
  if (!canSecure) {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    return;
  }
  // Только на этом устройстве и только после первой разблокировки: в облачные бэкапы не уходит.
  const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  if (value === null) await SecureStore.deleteItemAsync(key, opts);
  else await SecureStore.setItemAsync(key, value, opts);
}

export async function loadTokens() {
  [accessToken, refreshToken] = await Promise.all([read(ACCESS_KEY), read(REFRESH_KEY)]);
}

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

/** Принимает тело ответа /login или /auth/refresh и забирает из него токены, если они там есть. */
export async function saveTokensFrom(body: unknown): Promise<boolean> {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  const access = b.accessToken ?? b.access_token ?? b.AccessToken;
  const refresh = b.refreshToken ?? b.refresh_token ?? b.RefreshToken;
  if (typeof access === 'string') {
    accessToken = access;
    await write(ACCESS_KEY, access);
  }
  if (typeof refresh === 'string') {
    refreshToken = refresh;
    await write(REFRESH_KEY, refresh);
  }
  return typeof access === 'string';
}

/** Сессию продлили куками, а нового access-токена в теле нет: старый заголовок только мешал бы. */
export async function dropAccessToken() {
  accessToken = null;
  await write(ACCESS_KEY, null);
}

/**
 * Почта и пароль для тихого повторного входа. Сессия Keycloak умирает через час без активности,
 * поэтому, когда продлить её уже нельзя, приложение входит заново само, не показывая форму.
 * Хранятся в системном защищённом хранилище (Android Keystore / iOS Keychain), только на устройстве.
 */
export type Credentials = { email: string; password: string };

export async function saveCredentials(c: Credentials) {
  await write(CREDENTIALS_KEY, JSON.stringify(c));
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await read(CREDENTIALS_KEY);
    const c = raw ? (JSON.parse(raw) as Credentials) : null;
    return c?.email && c.password ? c : null;
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  await write(CREDENTIALS_KEY, null);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await Promise.all([write(ACCESS_KEY, null), write(REFRESH_KEY, null)]);
}
