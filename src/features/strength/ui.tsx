// Общие куски экрана «Силовые»: значок уровня, переключатели, таблица нормативов, таблица лидеров.
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import type { Arm, Leader, Sex, Standards } from './api';
import { fmtW, type Unit } from './units';

/** Цвет уровня: фон, текст. «Титан» — тёмный с переливом (рисуется градиентом). */
export const LEVEL_COLORS = [
  { bg: '#2A2A2E', fg: '#C9C9CE' },   // Новичок
  { bg: '#16301F', fg: '#7FD49A' },   // Любитель
  { bg: '#132A40', fg: '#7DB8F2' },   // Атлет
  { bg: '#2A2140', fg: '#B9A2F5' },   // Мастер
  { bg: '#3A2C10', fg: '#F2C46A' },   // Чемпион
  { bg: '#0B0B0D', fg: '#FFFFFF' },   // Титан
];

export function LevelBadge({ std, level, small }: { std: Standards; level: number; small?: boolean }) {
  if (level < 0) return <Text style={[styles.badgeNone, small && { fontSize: 11 }]}>ниже уровней</Text>;
  const lv = std.levels[level];
  const c = LEVEL_COLORS[level];
  const inner = (
    <View style={styles.badgeRow}>
      {lv.proof ? <Crown size={small ? 10 : 12} color={level === 5 ? '#FFE08A' : c.fg} strokeWidth={2.2} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }, small && { fontSize: 10 }]}>{lv.name}</Text>
    </View>
  );
  if (level === 5) {
    return (
      <LinearGradient colors={['#1A1033', '#0B0B0D', '#10262E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.badge, small && styles.badgeSmall, { borderColor: '#6E5BD8' }]}>
        {inner}
      </LinearGradient>
    );
  }
  return <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: c.bg, borderColor: c.bg }]}>{inner}</View>;
}

export function Toggle<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.toggle}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.toggleItem, o.key === value && styles.toggleOn]}>
          <Text style={[styles.toggleText, o.key === value && styles.toggleTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function classLabel(std: Standards, sex: Sex, i: number, u: Unit) {
  const tops = std.classes[sex];
  const top = tops[i];
  if (top === null) return `свыше ${fmtW(tops[i - 1] as number, u)}`;
  return `до ${fmtW(top, u)}`;
}

const COL = 66;
const FIRST = 92;

/** Нормативы: строки — весовые классы, столбцы — уровни; мой класс подсвечен. Широкая — листается вбок. */
export function StandardsTable({ std, exercise, sex, arm, mine, unit }: {
  std: Standards; exercise: string; sex: Sex; arm: Arm; mine: number | null; unit: Unit;
}) {
  const rows = std.table[exercise]?.[sex]?.[arm] ?? [];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { width: FIRST }]}>Класс</Text>
          {std.levels.map((lv, i) => (
            <View key={lv.id} style={{ width: COL, alignItems: 'center' }}>
              <LevelBadge std={std} level={i} small />
            </View>
          ))}
        </View>
        {rows.map((row, ci) => {
          const on = ci === mine;
          return (
            <View key={ci} style={[styles.tr, on && styles.trOn]}>
              <Text style={[styles.tdClass, { width: FIRST }, on && styles.tdOn]}>{classLabel(std, sex, ci, unit)}</Text>
              {row.map((v, i) => (
                <Text key={i} style={[styles.td, { width: COL }, on && styles.tdOn]}>{fmtW(v, unit)}</Text>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function LeadersList({ std, items, me, total, unit }: {
  std: Standards; items: Leader[]; me: Leader | null; total: number; unit: Unit;
}) {
  if (!items.length) return <Text style={styles.empty}>В этом классе пока никого — будь первым.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {items.map((l) => (
        <View key={l.rank} style={[styles.leader, l.me && styles.leaderMe]}>
          <Text style={[styles.rank, l.rank <= 3 && { color: ['#F2C46A', '#D8D8DE', '#D99A6C'][l.rank - 1] }]}>{l.rank}</Text>
          <Text style={styles.lname} numberOfLines={1}>{l.name}{l.me ? ' · ты' : ''}</Text>
          <LevelBadge std={std} level={l.level} small />
          <Text style={styles.lkg}>{fmtW(l.kg, unit)}</Text>
        </View>
      ))}
      {me && !items.some((l) => l.me) ? (
        <Text style={styles.empty}>Ты на {me.rank} месте из {total} · {fmtW(me.kg, unit)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeSmall: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  badgeNone: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  toggle: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.cardBorder },
  toggleItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleOn: { backgroundColor: '#2A2A2F' },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted },
  toggleTextOn: { color: colors.text },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  thead: { minHeight: 34 },
  trOn: { backgroundColor: '#2B1A18' },
  th: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted, paddingLeft: 8 },
  tdClass: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text, paddingLeft: 8 },
  td: { fontFamily: fonts.body, fontSize: 13, color: colors.text, textAlign: 'center' },
  tdOn: { color: '#fff', fontFamily: fonts.bodySemi },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  leader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#141416', borderWidth: 1, borderColor: colors.cardBorder,
  },
  leaderMe: { borderColor: colors.accent },
  rank: { width: 22, fontFamily: fonts.display, fontSize: 18, color: colors.textMuted, textAlign: 'center' },
  lname: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  lkg: { width: 64, textAlign: 'right', fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
});
