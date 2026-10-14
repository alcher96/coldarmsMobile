import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bestHand, isElite, winRateColor, type Athlete } from '@/api/athletes';
import { thumbnailUrl } from '@/api/competitions';
import { wrestlerPhotoUrl } from '@/api/fight';
import { flagOf } from '@/lib/countries';
import { initialsOf } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

const fullName = (w: Athlete) => `${w.firstName ?? ''} ${w.lastName ?? ''}`.trim();
const handLabel = (h: string) => (h === 'Right' ? 'Правая' : 'Левая');

/** Карточка сетки: фото, страна и Elite сверху, винрейт на фото, имя и ведущая рука снизу. */
export function AthleteCard({ w, onPress }: { w: Athlete; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  const { winRate, hand, fights } = bestHand(w);
  const color = winRateColor(winRate);
  const name = fullName(w);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.photo}>
        <Text style={styles.initials}>{initialsOf(name)}</Text>
        {w.photoPath && !failed ? (
          <Image
            source={wrestlerPhotoUrl(w.armWrestlerId)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(21,21,23,0)', 'rgba(21,21,23,0.85)']}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.top}>
          {w.country ? (
            <Text style={styles.country}>
              {flagOf(w.country)} {w.country.trim()}
            </Text>
          ) : (
            <View />
          )}
          {isElite(w) ? <Text style={styles.elite}>Elite</Text> : null}
        </View>
        {fights > 0 ? (
          <Text style={[styles.rate, { color, backgroundColor: `${color}22`, borderColor: `${color}66` }]}>
            {Math.round(winRate)}%
          </Text>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {w.nickName?.trim() ? (
          <Text style={styles.nick} numberOfLines={1}>
            «{w.nickName.trim()}»
          </Text>
        ) : null}
        <View style={styles.foot}>
          <Text style={styles.footLabel}>Ведущая рука</Text>
          <Text style={styles.footValue}>{handLabel(hand)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Строка списка: аватар, имя с Elite, страна и прозвище, винрейт с полосой. */
export function AthleteRow({ w, rank, onPress }: { w: Athlete; rank: number; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  const { winRate, hand, fights } = bestHand(w);
  const color = winRateColor(winRate);
  const name = fullName(w);
  const meta = [w.country ? `${flagOf(w.country)} ${w.country.trim()}` : null, w.nickName?.trim() ? `«${w.nickName.trim()}»` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(name)}</Text>
        {w.thumbnailPath && !failed ? (
          <Image
            source={thumbnailUrl(w.armWrestlerId)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : null}
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowName}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {name}
          </Text>
          {isElite(w) ? <Text style={styles.elite}>Elite</Text> : null}
        </View>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.round(winRate)}%`, backgroundColor: color }]} />
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowRate, { color }]}>{fights > 0 ? `${Math.round(winRate)}%` : '—'}</Text>
        <Text style={styles.rowHand}>{handLabel(hand)}</Text>
      </View>
      <ChevronRight size={16} color={colors.textDim} strokeWidth={1.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  photo: { aspectRatio: 3 / 4, backgroundColor: '#1C1C1F', alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.display, fontSize: 28, color: colors.textDim },
  top: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  country: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: colors.text,
    backgroundColor: 'rgba(11,11,12,0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  elite: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#E8B931',
    backgroundColor: 'rgba(232,185,49,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232,185,49,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  rate: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontFamily: fonts.display,
    fontSize: 15,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  info: { padding: 12, gap: 2, flex: 1 },
  name: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, textTransform: 'uppercase', color: colors.text },
  nick: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  foot: { marginTop: 'auto', paddingTop: 8 },
  footLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
  footValue: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text, marginTop: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rank: { width: 22, fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1F',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
  rowMain: { flex: 1, gap: 3 },
  rowName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  bar: { height: 3, borderRadius: 2, backgroundColor: '#222225', overflow: 'hidden', marginTop: 3 },
  barFill: { height: '100%', borderRadius: 2 },
  rowRight: { alignItems: 'flex-end', minWidth: 52 },
  rowRate: { fontFamily: fonts.display, fontSize: 18 },
  rowHand: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
});
