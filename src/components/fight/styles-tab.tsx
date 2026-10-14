import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EffKey, FightPage } from '@/api/fight';
import { colors, fonts, radii } from '@/theme/tokens';

import { InfoButton, type Info } from './info-sheet';
import { INFO, matrixView, styleRows, type Side } from './model';
import { fc } from './palette';

type Mode = 'freq' | 'eff';

const EFF: [key: EffKey, label: string][] = [
  ['technicalEfficiency', 'Техника'],
  ['tacticalEfficiency', 'Тактика'],
  ['powerDominance', 'Сила'],
  ['reactionAndStart', 'Реакция и старт'],
];

/** Стили борьбы: как часто каждый применял стиль и чей стиль сильнее в столкновении. */
export function StylesTab({ data, a, b, onInfo }: { data: FightPage; a: Side; b: Side; onInfo: (info: Info) => void }) {
  const [mode, setMode] = useState<Mode>('freq');
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const view = matrixView(data);

  // Эффективность — по руке боя, как на странице атлета.
  const handKey = data.fight.hand === 'Left' ? 'Left' : 'Right';
  const effOf = (side: 'statsA' | 'statsB', k: EffKey) => data[side]?.styleEffectiveness?.[`${k}${handKey}`] ?? null;
  const hasEff = EFF.some(([k]) => effOf('statsA', k) != null || effOf('statsB', k) != null);
  const fmtEff = (v: number | null) => (v == null ? '—' : String(Math.round(v * 10) / 10));
  const rows =
    mode === 'freq'
      ? styleRows(data, 'all').map((r) => ({ name: r.name, a: r.a, b: r.b, l: String(r.a), r: String(r.b) }))
      : hasEff
        ? EFF.map(([k, name]) => {
            const va = effOf('statsA', k);
            const vb = effOf('statsB', k);
            return { name, a: va ?? 0, b: vb ?? 0, l: fmtEff(va), r: fmtEff(vb) };
          })
        : [];
  // Шкала оценок не ограничена сотней (у левой руки бывает 140), поэтому полосы — от максимума пары.
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b)));

  const v = view?.value(sel[0], sel[1]) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>Стили борьбы</Text>
        <View style={styles.toggle}>
          {(
            [
              ['freq', 'Частота'],
              ['eff', 'Эффективность'],
            ] as const
          ).map(([k, l]) => (
            <Pressable key={k} onPress={() => setMode(k)} style={[styles.toggleItem, mode === k && styles.toggleOn]}>
              <Text style={[styles.toggleText, mode === k && styles.toggleTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.sub}>
        {mode === 'freq'
          ? 'Сколько раундов провёл этим стилем за карьеру'
          : `Оценки на ${handKey === 'Right' ? 'правую' : 'левую'} руку, как на странице атлета`}
      </Text>
      <View style={styles.legend}>
        <Text style={styles.legendText}>{a.last}</Text>
        <Text style={[styles.legendText, { color: fc.second }]}>{b.last}</Text>
      </View>

      {rows.length === 0 ? <Text style={styles.empty}>Нет данных</Text> : null}
      {rows.map((r) => {
        const aWins = r.a > r.b;
        const bWins = r.b > r.a;
        return (
          <View key={r.name} style={styles.row}>
            <Text style={[styles.num, { color: bWins ? fc.second : colors.text }]}>{r.l}</Text>
            <View style={[styles.track, styles.trackLeft]}>
              <View style={[styles.fill, { width: `${(r.a / max) * 100}%`, backgroundColor: bWins ? fc.loser : colors.text }]} />
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {r.name}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(r.b / max) * 100}%`, backgroundColor: aWins ? fc.loser : fc.barB }]} />
            </View>
            <Text style={[styles.num, styles.right, { color: aWins ? fc.second : colors.text }]}>{r.r}</Text>
          </View>
        );
      })}

      <View style={[styles.head, styles.matrixHead]}>
        <Text style={styles.title}>Матрица стилей</Text>
        <InfoButton onPress={() => onInfo(INFO.matrix)} label="Матрица стилей" />
      </View>
      {!view ? (
        <Text style={styles.empty}>Нет данных для этой пары</Text>
      ) : (
        <>
          <Text style={styles.sub}>Главные стили каждого · % побед {a.last} в столкновении</Text>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <View style={styles.gridLabel} />
              {view.cols.map((c) => (
                <Text key={c} style={styles.colLabel} numberOfLines={2}>
                  {c}
                </Text>
              ))}
            </View>
            {view.rows.map((rowName, i) => (
              <View key={rowName} style={styles.gridRow}>
                <Text style={styles.gridLabel} numberOfLines={2}>
                  {rowName}
                </Text>
                {view.cols.map((c, j) => {
                  const cell = view.value(i, j);
                  const on = sel[0] === i && sel[1] === j;
                  const adv = (cell ?? 50) - 50;
                  const bg =
                    cell == null
                      ? fc.chip
                      : adv > 0
                        ? `rgba(244,244,245,${0.15 + (adv / 50) * 0.75})`
                        : adv < 0
                          ? `rgba(229,72,63,${0.12 + (-adv / 50) * 0.6})`
                          : fc.chip;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setSel([i, j])}
                      style={[styles.cell, { backgroundColor: bg }, on && styles.cellOn]}>
                      <Text style={[styles.cellText, adv > 28 && { color: colors.lightText }]}>{cell ?? '—'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisText}>↓ {a.last}</Text>
            <Text style={styles.axisText}>{b.last} →</Text>
          </View>
          {v != null ? (
            <View style={styles.detail}>
              <Text style={styles.detailTitle}>
                {v >= 50 ? view.rows[sel[0]] : view.cols[sel[1]]} › {v >= 50 ? view.cols[sel[1]] : view.rows[sel[0]]} ·{' '}
                {Math.max(v, 100 - v)}/{Math.min(v, 100 - v)}
              </Text>
              <View style={styles.split}>
                <View style={{ width: `${v}%`, backgroundColor: colors.text }} />
                <View style={styles.splitB} />
              </View>
              <View style={styles.splitLabels}>
                <Text style={styles.splitText}>
                  {a.last} {v}%
                </Text>
                <Text style={[styles.splitText, { color: fc.second }]}>
                  {100 - v}% {b.last}
                </Text>
              </View>
              <Text style={styles.note}>
                {v > 50
                  ? `${view.rows[sel[0]]} (${a.last}) исторически выигрывает у ${view.cols[sel[1]].toLowerCase()} в ${v}% столкновений.`
                  : v < 50
                    ? `Здесь преимущество у ${view.cols[sel[1]].toLowerCase()} (${b.last}): ${100 - v}% побед в таких столкновениях.`
                    : 'Равное столкновение стилей.'}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 2 },
  matrixHead: { marginTop: 28 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 4, marginHorizontal: 2 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.small + 2,
    padding: 2,
  },
  toggleItem: { height: 28, paddingHorizontal: 10, borderRadius: 6, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.light },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.second },
  toggleTextOn: { color: colors.lightText },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginHorizontal: 2 },
  legendText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, marginTop: 10, marginHorizontal: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  num: { width: 40, fontFamily: fonts.display, fontSize: 17, color: colors.text },
  right: { textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: fc.chip, overflow: 'hidden' },
  trackLeft: { flexDirection: 'row', justifyContent: 'flex-end' },
  fill: { height: '100%', borderRadius: 4 },
  name: { width: 96, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 12, color: fc.soft },
  grid: { gap: 4, marginTop: 12 },
  gridRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  gridLabel: { width: 76, fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, color: colors.text },
  colLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, color: fc.second, paddingBottom: 4 },
  cell: {
    flex: 1,
    height: 54,
    borderRadius: radii.small,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { borderColor: colors.text },
  cellText: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.dim },
  detail: {
    marginTop: 12,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    padding: 14,
  },
  detailTitle: { fontFamily: fonts.display, fontSize: 17, textTransform: 'uppercase', color: colors.text },
  split: { flexDirection: 'row', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  splitB: { flex: 1, backgroundColor: fc.loser },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  splitText: { fontFamily: fonts.display, fontSize: 13, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft, marginTop: 8 },
});
