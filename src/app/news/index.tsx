import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadNews, type NewsItem } from '@/api/news';
import { fc } from '@/components/fight/palette';
import { NewsRow } from '@/components/news/news-row';
import { usePaged } from '@/hooks/use-paged';
import { colors, fonts } from '@/theme/tokens';

/** Все новости — как /news сайта: свежие сверху, догрузка страницами при прокрутке. */
export default function NewsScreen() {
  const fetchPage = useCallback((page: number) => loadNews(page), []);
  const { items, loading, error, loadMore, retry, reload } = usePaged<NewsItem>(fetchPage);

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
        <Text style={styles.title}>Новости</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NewsRow n={item} />}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.text} />}
        ListEmptyComponent={
          loading || error ? undefined : <Text style={styles.empty}>Новостей пока нет</Text>
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={colors.text} style={styles.loader} />
          ) : error ? (
            <Pressable onPress={retry} style={styles.retry}>
              <Text style={styles.empty}>Не удалось загрузить новости · Повторить</Text>
            </Pressable>
          ) : undefined
        }
      />
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
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  list: { padding: 16, paddingBottom: 32, gap: 10, flexGrow: 1 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, textAlign: 'center', marginTop: 32 },
  loader: { marginVertical: 16 },
  retry: { paddingVertical: 8 },
});
