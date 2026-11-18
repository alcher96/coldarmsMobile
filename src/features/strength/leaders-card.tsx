// Главная: «Новые лидеры» силовых — таблицы, где сменился первый (свежие смены первыми). Карточка сама листает таблицы:
// в каких упражнении и классе новый лидер, кого он сместил, топ-3; кнопка внизу ведёт в показанную таблицу и меняется
// вместе со слайдом. Листать можно и самому — точки снизу.
import { router, useFocusEffect } from 'expo-router';
import { ArrowUpRight, Crown } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { fc } from '@/components/fight/palette';
import { colors, fonts, radii } from '@/theme/tokens';

import { getHighlights, type Highlights } from './api';
import { LevelBadge, classLabel } from './ui';
import { fmtW, useUnit } from './units';

const SLIDE_MS = 5500;
const MEDAL = ['#F2C46A', '#D8D8DE', '#D99A6C'];

function ago(t: number) {
  const d = Math.floor((Date.now() / 1000 - t) / 86400);
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 5) return `${d} дня назад`;
  return `${d} дней назад`;
}

export function LeadersCard() {
  const unit = useUnit();
  const [data, setData] = useState<Highlights | null>(null);
  const [i, setI] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      getHighlights(ac.signal).then(setData).catch(() => {});
      return () => ac.abort();
    }, []),
  );
  const n = data?.items.length ?? 0;
  const go = useCallback(
    (to: number) => {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setI(to);
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    },
    [fade],
  );
  // листается само; тап по точке — сразу туда, отсчёт заново
  useEffect(() => {
    if (n < 2) return;
    const tm = setTimeout(() => go((i + 1) % n), SLIDE_MS);
    return () => clearTimeout(tm);
  }, [i, n, go]);

  if (!data || !n) return null;
  const it = data.items[Math.min(i, n - 1)];
  const ex = data.exercises.find((e) => e.id === it.exercise);
  const std = { levels: data.levels, classes: data.classes } as Parameters<typeof LevelBadge>[0]['std'];
  const lead = it.top[0];
  const open = () =>
    router.push({ pathname: '/strength', params: { ex: it.exercise, arm: it.arm, sex: it.sex, cls: String(it.cls) } });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Силовые · таблицы лидеров</Text>
          <Text style={styles.title}>Новые лидеры</Text>
        </View>
        <Text style={styles.count}>{i + 1}/{n}</Text>
      </View>

      <Animated.View style={{ opacity: fade, gap: 10 }}>
        <View style={styles.board}>
          <Text style={styles.ex}>{ex?.name ?? it.exercise}</Text>
          <Text style={styles.sub}>
            {it.sex === 'm' ? 'Мужчины' : 'Женщины'} · {classLabel(std, it.sex, it.cls, unit)} · {it.arm === 'right' ? 'правая' : 'левая'} рука
          </Text>
        </View>
        {lead ? (
          <View style={styles.news}>
            <Crown size={15} color="#F2C46A" strokeWidth={2.2} />
            <Text style={styles.newsText} numberOfLines={2}>
              <Text style={styles.newsName}>{lead.name}</Text> — новый лидер, сместил {it.previous.name} ·{' '}
              {ago(it.leaderSince)}
            </Text>
          </View>
        ) : null}
        {it.top.map((t) => (
          <View key={t.rank} style={[styles.row, t.me && styles.rowMe]}>
            <Text style={[styles.rank, { color: MEDAL[t.rank - 1] ?? fc.muted }]}>{t.rank}</Text>
            <Text style={styles.name} numberOfLines={1}>{t.name}{t.me ? ' · ты' : ''}</Text>
            <LevelBadge std={std} level={t.level} small />
            <Text style={styles.kg}>{fmtW(t.kg, unit)}</Text>
          </View>
        ))}
      </Animated.View>

      <View style={styles.dots}>
        {data.items.map((_, k) => (
          <Pressable key={k} onPress={() => k !== i && go(k)} hitSlop={6}>
            <View style={[styles.dot, k === i && styles.dotOn]} />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={open} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
        <Text style={styles.ctaText} numberOfLines={1}>Таблица «{ex?.name ?? it.exercise}»</Text>
        <ArrowUpRight size={16} color={colors.text} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  eyebrow: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: fc.muted },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase', color: colors.text, marginTop: 2 },
  count: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  board: { gap: 2 },
  ex: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted },
  news: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#211B0E', borderWidth: 1, borderColor: '#4A3A1A',
  },
  newsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#E9D9B5' },
  newsName: { fontFamily: fonts.bodySemi, color: '#F2C46A' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, height: 44, borderRadius: 10,
    backgroundColor: '#141416', borderWidth: 1, borderColor: colors.cardBorder,
  },
  rowMe: { borderColor: colors.accent },
  rank: { width: 18, fontFamily: fonts.display, fontSize: 18, textAlign: 'center' },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  kg: { width: 64, textAlign: 'right', fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3A3A40' },
  dotOn: { width: 18, backgroundColor: colors.accent },
  cta: {
    height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1E1E22', borderWidth: 1, borderColor: colors.cardBorder,
  },
  ctaText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
});
