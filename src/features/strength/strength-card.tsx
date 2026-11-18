// Карточка «Силовые» в профиле: рост, вес, класс и лучший уровень по каждому упражнению → экран «Силовые».
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fc } from '@/components/fight/palette';
import { colors, fonts, radii } from '@/theme/tokens';

import { getStrength, type StrengthData } from './api';
import { LevelBadge, classLabel } from './ui';
import { fmtW, useUnit } from './units';

export function StrengthCard() {
  const unit = useUnit();
  const [data, setData] = useState<StrengthData | null>(null);
  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      getStrength(ac.signal).then(setData).catch(() => {});
      return () => ac.abort();
    }, []),
  );
  const b = data?.body;
  const best = (ex: string) =>
    Math.max(-1, ...(data?.results ?? []).filter((r) => r.exercise === ex && r.best).map((r) => r.best!.level));
  const done = data ? data.standards.exercises.filter((e) => best(e.id) >= 0) : [];
  return (
    <Pressable onPress={() => router.push('/strength')} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.head}>
        <Text style={styles.title}>Силовые</Text>
        <ChevronRight size={18} color={fc.muted} strokeWidth={1.8} />
      </View>
      <Text style={styles.sub}>
        {b?.weightKg
          ? [b.heightCm ? `${b.heightCm} см` : null, fmtW(b.weightKg, unit),
             b.sex && b.classIdx !== null ? classLabel(data!.standards, b.sex, b.classIdx, unit) : null].filter(Boolean).join(' · ')
          : 'Укажи рост, вес и свои рабочие веса — узнаешь уровень и место в таблице лидеров'}
      </Text>
      {data && done.length ? (
        <View style={styles.list}>
          {done.map((e) => (
            <View key={e.id} style={styles.item}>
              <Text style={styles.ex}>{e.name}</Text>
              <LevelBadge std={data.standards} level={best(e.id)} small />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 16, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: fc.muted },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  ex: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
});
