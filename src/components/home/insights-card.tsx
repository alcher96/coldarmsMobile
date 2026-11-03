import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useAnimatedValue,
  useWindowDimensions,
  View,
  type FlatList,
} from 'react-native';

import { loadInsights, loadKpis, type Insight } from '@/api/analytics';
import { KpiGrid } from '@/components/analytics/kit';
import { Card, Eyebrow, Title } from '@/components/ui';
import { useAsync } from '@/hooks/use-async';
import { markHintLearned, markHintShown, shouldShowHint } from '@/lib/hints';
import { fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii, space } from '@/theme/tokens';

const GAP = 10;
const Gap = () => <View style={{ width: GAP }} />;

const DOT = 6;
const DOT_ON = 18;
/** Насколько лента уезжает в подсказке «листается». */
const NUDGE = 64;
const HINT = 'insights_swipe';

/**
 * «Данные, которые решают» на главной — витрина: итоговые цифры и карусель инсайтов, по одной
 * мысли на карточку; всё остальное — на экране аналитики. Запросы уходят, только когда блок
 * доехал до экрана (`active`), как на сайте; `inView` — карусель видна, можно подсказать жестом;
 * `refreshKey` растёт при «потянуть вниз».
 */
export function InsightsCard({ active, inView, refreshKey }: { active: boolean; inView: boolean; refreshKey: number }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Eyebrow>Аналитика</Eyebrow>
        <Pressable style={styles.link} onPress={() => router.push('/analytics')} hitSlop={8}>
          <Text style={styles.linkText}>Вся аналитика</Text>
          <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
        </Pressable>
      </View>
      <Title>Данные, которые решают</Title>
      {active ? <Content refreshKey={refreshKey} inView={inView} /> : <View style={styles.placeholder} />}
    </Card>
  );
}

function Content({ refreshKey, inView }: { refreshKey: number; inView: boolean }) {
  const load = useCallback(
    () => Promise.all([loadKpis(refreshKey > 0), loadInsights(refreshKey > 0)]),
    [refreshKey],
  );
  const { data, error, refresh } = useAsync(load);

  if (!data) {
    return error ? (
      <View style={styles.error}>
        <Text style={styles.errorText}>Аналитика временно недоступна</Text>
        <Pressable onPress={refresh} hitSlop={8}>
          <Text style={styles.retry}>Повторить</Text>
        </Pressable>
      </View>
    ) : (
      <ActivityIndicator color={colors.text} style={styles.placeholder} />
    );
  }

  const [kpis, insights] = data;
  return (
    <>
      <KpiGrid kpis={kpis} />
      <Carousel insights={insights} hint={inView} />
    </>
  );
}

/**
 * Лента инсайтов. Что её можно листать, подсказывают три вещи: следующая карточка выглядывает
 * справа, точки под лентой и — один раз, пока человек сам не пролистал — короткое движение ленты.
 */
function Carousel({ insights, hint }: { insights: Insight[]; hint: boolean }) {
  const { width } = useWindowDimensions();
  const itemWidth = Math.round((width - space.gutter * 2 - space.cardPad * 2) * 0.84);
  const step = itemWidth + GAP;
  const list = useRef<FlatList<Insight>>(null);
  const touched = useRef(false);
  const scrollX = useAnimatedValue(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  // Где лента встаёт на каждой карточке; последняя упирается в конец ленты, а не в свой шаг.
  const end = viewWidth && contentWidth ? Math.max(0, contentWidth - viewWidth) : Infinity;
  const stops = insights.map((_, i) => Math.min(i * step, end));

  // Подсказка движением: лента чуть уезжает к следующей карточке и возвращается.
  useEffect(() => {
    if (!hint || insights.length < 2) return;
    let alive = true;
    let back: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(async () => {
      if (!(await shouldShowHint(HINT)) || !alive || touched.current) return;
      markHintShown(HINT);
      list.current?.scrollToOffset({ offset: NUDGE, animated: true });
      back = setTimeout(() => {
        if (alive && !touched.current) list.current?.scrollToOffset({ offset: 0, animated: true });
      }, 500);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(start);
      clearTimeout(back);
    };
  }, [hint, insights.length]);

  return (
    <>
      <Animated.FlatList
        ref={list}
        data={insights}
        horizontal
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <Tile insight={item} width={itemWidth} />}
        ItemSeparatorComponent={Gap}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          if (touched.current) return;
          touched.current = true;
          markHintLearned(HINT);
        }}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      />
      {insights.length > 1 ? <Dots stops={stops} scrollX={scrollX} /> : null}
    </>
  );
}

/** Точки под лентой: сколько карточек и на какой ты; точка текущей длиннее и тянется за пальцем. */
function Dots({ stops, scrollX }: { stops: number[]; scrollX: Animated.Value }) {
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stops.map((at, i) => {
        const inputRange = [stops[i - 1] ?? at - 1, at, stops[i + 1] ?? at + 1];
        const width = scrollX.interpolate({ inputRange, outputRange: [DOT, DOT_ON, DOT], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
        return <Animated.View key={i} style={[styles.dot, { width, opacity }]} />;
      })}
    </View>
  );
}

/** Одна мысль: крупная цифра и строка пояснения. Ведёт в нужный раздел экрана аналитики. */
function Tile({ insight, width }: { insight: Insight; width: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/analytics', params: { section: insight.section } })}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${insight.title}: ${insight.value} ${insight.text}. ${insight.foot}`}>
      <View style={styles.tileHead}>
        <Text style={styles.tileTitle} numberOfLines={1} {...fitText}>
          {insight.title}
        </Text>
        <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
      </View>
      <Text style={styles.tileValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
        {insight.value}
      </Text>
      <Text style={styles.tileText}>{insight.text}</Text>
      <Text style={styles.tileFoot} numberOfLines={2}>
        {insight.foot}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  placeholder: { minHeight: 120 },
  error: { alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, textDecorationLine: 'underline' },
  // Лента выходит к краям карточки, первая плитка выровнена по тексту блока.
  carousel: { marginHorizontal: -space.cardPad },
  carouselContent: { paddingHorizontal: space.cardPad },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: DOT },
  dot: { height: DOT, borderRadius: DOT / 2, backgroundColor: colors.text },
  tile: {
    minHeight: 172,
    padding: 14,
    gap: 4,
    borderRadius: radii.control + 2,
    backgroundColor: colors.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  pressed: { opacity: 0.75 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileTitle: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.text, marginTop: 4 },
  tileText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text },
  tileFoot: { marginTop: 'auto', paddingTop: 8, fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
});
