import {
  advancedFor,
  STYLE_NAMES,
  type Advanced,
  type FightPage,
  type Hand,
  type StyleUsage,
  type Wrestler,
  type WrestlerStats,
} from '@/api/fight';
import { plural } from '@/lib/format';
import { colors } from '@/theme/tokens';

import type { Info } from './info-sheet';
import type { MirrorRowData } from './mirror-row';
import { fc } from './palette';

export type Side = { id: string; first: string; last: string; full: string };

function sideOf(w: Wrestler | null, id: string, fallback: string): Side {
  const [f = '', ...rest] = fallback.split(' ');
  const first = w?.firstName?.trim() || f;
  const last = w?.lastName?.trim() || rest.join(' ') || f;
  return { id, first, last, full: `${first} ${last}`.trim() || fallback };
}

export function sides(d: FightPage): [Side, Side] {
  return [
    sideOf(d.wrestler1, d.fight.wrestler1Id, d.fight.wrestler1Name),
    sideOf(d.wrestler2, d.fight.wrestler2Id, d.fight.wrestler2Name),
  ];
}

export const handLabel = (h: string | null) => (h === 'Left' ? 'Левая рука' : h === 'Right' ? 'Правая рука' : null);

/** «Best of 7» → «До 4 побед». */
export function bestOfLabel(bestOf: string | null) {
  const n = Number(bestOf);
  if (!Number.isFinite(n) || n <= 0) return null;
  const wins = Math.ceil(n / 2);
  return `До ${wins} ${plural(wins, ['победы', 'побед', 'побед'])}`;
}

/** Заголовок прогноза по разнице шансов. */
export function miraHeadline(leader: string, diff: number) {
  if (diff <= 6) return 'Почти равный бой';
  return `${leader} — фаворит`;
}

/** Уровни уверенности и риска апсета — пороги и цвета как на сайте. */
export const confidenceLevel = (pct: number) =>
  pct >= 75
    ? { label: 'Высокая уверенность', color: '#3DBE7A' }
    : pct >= 55
      ? { label: 'Средняя уверенность', color: '#E8B931' }
      : { label: 'Низкая уверенность', color: '#E07C3A' };

export const upsetLevel = (pct: number) =>
  pct >= 60
    ? { label: 'Очень высокий риск апсета', color: '#E5483F' }
    : pct >= 50
      ? { label: 'Высокий риск апсета', color: '#E07C3A' }
      : pct >= 40
        ? { label: 'Умеренный риск апсета', color: '#E8B931' }
        : { label: 'Низкий риск апсета', color: '#3DBE7A' };

// ── Форматирование ──

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const pct = (v: number | null | undefined) => (finite(v) ? `${f1(v)}%` : '—');
const int = (v: number | null | undefined) => (finite(v) ? String(Math.round(v)) : '—');
const val = (v: number | null | undefined) => (finite(v) ? v : null);
const rounds = (n: number) => `${n} ${plural(n, ['раунд', 'раунда', 'раундов'])}`;
const year = (iso: string | null | undefined) => (iso && iso.length >= 4 ? iso.slice(0, 4) : '—');
const shortDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y.slice(2)}` : '—';
};

const deltaOf = (a: number | null, b: number | null, unit = '') => {
  if (a == null || b == null) return undefined;
  const d = Math.round((a - b) * 10) / 10;
  return {
    text: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}${unit}`,
    color: d > 0 ? colors.text : d < 0 ? fc.second : fc.dim,
  };
};

const trendText = (v: number | null | undefined) =>
  finite(v) ? `${v >= 0 ? '▲ +' : '▼ −'}${f1(Math.abs(v))}%` : '—';
const trendColor = (v: number | null | undefined) => (finite(v) ? (v >= 0 ? '#5FD99A' : fc.coral) : fc.dim);

const simpleRow = (
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
  better: 1 | -1 | 0,
  fmt: (v: number | null | undefined) => string = int,
): MirrorRowData => ({ label, l: fmt(a), r: fmt(b), lv: val(a), rv: val(b), better });

// ── Категории сравнения ──

