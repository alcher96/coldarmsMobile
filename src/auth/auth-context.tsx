import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { setSessionExpiredHandler } from '@/api/http';
import { loadTokens } from '@/api/session';

type Status = 'loading' | 'signedIn' | 'signedOut';

type AuthValue = {
  status: Status;
  user: authApi.User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<authApi.User | null>(null);

  const signedOut = useCallback(() => {
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
    setUser(me ?? { nickname: null, email, emailVerified: false });
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    signedOut();
  }, [signedOut]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
