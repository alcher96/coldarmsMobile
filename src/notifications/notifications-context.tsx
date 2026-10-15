import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  deleteNotification,
  HUB_URL,
  hubToken,
  loadNotifications,
  markAllRead,
  markRead,
  type AppNotification,
} from '@/api/notifications';
import { useAuth } from '@/auth/auth-context';

type NotificationsValue = {
  items: AppNotification[];
  unread: number;
  /** Последнее пришедшее «вживую» уведомление — для баннера поверх экрана. */
  incoming: AppNotification | null;
  dismissIncoming: () => void;
  refresh: () => Promise<void>;
  readAll: () => void;
  read: (id: string) => void;
  remove: (id: string) => Promise<void>;
};

const Ctx = createContext<NotificationsValue | null>(null);

/**
 * Уведомления, как колокольчик сайта: список с сервера + SignalR-хаб. Хаб шлёт «notification»
 * в личную группу пользователя (JoinUserGroup по Keycloak sub) — тогда перечитываем список.
 * Пока приложение в фоне, соединения нет; при возврате — переподключаемся и обновляем список.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  // Список помечен владельцем: после выхода или смены аккаунта чужие уведомления не показываем.
  const [store, setStore] = useState<{ sub: string | null; list: AppNotification[] }>({ sub: null, list: [] });
  const [incoming, setIncoming] = useState<AppNotification | null>(null);
  const known = useRef<Set<string> | null>(null);
  const subRef = useRef<string | null>(null);
  const sub = status === 'signedIn' ? (user?.sub ?? null) : null;
  const items = useMemo(() => (store.sub === sub ? store.list : []), [store, sub]);
  const setItems = useCallback(
    (update: (list: AppNotification[]) => AppNotification[]) => setStore((s) => ({ ...s, list: update(s.list) })),
    [],
  );

  const refresh = useCallback(async () => {
    const list = await loadNotifications().catch(() => null);
    if (!list) return;
    // Новое непрочитанное, которого не было в прошлом списке, — показываем баннером.
    if (known.current) {
      const fresh = list.find((n) => !n.isRead && !known.current!.has(n.id));
      if (fresh) setIncoming(fresh);
    }
    known.current = new Set(list.map((n) => n.id));
    setStore({ sub: subRef.current, list });
  }, []);

  useEffect(() => {
    subRef.current = sub;
    known.current = null;
    if (!sub) return;
    let hub: HubConnection | null = null;
    let cancelled = false;

    const connect = async () => {
      if (hub || cancelled) return;
      const h = new HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory: hubToken, withCredentials: true })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.None)
        .build();
      hub = h;
      const join = () => h.invoke('JoinUserGroup', sub).catch(() => {});
      h.on('notification', () => {
        refresh();
      });
      // Группа теряется при переподключении (например, после рестарта сервера) — входим заново.
      h.onreconnected(() => {
        join();
        refresh();
      });
      try {
        await h.start();
        await join();
      } catch {
        // Хаб недоступен — колокольчик всё равно обновится при возврате в приложение.
      }
    };
    const disconnect = () => {
      const h = hub;
      hub = null;
      h?.stop().catch(() => {});
    };

    refresh();
    connect();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        connect();
      } else if (state === 'background') disconnect();
    });
    return () => {
      cancelled = true;
      appState.remove();
      disconnect();
    };
  }, [sub, refresh]);

  const readAll = useCallback(() => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    markAllRead();
  }, [setItems]);
  const read = useCallback((id: string) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    markRead(id);
  }, [setItems]);
  const remove = useCallback(async (id: string) => {
    if (await deleteNotification(id).catch(() => false)) setItems((list) => list.filter((n) => n.id !== id));
  }, [setItems]);
  const dismissIncoming = useCallback(() => setIncoming(null), []);

  const value = useMemo(
    () => ({
      items,
      unread: items.filter((n) => !n.isRead).length,
      incoming,
      dismissIncoming,
      refresh,
      readAll,
      read,
      remove,
    }),
    [items, incoming, dismissIncoming, refresh, readAll, read, remove],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useNotifications() {
  const v = use(Ctx);
  if (!v) throw new Error('useNotifications вне NotificationsProvider');
  return v;
}