export function formRows(
  a: WrestlerStats | null,
  b: WrestlerStats | null,
  hand: Hand,
  opts: { expert?: boolean } = {},
): MirrorRowData[] {
  const A = advancedFor(a, hand);
  const B = advancedFor(b, hand);
  const recentN = Math.max(A?.recentSampleSize ?? 0, B?.recentSampleSize ?? 0) || 5;
  const rows: MirrorRowData[] = [
    simpleRow(`Победы за ${recentN} ${plural(recentN, ['бой', 'боя', 'боёв'])}`, A?.recentWinRate, B?.recentWinRate, 1, pct),
    simpleRow('Победы за карьеру', A?.careerWinRate, B?.careerWinRate, 1, pct),
    { ...simpleRow('Дней без боя', A?.daysSinceLastFight, B?.daysSinceLastFight, 0), noBar: true },
    {
      label: 'Тренд формы',
      l: trendText(A?.formTrend),
      r: trendText(B?.formTrend),
      lv: null,
      rv: null,
      better: 0,
      noBar: true,
      lColor: trendColor(A?.formTrend),
      rColor: trendColor(B?.formTrend),
    },
  ];
  if (opts.expert) {
    rows.push(
      simpleRow('Лучшая серия побед', A?.longestWinStreak, B?.longestWinStreak, 1),
      simpleRow('Худшая серия поражений', A?.longestLossStreak, B?.longestLossStreak, -1),
    );
  }
  return rows;
}

const GRIPS: [key: string, label: string][] = [
  ['freeGrip', 'Свободный захват'],
  ['refereeGrip', 'Судейский захват'],
  ['freeGripAndStrap', 'Свободный + ремни'],
  ['refereeGripAndStrap', 'Судейский + ремни'],
];

/** Захваты: доля выигранных раундов (с разницей в центре) или число раундов в каждом захвате. */
export function gripRows(a: WrestlerStats | null, b: WrestlerStats | null, hand: Hand, mode: 'win' | 'rounds') {
  const ga = a?.roundStats?.gripWinRate;
  const gb = b?.roundStats?.gripWinRate;
  const suffix = hand === 'Right' ? 'Right' : 'Left';
  const count = (g: typeof ga, key: string) => g?.[`${key}${suffix}Count`] ?? 0;
  let hasSmall = false;

  if (mode === 'rounds') {
    const rows: MirrorRowData[] = GRIPS.map(([key, label]) => simpleRow(label, count(ga, key), count(gb, key), 0));
    const tl = GRIPS.reduce((s, [k]) => s + count(ga, k), 0);
    const tr = GRIPS.reduce((s, [k]) => s + count(gb, k), 0);
    rows.push(simpleRow('Всего раундов', tl, tr, 0));
    return { rows, hasSmall };
  }

  const rows: MirrorRowData[] = GRIPS.map(([key, label]) => {
    const ln = count(ga, key);
    const rn = count(gb, key);
    const lv = ln > 0 ? val(ga?.[`${key}${suffix}`]) : null;
    const rv = rn > 0 ? val(gb?.[`${key}${suffix}`]) : null;
    const lSmall = ln > 0 && ln < 5;
    const rSmall = rn > 0 && rn < 5;
    if (lSmall || rSmall) hasSmall = true;
    return {
      label,
      l: lv == null ? '—' : `${Math.round(lv)}%`,
      r: rv == null ? '—' : `${Math.round(rv)}%`,
      lv,
      rv,
      better: 1,
      delta: deltaOf(lv == null ? null : Math.round(lv), rv == null ? null : Math.round(rv), '%'),
      ln: ln ? rounds(ln) : 'нет раундов',
      rn: rn ? rounds(rn) : 'нет раундов',
      lSmall,
      rSmall,
    };
  });
  return { rows, hasSmall };
}

const ANTHRO: [keyof Wrestler, keyof NonNullable<NonNullable<WrestlerStats['advanced']>['anthroPercentiles']>, string][] = [
  ['height', 'height', 'Рост, см'],
  ['weight', 'weight', 'Вес, кг'],
  ['bicep', 'bicep', 'Бицепс, см'],
  ['forearm', 'forearm', 'Предплечье, см'],
  ['wristSize', 'wrist', 'Запястье, см'],
];

