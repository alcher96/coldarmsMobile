import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { CompetitionFight } from '@/api/competition';
import { loadMira } from '@/api/fight';
import { averageOdds, formatOdds, loadFightOdds } from '@/api/odds';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { fc } from '@/components/fight/palette';
import { useAsync } from '@/hooks/use-async';
import { plural } from '@/lib/format';
import { columnScale, fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

const GREEN = '#4AC87C';
const AMBER = '#E8B931';
const RED = '#E0645C';

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
              <Text style={styles.score} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                <Text style={{ color: w1 ? GREEN : fc.dim }}>{f.w1Score}</Text>
                <Text style={styles.dash}>–</Text>
                <Text style={{ color: w2 ? GREEN : fc.dim }}>{f.w2Score}</Text>
              </Text>
            ) : (
              <Text style={styles.vs} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                VS
              </Text>
            )}
            <Text style={styles.meta} maxFontSizeMultiplier={SMALL_TEXT_SCALE} numberOfLines={1} {...fitText}>
              {[f.bestOf ? `Bo${f.bestOf}` : null, handLabel(f.hand)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Side id={f.wrestler2Id} name={f.wrestler2Name} win={w2} dim={done && !w2} right />
        </View>
        {done && f.rounds.length ? <Track f={f} /> : null}
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
                {/* Фамилия, а не полное имя: на узком экране полное сжалось бы до нечитаемого. */}
                <Text style={styles.winnerText} numberOfLines={1}>
                  Победа · {split(f.winner!)[1] || f.winner}
                </Text>
              </View>
            ) : null}
          </View>
          {done ? (
            <>
              <Verdict f={f} />
              <Rounds f={f} />
            </>
          ) : (
            <Prediction f={f} />
          )}
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
        <Text style={[styles.first, dim && styles.dimText, right && styles.textRight]} numberOfLines={1} {...fitText}>
          {first}
        </Text>
        {rest ? (
          <Text style={[styles.last, dim && styles.dimText, right && styles.textRight]} numberOfLines={1} {...fitText}>
            {rest}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type Cell = 'won' | 'took' | 'lost' | 'none';

/**
 * Ход боя — как на сайте: по ячейке на каждый раунд формата (Bo7 — семь).
 * Раунд победителя боя — зелёный, раунд, взятый проигравшим, — серый, проигранный — рамка,
 * несыгранный — пунктир. Между дорожками — счёт после раунда: белый — ведёт будущий
 * победитель, янтарный — ведёт проигравший, серый — ничья.
 */
function Track({ f }: { f: CompetitionFight }) {
  const slots = Math.max(Number(f.bestOf) || 0, f.rounds.length);
  const winner = f.winner === f.wrestler1Name ? 1 : 2;
  const lane = (side: 1 | 2): Cell[] => {
    const me = side === 1 ? f.wrestler1Name : f.wrestler2Name;
    return Array.from({ length: slots }, (_, i) => {
      const r = f.rounds[i];
      if (!r) return 'none';
      if (r.winnerName !== me) return 'lost';
      return side === winner ? 'won' : 'took';
    });
  };
  let s1 = 0;
  let s2 = 0;
  const scores = Array.from({ length: slots }, (_, i) => {
    const r = f.rounds[i];
    if (!r) return null;
    if (r.winnerName === f.wrestler1Name) s1++;
    else if (r.winnerName === f.wrestler2Name) s2++;
    const lead = s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
    return { text: `${s1}:${s2}`, color: lead === 0 ? fc.muted : lead === winner ? colors.text : AMBER };
  });
  // Колонка имён растёт со шрифтом, но не съедает ячейки раундов.
  const { fontScale } = useWindowDimensions();
  const nameCol = { width: 64 * columnScale(fontScale) };
  const name = (side: 1 | 2) => {
    const full = side === 1 ? f.wrestler1Name : f.wrestler2Name;
    return split(full)[1] || full;
  };

  const laneRow = (side: 1 | 2) => (
    <View style={styles.trackRow}>
      <Text
        style={[styles.trackName, nameCol, side === winner && styles.trackNameOn]}
        numberOfLines={1}
        maxFontSizeMultiplier={SMALL_TEXT_SCALE}
        {...fitText}>
        {name(side)}
      </Text>
      <View style={styles.cells}>
        {lane(side).map((c, i) => (
          <View key={i} style={[styles.cell, CELL[c]]} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.track}>
      {laneRow(1)}
      <View style={styles.trackRow}>
        <Text style={[styles.trackName, nameCol]} />
        <View style={styles.cells}>
          {scores.map((s, i) => (
            <Text
              key={i}
              style={[styles.trackScore, { color: s ? s.color : fc.borderStrong }]}
              numberOfLines={1}
              maxFontSizeMultiplier={SMALL_TEXT_SCALE}
              {...fitText}>
              {s ? s.text : '·'}
            </Text>
          ))}
        </View>
      </View>
      {laneRow(2)}
    </View>
  );
}

const CELL = StyleSheet.create({
  won: { backgroundColor: GREEN },
  took: { backgroundColor: fc.second },
  lost: { borderWidth: 1, borderColor: fc.borderStrong },
  none: { borderWidth: 1, borderColor: fc.border, borderStyle: 'dashed' },
});

/**
 * «Итог против прогноза»: угадала ли M.I.R.A. победителя, плюс «в сухую».
 * Прогноз грузится только при раскрытии карточки.
 */
function Verdict({ f }: { f: CompetitionFight }) {
  const load = useCallback(() => loadMira(f.fightId), [f.fightId]);
  const { data: mira } = useAsync(load);
  const shutout = f.w1Score === 0 || f.w2Score === 0;
  const pick = !mira || mira.w1Pct === mira.w2Pct ? null : mira.w1Pct > mira.w2Pct ? f.wrestler1Name : f.wrestler2Name;
  if (!pick && !shutout) return null;
  const hit = pick === f.winner;
  return (
    <View style={styles.verdict}>
      {pick ? (
        <View style={styles.verdictItem}>
          <View style={[styles.verdictIcon, { backgroundColor: hit ? 'rgba(74,200,124,0.16)' : 'rgba(200,74,74,0.16)' }]}>
            <Text style={[styles.verdictMark, { color: hit ? GREEN : RED }]}>{hit ? '✓' : '✕'}</Text>
          </View>
          <Text style={styles.verdictText}>{hit ? 'M.I.R.A. угадала' : 'M.I.R.A. ошиблась'}</Text>
        </View>
      ) : null}
      {shutout ? <Text style={styles.shutout}>В сухую</Text> : null}
    </View>
  );
}

function Rounds({ f }: { f: CompetitionFight }) {
  return (
    <View style={styles.rounds}>
      {f.rounds.map((r, i) => {
        // Цвет — как в ходе боя: раунды победителя боя зелёные, проигравшего — янтарные.
        const byWinner = r.winnerName === f.winner;
        return (
          <View key={r.roundNumber} style={[styles.round, i % 2 === 1 && styles.roundAlt]}>
            <Text style={styles.roundN}>R{r.roundNumber}</Text>
            <View style={styles.flex}>
              <View style={styles.roundTop}>
                <Text style={[styles.roundWinner, { color: byWinner ? GREEN : AMBER }]} numberOfLines={1} {...fitText}>
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

/** Прогноз M.I.R.A. и средний коэффициент букмекеров: грузятся, только когда карточку раскрыли. */
function Prediction({ f }: { f: CompetitionFight }) {
  const load = useCallback(
    () => Promise.all([loadMira(f.fightId), loadFightOdds(f.fightId).catch(() => null)]),
    [f.fightId],
  );
  const { data, loading } = useAsync(load);
  if (loading && !data) return <ActivityIndicator color={colors.text} style={styles.loader} />;
  const [mira, odds] = data ?? [null, null];
  const avg = averageOdds(odds);
  if (!mira && !avg) return <Text style={styles.empty}>Прогноз пока не готов</Text>;
  return (
    <View style={styles.prob}>
      {mira ? (
        <>
          <Text style={styles.probLabel}>Вероятность победы · M.I.R.A.</Text>
          {(
            [
              [f.wrestler1Name, mira.w1Pct],
              [f.wrestler2Name, mira.w2Pct],
            ] as const
          ).map(([name, pct]) => {
            const lead = pct >= 50;
            return (
              <View key={name} style={styles.probRow}>
                <Text style={styles.probName} numberOfLines={1} {...fitText}>
                  {name}
                </Text>
                <View style={styles.probTrack}>
                  <View style={[styles.probFill, { width: `${pct}%`, backgroundColor: lead ? colors.text : '#5A5B61' }]} />
                </View>
                <Text style={[styles.probPct, !lead && { color: fc.dim }]} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                  {pct}%
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
      {avg ? (
        <>
          <Text style={[styles.probLabel, mira && styles.oddsLabel]}>
            Средний коэффициент · {avg.sources} {plural(avg.sources, ['букмекер', 'букмекера', 'букмекеров'])}
          </Text>
          <View style={styles.oddsRow}>
            {(
              [
                [f.wrestler1Name, avg.odds1, avg.odds1 <= avg.odds2],
                [f.wrestler2Name, avg.odds2, avg.odds2 < avg.odds1],
              ] as const
            ).map(([name, v, fav], i) => (
              <View key={i} style={[styles.oddsPill, i === 1 && styles.oddsPillRight]}>
                <Text style={styles.oddsName} numberOfLines={1} {...fitText}>
                  {split(name)[1] || name}
                </Text>
                <Text style={[styles.oddsValue, !fav && { color: fc.muted }]}>{formatOdds(v)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
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
  track: { marginTop: 12, gap: 4 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackName: {
    textAlign: 'right',
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: fc.dim,
  },
  trackNameOn: { color: colors.text },
  cells: { flex: 1, flexDirection: 'row', gap: 4 },
  cell: { flex: 1, height: 12, borderRadius: 2 },
  trackScore: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 12, lineHeight: 14 },
  verdict: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  verdictItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  verdictMark: { fontSize: 11, fontFamily: fonts.bodySemi },
  verdictText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  shutout: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GREEN,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chevron: { alignSelf: 'center', marginTop: 6 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fc.line },
  // Не помещается рядом с кнопкой (узкий экран, крупный шрифт) — плашка победителя уходит на строку ниже.
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 12 },
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
    flexGrow: 1,
    flexBasis: 150,
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
  // Доля строки, а не точки: на узком экране полоске шанса тоже нужно место.
  probName: { width: '34%', fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.soft },
  probTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: fc.track, overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 4 },
  probPct: { minWidth: 38, textAlign: 'right', fontFamily: fonts.display, fontSize: 15, color: colors.text },
  oddsLabel: { marginTop: 6 },
  oddsRow: { flexDirection: 'row', gap: 8 },
  oddsPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radii.control,
    backgroundColor: fc.chip,
  },
  oddsPillRight: { flexDirection: 'row-reverse' },
  oddsName: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.soft },
  oddsValue: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
});
