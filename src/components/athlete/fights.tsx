import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { winPct, type AthleteStats, type FightRef } from '@/api/athlete';
import { thumbnailUrl } from '@/api/competitions';
import type { Hand } from '@/api/fight';
import { fc } from '@/components/fight/palette';
import { dateLong, initialsOf } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

type Row = FightRef & { win: boolean };

/** История боёв на руку: победы и поражения, новые сверху; тап — экран боя. */
export function AthleteFights({ stats, hand, onHand }: { stats: AthleteStats | null; hand: Hand; onHand: (h: Hand) => void }) {
  const right = hand === 'Right';
  const w = (right ? stats?.rightArmWins : stats?.leftArmWins) ?? 0;
  const l = (right ? stats?.rightArmLosses : stats?.leftArmLosses) ?? 0;
  const rows: Row[] = [
    ...((right ? stats?.rightArmWinDetails : stats?.leftArmWinDetails) ?? []).map((f) => ({ ...f, win: true })),
    ...((right ? stats?.rightArmLossDetails : stats?.leftArmLossDetails) ?? []).map((f) => ({ ...f, win: false })),
  ].sort((a, b) => b.competitionDate.localeCompare(a.competitionDate));

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={styles.toggle}>
          {(['Right', 'Left'] as const).map((h) => (
            <Pressable key={h} onPress={() => onHand(h)} style={[styles.toggleItem, hand === h && styles.toggleOn]}>
              <Text style={[styles.toggleText, hand === h && styles.toggleTextOn]}>{h === 'Right' ? 'Правая' : 'Левая'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.record}>
          <Text style={styles.pct}>{winPct(w, l)}%</Text> · {w} W · {l} L
        </Text>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>Боёв на {right ? 'правую' : 'левую'} руку нет</Text> : null}
      {rows.map((f) => (
        <FightRow key={`${f.fightId}-${f.win}`} f={f} badge={f.win ? 'W' : 'L'} />
      ))}
    </View>
  );
}

/** Строка боя: соперник, турнир и дата, плашка справа (W / L / номер раунда); тап — экран боя. */
export function FightRow({
  f,
  badge,
}: {
  f: Pick<FightRef, 'fightId' | 'opponentId' | 'opponentName' | 'competitionName' | 'competitionDate'> & {
    opponentThumbnail?: string | null;
  };
  badge: string;
}) {
  const win = badge === 'W';
  const neutral = badge !== 'W' && badge !== 'L';
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/fight/[id]', params: { id: f.fightId } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(f.opponentName)}</Text>
        {f.opponentThumbnail !== null && !failed ? (
          <Image
            source={thumbnailUrl(f.opponentId)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : null}
      </View>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {f.opponentName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {f.competitionName} · {dateLong(f.competitionDate)}
        </Text>
      </View>
      <View style={[styles.chip, neutral ? styles.chipN : win ? styles.chipW : styles.chipL]}>
        <Text style={[styles.chipText, { color: neutral ? colors.text : win ? colors.lightText : colors.accent }]}>
          {badge}
        </Text>
      </View>
      <ChevronRight size={16} color={fc.dim} strokeWidth={1.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    padding: 3,
  },
  toggleItem: { height: 34, paddingHorizontal: 12, borderRadius: radii.small, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.light },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.second },
  toggleTextOn: { color: colors.lightText },
  record: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.muted },
  pct: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: fc.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodySemi, fontSize: 11, color: fc.muted },
  main: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: fc.muted },
  chip: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chipW: { backgroundColor: colors.light },
  chipL: { borderWidth: 1, borderColor: 'rgba(229,53,43,0.5)' },
  chipN: { minWidth: 26, paddingHorizontal: 6, width: undefined, backgroundColor: fc.chip },
  chipText: { fontFamily: fonts.display, fontSize: 13 },
});