/** Антропометрия; в режиме «Эксперт» под значениями — перцентиль среди атлетов того же пола. */
export function physRows(d: FightPage, expert: boolean) {
  const pa = d.statsA?.advanced?.anthroPercentiles;
  const pb = d.statsB?.advanced?.anthroPercentiles;
  const cohort = pa?.cohortSize ?? pb?.cohortSize ?? null;
  const rows: MirrorRowData[] = ANTHRO.map(([key, pKey, label]) => {
    const lv = (d.wrestler1?.[key] as number | null) || null;
    const rv = (d.wrestler2?.[key] as number | null) || null;
    const lp = lv ? val(pa?.[pKey]) : null;
    const rp = rv ? val(pb?.[pKey]) : null;
    return {
      ...simpleRow(label, lv, rv, 0),
      ...(expert
        ? {
            ln: lp != null ? `перцентиль ${lp}` : 'нет данных',
            rn: rp != null ? `перцентиль ${rp}` : 'нет данных',
            lnStrong: lp === 100,
          }
        : {}),
    };
  });
  return { rows, cohort };
}

export type Rating = { name: string; a: number | null; b: number | null };

/** Физические оценки по шкале до 10. */
export function ratings(d: FightPage): Rating[] {
  const keys: [keyof Wrestler, string][] = [
    ['sidePressure', 'Боковое давление'],
    ['wrist', 'Запястье'],
    ['angle', 'Угол'],
    ['stamina', 'Выносливость'],
    ['pronaton', 'Пронация'],
  ];
  return keys
    .map(([k, name]) => ({ name, a: val(d.wrestler1?.[k] as number | null), b: val(d.wrestler2?.[k] as number | null) }))
    .filter((r) => r.a != null || r.b != null);
}

export function experienceRows(A: Advanced | null, B: Advanced | null): MirrorRowData[] {
  const yearsFmt = (v: number | null | undefined) => (finite(v) ? `${f1(v)} ${plural(Math.floor(v), ['год', 'года', 'лет'])}` : '—');
  return [
    simpleRow('Стаж', A?.careerSpanYears, B?.careerSpanYears, 1, yearsFmt),
    simpleRow('Боёв в год', A?.fightsPerYear, B?.fightsPerYear, 1, (v) => (finite(v) ? f1(v) : '—')),
    simpleRow('Завершённых боёв', A?.totalFinishedFights, B?.totalFinishedFights, 1),
    { label: 'Дебют', l: year(A?.debutDate), r: year(B?.debutDate), lv: null, rv: null, better: 0, noBar: true },
    {
      label: 'Последний бой',
      l: shortDate(A?.lastFightDate),
      r: shortDate(B?.lastFightDate),
      lv: null,
      rv: null,
      better: 0,
      noBar: true,
    },
    simpleRow('Самый долгий простой', A?.longestLayoffDays, B?.longestLayoffDays, -1, (v) => (finite(v) ? `${v} дн` : '—')),
  ];
}

export function dominanceRows(A: Advanced | null, B: Advanced | null): MirrorRowData[] {
  return [
    simpleRow('Средний разрыв в победах', A?.averageWinMargin, B?.averageWinMargin, 1, (v) => (finite(v) ? f1(v) : '—')),
    simpleRow('Победы всухую', A?.cleanSweepWins, B?.cleanSweepWins, 1),
    simpleRow('Поражения всухую', A?.cleanSweepLosses, B?.cleanSweepLosses, -1),
    simpleRow('Победы в равных боях', A?.closeWins, B?.closeWins, 1),
    simpleRow('Поражения в равных боях', A?.closeLosses, B?.closeLosses, -1),
    simpleRow('Победы с отыгрышем', A?.comebackWins, B?.comebackWins, 1),
  ];
}

export function flashRows(a: WrestlerStats | null, b: WrestlerStats | null): MirrorRowData[] {
  const idx = (v: number | null | undefined) => (finite(v) ? f1(v) : '—');
  return [
    simpleRow('Флешпины всего', a?.flashPins, b?.flashPins, 1),
    simpleRow('Флешпины правой', a?.rightFlashPins, b?.rightFlashPins, 1),
    simpleRow('Флешпины левой', a?.leftFlashPins, b?.leftFlashPins, 1),
    simpleRow('Победы по фолам соперника', a?.winsByFouls, b?.winsByFouls, 1),
    simpleRow('Свои фолы', a?.totalFouls, b?.totalFouls, -1),
    simpleRow('Индекс эффективности · правая', a?.efficiencyIndexRight, b?.efficiencyIndexRight, 1, idx),
    simpleRow('Индекс эффективности · левая', a?.efficiencyIndexLeft, b?.efficiencyIndexLeft, 1, idx),
  ];
}

