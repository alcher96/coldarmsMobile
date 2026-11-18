// Раскладка плана «1a · Лента дней» (макет Plan Layouts.dc.html): неделя цикла и 7 дней в одну строку,
// ниже только выбранный день; пояснения — в выезжающей снизу панели, а не текстом на экране.
import { router } from 'expo-router';
import { ChevronLeft, Settings } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mira } from '@/features/analysis/components/mira';

import { DAYS, type Exercise, type PlanWeek } from './types';

export const c = {
  bg: '#0A0A0B',
  card: '#141416',
  line: '#1A1A1D',
  lineSoft: '#1E1E21',
  border: '#2A2B30',
  text: '#F4F4F5',
  soft: '#C9CAD0',
  muted: '#8E8F96',
  dim: '#6E6F76',
  off: '#5E5F66',
  red: '#E5483F',
  violet: '#A9A8FF',
  warn: '#F0B44C',
  done: '#2FBF71',
} as const;

export const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// цвет фазы цикла на полосе недель; разгрузка и лёгкая — бледнее
const PHASE_C: Record<string, string> = {
  многоповторный: '#F4F4F5',
  статика: '#8583FF',
  силовой: '#E5483F',
  тяжёлая: '#E5483F',
  лёгкая: '#F4F4F5',
  разгрузка: '#8E8F96',
};
export const phaseColor = (kind: string) => PHASE_C[kind] ?? c.muted;
const isLight = (kind: string) => kind === 'лёгкая' || kind === 'разгрузка';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const weekLabel = (w: PlanWeek) =>
  (w.kind === 'разгрузка' ? 'Разгрузочная' : cap(w.kind)) + (w.start_work ? ' · + спарринги со стартом' : '');

/** Название упражнения строкой и снаряд второй строкой. */
export const exName = (e: Exercise) => cap(e.targets.join(' + '));
export const exGear = (e: Exercise) => [e.equipment, e.handle].join(' · ');

/** Экран плана: «назад», справа — кнопка-действие; прокрутка; кнопка снизу; панель поверх всего. */
export function PlanShell({
  right,
  top,
  children,
  footer,
  sheet,
}: {
  right?: ReactNode;
  top?: ReactNode; // закреплённая часть над прокруткой (неделя и лента дней)
  children: ReactNode;
  footer?: ReactNode;
  sheet?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/analysis'))} accessibilityLabel="Назад">
          <ChevronLeft size={26} color={c.text} strokeWidth={1.6} />
        </Pressable>
        {right}
      </View>
      {top ? <View style={s.top}>{top}</View> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
        {children}
      </ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
      {sheet}
    </SafeAreaView>
  );
}

export function HeaderTitle({ children }: { children: string }) {
  return <Text style={s.headerTitle}>{children}</Text>;
}

export function GearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={s.back} onPress={onPress} accessibilityLabel="Настройки плана">
      <Settings size={20} color={c.soft} strokeWidth={1.6} />
    </Pressable>
  );
}

export function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={s.pill} onPress={onPress}>
      <Text style={s.pillText}>{label}</Text>
    </Pressable>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

/** Большая кнопка снизу; off — серая (например, «Сегодня отдых»). */
export function BigButton({ label, onPress, off }: { label: string; onPress?: () => void; off?: boolean }) {
  return (
    <Pressable style={[s.big, off && s.bigOff]} onPress={off ? undefined : onPress} disabled={off}>
      <Text style={[s.bigText, off && { color: c.off }]}>{label}</Text>
    </Pressable>
  );
}

