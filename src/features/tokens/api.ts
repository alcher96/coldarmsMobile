// ColdArms Token: баланс, пакеты, пополнение. Сейчас — сервер разбора (coldarmsAI/annotator/tokens.py), потом —
// основной бэкенд coldarms.com (ASP.NET Core; протокол — coldarmsAI/annotator/tokens_aspnet.md). При переезде меняется
// только этот файл: адрес и функция запроса, а не экраны.
import { analysisFetch } from '@/features/analysis/api';
import { ApiError } from '@/features/analysis/jobs';

export type Pack = { id: string; tokens: number; priceRub: number; priceUsd: number; perTokenRub: number };
/** cost — токенов за разбор: списывается, когда видео встаёт в очередь; расчёт не получился — возвращается. */
export type Tokens = { balance: number; cost: number; payments: string; packs: Pack[] };
export type Purchase = { id: string; pack: string; tokens: number; status: string; provider: string };

async function call<T>(method: string, path: string, init: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {}) {
  const res = await analysisFetch(path, {
    method,
    signal: init.signal,
    headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 401 ? 'Войди в аккаунт заново.' : (data.error ?? `Сервер: ${res.status}`);
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const getTokens = (signal?: AbortSignal) => call<Tokens>('GET', '/api/tokens', { signal });

/**
 * Купить пакет. key — ключ идемпотентности: один на попытку покупки, при повторе после обрыва связи — тот же, тогда
 * сервер вернёт ту же покупку и второй раз не начислит. Сумму телефон не присылает — цену пакета знает только сервер.
 */
export const buyPack = (pack: string, key: string, signal?: AbortSignal) =>
  call<{ purchase: Purchase; balance: number }>('POST', '/api/tokens/purchases', {
    body: { pack },
    headers: { 'Idempotency-Key': key },
    signal,
  });

/** Ключ попытки покупки (уникальность важна, тайна — нет: сервер сверяет ключ только в пределах аккаунта). */
export const newPurchaseKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;

/** 1 токен, 3 токена, 5 токенов. */
export function tokensWord(n: number) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'токенов';
  if (b === 1) return 'токен';
  if (b >= 2 && b <= 4) return 'токена';
  return 'токенов';
}

export const rub = (v: number) => `${v.toLocaleString('ru-RU').replace(/,/g, ' ')} ₽`;
