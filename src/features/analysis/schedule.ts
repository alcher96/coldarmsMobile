// Окно разбора: MIRA работает с 21:00 до 06:00 по Москве (сервер расчётов — домашний компьютер с видеокартой).
// Вне окна видео можно загрузить и ответить на базовые вопросы — разбор встаёт в очередь и начнётся, когда MIRA проснётся.
// Москва — всегда UTC+3 (без перехода на летнее время).

export const OPEN_MSK = 21 * 60;   // минуты от полуночи по Москве
export const CLOSE_MSK = 6 * 60;
const MSK = 3 * 60;

/** Сейчас по Москве: минуты от полуночи (с долями). */
export function mskMinutes(now = Date.now()): number {
  const d = new Date(now);
  return ((d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + MSK) % 1440 + 1440) % 1440;
}

export const isOpenAt = (mm: number) => mm >= OPEN_MSK || mm < CLOSE_MSK;

const p2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
export const hhmm = (mm: number) => `${p2((((mm % 1440) + 1440) % 1440) / 60)}:${p2((((mm % 60) + 60) % 60))}`;

export type Schedule = {
  open: boolean;
  msk: number;             // минуты по Москве
  left: number;            // минут до закрытия (открыто) или до открытия (закрыто)
  leftText: string;        // «2 ч 14 мин»
};

/** force — для проверки экрана: 'open' / 'closed' подменяют московское время, как переключатель в шаблоне. */
export function schedule(now = Date.now(), force?: 'open' | 'closed' | null): Schedule {
  const msk = force === 'open' ? 23 * 60 + 48 : force === 'closed' ? 14 * 60 + 20 : mskMinutes(now);
  const open = isOpenAt(msk);
  const left = ((open ? CLOSE_MSK : OPEN_MSK) - msk + 1440) % 1440;
  const h = Math.floor(left / 60), m = Math.floor(left % 60);
  return { open, msk, left, leftText: h ? `${h} ч ${m} мин` : `${m} мин` };
}

// ---------- часовые пояса ----------
// Смещение берём из часового пояса устройства (Intl), летнее время — тоже; если Intl не умеет — из таблицы.
export const ZONES: { city: string; tz: string; off: number }[] = [
  { city: 'Лос-Анджелес', tz: 'America/Los_Angeles', off: -8 * 60 },
  { city: 'Нью-Йорк', tz: 'America/New_York', off: -5 * 60 },
  { city: 'Лондон', tz: 'Europe/London', off: 0 },
  { city: 'Берлин', tz: 'Europe/Berlin', off: 60 },
  { city: 'Москва', tz: 'Europe/Moscow', off: 180 },
  { city: 'Дубай', tz: 'Asia/Dubai', off: 240 },
  { city: 'Алматы', tz: 'Asia/Almaty', off: 300 },
  { city: 'Новосибирск', tz: 'Asia/Novosibirsk', off: 420 },
  { city: 'Владивосток', tz: 'Asia/Vladivostok', off: 600 },
];

/** Смещение пояса от UTC в минутах на момент now. */
export function zoneOffset(tz: string, fallback: number, now = Date.now()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(now));
    const g = (t: string) => +(parts.find((p) => p.type === t)?.value ?? NaN);
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
    const off = Math.round((asUtc - Math.floor(now / 60000) * 60000) / 60000);
    return Number.isFinite(off) && Math.abs(off) <= 14 * 60 ? off : fallback;
  } catch {
    return fallback;
  }
}

/** Смещение устройства от UTC в минутах. */
export const localOffset = (now = Date.now()) => -new Date(now).getTimezoneOffset();

const utcText = (off: number) => {
  const a = Math.abs(off), s = off >= 0 ? '+' : '−';
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + p2(a % 60) : ''}`;
};

export type ZoneRow = {
  city: string; you: boolean; utc: string; range: string;
  segs: { l: number; w: number }[];   // окно разбора на шкале суток (проценты)
  now: number;                         // «сейчас» на шкале (проценты)
};

/** Строка пояса: окно 21:00–06:00 МСК в местном времени этого пояса. */
export function zoneRow(city: string, off: number, msk: number, you: boolean): ZoneRow {
  const d = off - MSK;
  const a = ((OPEN_MSK + d) % 1440 + 1440) % 1440, b = ((CLOSE_MSK + d) % 1440 + 1440) % 1440;
  const segs = a < b ? [{ l: a / 14.4, w: (b - a) / 14.4 }] : [{ l: a / 14.4, w: (1440 - a) / 14.4 }, { l: 0, w: b / 14.4 }];
  return { city, you, utc: utcText(off), range: `${hhmm(a)}–${hhmm(b)}`, segs, now: (((msk + d) % 1440 + 1440) % 1440) / 14.4 };
}

/** Все пояса; пояс устройства отмечен «ВЫ», а если его нет в списке — добавлен первой строкой «Ваше время». */
export function zoneRows(msk: number, now = Date.now()): ZoneRow[] {
  const mine = localOffset(now);
  const rows = ZONES.map((z) => ({ ...z, off: zoneOffset(z.tz, z.off, now) }));
  const hit = rows.findIndex((z) => z.off === mine);
  const out = rows.map((z, i) => zoneRow(z.city, z.off, msk, i === hit));
  if (hit < 0) out.unshift(zoneRow('Ваше время', mine, msk, true));
  return out;
}

/** Окно разбора по времени устройства: «00:00–09:00». */
export function localWindow(now = Date.now()): string {
  return zoneRow('', localOffset(now), 0, true).range;
}
