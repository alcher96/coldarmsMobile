import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadHome } from '@/api/home';
import { AppHeader } from '@/components/app-header';
import { AnalyzeCard } from '@/components/home/analyze-card';
import { FocusCard } from '@/components/home/focus-card';
import { InsightsCard } from '@/components/home/insights-card';
import { NextTournament } from '@/components/home/next-tournament';
import { useAsync } from '@/hooks/use-async';
import { colors, fonts, space, radii } from '@/theme/tokens';

const load = () => loadHome('ru');

export default function HomeScreen() {
  const { data, error, loading, refreshing, refresh } = useAsync(load);
  // Блок аналитики: данные грузятся, когда он подъехал к экрану (с запасом 200), — как ленивые
  // вкладки на сайте; подсказка «ленту можно листать» — пока его нижняя часть с лентой на экране.
  const [insightsActive, setInsightsActive] = useState(false);
  const [insightsInView, setInsightsInView] = useState(false);
  const [insightsKey, setInsightsKey] = useState(0);
  const insightsBox = useRef<{ y: number; height: number } | null>(null);
  const scrollY = useRef(0);
  const viewHeight = useRef(0);
  const track = () => {
    const box = insightsBox.current;
    if (!box || !viewHeight.current) return;
    const top = scrollY.current;
    const bottom = top + viewHeight.current;
    if (!insightsActive && bottom + 200 >= box.y) setInsightsActive(true);
    const end = box.y + box.height;
    const inView = end <= bottom && end - 200 >= top;
    if (inView !== insightsInView) setInsightsInView(inView);
  };
  const onRefresh = () => {
    setInsightsKey((k) => k + 1);
    refresh();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        onLayout={(e) => {
          viewHeight.current = e.nativeEvent.layout.height;
          track();
        }}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          track();
        }}
        scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}>
        {loading && <ActivityIndicator color={colors.text} style={styles.loader} />}

        {!data && error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error.message}</Text>
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {data?.competition && <NextTournament competition={data.competition} mainFight={data.mainFight} />}
        {data && <AnalyzeCard onPress={() => router.navigate('/analysis')} />}
        {data && (
          <View
            onLayout={(e) => {
              insightsBox.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
              track();
            }}>
            <InsightsCard active={insightsActive} inView={insightsInView} refreshKey={insightsKey} />
          </View>
        )}
        {data?.news[0] && <FocusCard news={data.news[0]} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.gutter, gap: space.gap, paddingBottom: 32 },
  loader: { marginTop: 24 },
  error: { alignItems: 'center', gap: 12, marginTop: 16 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
});