/** Неделя цикла: ‹ Неделя N / M › с подписью фазы и полоса недель (выбранная — выше). */
export function WeekCard({ weeks, wk, onPick, onInfo, marks }: {
  weeks: PlanWeek[];
  wk: number;
  onPick: (i: number) => void;
  onInfo: () => void;
  marks?: (i: number) => boolean; // неделя отмечена полностью
}) {
  const w = weeks[wk];
  return (
    <View style={s.weekCard}>
      <View style={s.weekRow}>
        <Pressable style={[s.arrow, { opacity: wk > 0 ? 1 : 0.3 }]} onPress={() => wk > 0 && onPick(wk - 1)} accessibilityLabel="Прошлая неделя">
          <Text style={s.arrowText}>‹</Text>
        </Pressable>
        <Pressable onPress={onInfo} style={{ alignItems: 'center' }} accessibilityLabel="Что на этой неделе">
          <Text style={s.weekTitle}>
            Неделя {w.week} <Text style={{ color: c.dim }}>/ {weeks.length}</Text>
          </Text>
          <Text style={[s.weekSub, { color: isLight(w.kind) ? c.muted : phaseColor(w.kind) }]}>
            {weekLabel(w)} <Text style={{ color: c.dim }}>ⓘ</Text>
          </Text>
        </Pressable>
        <Pressable style={[s.arrow, { opacity: wk < weeks.length - 1 ? 1 : 0.3 }]} onPress={() => wk < weeks.length - 1 && onPick(wk + 1)} accessibilityLabel="Следующая неделя">
          <Text style={s.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={s.bars}>
        {weeks.map((x, i) => (
          <Pressable
            key={x.week}
            onPress={() => onPick(i)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[s.bar, { height: i === wk ? 14 : 8, backgroundColor: marks?.(i) ? c.done : phaseColor(x.kind), opacity: i === wk ? 1 : isLight(x.kind) ? 0.25 : 0.5 }]}
          />
        ))}
      </View>
    </View>
  );
}

/** 7 дней в строку; точка — день тренировки (dot задаёт цвет, null — без точки). */
export function DayStrip({ day, onPick, dot }: { day: string; onPick: (d: string) => void; dot: (d: string) => string | null }) {
  return (
    <View style={s.strip}>
      {DAYS.map((d, i) => {
        const on = d === day;
        const color = dot(d);
        return (
          <Pressable key={d} onPress={() => onPick(d)} style={[s.stripDay, on && s.stripOn]} accessibilityState={{ selected: on }}>
            <Text style={[s.stripText, { color: on ? c.bg : color ? c.text : c.off }]}>{DAY_SHORT[i]}</Text>
            <View style={[s.stripDot, { backgroundColor: color ? (on ? c.bg : color) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Метки под упражнением: ⚠ Техника, статика, +2 кг… */
export function Tag({ label, tone = 'plain', onPress }: { label: string; tone?: 'plain' | 'warn' | 'static' | 'add' | 'rep'; onPress?: () => void }) {
  const t = TAG[tone];
  const body = <Text style={[s.tag, { backgroundColor: t.bg, color: t.fg, borderColor: t.border }]}>{label}</Text>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
const TAG = {
  plain: { bg: '#1C1C1F', fg: c.soft, border: '#1C1C1F' },
  warn: { bg: '#17130B', fg: c.warn, border: '#4A3A1E' },
  static: { bg: '#17172A', fg: c.violet, border: '#17172A' },
  add: { bg: '#0E1A13', fg: c.done, border: '#1D3A27' },
  rep: { bg: '#17150B', fg: '#E8B931', border: '#3E3517' },
};

/** Выезжающая снизу панель с заголовком; тап по затемнению — закрыть. */
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={s.dim} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={s.sheet}>
        <View style={s.grip} />
        <Text style={s.sheetTitle}>{title}</Text>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function SheetText({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <Text style={[s.sheetText, dim && { color: c.muted, fontSize: 13 }]}>{children}</Text>;
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: mira.display, fontSize: 18, textTransform: 'uppercase', color: c.text },
  top: { paddingHorizontal: 16, paddingTop: 2 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.line },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
  pillText: { fontFamily: mira.font, fontSize: 13, color: c.soft },
  eyebrow: { fontFamily: mira.fontSemi, fontSize: 11, letterSpacing: 1.3, color: c.muted, textTransform: 'uppercase' },
  big: { height: 54, borderRadius: 16, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center' },
  bigOff: { backgroundColor: '#1C1C1F' },
  bigText: { fontFamily: mira.displayBold, fontSize: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: c.bg },
  weekCard: { marginTop: 14, backgroundColor: c.card, borderRadius: 16, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 6 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: mira.font, fontSize: 22, color: c.soft },
  weekTitle: { fontFamily: mira.display, fontSize: 17, textTransform: 'uppercase', color: c.text },
  weekSub: { fontFamily: mira.font, fontSize: 12, marginTop: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 6, marginHorizontal: 10 },
  bar: { flex: 1, borderRadius: 2 },
  strip: { flexDirection: 'row', gap: 4, marginTop: 12 },
  stripDay: { flex: 1, height: 56, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', gap: 6 },
  stripOn: { backgroundColor: c.text },
  stripText: { fontFamily: mira.fontSemi, fontSize: 13 },
  stripDot: { width: 5, height: 5, borderRadius: 3 },
  tag: { height: 28, lineHeight: 26, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, overflow: 'hidden', fontFamily: mira.font, fontSize: 12 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.card,
    borderTopWidth: 1,
    borderTopColor: '#232327',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3B40', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: mira.display, fontSize: 20, lineHeight: 23, textTransform: 'uppercase', color: c.text },
  sheetText: { fontFamily: mira.font, fontSize: 15, lineHeight: 22, color: c.soft },
  // строка упражнения
  row: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.line },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  rowName: { flexShrink: 1, fontFamily: mira.fontSemi, fontSize: 16, color: c.text },
  rowNums: { fontFamily: mira.fontBold, fontSize: 16, color: c.text },
  rowSub: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 },
  rowGear: { flexShrink: 1, fontFamily: mira.font, fontSize: 13, color: c.muted },
  rowWas: { fontFamily: mira.font, fontSize: 12, color: c.dim },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  weakDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.red },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  dayName: { fontFamily: mira.display, fontSize: 18, textTransform: 'uppercase', color: c.text },
  dayMeta: { fontFamily: mira.font, fontSize: 12, color: c.muted },
  rest: { marginTop: 12, padding: 22, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center' },
  restText: { fontFamily: mira.font, fontSize: 14, color: c.dim },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
});
