// Цвета MIRA — вариант G «Морской закат: мягкие голубые глаза» из шаблона «MIRA Helmet HUD Neon.dc.html»
// (eyeColor="soft", hud="dusk"; эксперт, 2026-11-17). Перенесено из кода шаблона один в один:
//   • глаза: таблица замены фиолетовых цветов рисунка (THEMES.soft.map), палитра радужки (pal) и новые слои радужки
//     (чаша за зрачком, кольцо-шестерёнка, обод, розоватое свечение за зрачком, блики-дуги, искра) — SOFT;
//   • визор: все фиолетовые оттенки (тон 220…300°) → морской голубой 199°, насыщенность ×0.62, светлота та же
//     (hudPalette.conv); неоновая рамка — розовая, центральные точки — светло-персиковые с розовым свечением.
// Глаза рисуют cyber-eyes.tsx (картинки) и mira-hud.tsx (кадр); веб — cyber-eyes.web.tsx (проверка и запекание кнопки).

export const EYE_MAP: Record<string, string> = {
  '#885CFF': '#5FB0D6', '#BA9AFF': '#A9D6E8', '#A98BFF': '#7FC2DF', '#D7C6FF': '#D3ECF4', '#E5E7FF': '#EEF6F9',
  '#4A2AA6': '#2F6C8E', '#1E1052': '#12304A', '#0D0722': '#07121C', '#231D3D': '#1B232D', '#15122A': '#11171F', '#08070F': '#06080B',
  '#6E4F96': '#5D7E98', '#251A3D': '#1A2836', '#040309': '#030507', '#04030A': '#030507', '#160D2E': '#0E1E2E',
  '#05030E': '#03070C', '#0A0520': '#06111D', '#0B0624': '#071422', '#030208': '#020407', '#030206': '#020406', '#0E0B18': '#0B1016',
  '#1E1540': '#13243A', '#2A1C62': '#1A3C5A', '#46299F': '#2B6588', '#6C48E2': '#4A94BF', '#8A66FF': '#6CB6DA',
  '#2C2159': '#18293B', '#2B1F5C': '#183049', '#231849': '#14253A', '#1B1339': '#101C2C',
};

/** Цвет рисунка глаз → вариант G (что не в таблице — как есть). */
export function eyeHex(c: string): string {
  'worklet';
  return c[0] === '#' ? EYE_MAP[c.toUpperCase()] ?? c : c;
}

/** Палитра радужки: обычная и «эмоция» (в шаблоне — mid/mid2, in/in2). */
export const EYE_PAL = { mid: '#5FB0D6', mid2: '#7FC2DF', inn: '#A9D6E8', inn2: '#D3ECF4' };

/** Новые слои радужки варианта G (THEMES.soft): градиенты [доля, цвет, прозрачность] и цвета. */
export const SOFT = {
  well: [[0, '#02060A', .95], [.48, '#0B2233', .7], [.8, '#3E7A99', .18], [1, '#3E7A99', 0]] as [number, string, number][],
  rim: [[0, '#A9D6E8', 0], [.7, '#A9D6E8', 0], [.88, '#CDEAF3', .38], [1, '#CDEAF3', 0]] as [number, string, number][],
  back: [[0, '#F4B9C3', .5], [1, '#F4B9C3', 0]] as [number, string, number][],
  glow: [[0, '#FFFFFF', 1], [.3, '#FBE1DA', .55], [1, '#F4B9C3', 0]] as [number, string, number][],
  c1: '#A8C5D6', c2: '#5FB0D6', c3: '#D3ECF4', c4: '#F7E3DA', star: '#FFF4EF',
};

// ---------- палитра «Морской закат» для всего интерфейса MIRA (эксперт, 2026-11-17; цвета сняты с образца) ----------
// Роли (одна роль — один цвет, акцент действий один — так советуют для тёмной темы):
//   sea      — действия (кнопки, выбранное) и индикатор MIRA; на заливке — тёмный текст (белый на нём 2:1 — не читается)
//   pink     — статус и отметки («Разбор открыт», «ВЫ»), неон визора; переход sea → pink — «закат» (дуга часов)
//   peach    — редкие тёплые блики; lavender — второстепенный текст; mist — имя MIRA; deep — дорожки и неактивное
// Контраст на фоне #0A0A0B: lavender 9.4 · pink 12.4 · peach 16.0 · mist 10.9 · sea 9.6 · deep 5.7 (норма — 4.5).
export const SEA = {
  lavender: '#AAB2CA', pink: '#F7BEC8', peach: '#F4E4DA', mist: '#A7C5D4', sea: '#67C1D7', deep: '#5492AB',
  seaPressed: '#55AFC6', onSea: '#0A0A0B',
};

// ---------- визор «закат» ----------
/** Неоновая рамка (утолщения) и центральные точки визора. */
export const DUSK = {
  accent: '#F4BFC8',
  dotCore: '#FFF1EC',
  dotGlow: 'rgba(244,185,195,.95)',
  dotGlow2: 'rgba(244,185,195,.45)',
  rowGlow: 'rgba(244,185,195,.95)',   // подсветка активной строки списка техник
  attention: '#8FCBE3',               // статус «внимание» (было #8B84FF)
  emotion: '#F4BFC8',
};

/** Фиолетовый (тон 220…300°) → морской голубой: тон 199°, насыщенность ×0.62, светлота та же (hudPalette.conv). */
function conv(r: number, g: number, b: number): [number, number, number] {
  'worklet';
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [r, g, b];
  let h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 220 || h > 300) return [r, g, b];
  const s1 = Math.min(1, (d / (1 - Math.abs(2 * l - 1))) * .62), h1 = 199;
  const c = (1 - Math.abs(2 * l - 1)) * s1, x = c * (1 - Math.abs(((h1 / 60) % 2) - 1)), m = l - c / 2;
  return [Math.round(m * 255), Math.round((x + m) * 255), Math.round((c + m) * 255)];
}

/** Цвет визора (#RRGGBB, rgb(…), rgba(…)) → вариант «закат». */
export function dusk(s: string): string {
  'worklet';
  if (s[0] === '#' && s.length === 7) {
    const n = parseInt(s.slice(1), 16), c = conv(n >> 16, (n >> 8) & 255, n & 255);
    return '#' + c.map((v) => (v < 16 ? '0' : '') + v.toString(16)).join('');
  }
  const m = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(.*)$/);
  if (!m) return s;
  const c = conv(+m[1], +m[2], +m[3]);
  return (s.startsWith('rgba') ? 'rgba(' : 'rgb(') + c.join(',') + m[4];
}
