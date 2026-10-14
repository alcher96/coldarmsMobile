import { useEffect, useState } from 'react';

export type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** Сколько осталось до `target`, обновляется раз в `tickMs`; `null` — момент уже наступил. */
export function useCountdown(target: Date | null, tickMs = 1000): Countdown | null {
  const [now, setNow] = useState(() => Date.now());
  const time = target?.getTime() ?? NaN;

  useEffect(() => {
    if (Number.isNaN(time)) return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [time, tickMs]);

  const left = Math.floor((time - now) / 1000);
  if (Number.isNaN(left) || left <= 0) return null;
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
}
