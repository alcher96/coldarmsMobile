const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function parse(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «24 октября 2026». */
export function dateLong(iso: string) {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}` : '—';
}

/** «24 ОКТ». */
export function dateBadge(iso: string) {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toUpperCase()}` : null;
}

/** plural(14, ['матч', 'матча', 'матчей']) → «матчей». */
export function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

/** «Vitaly Laletin» → «VL», «alex» → «AL». */
export function initialsOf(name: string | null | undefined) {
  if (!name) return undefined;
  const words = name.trim().split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2);
  return s ? s.toUpperCase() : undefined;
}

/** «East vs West 27» → { title: «East vs West», number: «27» } — номер выпуска рисуется крупно. */
export function splitEventNumber(name: string) {
  const m = name.trim().match(/^(.*?)\s+#?(\d+)$/);
  return m ? { title: m[1], number: m[2] } : { title: name, number: null };
}

/** mainEvent приходит строкой «Vitaly Laletin vs Kamil Jablonski». */
export function splitMainEvent(mainEvent: string | null | undefined) {
  const [left, right] = (mainEvent ?? '').split(/\s+vs\.?\s+/i);
  return left && right ? { left, right } : null;
}

/** «сейчас», «5 мин», «2 ч», «3 дн», дальше — дата «12 окт». */
export function timeAgo(iso: string) {
  const d = parse(iso);
  if (!d) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'сейчас';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} дн`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
