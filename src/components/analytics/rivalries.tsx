import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MatchInsights, Rivalry } from '@/api/analytics';
import { Block, styles as kit } from '@/components/analytics/kit';
import { fc } from '@/components/fight/palette';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { flagOf } from '@/lib/countries';
import { plural } from '@/lib/format';
import { fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts } from '@/theme/tokens';

/** «Соперники и стили»: пары, встречавшиеся чаще всех, и счёт очных встреч стилей. */
export function RivalriesSection({ data }: { data: MatchInsights }) {
  const m = data.styleMatchups;
  return (
    <View style={{ gap: 12 }}>
      <Block title="Вечные соперники">
        {data.rivalries.map((r) => (
          <RivalryRow key={`${r.wrestlerAId}-${r.wrestlerBId}`} r={r} />
        ))}
      </Block>

      <Block
        title="Стиль против стиля"
        note={`Счёт очных встреч в матчах — не винрейт стиля. Здесь только прямые дуэли пары стилей, причём лишь в матчах, где раунды брали обе стороны (${m.fightsCounted} ${plural(m.fightsCounted, ['бой', 'боя', 'боёв'])}): стиль записывается у победителя раунда, и победы всухую стиль проигравшего не раскрывают. На выборках в 10–20 встреч перевес в пару матчей — обычный разброс, а не превосходство техники.`}>
        {m.pairs.map((p) => {
          const left = p.total ? p.winsA / p.total : 0.5;
          return (
            <View key={`${p.styleA}-${p.styleB}`} style={styles.pair} accessible accessibilityLabel={`${p.styleA} ${p.winsA}, ${p.styleB} ${p.winsB}`}>
              <View style={styles.pairHead}>
                {/* Неразрывные пробелы: счёт не отрывается от названия стиля при переносе. */}
                <Text style={[styles.style, p.winsA >= p.winsB && styles.lead]}>
                  {p.styleA}{'\u00A0·\u00A0'}{p.winsA}
                </Text>
                <Text style={[styles.style, styles.right, p.winsB >= p.winsA && styles.lead]}>
                  {p.winsB}{'\u00A0·\u00A0'}{p.styleB}
                </Text>
              </View>
              <View style={styles.split}>
                <View style={[styles.splitA, { flex: left }]} />
                <View style={[styles.splitB, { flex: 1 - left }]} />
              </View>
              <Text style={styles.total} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                {p.total} {plural(p.total, ['встреча', 'встречи', 'встреч'])}
              </Text>
            </View>
          );
        })}
      </Block>
    </View>
  );
}

/** Пара соперников: счёт очных встреч и последняя встреча. Имена ведут на страницы атлетов. */
function RivalryRow({ r }: { r: Rivalry }) {
  const side = (id: string, name: string, country: string | null, right?: boolean) => (
    <Pressable
      onPress={() => router.push({ pathname: '/athlete/[id]', params: { id } })}
      style={({ pressed }) => [styles.side, right && styles.sideRight, pressed && kit.pressed]}
      accessibilityRole="button"
      accessibilityLabel={name}>
      <FighterAvatar id={id} name={name} size={30} round />
      <Text style={[styles.name, right && styles.right]} numberOfLines={2} {...fitText}>
        {name} {flagOf(country)}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.rivalry}>
      <View style={styles.rivalryHead}>
        {side(r.wrestlerAId, r.nameA, r.countryA)}
        <Text style={styles.score} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
          {r.winsA}–{r.winsB}
        </Text>
        {side(r.wrestlerBId, r.nameB, r.countryB, true)}
      </View>
      <Text style={styles.meta}>
        {r.totalFights} {plural(r.totalFights, ['встреча', 'встречи', 'встреч'])} · последняя — {r.lastCompetitionName},{' '}
        {new Date(r.lastMeeting).getFullYear()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rivalry: { gap: 4, paddingVertical: 2 },
  rivalryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  sideRight: { flexDirection: 'row-reverse' },
  name: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  right: { textAlign: 'right' },
  score: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  pair: { gap: 6 },
  pairHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  style: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  lead: { color: colors.text, fontFamily: fonts.bodySemi },
  total: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  split: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  splitA: { backgroundColor: colors.text },
  splitB: { backgroundColor: fc.barB },
});
