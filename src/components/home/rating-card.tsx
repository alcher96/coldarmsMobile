import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RankingEntry } from '@/api/home';
import { Card, Eyebrow, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/theme/tokens';

export function RatingCard({ entries, onAll }: { entries: RankingEntry[]; onAll?: () => void }) {
  return (
    <Card>
      <View style={styles.head}>
        <Title style={styles.title}>Технический рейтинг</Title>
        <Pressable style={styles.link} onPress={onAll} hitSlop={8}>
          <Text style={styles.linkText}>Все атлеты</Text>
          <ArrowUpRight size={12} color={colors.textMuted} strokeWidth={1.6} />
        </Pressable>
      </View>
      <Eyebrow style={styles.sub}>Правая рука / топ-3</Eyebrow>
      {entries.slice(0, 3).map((e) => (
        <Pressable
          key={e.armWrestlerId}
          onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: e.armWrestlerId } })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
          <Text style={styles.rank}>{String(e.rank).padStart(2, '0')}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {e.fullName}
          </Text>
          <Text style={styles.score}>{e.score === null ? '—' : e.score.toFixed(1)}</Text>
        </Pressable>
      ))}
      {entries.length === 0 && <Text style={styles.empty}>Рейтинг пока недоступен</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  // Заголовок переносится на вторую строку, а не наезжает на «Все атлеты».
  title: { flexShrink: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  sub: { marginTop: 10, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    marginTop: 8,
    paddingLeft: 10,
    borderRadius: radii.small,
    overflow: 'hidden',
    backgroundColor: colors.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rank: { width: 34, fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
  name: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  score: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    backgroundColor: '#000',
    minWidth: 76,
    textAlign: 'right',
    paddingRight: 2,
    height: '100%',
    textAlignVertical: 'center',
    lineHeight: 32,
  },
  empty: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