/** Сила оппозиции; нули API ставит, когда данных нет, — их показываем прочерком. */
export function oppositionRows(A: Advanced | null, B: Advanced | null): MirrorRowData[] {
  const nz = (v: number | null | undefined) => (finite(v) && v !== 0 ? v : null);
  const main = (s: Advanced | null) =>
    s?.mainEventFights ? `${s.mainEventWins ?? 0} из ${s.mainEventFights}` : '—';
  const mainPct = (s: Advanced | null) => (s?.mainEventFights ? ((s.mainEventWins ?? 0) / s.mainEventFights) * 100 : null);
  return [
    simpleRow('Винрейт соперников', nz(A?.averageOpponentWinRate), nz(B?.averageOpponentWinRate), 1, pct),
    simpleRow('Качественные победы', A?.qualityWins, B?.qualityWins, 1),
    { label: 'Главные бои · победы', l: main(A), r: main(B), lv: mainPct(A), rv: mainPct(B), better: 1 },
  ];
}

export type Interval = { name: string; p: number; lo: number; hi: number; second: boolean };

/** 95% доверительный интервал винрейта; null — API не посчитал (нули). */
export function intervals(A: Advanced | null, B: Advanced | null, a: Side, b: Side): Interval[] | null {
  const one = (s: Advanced | null, name: string, second: boolean): Interval | null =>
    s && finite(s.careerWinRate) && finite(s.winRateUpperBound) && s.winRateUpperBound > 0
      ? { name, p: s.careerWinRate, lo: s.winRateLowerBound ?? 0, hi: s.winRateUpperBound, second }
      : null;
  const list = [one(A, a.last, false), one(B, b.last, true)].filter((x): x is Interval => !!x);
  return list.length ? list : null;
}

// ── Стили ──

export type StyleRow = { name: string; a: number; b: number };

export function styleRows(d: FightPage, hand: Hand | 'all'): StyleRow[] {
  const pick = (s: StyleUsage | undefined) =>
    !s ? 0 : hand === 'all' ? s.usageCount : hand === 'Right' ? s.rightHandCount : s.leftHandCount;
  return STYLE_NAMES.map((name) => ({
    name,
    a: pick(d.stylesA.find((s) => s.styleName === name)),
    b: pick(d.stylesB.find((s) => s.styleName === name)),
  }))
    .filter((r) => r.a > 0 || r.b > 0)
    .sort((x, y) => y.a + y.b - (x.a + x.b));
}

const topStyles = (list: StyleUsage[], n: number) =>
  list
    .filter((s) => s.usageCount > 0 && STYLE_NAMES.includes(s.styleName))
    .sort((x, y) => y.usageCount - x.usageCount)
    .slice(0, n)
    .map((s) => s.styleName);

export type MatrixView = {
  rows: string[];
  cols: string[];
  /** % побед стиля бойца A (строка) против стиля бойца B (столбец). */
  value: (r: number, c: number) => number | null;
};

/** Главные стили каждого (до 3) и исход их столкновений по всей базе. */
export function matrixView(d: FightPage): MatrixView | null {
  const m = d.styleMatrix;
  if (!m) return null;
  const rows = topStyles(d.stylesA, 3);
  const cols = topStyles(d.stylesB, 3);
  if (!rows.length || !cols.length) return null;
  return {
    rows,
    cols,
    value: (r, c) => {
      const v = m[STYLE_NAMES.indexOf(rows[r])]?.[STYLE_NAMES.indexOf(cols[c])];
      return finite(v) ? Math.round(v) : null;
    },
  };
}

/** Главное столкновение: основной стиль A против основного стиля B — «Flop press › Top roll 61/39». */
export function mainMatchup(view: MatrixView | null) {
  const v = view?.value(0, 0);
  if (!view || v == null) return null;
  const aWins = v >= 50;
  return {
    stronger: aWins ? view.rows[0] : view.cols[0],
    weaker: aWins ? view.cols[0] : view.rows[0],
    hi: Math.max(v, 100 - v),
    lo: Math.min(v, 100 - v),
  };
}

// ── Единицы и страны ──

export const lb = (kg: number) => Math.round(kg * 2.20462);
export const inches = (cm: number) => `${(cm / 2.54).toFixed(1)}″`;
export function feet(cm: number) {
  const total = Math.round(cm / 2.54);
  return `${Math.floor(total / 12)}′${total % 12}″`;
}

