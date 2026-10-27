import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryLabel, newsCoverUrl, newsMonogram, type NewsItem } from '@/api/news';
import { fc } from '@/components/fight/palette';
import { dateLong } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** Новость в списке: обложка (или буквы названия), категория, дата, заголовок и анонс. */
export function NewsRow({ n }: { n: NewsItem }) {
  const cover = newsCoverUrl(n.coverImagePath);
  const category = categoryLabel(n.category);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/news/[id]', params: { id: n.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cover}>
        {cover ? (
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.mono}>{newsMonogram(n.title)}</Text>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.meta}>
          {category ? <Text style={styles.badge}>{category}</Text> : null}
          <Text style={styles.date}>{dateLong(n.publishedAt)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {n.title}
        </Text>
        {n.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {n.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.card,
  },
  pressed: { opacity: 0.8 },
  cover: {
    width: 72,
    height: 72,
    borderRadius: radii.small,
    backgroundColor: '#222226',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mono: { fontFamily: fonts.display, fontSize: 20, color: colors.textMuted },
  cardBody: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  date: { fontFamily: fonts.body, fontSize: 11, color: fc.dim },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 19, color: colors.text },
  summary: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: fc.muted },
});
