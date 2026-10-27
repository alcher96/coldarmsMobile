import { router } from 'expo-router';
import { Check, ChevronDown, LayoutGrid, List } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_FILTERS,
  loadAthletesPage,
  loadCountryCodes,
  type Athlete,
  type AthleteFilters,
} from '@/api/athletes';
import { AppHeader } from '@/components/app-header';
import { AthleteCard, AthleteRow } from '@/components/athletes/athlete-card';
import { Sheet } from '@/components/fight/info-sheet';
import { ScreenTitle } from '@/components/screen-title';
import { SearchField } from '@/components/search-field';
import { Segmented } from '@/components/segmented';
import { useAsync } from '@/hooks/use-async';
import { useBackStep, useHistoryState } from '@/hooks/use-back-step';
import { usePaged } from '@/hooks/use-paged';
import { useSearch } from '@/hooks/use-search';
import { countryName, flagOf } from '@/lib/countries';
import { plural } from '@/lib/format';
import { colors, fonts, radii, space } from '@/theme/tokens';

const PAGE_SIZE = 24;
const HANDS = [
  { key: 'all' as const, label: 'Все' },
  { key: 'Right' as const, label: 'Правая' },
  { key: 'Left' as const, label: 'Левая' },
];

type Layout = 'grid' | 'list';

