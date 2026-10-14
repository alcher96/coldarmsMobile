import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { fc } from './palette';

export type MirrorRowData = {
  label: string;
  /** Подписи значений («80%», «177», «—»). */
  l: string;
  r: string;
  /** Числа для полос; null — нет данных. */
  lv: number | null;
  rv: number | null;
  /** 1 — больше лучше, −1 — меньше лучше (фолы, простой): отстающий становится серым. 0 — без оценки. */
  better: 1 | -1 | 0;
  /** Без полос (даты, тренд). */
  noBar?: boolean;
  /** Цвет значений вместо вычисленного (тренд формы: рост — зелёный, спад — коралловый). */
  lColor?: string;
  rColor?: string;
  /** Разница в центре под подписью («+50%»). */
  delta?: { text: string; color: string };
  /** Под полосами — размер выборки или перцентиль; `small` — выборка меньше 5, процент ненадёжен. */
  ln?: string;
  rn?: string;
  lSmall?: boolean;
  rSmall?: boolean;
  lnStrong?: boolean;
};

/** Строка сравнения: значения по краям, подпись в центре, полосы растут от середины. */
export function MirrorRow({ row, last }: { row: MirrorRowData; last?: boolean }) {
  const { lv, rv, better } = row;
  const max = Math.max(lv ?? 0, rv ?? 0) || 1;
  const both = lv != null && rv != null && lv !== rv;
  const lWin = both && better !== 0 && (better > 0 ? lv > rv : lv < rv);
  const rWin = both && better !== 0 && (better > 0 ? rv > lv : rv < lv);
  const lColor = row.lColor ?? (lv == null && row.l === '—' ? fc.dim : rWin ? fc.second : colors.text);
  const rColor = row.rColor ?? (rv == null && row.r === '—' ? fc.dim : lWin ? fc.second : colors.text);

  return (
    <View style={[styles.row, !last && styles.border]}>
      <View style={styles.top}>
        <Text style={[styles.value, { color: lColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {row.l}
        </Text>
        <View style={styles.mid}>
          <Text style={styles.label}>{row.label}</Text>
          {row.delta ? <Text style={[styles.delta, { color: row.delta.color }]}>{row.delta.text}</Text> : null}
        </View>
        <Text
          style={[styles.value, styles.right, { color: rColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {row.r}
        </Text>
      </View>
      {!row.noBar ? (
        <View style={styles.bars}>
          <View style={[styles.track, styles.trackLeft]}>
            <View style={[styles.fill, { width: `${((lv ?? 0) / max) * 100}%`, backgroundColor: rWin ? fc.loser : colors.text }]} />
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((rv ?? 0) / max) * 100}%`, backgroundColor: lWin ? fc.loser : fc.barB }]} />
          </View>
        </View>
      ) : null}
      {row.ln || row.rn ? (
        <View style={styles.counts}>
          <Sample text={row.ln} small={row.lSmall} strong={row.lnStrong} />
          <Sample text={row.rn} small={row.rSmall} right />
        </View>
      ) : null}
    </View>
  );
}

function Sample({ text, small, right, strong }: { text?: string; small?: boolean; right?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.sample, right && styles.sampleRight]}>
      {small && right ? <View style={styles.dot} /> : null}
      <Text style={[styles.sampleText, strong && { color: colors.text }, small && { color: fc.coral }]}>{text}</Text>
      {small && !right ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  value: { width: 80, fontFamily: fonts.display, fontSize: 21 },
  right: { textAlign: 'right' },
  mid: { flex: 1, alignItems: 'center', paddingTop: 5 },
  label: { textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: fc.second },
  delta: { fontFamily: fonts.display, fontSize: 12, marginTop: 2 },
  bars: { flexDirection: 'row', gap: 4, marginTop: 7 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: fc.track, overflow: 'hidden' },
  trackLeft: { flexDirection: 'row', justifyContent: 'flex-end' },
  fill: { height: '100%', borderRadius: 2 },
  counts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sampleRight: { justifyContent: 'flex-end' },
  sampleText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.dim },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
});
