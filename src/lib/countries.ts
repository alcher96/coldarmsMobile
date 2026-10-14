/** Названия стран по ISO-коду — для фильтров и карточек атлетов. */
const NAMES: Record<string, string> = {
  AM: 'Армения', AT: 'Австрия', AU: 'Австралия', AZ: 'Азербайджан', BG: 'Болгария', BR: 'Бразилия', BY: 'Беларусь',
  CA: 'Канада', CH: 'Швейцария', CM: 'Камерун', CN: 'Китай', CR: 'Коста-Рика', CZ: 'Чехия', DE: 'Германия',
  EE: 'Эстония', ES: 'Испания', FI: 'Финляндия', FR: 'Франция', GB: 'Великобритания', GE: 'Грузия', GR: 'Греция',
  HR: 'Хорватия', HU: 'Венгрия', IL: 'Израиль', IN: 'Индия', IR: 'Иран', IT: 'Италия', JP: 'Япония', KG: 'Киргизия',
  KR: 'Южная Корея', KZ: 'Казахстан', LT: 'Литва', LV: 'Латвия', MD: 'Молдова', MT: 'Мальта', MY: 'Малайзия',
  NO: 'Норвегия', NZ: 'Новая Зеландия', PL: 'Польша', QA: 'Катар', RO: 'Румыния', RS: 'Сербия', RU: 'Россия',
  SE: 'Швеция', SG: 'Сингапур', SK: 'Словакия', TH: 'Таиланд', TJ: 'Таджикистан', TR: 'Турция', UA: 'Украина',
  US: 'США', UZ: 'Узбекистан', ZA: 'ЮАР',
};

export const countryName = (code: string | null | undefined) =>
  code ? (NAMES[code.trim().toUpperCase()] ?? code.trim().toUpperCase()) : null;

/** Флаг эмодзи из кода страны («RU» → 🇷🇺): буквы кода превращаются в региональные символы. */
export function flagOf(code: string | null | undefined) {
  const c = code?.trim().toUpperCase();
  if (!c || !/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
