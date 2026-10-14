import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommonOpponent, FightPage } from '@/api/fight';
import { dateLong } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { SectionHead, type Info } from './info-sheet';
import { INFO, type Side } from './model';
import { fc } from './palette';

const handShort = (h: string | null) => (h === 'Left' ? 'левая' : h === 'Right' ? 'правая' : '');

/** Личные встречи и общие соперники. */
export function History({ data, a, b, onInfo }: { data: FightPage; a: Side; b: Side; onInfo: (info: Info) => void }) {
  const fight = data.fight;
  // Прошлые встречи: без текущего боя и без незавершённых («Draw» API ставит боям без результата).
  const past = (data.comparison?.directFights ?? []).filter(
    (f) => f.fightId !== fight.fightId && f.winnerName && f.winnerName !== 'Draw',
  );
  const winsA = past.filter((f) => f.winnerName === fight.wrestler1Name).length;
  const winsB = past.filter((f) => f.winnerName === fight.wrestler2Name).length;
  const common = data.comparison?.commonOpponents ?? [];
  const sum = (pick: (c: CommonOpponent) => { wins: number; losses: number }) =>
    common.reduce((acc, c) => [acc[0] + pick(c).wins, acc[1] + pick(c).losses], [0, 0]);
  const [tA, tB] = [sum((c) => c.resultA), sum((c) => c.resultB)];
  const event = data.competition
    ? `${data.competition.competitionName} · ${dateLong(data.competition.competitionDate)}`
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.h2h}>
        <Text style={[styles.h2hScore, past.length > 0 && { color: colors.text }]}>
          {winsA}–{winsB}
        </Text>
        <View style={styles.flex}>
          <Text style={styles.h2hTitle}>
            {past.length === 0
              ? 'Первая личная встреча'
              : winsA === winsB
                ? 'Равенство в личных встречах'
                : `${winsA > winsB ? a.last : b.last} ведёт в личных встречах`}
          </Text>
          {past.length === 0 && event ? <Text style={styles.h2hSub}>{event}</Text> : null}
          {past.map((f) => (
            <Text key={f.fightId} style={styles.h2hSub}>
              {f.competitionName} · {handShort(f.hand)} · победа {f.winnerName}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHead title="Общие соперники" onInfo={() => onInfo(INFO.common)} />
      </View>

      {common.length === 0 ? (
        <Text style={styles.empty}>Общих соперников нет</Text>
      ) : (
        <>
          <View style={[styles.grid, styles.headRow]}>
            <Text style={[styles.th, styles.flex]}>Соперник</Text>
            <Text style={[styles.th, styles.col]} numberOfLines={1}>
              {a.last}
            </Text>
            <Text style={[styles.th, styles.col]} numberOfLines={1}>
              {b.last}
            </Text>
            <View style={styles.chev} />
          </View>
          {common.map((c) => (
            <OpponentRow key={c.opponentId} c={c} />
          ))}
          <View style={[styles.grid, styles.total]}>
            <Text style={[styles.totalLabel, styles.flex]}>Итого</Text>
            <Text style={[styles.totalValue, styles.col]}>
              {tA[0]}–{tA[1]}
            </Text>
            <Text style={[styles.totalValue, styles.col, { color: fc.second }]}>
              {tB[0]}–{tB[1]}
            </Text>
            <View style={styles.chev} />
          </View>
        </>
      )}
    </View>
  );
}

function OpponentRow({ c }: { c: CommonOpponent }) {
  const [open, setOpen] = useState(false);
  const results = (r: CommonOpponent['resultA']) => r.fights.map((f) => (f.isWin ? 'W' : 'L'));
  const events = (r: CommonOpponent['resultA']) =>
    r.fights.map((f) => `${f.competitionName} · ${f.isWin ? 'победа' : 'поражение'}`);
  return (
    <View style={styles.rowWrap}>
      <Pressable onPress={() => setOpen((v) => !v)} style={[styles.grid, styles.row]}>
        <Text style={[styles.name, styles.flex]} numberOfLines={2}>
          {c.opponentName}
        </Text>
        <Chips items={results(c.resultA)} />
        <Chips items={results(c.resultB)} />
        <View style={[styles.chev, open && styles.chevOpen]}>
          <ChevronDown size={16} color={fc.dim} strokeWidth={1.8} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.details}>
          <View style={styles.flex}>
            {events(c.resultA).map((e, i) => (
              <Text key={i} style={styles.detail}>
                {e}
              </Text>
            ))}
          </View>
          <View style={styles.flex}>
            {events(c.resultB).map((e, i) => (
              <Text key={i} style={[styles.detail, styles.right]}>
                {e}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <View style={[styles.col, styles.chips]}>
      {items.map((t, i) => (
        <View key={i} style={[styles.chip, t === 'W' ? styles.chipW : null]}>
          <Text style={[styles.chipText, { color: t === 'W' ? colors.lightText : colors.accent }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 28 },
  flex: { flex: 1 },
  h2h: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  h2hScore: { fontFamily: fonts.display, fontSize: 26, color: '#5A5B61' },
  h2hTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  h2hSub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 2 },
  section: { marginTop: 24, marginBottom: 4 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, marginTop: 8 },
  grid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  th: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: fc.dim },
  col: { width: 72, textAlign: 'center' },
  chev: { width: 20, alignItems: 'center' },
  chevOpen: { transform: [{ rotate: '180deg' }] },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  row: { minHeight: 56 },
  name: { fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  chip: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  chipW: { backgroundColor: colors.light },
  chipText: { fontFamily: fonts.display, fontSize: 12 },
  details: { flexDirection: 'row', gap: 10, paddingBottom: 14 },
  detail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: fc.second },
  right: { textAlign: 'right' },
  total: { paddingTop: 14 },
  totalLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  totalValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
});
