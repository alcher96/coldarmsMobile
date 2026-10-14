import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isUpcoming, type Competition, type Fight } from '@/api/competitions';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { Card, Eyebrow } from '@/components/ui';
import { useCountdown } from '@/hooks/use-countdown';
import { dateBadge, plural, splitMainEvent } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

const AVATAR = 32;

export function NextTournament({ competition, mainFight }: { competition: Competition; mainFight: Fight | null }) {
  const date = new Date(competition.competitionDate);
  const valid = !Number.isNaN(date.getTime());
  const upcoming = isUpcoming(competition);
  const badge = dateBadge(competition.competitionDate);
  const meta = [competition.location, valid ? date.getFullYear() : null].filter(Boolean).join(' · ');
  // Имена берём из боя (там же id для фото), иначе — из строки mainEvent турнира.
  const names = mainFight
    ? { left: mainFight.wrestler1Name, right: mainFight.wrestler2Name }
    : splitMainEvent(competition.mainEvent);

  return (
    <Pressable onPress={() => router.push({ pathname: '/competition/[id]', params: { id: competition.competitionId } })}>
      <Card>
        <View style={styles.top}>
          <Eyebrow>{upcoming ? 'Следующий турнир' : 'Последний турнир'}</Eyebrow>
          <View style={styles.when}>
            {upcoming && valid ? <CountdownText target={date} /> : null}
            {badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.name}>{competition.competitionName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{meta}</Text>
          <ArrowUpRight size={16} color={colors.textMuted} strokeWidth={1.6} />
        </View>

        {names ? (
          <Pressable
            disabled={!mainFight}
            onPress={() => mainFight && router.push({ pathname: '/fight/[id]', params: { id: mainFight.fightId } })}
            style={({ pressed }) => [styles.fight, pressed && styles.pressed]}>
            <View style={styles.fighter}>
              <FighterAvatar id={mainFight?.wrestler1Id} name={names.left} size={AVATAR} round />
              <Text style={styles.fighterName} numberOfLines={2}>
                {names.left}
              </Text>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={[styles.fighter, styles.fighterRight]}>
              <Text style={[styles.fighterName, styles.textRight]} numberOfLines={2}>
                {names.right}
              </Text>
              <FighterAvatar id={mainFight?.wrestler2Id} name={names.right} size={AVATAR} round />
            </View>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** «через 10 дней» / «через 5 ч 20 мин» — до начала дня турнира (время начала API не отдаёт). */
function CountdownText({ target }: { target: Date }) {
  const left = useCountdown(target, 60_000);
  let text = 'сегодня';
  if (left && left.days > 0) text = `через ${left.days} ${plural(left.days, ['день', 'дня', 'дней'])}`;
  else if (left && left.hours > 0) text = `через ${left.hours} ч ${left.minutes} мин`;
  else if (left) text = `через ${Math.max(left.minutes, 1)} мин`;
  return <Text style={styles.countdown}>{text}</Text>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.displaySemi, fontSize: 11, color: colors.accent },
  name: {
    fontFamily: fonts.display,
    fontSize: 28,
    textTransform: 'uppercase',
    color: colors.text,
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdown: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  pressed: { opacity: 0.7 },
  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  // Аватар сбоку от имени: слева — [фото] Имя, справа — Имя [фото].
  fighter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fighterRight: { justifyContent: 'flex-end' },
  fighterName: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  textRight: { textAlign: 'right' },
  vs: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.accent, marginHorizontal: 10 },
});
