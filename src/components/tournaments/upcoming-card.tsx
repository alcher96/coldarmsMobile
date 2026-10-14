import { router } from 'expo-router';
import { ArrowUpRight, BellPlus, CalendarDays, MapPin } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { coverUrl, type Competition, type Fight } from '@/api/competitions';
import { Card, Eyebrow } from '@/components/ui';
import { dateLong, splitEventNumber, splitMainEvent } from '@/lib/format';
import { colors, fonts, space, radii } from '@/theme/tokens';

import { CoverBackground, textOnCover } from './cover-background';
import { FighterAvatar } from './fighter-avatar';

export function UpcomingCard({ competition, mainFight }: { competition: Competition; mainFight: Fight | null }) {
  const { title, number } = splitEventNumber(competition.competitionName);
  // Имена берём из боя (там же id для фото); если боёв ещё нет — из строки mainEvent турнира.
  const names = mainFight
    ? { left: mainFight.wrestler1Name, right: mainFight.wrestler2Name }
    : splitMainEvent(competition.mainEvent);
  const cover = coverUrl(competition);
  const openCompetition = () =>
    router.push({ pathname: '/competition/[id]', params: { id: competition.competitionId } });

  return (
    <Card style={styles.card}>
      {/* Шапка карточки: обложка турнира (если загружена) фоном под названием; тап — страница турнира. */}
      <Pressable
        onPress={openCompetition}
        accessibilityRole="button"
        accessibilityLabel={`Турнир ${competition.competitionName}`}
        style={({ pressed }) => [styles.hero, cover && styles.heroCover, pressed && styles.pressed]}>
        {cover ? <CoverBackground uri={cover} /> : null}
        <View style={styles.top}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Предстоит</Text>
          </View>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Напомнить о турнире"
            // Пользовательской подписки на турнир в API пока нет (см. TODO.md).
            onPress={() => Alert.alert('Скоро', 'Напоминания о турнирах появятся в одном из следующих обновлений.')}>
            <BellPlus size={18} color={colors.text} strokeWidth={1.6} />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, cover && textOnCover]} numberOfLines={2}>
            {title}
          </Text>
          {number ? <Text style={[styles.number, cover && styles.numberOnCover]}>{number}</Text> : null}
        </View>
      </Pressable>

      <Pressable onPress={openCompetition} style={({ pressed }) => [styles.meta, pressed && styles.pressed]}>
        <View style={styles.metaRow}>
          <CalendarDays size={16} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={styles.metaStrong}>{dateLong(competition.competitionDate)}</Text>
        </View>
        {competition.location ? (
          <View style={[styles.metaRow, styles.metaShrink]}>
            <MapPin size={16} color={colors.textMuted} strokeWidth={1.6} />
            <Text style={[styles.metaText, styles.metaShrink]} numberOfLines={1}>
              {competition.location}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {names ? (
        <Pressable
          disabled={!mainFight}
          onPress={() => mainFight && router.push({ pathname: '/fight/[id]', params: { id: mainFight.fightId } })}
          style={({ pressed }) => [styles.main, pressed && { opacity: 0.8 }]}>
          <Eyebrow>Главный поединок</Eyebrow>
          <View style={styles.fight}>
            <View style={styles.fighter}>
              <FighterAvatar id={mainFight?.wrestler1Id} name={names.left} />
              <Text style={styles.fighterName} numberOfLines={2}>
                {names.left}
              </Text>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={[styles.fighter, styles.fighterRight]}>
              <FighterAvatar id={mainFight?.wrestler2Id} name={names.right} />
              <Text style={[styles.fighterName, styles.right]} numberOfLines={2}>
                {names.right}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={openCompetition}>
        <Text style={styles.buttonText}>Смотреть детали</Text>
        <ArrowUpRight size={18} color={colors.lightText} strokeWidth={1.6} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 0, paddingBottom: 18, overflow: 'hidden' },
  // Шапка выходит под края карточки, чтобы обложка легла от края до края.
  hero: { marginHorizontal: -space.cardPad, paddingHorizontal: space.cardPad, paddingTop: 18 },
  heroCover: { minHeight: 220, justifyContent: 'space-between' },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(11,11,12,0.8)',
  },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 10, textTransform: 'uppercase', color: colors.accent },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    textTransform: 'uppercase',
    color: colors.text,
    marginBottom: 6,
  },
  number: { fontFamily: fonts.display, fontSize: 88, lineHeight: 92, color: '#55555C', marginLeft: 8 },
  numberOnCover: { color: 'rgba(255,255,255,0.45)' },
  // Дата и место в одну строку; длинное место обрезается многоточием.
  meta: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaShrink: { flexShrink: 1 },
  metaStrong: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  main: { backgroundColor: colors.row, marginHorizontal: -space.cardPad, padding: space.cardPad, paddingTop: 12 },
  fight: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  fighter: { flex: 1, gap: 8 },
  fighterRight: { alignItems: 'flex-end' },
  fighterName: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  right: { textAlign: 'right' },
  vs: { fontFamily: fonts.display, fontSize: 22, color: colors.accent, marginHorizontal: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    paddingHorizontal: 16,
    marginTop: 16,
    borderRadius: radii.control,
    backgroundColor: colors.light,
  },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lightText },
});
