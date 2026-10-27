import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadComments, newsComments } from '@/api/comments';
import { categoryLabel, loadArticle, newsCoverUrl } from '@/api/news';
import { CommentsCard } from '@/components/fight/comments';
import { fc } from '@/components/fight/palette';
import { HtmlBody } from '@/components/html-body';
import { useAsync } from '@/hooks/use-async';
import { dateLong } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** Новость — как /news/{id} сайта: категория и дата, заголовок, анонс, текст, лайки и обсуждение. */
export default function NewsArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(
    () => Promise.all([loadArticle(id), loadComments(newsComments(id)).catch(() => [])]),
    [id],
  );
  const { data, loading, error, refreshing, refresh } = useAsync(load);
  const [article, comments] = data ?? [null, []];
  const cover = newsCoverUrl(article?.coverImagePath ?? null);
  const category = categoryLabel(article?.category ?? null);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/news'))}
          hitSlop={10}
          style={styles.back}
          accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.barTitle}>Новости</Text>
      </View>

      {loading && !article ? (
        <ActivityIndicator color={colors.text} style={styles.loader} />
      ) : error && !article ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Не удалось загрузить новость</Text>
          <Pressable onPress={refresh} style={styles.retry}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : article ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
          {cover ? <Image source={cover} style={styles.cover} contentFit="cover" /> : null}
          <View style={styles.meta}>
            {category ? <Text style={styles.badge}>{category}</Text> : null}
            <Text style={styles.date}>{dateLong(article.publishedAt)}</Text>
          </View>
          <Text style={styles.title}>{article.title}</Text>
          {article.summary ? <Text style={styles.lead}>{article.summary}</Text> : null}
          {article.bodyHtml ? <HtmlBody html={article.bodyHtml} /> : null}
          <View style={styles.likes}>
            <Heart
              size={16}
              color={article.likedByMe ? colors.accent : fc.muted}
              fill={article.likedByMe ? colors.accent : 'transparent'}
              strokeWidth={1.8}
            />
            <Text style={styles.likesText}>{article.likeCount}</Text>
          </View>
          <CommentsCard api={newsComments(article.id)} initial={comments} />
        </ScrollView>
      ) : null}
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
  barTitle: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  loader: { marginTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.card, backgroundColor: fc.chip },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accent,
    borderWidth: 1,
    borderColor: 'rgba(229,53,43,0.45)',
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  date: { fontFamily: fonts.body, fontSize: 12, color: fc.dim },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, textTransform: 'uppercase', color: colors.text },
  lead: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 23, color: fc.soft },
  likes: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
  likesText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.muted },
});