export { countryName } from '@/lib/countries';

/** Пояснения к блокам — в шторке по кнопке «i». */
export const INFO = {
  mira: {
    title: 'Прогноз M.I.R.A.',
    body: [
      'Предматчевая вероятность победы по модели. Это не результат и не гарантия.',
      'Concept / beta — модель ещё обучается.',
    ],
  },
  conf: (v: number): Info => ({
    title: `${confidenceLevel(v).label} · ${v}%`,
    body: [
      'Отдельная оценка уверенности M.I.R.A. в этом прогнозе. Это не вероятность победы.',
      'Шкала: до 55% — низкая, 55–75% — средняя, выше — высокая.',
    ],
  }),
  upset: (v: number, underdog: string, leaderPct: number): Info => ({
    title: `${upsetLevel(v).label} · ${v}%`,
    body: [
      `Показатель upset risk из модели. Он не складывается с ${leaderPct}% и не равен шансу ${underdog}.`,
      'Цвет: зелёный — низкий, жёлтый — умеренный, оранжевый — высокий, красный — очень высокий.',
    ],
  }),
  hist: (v: number, n: number): Info => ({
    title: `Историческая надёжность · ${v}%`,
    body: [
      `Доля верных прогнозов на ${n} ${plural(n, ['похожем бое', 'похожих боях', 'похожих боях'])}. Прошлые результаты не гарантируют будущие.`,
    ],
  }),
  layers: {
    title: 'Слои прогноза',
    body: [
      'ML — модель машинного обучения. Elo — рейтинг по истории боёв. Fusion — итоговый слой, который сводит остальные. Антропометрия — шанс только по физическим данным.',
      'Итоговый прогноз M.I.R.A. — это ML-слой; остальные показывают, с чем он согласен.',
    ],
  },
  matrix: {
    title: 'Матрица стилей',
    body: [
      'Процент побед в столкновениях стиля против стиля по всей базе Cold Arms, а не только у этих двух атлетов.',
      'Строки — главные стили первого бойца, столбцы — второго.',
    ],
  },
  grips: {
    title: 'Захваты',
    body: [
      'Винрейт — доля выигранных раундов в каждом типе захвата. Под ним размер выборки, в центре — разница.',
      'Раунды — сколько раундов каждый провёл в этом захвате.',
    ],
  },
  form: {
    title: 'Форма',
    body: [
      'Победы в последних боях и за карьеру на эту руку, плюс сколько дней прошло с последнего боя.',
      'Тренд — изменение доли побед в последних боях относительно карьеры.',
    ],
  },
  phys: {
    title: 'Физика',
    body: [
      'Прочерк — измерения нет в источнике, а не нулевое значение.',
      'Перцентиль — место среди атлетов того же пола: 100 — максимум. Оценки — по шкале до 10.',
    ],
  },
  small: {
    title: 'Малая выборка',
    body: [
      'Меньше 5 раундов — процент ненадёжен: 100% на 2 раундах — это два выигранных раунда, а не доминирование. Сравнивайте и процент, и число раундов.',
    ],
  },
  common: {
    title: 'Общие соперники',
    body: [
      'Победы и поражения в поединках против одного и того же соперника — не счёт по раундам.',
      'Это контекст опыта, а не фактор прогноза M.I.R.A.',
    ],
  },
  dom: {
    title: 'Доминирование',
    body: ['Всухую — 4–0. Равный бой — 4–3. С отыгрышем — победа после счёта 0–2 или хуже.'],
  },
  flash: {
    title: 'Флешпины и фолы',
    body: ['Флешпин — победа в раунде почти мгновенно, со старта. Индекс эффективности — сводная оценка результативности раундов на эту руку.'],
  },
  deep: {
    title: 'Сила оппозиции',
    body: [
      'Винрейт соперников — насколько сильными были противники за карьеру. Качественная победа — над сильным соперником.',
      'Доверительный интервал показывает, насколько винрейт может отличаться от истинного из-за размера выборки.',
    ],
  },
  styles: {
    title: 'Стили борьбы',
    body: [
      'Частота — сколько раундов боец провёл этим стилем.',
      'Эффективность — сводные оценки техники, тактики, силы и старта.',
    ],
  },
} satisfies Record<string, Info | ((...args: never[]) => Info)>;
