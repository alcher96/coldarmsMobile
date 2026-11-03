import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isSection,
  loadAnthroTop,
  loadFightExperience,
  loadKpis,
  loadMatchInsights,
  loadRestAnalytics,
  loadTriangle,
  SECTIONS,
  type AnalyticsSection,
} from '@/api/analytics';
import { AnthroSection } from '@/components/analytics/anthro';
import { ExperienceSection } from '@/components/analytics/experience';
import { Chips, KpiGrid, Loadable } from '@/components/analytics/kit';
import { PatternsSection } from '@/components/analytics/patterns';
import { RestSection } from '@/components/analytics/rest';
import { RivalriesSection } from '@/components/analytics/rivalries';
import { TriangleSection } from '@/components/analytics/triangle';
import { fc } from '@/components/fight/palette';
import { Title } from '@/components/ui';
import { colors, fonts, space } from '@/theme/tokens';

/** Раздел грузится при первом открытии; `refreshKey` растёт при «потянуть вниз» — тогда в обход кэша. */
function Tab<T>({
  load,
  refreshKey,
  render,
}: {
  load: (force: boolean) => Promise<T>;
  refreshKey: number;
  render: (data: T) => ReactNode;
}) {
  const run = useCallback(() => load(refreshKey > 0), [load, refreshKey]);
  return <Loadable load={run}>{render}</Loadable>;
}

const TABS: Record<AnalyticsSection, (refreshKey: number) => ReactNode> = {
  anthro: (k) => <Tab load={loadAnthroTop} refreshKey={k} render={(d) => <AnthroSection data={d} />} />,
  rest: (k) => <Tab load={loadRestAnalytics} refreshKey={k} render={(d) => <RestSection data={d} />} />,
  triangle: (k) => <Tab load={loadTriangle} refreshKey={k} render={(d) => <TriangleSection data={d} />} />,
  experience: (k) => <Tab load={loadFightExperience} refreshKey={k} render={(d) => <ExperienceSection data={d} />} />,
  patterns: (k) => <Tab load={loadMatchInsights} refreshKey={k} render={(d) => <PatternsSection data={d} />} />,
  rivalries: (k) => <Tab load={loadMatchInsights} refreshKey={k} render={(d) => <RivalriesSection data={d} />} />,
};

/**
 * «Данные, которые решают» — та же аналитика, что во вкладках на главной сайта. Лента разделов
 * прилипает к верху; открытые разделы остаются в памяти, чтобы «Показать все» не сбрасывалось.
 * «Назад» уводит с экрана, а не листает разделы — как на остальных экранах деталей.
 */
export default function AnalyticsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const initial: AnalyticsSection = isSection(params.section) ? params.section : SECTIONS[0].key;
  const [section, setSection] = useState<AnalyticsSection>(initial);
  const [visited, setVisited] = useState<AnalyticsSection[]>([initial]);
  // Ссылка на другой раздел, когда экран уже открыт, меняет параметр, а не открывает экран заново.
  const [linked, setLinked] = useState(params.section);
  if (params.section !== linked) {
    setLinked(params.section);
    if (isSection(params.section)) {
      const next = params.section;
      setSection(next);
      setVisited((v) => (v.includes(next) ? v : [...v, next]));
    }
  }
  const [refreshKey, setRefreshKey] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const chipsY = useRef(0);
  const kpis = useCallback(() => loadKpis(refreshKey > 0), [refreshKey]);
  const { height } = useWindowDimensions();

  const choose = (next: AnalyticsSection) => {
    setSection(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
    // Новый раздел начинается сверху, под прилипшей лентой, а не с середины прошлого.
    if (scrollY.current > chipsY.current) scroll.current?.scrollTo({ y: chipsY.current, animated: false });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.back}
          accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.barTitle}>Аналитика</Text>
      </View>
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.content}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} tintColor={colors.text} />
        }>
        <View style={styles.head}>
          <Title>Данные, которые решают</Title>
          <Text style={styles.sub}>Реальная статистика со всех зарегистрированных матчей — стили, победы, эффективность.</Text>
          <Loadable load={kpis}>{(k) => <KpiGrid kpis={k} />}</Loadable>
        </View>
        <View
          style={styles.chips}
          onLayout={(e) => {
            chipsY.current = e.nativeEvent.layout.y;
          }}>
          <Chips options={SECTIONS} value={section} onChange={choose} inset={space.gutter} />
        </View>
        {/* Не ниже экрана: пока новый раздел грузится, прокрутке есть куда встать — лента остаётся наверху. */}
        <View style={{ minHeight: height }}>
          {visited.map((s) => (
            <View key={s} style={s === section ? null : styles.hidden}>
              {TABS[s](refreshKey)}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 20,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  barTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  content: { paddingHorizontal: space.gutter, paddingBottom: 32 },
  head: { gap: 10, paddingTop: 16, paddingBottom: 6 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  chips: { backgroundColor: colors.bg, paddingVertical: 10, marginHorizontal: -space.gutter },
  hidden: { display: 'none' },
});
