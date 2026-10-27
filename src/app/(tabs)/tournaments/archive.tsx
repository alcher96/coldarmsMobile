import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isUpcoming, loadCompetitionsPage, SERIES, type Competition, type Series } from '@/api/competitions';
import { ScreenTitle } from '@/components/screen-title';
import { SearchField } from '@/components/search-field';
import { Segmented } from '@/components/segmented';
import { ArchiveCard } from '@/components/tournaments/archive-card';
import { usePaged } from '@/hooks/use-paged';
import { useBackStep, useHistoryState } from '@/hooks/use-back-step';
import { useSearch } from '@/hooks/use-search';
import { colors, fonts, space, radii } from '@/theme/tokens';

const PAGE_SIZE = 20;

function parseSeries(value: string | undefined): Series {
  return SERIES.find((s) => s.key === value)?.key ?? 'all';
}

/** Весь архив: прошедшие турниры постранично, с тем же фильтром серий. */
export default function ArchiveScreen() {
  const params = useLocalSearchParams<{ series?: string; q?: string }>();
  const seriesState = useHistoryState<Series>(parseSeries(params.series));
  const series = seriesState.value;
  const { query, setQuery, search, submit } = useSearch(params.q ?? '');
  // «Назад»: сначала стираем поиск, потом возвращаем прежнюю серию, потом — к календарю.
  useBackStep(() => {
    if (query) {
      setQuery('');
      return true;
    }
    return seriesState.back();
  });

  // Ближайшие турниры в архив не входят — отсекаем их на клиенте.
  const fetchPage = useCallback(
    async (page: number) => {
      const { items, meta } = await loadCompetitionsPage(series, page, PAGE_SIZE, search);
      return { items: items.filter((c) => !isUpcoming(c)), totalPages: meta.totalPages };
    },
    [series, search],
  );
  const { items, loading, error, loadMore, retry, reload } = usePaged<Competition>(fetchPage);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.bar}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10} accessibilityLabel="Назад">
          <ChevronLeft size={22} color={colors.text} strokeWidth={1.6} />
          <Text style={styles.backText}>Турниры</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(c) => c.competitionId}
        renderItem={({ item }) => <ArchiveCard competition={item} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenTitle eyebrow="Результаты" title="Архив турниров" />
            <Segmented options={SERIES} value={series} onChange={seriesState.set} />
            <SearchField value={query} onChangeText={setQuery} onSubmit={submit} />
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.muted}>{search ? 'Ничего не найдено' : 'Прошедших турниров нет'}</Text>
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListFooterComponent={
          <View style={styles.footer}>
            {loading && <ActivityIndicator color={colors.text} />}
            {error && (
              <Pressable
                onPress={retry}
                style={styles.retry}>
                <Text style={styles.retryText}>Не удалось загрузить. Повторить</Text>
              </Pressable>
            )}
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.text} />}
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 12 }} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    height: 56,
    paddingHorizontal: space.gutter - 6,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  content: { padding: space.gutter, paddingBottom: 32 },
  header: { gap: space.gap, marginBottom: space.gap },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  footer: { paddingVertical: 20, alignItems: 'center' },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
});
