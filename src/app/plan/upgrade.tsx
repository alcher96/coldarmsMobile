import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Option, Question, Screen } from '@/features/analysis/components/kit';
import { fetchCatalog, fetchStatic, makePlan } from '@/features/plan/api';
import { BigButton, GearButton, HeaderTitle } from '@/features/plan/layout';
import { PlanView } from '@/features/plan/plan-view';
import { usePlan } from '@/features/plan/store';
import { gearOfWeek, type Catalog, type Plan } from '@/features/plan/types';
import { colors, fonts, radii } from '@/theme/tokens';
import { userMessage } from '@/lib/user-error';

const DEGREES = [
  { key: 'weak', label: 'Слабая', hint: 'Добавить 2 подсобных упражнения на слабые места' },
  { key: 'medium', label: 'Средняя', hint: 'Добавить 2 и заменить 1–2 упражнения, которые слабые места не закрывают' },
  { key: 'strong', label: 'Сильная', hint: 'Максимально подогнать неделю под слабые места' },
];
const STATICS = [
  { key: 'strength', label: 'Силовая', hint: 'Короткие тяжёлые удержания 6–10 с' },
  { key: 'endurance', label: 'На выносливость', hint: 'Длинные удержания 60–90 с на 40–60% усилия, без отказа' },
];

/** Коррекция недели по разбору: срок, степень → «было → стало» и схема по неделям. */
export default function Upgrade() {
  const { analysis } = useLocalSearchParams<{ analysis: string }>();
  const { week, hasExercises, inventory, setInventory, active, startPlan } = usePlan();
  const [cat, setCat] = useState<Catalog | null>(null);
  useEffect(() => {
    fetchCatalog().then(setCat).catch(() => setCat(null));
  }, []);
  const implied = cat ? gearOfWeek(week, cat) : new Set<string>(); // на чём уже тренируется — есть точно
  const gear = new Set([...(inventory ?? []), ...implied]);
  const toggleGear = (g: string) => {
    if (implied.has(g)) return;
    const next = new Set(gear);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setInventory([...next]);
  };
  const [months, setMonths] = useState(3);
  const [degree, setDegree] = useState('medium');
  const [staticType, setStaticType] = useState('strength');
  const [staticForced, setStaticForced] = useState(false);
  useEffect(() => {
    fetchStatic(analysis).then((s) => setStaticForced(s.forced)).catch(() => setStaticForced(false));
  }, [analysis]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const [starts, setStarts] = useState<Record<string, number>>({});
  const first = useRef(true);

  const params = (s = starts) => ({ week, months, degree, starts: s, inventory: [...gear], static: staticType });
  const run = (s = starts) => {
    setBusy(true);
    setError(undefined);
    makePlan(analysis, params(s))
      .then(setPlan)
      .catch((e) => setError(userMessage(e)))
      .finally(() => setBusy(false));
  };

  // вписал вес 1-й недели — план пересчитывает все недели от него
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => run(starts), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starts]);

  if (active?.analysis === analysis) {
    return (
      <Screen eyebrow="План тренировок" title="План уже начат"
        footer={<Button label="Мой план тренировок" onPress={() => router.replace('/plan/track')} />}>
        <Text style={styles.lead}>По этому разбору план уже скорректирован и идёт. Новый план — по следующему разбору.</Text>
      </Screen>
    );
  }

  if (plan) {
    return (
      <PlanView
        plan={plan}
        right={
          <>
            <HeaderTitle>Твой план</HeaderTitle>
            <GearButton
              onPress={() => {
                setPlan(null); // другие настройки: срок, степень, инвентарь, статика
                setStarts({});
              }}
            />
          </>
        }
        onStartWeight={(key, kg) => setStarts((s) => ({ ...s, [key]: kg }))}
        footer={() => (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <BigButton
              label={starting ? 'Сохраняю…' : active ? 'Начать этот план вместо текущего' : 'Начать этот план'}
              onPress={() => {
                if (starting) return;
                // сервер строит план по тем же параметрам и сохраняет — тот же план, что на экране
                setStarting(true);
                setError(undefined);
                startPlan(analysis, params())
                  .then(() => router.replace('/plan/track'))
                  .catch((e) => setError(userMessage(e)))
                  .finally(() => setStarting(false));
              }}
            />
          </>
        )}
      />
    );
  }

  if (!hasExercises) {
    return (
      <Screen eyebrow="План тренировок" title="Сначала неделя" footer={<Button label="Заполнить неделю" onPress={() => router.replace(`/plan?analysis=${encodeURIComponent(analysis)}`)} />}>
        <Text style={styles.lead}>Чтобы подстроить план, MIRA должна знать, как ты тренируешься сейчас.</Text>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="План тренировок · по разбору"
      title="Коррекция"
      footer={<Button label={busy ? 'Считаю…' : 'Скорректировать план'} disabled={busy} onPress={() => run()} />}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={colors.text} /> : null}
      <>
          <Question title="Что у тебя есть">
            <Text style={styles.lead}>Отметь инвентарь — MIRA не поставит упражнение, для которого чего-то нет.</Text>
            {/* на чём уже тренируется — есть точно: не кнопкой (её нельзя снять — выглядит как поломка), а строкой */}
            {implied.size ? <Text style={styles.lead}>Уже есть по твоей неделе: {[...implied].join(', ')}.</Text> : null}
            {cat
              ? (['снаряды', 'ручки'] as const).map((group) => (
                  <View key={group} style={styles.chips}>
                    {cat.gear[group].filter((g) => !implied.has(g)).map((g) => {
                      const on = gear.has(g);
                      return (
                        <Pressable
                          key={g}
                          onPress={() => toggleGear(g)}
                          style={[styles.chip, on && styles.chipOn]}
                          accessibilityState={{ selected: on }}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              : null}
          </Question>
          <Question title="На сколько">
            <View style={styles.row}>
              {[1, 2, 3].map((m) => (
                <Option key={m} label={`${m} мес.`} selected={months === m} onPress={() => setMonths(m)} style={{ flex: 1 }} />
              ))}
            </View>
          </Question>
          <Question title="Насколько менять неделю">
            {DEGREES.map((d) => (
              <Option key={d.key} label={d.label} hint={d.hint} selected={degree === d.key} onPress={() => setDegree(d.key)} />
            ))}
          </Question>
          <Question title="Какая статика">
            {staticForced ? (
              <Text style={styles.lead}>Силовая — короткие тяжёлые удержания 6–10 с: при проигрыше в касание.</Text>
            ) : (
              STATICS.map((d) => (
                <Option key={d.key} label={d.label} hint={d.hint} selected={staticType === d.key} onPress={() => setStaticType(d.key)} />
              ))
            )}
          </Question>
      </>
    </Screen>
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
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.accent },
  row: { flexDirection: 'row', gap: 8 },
});
