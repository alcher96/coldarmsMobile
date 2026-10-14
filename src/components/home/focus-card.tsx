import { Image } from 'expo-image';
import { ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NewsItem } from '@/api/home';
import { SITE_URL } from '@/api/http';
import { Card, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/theme/tokens';

/** Буквы для плашки без обложки: «East vs West 27» → «EVW», «Обновление 27.09» → «ОБН». */
function monogram(title: string) {
  const words = title.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Сайт кладёт coverImagePath в <img src> как есть — путь от корня сайта или полный URL. */
function coverUrl(path: string | null) {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}

export function FocusCard({ news, onAll }: { news: NewsItem; onAll?: () => void }) {
  const cover = coverUrl(news.coverImagePath);
  return (
    <Card>
      <View style={styles.head}>
        <Title style={styles.title}>В фокусе</Title>
        <Pressable style={styles.link} onPress={onAll} hitSlop={8}>
          <Text style={styles.linkText}>Новости</Text>
          <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
        </Pressable>
      </View>
      <Pressable style={styles.item}>
        <View style={styles.thumb}>
          {cover ? (
            <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.mono}>{monogram(news.title)}</Text>
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
