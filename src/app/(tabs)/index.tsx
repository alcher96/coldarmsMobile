import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadHome } from '@/api/home';
import { AppHeader } from '@/components/app-header';
import { AnalyzeCard } from '@/components/home/analyze-card';
import { FocusCard } from '@/components/home/focus-card';
import { NextTournament } from '@/components/home/next-tournament';
import { RatingCard } from '@/components/home/rating-card';
import { useAsync } from '@/hooks/use-async';
import { colors, fonts, space, radii } from '@/theme/tokens';

const load = () => loadHome('ru');

export default function HomeScreen() {
  const { data, error, loading, refreshing, refresh } = useAsync(load);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
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
        {data && <RatingCard entries={data.technicalRight} onAll={() => router.navigate('/athletes')} />}
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
