import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { winPct, type AthleteStats } from '@/api/athlete';
import type { Athlete } from '@/api/athletes';
import { FightRow } from '@/components/athlete/fights';
import { MirrorRow, type MirrorRowData } from '@/components/fight/mirror-row';
import { fc } from '@/components/fight/palette';
import { RadarChart } from '@/components/radar-chart';
import { plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

export type AnalyticsCat = 'grips' | 'yearly' | 'arms' | 'anthro' | 'eff' | 'deep';

const CATS: { key: AnalyticsCat; label: string }[] = [
  { key: 'grips', label: 'Захваты' },
  { key: 'yearly', label: 'По годам' },
  { key: 'arms', label: 'Правая / Левая' },
  { key: 'anthro', label: 'Антропометрия' },
  { key: 'eff', label: 'Эффективность' },
  { key: 'deep', label: 'Углублённая' },
];

const RIGHT = '#4AC87C';
const LEFT = '#4AADC8';
const GOLD = '#E8B931';
const f1 = (v: number) => String(Math.round(v * 10) / 10);
const rounds = (n: number) => `${n} ${plural(n, ['раунд', 'раунда', 'раундов'])}`;

/** Аналитика выступлений: одна категория за раз, как вкладки на странице атлета сайта. */
export function AthleteAnalytics({
  athlete,
  stats,
  cat,
  onCat,
}: {
  athlete: Athlete;
  stats: AthleteStats | null;
  cat: AnalyticsCat;
  onCat: (c: AnalyticsCat) => void;
}) {
  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll} contentContainerStyle={styles.cats}>
        {CATS.map((c) => (
          <Pressable key={c.key} onPress={() => onCat(c.key)} style={[styles.cat, cat === c.key && styles.catOn]}>
            <Text style={[styles.catText, cat === c.key && styles.catTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {!stats ? <Text style={styles.empty}>Статистика недоступна</Text> : null}
      {stats && cat === 'grips' ? <Grips s={stats} /> : null}
      {stats && cat === 'yearly' ? <Yearly s={stats} /> : null}
      {stats && cat === 'arms' ? <Arms s={stats} /> : null}
      {cat === 'anthro' ? <Anthro a={athlete} adv={stats?.advanced ?? null} /> : null}
      {stats && cat === 'eff' ? <Efficiency s={stats} /> : null}
      {stats && cat === 'deep' ? <Deep a={stats.advanced} /> : null}
    </View>
  );
}

function Grips({ s }: { s: AthleteStats }) {
  const rs = s.roundStats;
  const g = rs?.gripWinRate;
  if (!rs || !g) return <Text style={styles.empty}>Нет данных о захватах</Text>;
  const list: [string, string, number][] = [
    ['Свободный захват', 'freeGrip', rs.freeGrip],
    ['Судейский захват', 'refereeGrip', rs.refereeGrip],
    ['Свободный + ремень', 'freeGripAndStrap', rs.freeGripAndStrap],
    ['Судейский + ремень', 'refereeGripAndStrap', rs.refereeGripAndStrap],
  ];
  const total = Math.max(1, list.reduce((n, [, , c]) => n + (c ?? 0), 0));
  const rate = (key: string, side: 'Right' | 'Left') => {
    const n = g[`${key}${side}Count`] ?? 0;
    return n > 0 ? `${Math.round(g[`${key}${side}`] ?? 0)}% · ${rounds(n)}` : '—';
  };
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Захваты</Text>
      <Text style={styles.sub}>Доля раундов и винрейт на каждую руку</Text>
      {list.map(([name, key, n]) => (
        <View key={key} style={styles.gripRow}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{name}</Text>
            <Text style={styles.value}>
              {Math.round(((n ?? 0) / total) * 100)}% <Text style={styles.dim}>· {rounds(n ?? 0)}</Text>
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((n ?? 0) / total) * 100}%` }]} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.small}>Правая: {rate(key, 'Right')}</Text>
            <Text style={styles.small}>Левая: {rate(key, 'Left')}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Yearly({ s }: { s: AthleteStats }) {
  const years = (s.yearlyWinRates ?? []).slice().sort((a, b) => b.year - a.year);
  if (!years.length) return <Text style={styles.empty}>Нет данных по годам</Text>;
  return (
    <View style={styles.block}>
      <Text style={styles.title}>По годам</Text>
      <Text style={styles.sub}>Винрейт и число боёв на каждую руку</Text>
      {years.map((y) => (
        <View key={y.year} style={styles.year}>
          <Text style={styles.yearLabel}>{y.year}</Text>
          <View style={styles.flex}>
            <YearBar label="Правая" pct={y.rightHandWinRate} fights={y.rightHandFights} color={colors.text} />
            <YearBar label="Левая" pct={y.leftHandWinRate} fights={y.leftHandFights} color={fc.barB} />
          </View>
        </View>
      ))}
    </View>
  );
}

function YearBar({ label, pct, fights, color }: { label: string; pct: number; fights: number; color: string }) {
  return (
    <View style={styles.yearBar}>
      <Text style={styles.yearHand}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fights ? pct : 0}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.yearValue}>{fights ? `${Math.round(pct)}%` : '—'}</Text>
      <Text style={styles.yearFights}>{fights} б.</Text>
    </View>
  );
}

/** Правая против левой: оценки эффективности по руке и винрейт. */
function Arms({ s }: { s: AthleteStats }) {
  const e = s.styleEffectiveness;
  // Рука без боёв — прочерк, а не ноль.
  const rFought = s.rightArmWins + s.rightArmLosses > 0;
  const lFought = s.leftArmWins + s.leftArmLosses > 0;
  const val = (k: string) => (e?.[k as keyof typeof e] as number | null | undefined) ?? null;
  const row = (label: string, key: string): MirrorRowData => {
    const r = rFought ? val(`${key}Right`) : null;
    const l = lFought ? val(`${key}Left`) : null;
    return { label, l: r == null ? '—' : f1(r), r: l == null ? '—' : f1(l), lv: r, rv: l, better: 1 };
  };
  const rPct = winPct(s.rightArmWins, s.rightArmLosses);
  const lPct = winPct(s.leftArmWins, s.leftArmLosses);
  const rows: MirrorRowData[] = [
    {
      label: 'Win Rate',
      l: rFought ? `${rPct}%` : '—',
      r: lFought ? `${lPct}%` : '—',
      lv: rFought ? rPct : null,
      rv: lFought ? lPct : null,
      better: 1,
    },
    ...(e
      ? [
          row('Техника', 'technicalEfficiency'),
          row('Тактика', 'tacticalEfficiency'),
          row('Сила', 'powerDominance'),
          row('Реакция и старт', 'reactionAndStart'),
        ]
      : []),
  ];
  // Радар: оценки обрезаются до 100, как полосы на сайте; рука без боёв не рисуется.
  const cap = (v: number | null) => Math.min(100, Math.max(0, v ?? 0));
  const keys = ['technicalEfficiency', 'tacticalEfficiency', 'powerDominance', 'reactionAndStart'];
  const radar = (side: 'Right' | 'Left', fought: boolean, wr: number) =>
    fought ? [...keys.map((k) => cap(val(`${k}${side}`))), wr] : null;
  const rRadar = radar('Right', rFought, rPct);
  const lRadar = radar('Left', lFought, lPct);
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Правая / Левая</Text>
      {e && (rRadar || lRadar) ? (
        <View style={styles.radar}>
          <RadarChart
            labels={['Техника', 'Тактика', 'Сила', 'Реакция', 'Win Rate']}
            series={[
              ...(rRadar ? [{ values: rRadar, color: RIGHT }] : []),
              ...(lRadar ? [{ values: lRadar, color: LEFT }] : []),
            ]}
            max={100}
            size={320}
          />
        </View>
      ) : null}
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: RIGHT }]}>● Правая</Text>
        <Text style={[styles.legendText, { color: LEFT }]}>Левая ●</Text>
      </View>
      {rows.map((r, i) => (
        <MirrorRow key={r.label} row={r} last={i === rows.length - 1} />
      ))}
      {!e ? <Text style={styles.empty}>Оценок эффективности пока нет</Text> : null}
    </View>
  );
}

function Efficiency({ s }: { s: AthleteStats }) {
  const w = s.rightArmWins + s.leftArmWins;
  const l = s.rightArmLosses + s.leftArmLosses;
  const total = w + l;
  const flash = (s.rightFlashPins ?? 0) + (s.leftFlashPins ?? 0);
  const tiles: [string, string, string][] = [
    ['Общий Win Rate', `${winPct(w, l)}%`, 'за все матчи'],
    ['Flash Pin Rate', `${total ? Math.trunc((flash * 100) / total) : 0}%`, `${flash} из ${total}`],
    ['Чистых побед', String(w - (s.winsByFouls ?? 0)), 'без нарушений'],
    ['Фолов на матч', total ? f1((s.totalFouls ?? 0) / total) : '0', `${s.totalFouls ?? 0} всего`],
    ['Победы / Поражения', `${w} / ${l}`, `${total} ${plural(total, ['бой', 'боя', 'боёв'])}`],
  ];
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Эффективность</Text>
      <View style={styles.grid}>
        {tiles.map(([label, value, sub]) => (
          <View key={label} style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue}>{value}</Text>
            <Text style={styles.tileSub}>{sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Антропометрия: перцентили среди атлетов того же пола — радар и «топ X%». */
function Anthro({ a, adv }: { a: Athlete; adv: AthleteStats['advanced'] }) {
  const p = adv?.anthroPercentiles;
  const rows: [string, string, number | null, number | null | undefined][] = [
    ['Рост', 'см', a.height, p?.height],
    ['Вес', 'кг', a.weight, p?.weight],
    ['Бицепс', 'см', a.bicep, p?.bicep],
    ['Предплечье', 'см', a.forearm, p?.forearm],
    ['Запястье', 'см', a.wristSize, p?.wrist],
  ];
  const known = (v: number | null, pct: number | null | undefined) => !!v && pct != null;
  const hasPct = rows.some(([, , v, pct]) => known(v, pct));
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Антропометрия</Text>
      <Text style={styles.sub}>
        {hasPct && p?.cohortSize
          ? `Перцентиль среди ${p.cohortSize} атлетов того же пола: 100 — крупнее всех`
          : 'Размеры атлета'}
      </Text>
      {hasPct ? (
        <View style={styles.radar}>
          <RadarChart
            labels={rows.map(([n]) => n)}
            series={[{ values: rows.map(([, , v, pct]) => (known(v, pct) ? (pct as number) : 0)), color: GOLD }]}
            max={100}
            size={320}
          />
        </View>
      ) : null}
      {rows.map(([name, unit, v, pct]) => (
        <View key={name} style={styles.gripRow}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{name}</Text>
            <Text style={styles.value}>
              {v ? `${v} ${unit}` : '—'}
              {known(v, pct) ? <Text style={styles.dim}>{`  · топ ${Math.max(1, 100 - (pct as number))}%`}</Text> : null}
            </Text>
          </View>
          {known(v, pct) ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct ?? 0}%`, backgroundColor: GOLD }]} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const monthYear = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : '—';
};
const winColor = (v: number) => (v >= 80 ? '#4AC87C' : v >= 55 ? '#C8A04A' : v > 0 ? '#C84A4A' : fc.dim);

/** Углублённая аналитика (на сайте закрыта для гостей) — та же раскладка, что у сайта. */
function Deep({ a }: { a: AthleteStats['advanced'] }) {
  if (!a) return <Text style={styles.empty}>Нет данных</Text>;
  const n = (v: number | null | undefined) => (v == null ? '—' : f1(v));
  const streak = a.currentStreak ? `${a.currentStreakType ?? ''}${a.currentStreak}` : '—';
  const streakColor = a.currentStreakType === 'W' ? '#5FD99A' : a.currentStreakType === 'L' ? fc.coral : colors.text;
  const trend = a.formTrend ?? 0;
  const hasRange = (a.winRateUpperBound ?? 0) > 0;

  const summary: { label: string; value: string; color?: string; sub?: string; subColor?: string }[] = [
    {
      label: 'Винрейт за карьеру',
      value: `${n(a.careerWinRate)}%`,
      color: winColor(a.careerWinRate ?? 0),
      sub: hasRange
        ? `95%: ${Math.round(a.winRateLowerBound ?? 0)}–${Math.round(a.winRateUpperBound ?? 0)}%`
        : 'интервал не посчитан',
    },
    { label: 'Текущая серия', value: streak, color: streakColor, sub: `лучшая: ${a.longestWinStreak ?? 0} побед` },
    {
      label: `Форма · ${a.recentSampleSize ?? 5} боёв`,
      value: `${n(a.recentWinRate)}%`,
      color: winColor(a.recentWinRate ?? 0),
      sub: `${trend >= 0 ? '▲ +' : '▼ −'}${f1(Math.abs(trend))}%`,
      subColor: trend >= 0 ? '#5FD99A' : fc.coral,
    },
    {
      label: 'Сила соперников',
      value: a.averageOpponentWinRate ? `${n(a.averageOpponentWinRate)}%` : '—',
      sub: 'их средний винрейт',
    },
  ];
  const how: [string, string][] = [
    ['Победы всухую', n(a.cleanSweepWins)],
    ['Поражения всухую', n(a.cleanSweepLosses)],
    ['Победы в равных боях', n(a.closeWins)],
    ['Поражения в равных', n(a.closeLosses)],
    ['Победы с отыгрышем', n(a.comebackWins)],
    ['Средний разрыв', n(a.averageWinMargin)],
  ];
  const activity: [string, string][] = [
    ['Дебют', monthYear(a.debutDate)],
    ['Последний бой', monthYear(a.lastFightDate)],
    [
      'Стаж',
      a.careerSpanYears == null
        ? '—'
        : `${f1(a.careerSpanYears)} ${plural(Math.floor(a.careerSpanYears), ['год', 'года', 'лет'])}`,
    ],
    ['Боёв в год', n(a.fightsPerYear)],
    ['Дней с последнего боя', n(a.daysSinceLastFight)],
    ['Самый долгий простой', a.longestLayoffDays == null ? '—' : `${a.longestLayoffDays} дн`],
  ];
  const big: [string, number | null][] = [
    [`Главные бои (${a.mainEventWins ?? 0}/${a.mainEventFights ?? 0})`, a.mainEventFights ? (a.mainEventWinRate ?? 0) : null],
    ['Андеркард', a.undercardWinRate ?? null],
  ];
  const sig = a.signatureWins ?? [];
  const top = a.topOpponents ?? [];

  return (
    <View style={styles.block}>
      <View style={styles.grid}>
        {summary.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={[styles.tileValue, t.color ? { color: t.color } : null]}>{t.value}</Text>
            {t.sub ? <Text style={[styles.tileSub, t.subColor ? { color: t.subColor } : null]}>{t.sub}</Text> : null}
          </View>
        ))}
      </View>
      {a.isSmallSample ? (
        <Text style={styles.warn}>
          Малая выборка: {a.totalFinishedFights ?? 0} завершённых боёв — проценты ненадёжны
        </Text>
      ) : null}

      <Text style={[styles.title, styles.groupTitle]}>Как побеждает</Text>
      <View style={styles.grid}>
        {how.map(([label, value]) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.cellLabel}>{label}</Text>
            <Text style={styles.cellValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.title, styles.groupTitle]}>Большие бои</Text>
      {big.map(([label, v]) => (
        <View key={label} style={styles.gripRow}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, v != null ? { color: winColor(v) } : null]}>{v == null ? '—' : `${f1(v)}%`}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${v ?? 0}%`, backgroundColor: winColor(v ?? 0) }]} />
          </View>
        </View>
      ))}

      <View style={[styles.rowBetween, styles.groupTitle]}>
        <Text style={styles.title}>Активность</Text>
        {a.isActive != null ? (
          <Text style={[styles.badge, a.isActive ? styles.badgeOn : styles.badgeOff]}>
            {a.isActive ? 'Активен' : 'Неактивен'}
          </Text>
        ) : null}
      </View>
      <View style={styles.grid}>
        {activity.map(([label, value]) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.cellLabel}>{label}</Text>
            <Text style={styles.cellValue}>{value}</Text>
          </View>
        ))}
      </View>

      {sig.length ? (
        <>
          <Text style={[styles.title, styles.groupTitle]}>Качественные победы · {a.qualityWins ?? sig.length}</Text>
          {sig.map((f) => (
            <FightRow key={f.fightId} f={f} badge="W" />
          ))}
        </>
      ) : null}

      {top.length ? (
        <>
          <Text style={[styles.title, styles.groupTitle]}>Частые соперники</Text>
          {top.map((h) => (
            <Pressable
              key={h.opponentId}
              onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: h.opponentId } })}
              style={({ pressed }) => [styles.opp, pressed && styles.pressed]}>
              <View style={styles.flex}>
                <Text style={styles.oppName}>{h.opponentName}</Text>
                <Text style={styles.small}>
                  {h.total} {plural(h.total, ['встреча', 'встречи', 'встреч'])}
                </Text>
              </View>
              <Text style={styles.h2h}>
                <Text style={{ color: RIGHT }}>{h.wins}</Text>–<Text style={{ color: '#C84A4A' }}>{h.losses}</Text>
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 28 },
  flex: { flex: 1 },
  catsScroll: { marginHorizontal: -16 },
  cats: { gap: 6, paddingHorizontal: 16 },
  cat: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: fc.border,
    backgroundColor: fc.card,
    justifyContent: 'center',
  },
  catOn: { borderColor: colors.accent, backgroundColor: fc.coralBg },
  catText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.soft },
  catTextOn: { color: fc.coral },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, marginTop: 16 },
  block: { marginTop: 18 },
  group: { marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gripRow: { marginTop: 14 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  value: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  dim: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  small: { fontFamily: fonts.body, fontSize: 11, color: fc.second, marginTop: 6 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: fc.track, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.text },
  year: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  yearLabel: { width: 46, fontFamily: fonts.display, fontSize: 18, color: colors.text },
  yearBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  yearHand: { width: 50, fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.muted },
  yearValue: { width: 40, textAlign: 'right', fontFamily: fonts.display, fontSize: 14, color: colors.text },
  yearFights: { width: 32, textAlign: 'right', fontFamily: fonts.body, fontSize: 11, color: fc.dim },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tile: { width: '48.8%', flexGrow: 1, backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.control, padding: 12 },
  tileLabel: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: fc.muted },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginTop: 4 },
  tileSub: { fontFamily: fonts.body, fontSize: 12, color: fc.dim },
  radar: { alignItems: 'center', marginTop: 8 },
  pressed: { opacity: 0.7 },
  warn: {
    marginTop: 10,
    padding: 10,
    borderRadius: radii.control,
    backgroundColor: fc.coralBg,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: fc.coral,
  },
  groupTitle: { marginTop: 22 },
  cell: { width: '48.8%', flexGrow: 1, backgroundColor: fc.chip, borderRadius: radii.control, padding: 12 },
  cellLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  cellValue: { fontFamily: fonts.display, fontSize: 19, color: colors.text, marginTop: 2 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgeOn: { backgroundColor: 'rgba(61,190,122,0.14)', color: '#5FD99A' },
  badgeOff: { backgroundColor: fc.chip, color: fc.muted },
  opp: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  oppName: { fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
  h2h: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 11 },
  kvBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  kvLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  kvValue: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
});
