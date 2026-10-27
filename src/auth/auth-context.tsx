import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { resetMyId } from '@/api/profile';
import { refreshSession, setSessionExpiredHandler } from '@/api/http';
import { loadTokens } from '@/api/session';

type Status = 'loading' | 'signedIn' | 'signedOut';

type AuthValue = {
  status: Status;
  user: authApi.User | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Сессию уже выдал сервер (вход через Telegram) — узнаём, кто вошёл, и пускаем в приложение. */
  completeSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Перечитать /auth/me — например, после подтверждения почты. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<authApi.User | null>(null);

  const signedOut = useCallback(() => {
    resetMyId();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Старт: поднимаем сохранённые токены и спрашиваем /auth/me (при 401 он сам попробует рефреш).
  useEffect(() => {
    setSessionExpiredHandler(signedOut);
    (async () => {
      try {
        await loadTokens();
        const me = await authApi.fetchMe();
        if (me) {
          setUser(me);
          setStatus('signedIn');
        } else signedOut();
      } catch {
        signedOut();
      }
    })();
    return () => setSessionExpiredHandler(null);
  }, [signedOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password);
    // Ник для шапки. Если /auth/me не ответил — вход всё равно состоялся.
    const me = await authApi.fetchMe().catch(() => null);
    setUser(me ?? { nickname: null, email, emailVerified: false, sub: null });
    setStatus('signedIn');
  }, []);

  const completeSignIn = useCallback(async () => {
    const me = await authApi.fetchMe();
    if (!me) throw new authApi.AuthError('Не удалось войти. Попробуйте ещё раз');
    setUser(me);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    signedOut();
  }, [signedOut]);

  const refreshUser = useCallback(async () => {
    // Свежий email_verified приходит только в новом токене — сначала перевыпускаем сессию.
    await refreshSession().catch(() => false);
    const me = await authApi.fetchMe().catch(() => null);
    if (me) setUser(me);
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, completeSignIn, signOut, refreshUser }),
    [status, user, signIn, completeSignIn, signOut, refreshUser],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
