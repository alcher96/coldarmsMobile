import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Question, Screen } from '@/features/analysis/components/kit';
import { fetchCatalog } from '@/features/plan/api';
import { usePlan } from '@/features/plan/store';
import { DAY_RU, type Catalog } from '@/features/plan/types';
import { colors, fonts, radii } from '@/theme/tokens';

/** Добавить упражнение — пошагово чипами и степперами, без клавиатуры. */
export default function AddExercise() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { add } = usePlan();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string>();
  const [handle, setHandle] = useState<string>();
  const [mode, setMode] = useState('динамика');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);

  useEffect(() => {
    fetchCatalog().then(setCat);
  }, []);

  const toggle = (t: string) => setTargets((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t].slice(0, 4)));
  const ready = targets.length && equipment && handle;

  return (
    <Screen
      eyebrow={`План · ${DAY_RU[day] ?? day}`}
      title="Упражнение"
      footer={
        <Button
          label="Добавить"
          disabled={!ready}
          onPress={() => {
            add(day, { targets, equipment: equipment!, handle: handle!, mode, sets, reps, weight });
            router.back();
          }}
        />
      }>
      {!cat ? <ActivityIndicator color={colors.text} /> : null}
      {cat ? (
        <>
          <Question title="Что тренирует (можно несколько, первое — главное)">
            <Chips items={cat.targets} selected={targets} onPress={toggle} />
          </Question>
          <Question title="Снаряд">
            <Chips items={cat.equipment} selected={equipment ? [equipment] : []} onPress={setEquipment} />
          </Question>
          <Question title="Ручка / хват">
            <Chips items={cat.handles} selected={handle ? [handle] : []} onPress={setHandle} />
          </Question>
          <Question title="Режим">
            <Chips items={cat.modes} selected={[mode]} onPress={setMode} />
          </Question>
          <Question title="Числа">
            <Stepper label="подходы" value={sets} step={1} min={1} max={20} onChange={setSets} />
            <Stepper label={mode === 'статика' ? 'секунды' : 'повторы'} value={reps} step={1} min={1} max={100} onChange={setReps} />
            <Stepper label="вес, кг" value={weight} step={1} min={0} max={300} onChange={setWeight} />
          </Question>
        </>
      ) : null}
    </Screen>
  );
}

function Chips({ items, selected, onPress }: { items: string[]; selected: string[]; onPress: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((t) => {
        const on = selected.includes(t);
        const n = selected.indexOf(t);
        return (
          <Pressable key={t} onPress={() => onPress(t)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {on && selected.length > 1 ? `${n + 1}. ` : ''}
              {t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
        <Minus size={16} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
        <Plus size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  chipOn: { backgroundColor: colors.light, borderColor: colors.light },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text },
  chipTextOn: { fontFamily: fonts.bodySemi, color: colors.lightText },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  stepValue: { width: 44, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, color: colors.text },
});
