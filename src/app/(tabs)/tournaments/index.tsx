import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadCompetitionsOverview, loadCompetitionsPage, SERIES, type Series } from '@/api/competitions';
import { AppHeader } from '@/components/app-header';
import { ScreenTitle } from '@/components/screen-title';
import { SearchField } from '@/components/search-field';
import { Segmented } from '@/components/segmented';
import { ArchiveCard } from '@/components/tournaments/archive-card';
import { MiraCard } from '@/components/tournaments/mira-card';
import { UpcomingCard } from '@/components/tournaments/upcoming-card';
import { Card, Title } from '@/components/ui';
import { useAsync } from '@/hooks/use-async';
import { useBackStep, useHistoryState } from '@/hooks/use-back-step';
import { useSearch } from '@/hooks/use-search';
import { colors, fonts, space, radii } from '@/theme/tokens';

export default function TournamentsScreen() {
  const seriesState = useHistoryState<Series>('all');
  const series = seriesState.value;
  const load = useCallback(() => loadCompetitionsOverview(series), [series]);
  const openArchive = () => router.push({ pathname: '/tournaments/archive', params: { series } });
  const { query, setQuery, search, submit } = useSearch();
  // «Назад»: сначала стираем поиск, потом возвращаем прежнюю серию.
  useBackStep(() => {
    if (query) {
      setQuery('');
      return true;
    }
    return seriesState.back();
  });
  const { data, error, loading, refreshing, refresh } = useAsync(load);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
        <ScreenTitle eyebrow="Мировая сцена" title="Турниры" subtitle="Календарь, поединки и архив результатов" />
        <Segmented options={SERIES} value={series} onChange={seriesState.set} />
        <SearchField value={query} onChangeText={setQuery} onSubmit={submit} />

        {search ? <SearchResults series={series} search={search} /> : null}

        {!search && !data && loading && <ActivityIndicator color={colors.text} style={styles.loader} />}

        {!search && !data && error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>Не удалось загрузить турниры</Text>
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {!search && data && (
          // Пока грузится другой фильтр, старые карточки приглушены.
          <View style={[styles.sections, loading && !refreshing && styles.stale]}>
            {data.upcoming ? (
              <UpcomingCard competition={data.upcoming} mainFight={data.mainFight} />
            ) : (
              <Card>
                <Text style={styles.empty}>Ближайших турниров пока нет</Text>
              </Card>
            )}

            <MiraCard />

            <View style={styles.archiveHead}>
              <Title style={styles.archiveTitle}>Архив турниров</Title>
              <Pressable
                style={styles.link}
                hitSlop={8}
                onPress={openArchive}>
                <Text style={styles.linkText}>Весь архив</Text>
                <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
              </Pressable>
            </View>
            {data.archive.map((c) => (
              <ArchiveCard key={c.competitionId} competition={c} />
            ))}
            {data.archive.length === 0 && <Text style={styles.empty}>Прошедших турниров нет</Text>}
            {data.archive.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.allButton, pressed && styles.pressed]}
                onPress={openArchive}>
                <Text style={styles.allButtonText}>Весь архив и поиск</Text>
                <ArrowUpRight size={14} color={colors.text} strokeWidth={1.6} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SEARCH_LIMIT = 50;

/** Результаты поиска вместо разделов календаря: и прошедшие, и предстоящие турниры. */
function SearchResults({ series, search }: { series: Series; search: string }) {
  const load = useCallback(() => loadCompetitionsPage(series, 1, SEARCH_LIMIT, search), [series, search]);
  const { data, error, loading, refresh } = useAsync(load);

  if (!data && loading) return <ActivityIndicator color={colors.text} style={styles.loader} />;
  if (!data && error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>Не удалось выполнить поиск</Text>
        <Pressable onPress={refresh} style={styles.retry}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }
  if (!data) return null;

  const { items, meta } = data;
  return (
    <View style={[styles.sections, loading && styles.stale]}>
      <Text style={styles.empty}>
        {meta.totalCount > 0
          ? `Найдено: ${meta.totalCount}${meta.totalCount > items.length ? ` (показаны первые ${items.length})` : ''}`
          : 'Ничего не найдено'}
      </Text>
      {items.map((c) => (
        <ArchiveCard key={c.competitionId} competition={c} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.gutter, gap: space.gap, paddingBottom: 32 },
  sections: { gap: space.gap },
  stale: { opacity: 0.5 },
  loader: { marginTop: 24 },
  error: { alignItems: 'center', gap: 12, marginTop: 16 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  archiveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  archiveTitle: { fontSize: 24 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.control,
  },
  allButtonText: { fontFamily: fonts.bodySemi, fontSize: 13, textTransform: 'uppercase', color: colors.text },
  pressed: { opacity: 0.7 },
});
