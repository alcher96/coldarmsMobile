// Баланс ColdArms Token — один на всё приложение (вкладка «Анализ», профиль, разговор с MIRA показывают одно и то же
// число). Источник правды — сервер: на телефоне ничего не хранится, при смене аккаунта баланс сбрасывается и грузится
// заново. Пополнение — buy(): ключ идемпотентности держится, пока попытка не завершилась, — повтор после обрыва
// не начислит второй раз.
// Свежесть: баланс перечитывается при возврате в приложение и раз в POLL_MS, пока оно на экране, — начисление
// админом или возврат за упавший разбор видны через несколько секунд без перезапуска.
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/auth-context';

import { buyPack, getTokens, newPurchaseKey, type Tokens } from './api';

type Ctx = {
  data: Tokens | null;
  error?: string;
  refresh: (signal?: AbortSignal) => Promise<void>;
  /** Купить пакет → сколько начислено. Ошибка — исключение (баланс перечитывается: вдруг начисление прошло). */
  buy: (pack: string) => Promise<number>;
};

const TokensContext = createContext<Ctx | null>(null);

/** Как часто перечитывать баланс, пока приложение открыто. */
const POLL_MS = 15_000;

export function TokensProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const acct = user?.sub ?? null;
  const [state, setState] = useState<{ acct: string | null; data: Tokens | null; error?: string }>({ acct, data: null });
  const pending = useRef<{ acct: string | null; pack: string; key: string } | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!acct) return;
      try {
        const data = await getTokens(signal);
        setState({ acct, data });
      } catch (e) {
        if (!signal?.aborted) setState((s) => ({ ...s, acct, error: String((e as Error).message ?? e) }));
      }
    },
    [acct],
  );

  useEffect(() => {
    if (!acct) return;
    const ac = new AbortController();
    void refresh(ac.signal);
    return () => ac.abort();
  }, [acct, refresh]);

  // приложение на экране — раз в POLL_MS; вернулись в приложение — сразу; в фоне — не опрашиваем
  useEffect(() => {
    if (!acct) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        start();
      } else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [acct, refresh]);

  const buy = useCallback(
    async (pack: string) => {
      const p = pending.current;
      // та же попытка (тот же пакет после обрыва) — тот же ключ; другой пакет — новая попытка
      const attempt = p && p.acct === acct && p.pack === pack ? p : { acct, pack, key: newPurchaseKey() };
      pending.current = attempt;
      try {
        const r = await buyPack(pack, attempt.key);
        pending.current = null;
        setState((s) => (s.data ? { acct, data: { ...s.data, balance: r.balance } } : s));
        if (!state.data) void refresh();
        return r.purchase.tokens;
      } catch (e) {
        void refresh();
        throw e;
      }
    },
    [acct, refresh, state.data],
  );

  const value: Ctx = {
    data: state.acct === acct ? state.data : null,
    error: state.acct === acct ? state.error : undefined,
    refresh,
    buy,
  };
  return <TokensContext value={value}>{children}</TokensContext>;
}

export function useTokens() {
  const ctx = use(TokensContext);
  if (!ctx) throw new Error('useTokens — только внутри TokensProvider');
  return ctx;
}