/** Атлеты: та же база и фильтры, что на странице /armwrestlers сайта. */
export default function AthletesScreen() {
  // Фильтры с историей: системная «Назад» откатывает их по одному шагу.
  const filtersState = useHistoryState<Omit<AthleteFilters, 'search'>>(DEFAULT_FILTERS);
  const filters = filtersState.value;
  const { query, setQuery, search, submit } = useSearch();
  const [view, setView] = useState<Layout>('grid');
  const [countriesOpen, setCountriesOpen] = useState(false);

  const countries = useAsync(loadCountryCodes).data ?? [];

  const fetchPage = useCallback(
    async (page: number) => {
      const { items, meta } = await loadAthletesPage({ ...filters, search }, page, PAGE_SIZE);
      return { items, totalPages: meta.totalPages, totalCount: meta.totalCount };
    },
    [filters, search],
  );
  const { items, totalCount: total, loading, error, loadMore, retry, reload } = usePaged<Athlete>(fetchPage);

  const patch = (p: Partial<typeof filters>) => {
    const next = { ...filters, ...p };
    if (JSON.stringify(next) !== JSON.stringify(filters)) filtersState.set(next);
  };

  // «Назад»: сначала стираем поиск, потом откатываем фильтры, потом возвращаем сетку.
  useBackStep(() => {
    if (query) {
      setQuery('');
      return true;
    }
    if (filtersState.back()) return true;
    if (view !== 'grid') {
      setView('grid');
      return true;
    }
    return false;
  });
  const grid = view === 'grid';

  const header = (
    <View style={styles.header}>
      <ScreenTitle eyebrow="База Cold Arms" title="Атлеты" subtitle="Рейтинги, статистика и стили бойцов" />
      <SearchField value={query} onChangeText={setQuery} onSubmit={submit} placeholder="Имя или прозвище" />
      <Segmented options={HANDS} value={filters.hand} onChange={(hand) => patch({ hand })} />
      <View style={styles.controls}>
        <Pressable
          onPress={() => setCountriesOpen(true)}
          style={[styles.chip, styles.countryChip, !!filters.country && styles.chipOn]}>
          <Text style={[styles.chipText, !!filters.country && styles.chipTextOn]} numberOfLines={1}>
            {filters.country ? `${flagOf(filters.country)} ${countryName(filters.country)}` : 'Все страны'}
          </Text>
          <ChevronDown size={14} color={filters.country ? colors.text : colors.textMuted} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={() => patch({ elite: !filters.elite })} style={[styles.chip, filters.elite && styles.eliteOn]}>
          <Text style={[styles.chipText, filters.elite && styles.eliteText]}>Elite</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <View style={styles.sort}>
          {(
            [
              ['winRate', 'Win Rate'],
              ['name', 'По имени'],
            ] as const
          ).map(([k, l]) => (
            <Pressable key={k} onPress={() => patch({ sort: k })} style={[styles.sortItem, filters.sort === k && styles.sortOn]}>
              <Text style={[styles.sortText, filters.sort === k && styles.sortTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.count}>
          {total != null ? `${total} ${plural(total, ['атлет', 'атлета', 'атлетов'])}` : ''}
        </Text>
        <View style={styles.views}>
          <Pressable onPress={() => setView('grid')} hitSlop={6} style={[styles.viewBtn, grid && styles.viewOn]} accessibilityLabel="Сетка">
            <LayoutGrid size={16} color={grid ? colors.lightText : colors.textMuted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => setView('list')} hitSlop={6} style={[styles.viewBtn, !grid && styles.viewOn]} accessibilityLabel="Список">
            <List size={16} color={!grid ? colors.lightText : colors.textMuted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const openAthlete = (w: Athlete) => router.push({ pathname: '/athlete/[id]', params: { id: w.armWrestlerId } });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <FlatList
        key={view}
        data={items}
        numColumns={grid ? 2 : 1}
        keyExtractor={(w) => w.armWrestlerId}
        columnWrapperStyle={grid ? styles.columns : undefined}
        renderItem={({ item, index }) =>
          grid ? (
            <View style={styles.cell}>
              <AthleteCard w={item} onPress={() => openAthlete(item)} />
            </View>
          ) : (
            <AthleteRow w={item} rank={index + 1} onPress={() => openAthlete(item)} />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Никого не нашли</Text>
              <Text style={styles.muted}>Попробуйте изменить фильтры или поиск</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loading ? <ActivityIndicator color={colors.text} /> : null}
            {error ? (
              <Pressable onPress={retry} style={styles.retry}>
                <Text style={styles.retryText}>Не удалось загрузить. Повторить</Text>
              </Pressable>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.content}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.text} />}
      />

      <Sheet visible={countriesOpen} onClose={() => setCountriesOpen(false)} bare>
        <Text style={styles.sheetTitle}>Страна</Text>
        <ScrollView contentContainerStyle={styles.countryList}>
          {['', ...countries.slice().sort((x, y) => (countryName(x) ?? x).localeCompare(countryName(y) ?? y, 'ru'))].map(
            (code) => {
              const on = filters.country === code;
              return (
                <Pressable
                  key={code || 'all'}
                  onPress={() => {
                    patch({ country: code });
                    setCountriesOpen(false);
                  }}
                  style={styles.countryRow}>
                  <Text style={styles.flag}>{code ? flagOf(code) : '🌍'}</Text>
                  <Text style={[styles.countryName, on && styles.countryNameOn]}>
                    {code ? countryName(code) : 'Все страны'}
                  </Text>
                  {code ? <Text style={styles.countryCode}>{code}</Text> : null}
                  {on ? <Check size={16} color={colors.accent} strokeWidth={2} /> : null}
                </Pressable>
              );
            },
          )}
        </ScrollView>
      </Sheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.gutter, paddingBottom: 32 },
  header: { gap: 14, marginBottom: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryChip: { flex: 1 },
  chipOn: { borderColor: colors.text },
  chipText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted },
  chipTextOn: { color: colors.text },
  eliteOn: { borderColor: 'rgba(232,185,49,0.6)', backgroundColor: 'rgba(232,185,49,0.12)' },
  eliteText: { color: '#E8B931' },
  sort: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    borderRadius: radii.control,
    padding: 3,
  },
  sortItem: { height: 30, paddingHorizontal: 10, borderRadius: radii.small, justifyContent: 'center' },
  sortOn: { backgroundColor: colors.light },
  sortText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
  sortTextOn: { color: colors.lightText },
  count: { flex: 1, textAlign: 'right', fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  views: { flexDirection: 'row', gap: 4 },
  viewBtn: { width: 34, height: 34, borderRadius: radii.small, alignItems: 'center', justifyContent: 'center' },
  viewOn: { backgroundColor: colors.light },
  columns: { gap: 10 },
  cell: { flex: 1, marginBottom: 10 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 32 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  footer: { paddingVertical: 20, alignItems: 'center' },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    textTransform: 'uppercase',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  countryList: { paddingHorizontal: 20, paddingBottom: 8 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  flag: { fontSize: 20 },
  countryName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textMuted },
  countryNameOn: { color: colors.text },
  countryCode: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textDim },
});
