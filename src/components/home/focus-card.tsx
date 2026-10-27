import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { newsCoverUrl, newsMonogram, type NewsItem } from '@/api/news';
import { Card, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/theme/tokens';

/** «В фокусе» на главной: свежая новость; «Новости» — весь список. */
export function FocusCard({ news }: { news: NewsItem }) {
  const cover = newsCoverUrl(news.coverImagePath);
  return (
    <Card>
      <View style={styles.head}>
        <Title style={styles.title}>В фокусе</Title>
        <Pressable style={styles.link} onPress={() => router.push('/news')} hitSlop={8}>
          <Text style={styles.linkText}>Новости</Text>
          <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
        </Pressable>
      </View>
      <Pressable
        style={styles.item}
        onPress={() => router.push({ pathname: '/news/[id]', params: { id: news.id } })}>
        <View style={styles.thumb}>
          {cover ? (
            <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.mono}>{newsMonogram(news.title)}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {news.title}
          </Text>
          {news.summary ? (
            <Text style={styles.itemSub} numberOfLines={1}>
              {news.summary}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.6} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.small,
    backgroundColor: '#222226',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mono: { fontFamily: fonts.display, fontSize: 15, color: colors.textMuted },
  body: { flex: 1 },
  itemTitle: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  itemSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 4 },
});
