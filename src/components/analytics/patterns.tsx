import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPct, handName, type ComebackFight, type MatchInsights } from '@/api/analytics';
import { AthleteRow, BarRow, BigStat, Block, KpiGrid, Note, ShowMore, styles as kit } from '@/components/analytics/kit';
import { fc } from '@/components/fight/palette';
import { plural } from '@/lib/format';
import { SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

const FEW_SCORES = 6;
const FEW_COMEBACKS = 5;

/** «Паттерны побед»: фавориты и апсеты, цена первого раунда, камбэки и счета матчей. */
export function PatternsSection({ data }: { data: MatchInsights }) {
  const [allScores, setAllScores] = useState(false);
  const [allComebacks, setAllComebacks] = useState(false);
  const { favorites: fav, firstRound: fr, scores } = data;
  const upset = fav.biggestUpset;
  const maxScore = Math.max(1, ...scores.scores.map((s) => s.count));
  const shownScores = allScores ? scores.scores : scores.scores.slice(0, FEW_SCORES);
  const comebacks = allComebacks ? fr.comebackFights : fr.comebackFights.slice(0, FEW_COMEBACKS);

  return (
    <View style={{ gap: 12 }}>
      <Block title="Фаворит против андердога">
        <BigStat
          value={formatPct(fav.favoriteWinRate)}
          text="боёв выигрывает явный фаворит — атлет с перевесом от 50 пунктов Elo на момент матча."
        />
        <Note>
          Апсетов — {fav.upsetCount} из {fav.fightsCounted} таких боёв.
        </Note>
      </Block>

      {upset ? (
        <Block
          title="Самый громкий апсет"
          note={`Шанс по Elo — всего ${formatPct(upset.winnerChance)} · ${handName(upset.hand).toLowerCase()} рука · ${new Date(upset.date).getFullYear()}`}>
          <AthleteRow id={upset.winnerId} name={upset.winnerName} sub="победил" />
          <AthleteRow id={upset.loserId} name={upset.loserName} sub="фаворит по Elo" />
        </Block>
      ) : null}

      <Block title="Цена первого раунда">
        <BigStat
          value={formatPct(fr.firstRoundWinnerMatchRate)}
          text={`взявших первый раунд выигрывают весь матч (${fr.fightsCounted} ${plural(fr.fightsCounted, ['матч', 'матча', 'матчей'])} с записанными раундами).`}
        />
        <KpiGrid
          kpis={[
            { value: String(fr.comebacks - fr.comebacksFromTwoDown), label: 'Камбэков после 0–1' },
            { value: String(fr.comebacksFromTwoDown), label: 'Камбэков после 0–2' },
            { value: formatPct(scores.sweepRate), label: 'Побед всухую' },
            { value: formatPct(scores.deciderRate), label: 'Дошло до решающего' },
          ]}
        />
      </Block>

      <Block title="Счёт матчей" note={`${scores.fightsCounted} ${plural(scores.fightsCounted, ['матч', 'матча', 'матчей'])}.`}>
        {shownScores.map((s) => (
          <BarRow
            key={s.score}
            label={s.score}
            value={String(s.count)}
            sub={formatPct((s.count / Math.max(1, scores.fightsCounted)) * 100)}
            fraction={s.count / maxScore}
          />
        ))}
        {scores.scores.length > FEW_SCORES ? (
          <ShowMore expanded={allScores} total={scores.scores.length} onPress={() => setAllScores((v) => !v)} />
        ) : null}
      </Block>

      <Block title="Камбэки" note="Матчи, выигранные после проигранного первого раунда.">
        {comebacks.map((c) => (
          <ComebackRow key={c.fightId} c={c} />
        ))}
        {fr.comebackFights.length > FEW_COMEBACKS ? (
          <ShowMore expanded={allComebacks} total={fr.comebackFights.length} onPress={() => setAllComebacks((v) => !v)} />
        ) : null}
      </Block>
    </View>
  );
}

/** Матч, выигранный после проигранного первого раунда. Ведёт на экран боя. */
function ComebackRow({ c }: { c: ComebackFight }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/fight/[id]', params: { id: c.fightId } })}
      style={({ pressed }) => [styles.row, pressed && kit.pressed]}
      accessibilityRole="button">
      <View style={styles.main}>
        <Text style={styles.names} numberOfLines={2}>
          <Text style={styles.winner}>{c.winnerName}</Text>
          <Text style={styles.vs}> vs </Text>
          {c.loserName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {c.competitionName} · {handName(c.hand).toLowerCase()}
          {c.fromTwoDown ? ' · после 0–2' : ''}
        </Text>
      </View>
      <Text style={styles.score} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
        {c.score}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  main: { flex: 1, minWidth: 0 },
  names: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  winner: { color: colors.text },
  vs: { color: colors.textDim },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  score: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.row,
    borderRadius: radii.small,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
