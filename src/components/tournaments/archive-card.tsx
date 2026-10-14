import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { coverUrl, type Competition } from '@/api/competitions';
import { Card } from '@/components/ui';
import { dateLong, plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { CoverBackground, textOnCover } from './cover-background';

/** Карточка прошедшего турнира, обложка — фоном. Пока открывает страницу турнира на сайте. */
export function ArchiveCard({ competition }: { competition: Competition }) {
  const c = competition;
  const meta = [dateLong(c.competitionDate), c.location].filter(Boolean).join(' · ');
  const cover = coverUrl(c);
  return (
    <Pressable onPress={() => router.push({ pathname: '/competition/[id]', params: { id: c.competitionId } })}>
      {({ pressed }) => (
        <Card style={[styles.card, cover && styles.cardCover, pressed && styles.pressed]}>
          {cover ? <CoverBackground uri={cover} /> : null}
          <View style={styles.head}>
            <Text style={[styles.name, cover && textOnCover]} numberOfLines={2}>
              {c.competitionName}
            </Text>
            {c.fightCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {c.fightCount} {plural(c.fightCount, ['матч', 'матча', 'матчей'])}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>{meta}</Text>
          <View style={styles.bottom}>
            <Text style={styles.main} numberOfLines={1}>
              {c.mainEvent ?? 'Поединки турнира'}
            </Text>
            <ArrowUpRight size={16} color={colors.textMuted} strokeWidth={1.6} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  // С обложкой карточка чуть выше — чтобы фото было видно над названием.
  cardCover: { paddingTop: 104 },
  pressed: { opacity: 0.8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 24, textTransform: 'uppercase', color: colors.text },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A40',
    backgroundColor: 'rgba(29,29,32,0.85)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 10, textTransform: 'uppercase', color: colors.textMuted },
  meta: { fontFamily: fonts.body, fontSize: 11, color: '#A6A6AC', marginTop: 6 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: 12,
  },
  main: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text },
});
