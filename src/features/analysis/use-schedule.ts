import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { getSchedule } from './jobs';
import { schedule, type Schedule } from './schedule';

/** Окно разбора для экрана: по часам телефона сразу, затем — как скажет сервер (у него может быть отладочное
 *  «всегда открыто / закрыто»); обновляется при каждом открытии экрана и раз в 30 с. force — ?mode= экрана MIRA. */
export function useSchedule(force?: 'open' | 'closed' | null): Schedule & { now: number } {
  const [now, setNow] = useState(() => Date.now());
  const [server, setServer] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    setNow(Date.now());
    getSchedule().then((s) => setServer(s.open)).catch(() => {});
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh]);
  const local = schedule(now, force);
  // сервер принудительно открыл / закрыл окно (отладка) — показываем его состояние, часы — московские как есть
  if (!force && server !== null && server !== local.open) return { ...schedule(now, server ? 'open' : 'closed'), msk: local.msk, now };
  return { ...local, now };
}
