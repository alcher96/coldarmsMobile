import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CompetitionFight } from '@/api/competition';
import { loadMira } from '@/api/fight';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { fc } from '@/components/fight/palette';
import { useAsync } from '@/hooks/use-async';
import { colors, fonts, radii } from '@/theme/tokens';

const GREEN = '#4AC87C';

const split = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i + 1)];
};
const handLabel = (h: string | null) => (h === 'Right' ? 'Правая' : h === 'Left' ? 'Левая' : '');

/** Бой в карточке турнира: соперники и счёт; по тапу — раунды (если бой прошёл) или прогноз M.I.R.A. */
export function CompetitionFightCard({ f, initiallyOpen }: { f: CompetitionFight; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const done = !!f.winner;
  const w1 = done && f.winner === f.wrestler1Name;
  const w2 = done && f.winner === f.wrestler2Name;
  const openFight = () => router.push({ pathname: '/fight/[id]', params: { id: f.fightId } });

  return (
    <View style={[styles.card, open && styles.cardOpen, f.isMainEvent && styles.cardMain]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.head}>
        {f.isMainEvent ? <Text style={styles.mainTag}>Главный бой</Text> : null}
        <View style={styles.row}>
          <Side id={f.wrestler1Id} name={f.wrestler1Name} win={w1} dim={done && !w1} />
          <View style={styles.mid}>
            {done ? (
              <Text style={styles.score}>
                <Text style={{ color: w1 ? GREEN : fc.dim }}>{f.w1Score}</Text>
                <Text style={styles.dash}>–</Text>
                <Text style={{ color: w2 ? GREEN : fc.dim }}>{f.w2Score}</Text>
              </Text>
            ) : (
              <Text style={styles.vs}>VS</Text>
            )}
            <Text style={styles.meta}>
              {[f.bestOf ? `Bo${f.bestOf}` : null, handLabel(f.hand)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Side id={f.wrestler2Id} name={f.wrestler2Name} win={w2} dim={done && !w2} right />
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <ChevronDown size={16} color={open ? colors.text : fc.dim} strokeWidth={1.8} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={styles.actions}>
            <Pressable onPress={openFight} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Подробный разбор</Text>
            </Pressable>
            {done ? (
              <View style={styles.winner}>
                <View style={styles.winnerDot} />
                <Text style={styles.winnerText} numberOfLines={1}>
                  Победа · {f.winner}
                </Text>
              </View>
            ) : null}
          </View>
          {done ? <Rounds f={f} /> : <Prediction f={f} />}
        </View>
      ) : null}
    </View>
  );
}

function Side({ id, name, win, dim, right }: { id: string; name: string; win: boolean; dim: boolean; right?: boolean }) {
  const [first, rest] = split(name);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/athlete/[id]', params: { id } })}
      style={[styles.side, right && styles.sideRight]}>
      <View>
        <FighterAvatar id={id} name={name} size={44} round />
        {win ? <View style={styles.winBadge} /> : null}
      </View>
      <View style={[styles.names, right && styles.alignRight]}>
        <Text style={[styles.first, dim && styles.dimText, right && styles.textRight]} numberOfLines={1}>
          {first}
        </Text>
        {rest ? (
          <Text style={[styles.last, dim && styles.dimText, right && styles.textRight]} numberOfLines={1}>
            {rest}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Rounds({ f }: { f: CompetitionFight }) {
  return (
    <View style={styles.rounds}>
      {f.rounds.map((r, i) => {
        const isW1 = r.winnerName === f.wrestler1Name;
        return (
          <View key={r.roundNumber} style={[styles.round, i % 2 === 1 && styles.roundAlt]}>
            <Text style={styles.roundN}>R{r.roundNumber}</Text>
            <View style={styles.flex}>
              <View style={styles.roundTop}>
                <Text style={[styles.roundWinner, { color: isW1 ? GREEN : '#E8B931' }]} numberOfLines={1}>
                  {r.winnerName ?? '—'}
                </Text>
                {r.styleUsed ? <Text style={styles.roundStyle}>{r.styleUsed}</Text> : null}
              </View>
              {r.descriptionRound?.trim() ? <Text style={styles.roundDesc}>{r.descriptionRound.trim()}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Прогноз M.I.R.A. на предстоящий бой: грузится, только когда карточку раскрыли. */
function Prediction({ f }: { f: CompetitionFight }) {
  const load = useCallback(() => loadMira(f.fightId), [f.fightId]);
  const { data, loading } = useAsync(load);
  if (loading && !data) return <ActivityIndicator color={colors.text} style={styles.loader} />;
  if (!data) return <Text style={styles.empty}>Прогноз пока не готов</Text>;
  return (
    <View style={styles.prob}>
      <Text style={styles.probLabel}>Вероятность победы · M.I.R.A.</Text>
      {(
        [
          [f.wrestler1Name, data.w1Pct],
          [f.wrestler2Name, data.w2Pct],
        ] as const
      ).map(([name, pct]) => {
        const lead = pct >= 50;
        return (
          <View key={name} style={styles.probRow}>
            <Text style={styles.probName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.probTrack}>
              <View style={[styles.probFill, { width: `${pct}%`, backgroundColor: lead ? colors.text : '#5A5B61' }]} />
            </View>
            <Text style={[styles.probPct, !lead && { color: fc.dim }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardOpen: { borderColor: fc.borderStrong },
  cardMain: { borderColor: 'rgba(229,53,43,0.45)' },
  head: { padding: 14, paddingBottom: 10 },
  mainTag: {
    alignSelf: 'center',
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideRight: { flexDirection: 'row-reverse' },
  names: { flexShrink: 1 },
  alignRight: { alignItems: 'flex-end' },
  first: { fontFamily: fonts.display, fontSize: 15, lineHeight: 16, textTransform: 'uppercase', color: colors.text },
  last: { fontFamily: fonts.display, fontSize: 13, lineHeight: 15, textTransform: 'uppercase', color: fc.soft },
  dimText: { color: fc.dim },
  textRight: { textAlign: 'right' },
  winBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: fc.card,
  },
  mid: { alignItems: 'center', minWidth: 58 },
  score: { fontFamily: fonts.display, fontSize: 26 },
  dash: { color: fc.dim },
  vs: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: fc.muted, marginTop: 2 },
  chevron: { alignSelf: 'center', marginTop: 6 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fc.line },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  btn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    backgroundColor: colors.light,
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lightText },
  pressed: { opacity: 0.8 },
  winner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(74,200,124,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,200,124,0.25)',
  },
  winnerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  winnerText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 11, color: GREEN },
  rounds: { backgroundColor: colors.bg },
  round: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  roundAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  roundN: { width: 26, fontFamily: fonts.display, fontSize: 15, color: fc.dim },
  roundTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  roundWinner: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13 },
  roundStyle: { fontFamily: fonts.body, fontSize: 12, color: fc.second },
  roundDesc: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, fontStyle: 'italic', color: fc.dim, marginTop: 2 },
  loader: { marginVertical: 16 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, padding: 14 },
  prob: { padding: 14, paddingTop: 2, gap: 8 },
  probLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: fc.dim },
  probRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  probName: { width: 112, fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.soft },
  probTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: fc.track, overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 4 },
  probPct: { width: 38, textAlign: 'right', fontFamily: fonts.display, fontSize: 15, color: colors.text },
});
