import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPct, handName, type TriangleAnalytics, type TriangleCase, type TriangleScore } from '@/api/analytics';
import { BarRow, Block, GREEN, ShowMore, styles as kit } from '@/components/analytics/kit';
import { fc } from '@/components/fight/palette';
import { colors, fonts, radii } from '@/theme/tokens';

const FEW = 5;

/** Доля попаданий: «25 из 38» и полоса с отметкой 50%. */
function Score({ label, s }: { label: string; s: TriangleScore }) {
  return (
    <BarRow
      label={label}
      value={formatPct(s.winRate, 0)}
      sub={`${s.hits} из ${s.cases}`}
      fraction={(s.winRate ?? 0) / 100}
      marker
      wrap
    />
  );
}

/** «Треугольник»: насколько правило «победил общего соперника — значит сильнее» угадывает исход. */
export function TriangleSection({ data }: { data: TriangleAnalytics }) {
  const [all, setAll] = useState(false);
  const hands = (
    [
      ['Правая рука', data.right.rule],
      ['Левая рука', data.left.rule],
    ] as const
  ).filter(([, s]) => s.cases > 0);
  const cases = all ? data.cases : data.cases.slice(0, FEW);

  return (
    <View style={{ gap: 12 }}>
      <Block title="Насколько точно работает правило">
        <Text style={styles.rule}>
          Правило треугольника: если один боец побеждал общего соперника, а второй ему проигрывал — считается, что первый
          сильнее.
        </Text>
        {hands.map(([label, s]) => (
          <Score key={label} label={label} s={s} />
        ))}
      </Block>

      <Block
        title="Правило или процент побед?"
        note={`Сравнить можно ${data.ruleComparable.cases} из этих ${data.rule.cases} боёв: в остальных у кого-то из бойцов меньше 3 боёв на этой руке или процент побед одинаковый.`}>
        <Score label="Правило треугольника" s={data.ruleComparable} />
        <Score label="Победит боец с большим процентом побед" s={data.strength} />
      </Block>

      <Block title="Точность в разных случаях">
        <Score label="Бойцы почти равны по проценту побед (разница до 20)" s={data.even} />
        <Score label="Правило и процент побед расходятся — право правило" s={data.disputed} />
      </Block>

      <Block
        title="Все бои"
        note="Считаются только результаты на той же руке, на которой шёл бой. Общий соперник учитывается, если оба бойца встречались с ним на этой руке до боя.">
        {cases.map((c) => (
          <CaseRow key={c.fightId} c={c} />
        ))}
        {data.cases.length > FEW ? <ShowMore expanded={all} total={data.cases.length} onPress={() => setAll((v) => !v)} /> : null}
      </Block>
    </View>
  );
}

/** Бой: кого правило назвало сильнее, через каких общих соперников и угадало ли. Ведёт на экран боя. */
function CaseRow({ c }: { c: TriangleCase }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/fight/[id]', params: { id: c.fightId } })}
      style={({ pressed }) => [styles.case, pressed && kit.pressed]}
      accessibilityRole="button">
      <View style={styles.caseMain}>
        <Text style={styles.caseNames} numberOfLines={2}>
          <Text style={styles.picked}>{c.pickedName}</Text>
          <Text style={styles.vs}> vs </Text>
          {c.otherName}
        </Text>
        <Text style={styles.caseSub} numberOfLines={2}>
          через {c.via.map((v) => v.fullName).join(', ')} · {c.competitionName} · {handName(c.hand).toLowerCase()}
        </Text>
      </View>
      <Text style={[styles.badge, c.ruleWasRight ? styles.hit : styles.miss]}>{c.ruleWasRight ? 'верно' : 'ошибка'}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  rule: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft },
  case: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  caseMain: { flex: 1, minWidth: 0 },
  caseNames: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  picked: { color: colors.text },
  vs: { color: colors.textDim },
  caseSub: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMuted, marginTop: 1 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.small,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hit: { color: GREEN, borderColor: 'rgba(74,200,124,0.4)' },
  miss: { color: fc.coral, borderColor: 'rgba(240,138,130,0.4)' },
});
