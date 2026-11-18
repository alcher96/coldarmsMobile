import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { mira } from '@/features/analysis/components/mira';
import { fetchExampleWeek } from '@/features/plan/api';
import { BigButton, c, DAY_SHORT, Eyebrow, exGear, exName, Pill, PlanShell } from '@/features/plan/layout';
import { usePlan } from '@/features/plan/store';
import { DAYS, DAY_RU, exerciseNumbers, type Exercise } from '@/features/plan/types';

/** «Моя неделя» (раскладка 1a): сначала тапаешь дни тренировок, потом наполняешь только их. */
export default function MyWeek() {
  const { analysis } = useLocalSearchParams<{ analysis?: string }>();
  const { week, setWeek, remove, toggleDay, hasExercises } = usePlan();
  const train = DAYS.filter((d) => Array.isArray(week[d]));
  const rest = DAYS.filter((d) => !Array.isArray(week[d]));
  const items = (d: string) => (Array.isArray(week[d]) ? (week[d] as Exercise[]) : []);

  const confirm = (title: string, text: string, go: () => void) => {
    if (Platform.OS === 'web') go();
    else Alert.alert(title, text, [{ text: 'Отмена', style: 'cancel' }, { text: 'Да', style: 'destructive', onPress: go }]);
  };
  const fill = () => {
    const go = () => fetchExampleWeek().then((r) => setWeek(r.days));
    if (hasExercises) confirm('Заменить неделю?', 'Твои упражнения заменятся неделей эксперта.', go);
    else go();
  };
  const toggle = (d: string) => {
    if (items(d).length) confirm(`${DAY_RU[d]} — отдых?`, 'Упражнения этого дня удалятся.', () => toggleDay(d));
    else toggleDay(d);
  };

  return (
    <PlanShell
      right={<Pill label="Пример эксперта" onPress={fill} />}
      footer={
        <BigButton
          label={analysis ? 'Скорректировать по разбору' : 'Готово'}
          off={!hasExercises}
          onPress={() => (analysis ? router.push(`/plan/upgrade?analysis=${encodeURIComponent(analysis)}`) : router.back())}
        />
      }>
      <Eyebrow>План тренировок</Eyebrow>
      <Text style={st.title}>Моя неделя</Text>
      <Text style={st.lead}>
        Отметь, что делаешь в обычную неделю — <Text style={{ color: c.violet }}>MIRA</Text> подстроит план под разбор.
      </Text>

      <Eyebrow style={{ marginTop: 22 }}>Дни тренировок</Eyebrow>
      <View style={st.toggles}>
        {DAYS.map((d, i) => {
          const on = Array.isArray(week[d]);
          return (
            <Pressable key={d} onPress={() => toggle(d)} style={[st.toggle, on && st.toggleOn]} accessibilityState={{ selected: on }} accessibilityLabel={DAY_RU[d]}>
              <Text style={[st.toggleText, { color: on ? c.bg : c.muted }]}>{DAY_SHORT[i]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 8, marginTop: 16 }}>
        {train.map((d) => {
          const ex = items(d);
          return (
            <View key={d} style={st.card}>
              <View style={st.cardHead}>
                <Text style={st.cardName}>
                  {DAY_RU[d]} <Text style={{ color: c.dim }}>· {ex.length ? `${ex.length} упр.` : 'пусто'}</Text>
                </Text>
                <Pressable style={st.plus} onPress={() => router.push(`/plan/add?day=${encodeURIComponent(d)}`)} accessibilityLabel={`Добавить упражнение: ${DAY_RU[d]}`}>
                  <Plus size={16} color={c.text} strokeWidth={1.8} />
                </Pressable>
              </View>
              {ex.map((e, i) => (
                <View key={i} style={st.ex}>
                  <Text style={st.exName} numberOfLines={1}>
                    {exName(e)} <Text style={{ color: c.dim }}>· {exGear(e)}</Text>
                  </Text>
                  <Text style={st.exNums}>{exerciseNumbers(e)}</Text>
                  <Pressable hitSlop={10} onPress={() => remove(d, i)} accessibilityLabel="Удалить упражнение">
                    <X size={15} color={c.dim} strokeWidth={1.8} />
                  </Pressable>
                </View>
              ))}
              {!ex.length ? <Text style={st.empty}>Пока пусто — нажми +</Text> : null}
            </View>
          );
        })}
      </View>
      {rest.length ? (
        <View style={st.restRow}>
          <Text style={st.restText}>Отдых</Text>
          <Text style={st.restText}>{rest.map((d) => DAY_SHORT[DAYS.indexOf(d)]).join(', ')}</Text>
        </View>
      ) : null}
    </PlanShell>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: mira.display, fontSize: 32, lineHeight: 34, textTransform: 'uppercase', color: c.text, marginTop: 6 },
  lead: { fontFamily: mira.font, fontSize: 14, lineHeight: 20, color: '#9A9BA2', marginTop: 8 },
  toggles: { flexDirection: 'row', gap: 5, marginTop: 10 },
  toggle: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: c.text, borderColor: c.text },
  toggleText: { fontFamily: mira.fontSemi, fontSize: 14 },
  card: { backgroundColor: c.card, borderRadius: 16, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontFamily: mira.display, fontSize: 16, textTransform: 'uppercase', color: c.text },
  plus: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  ex: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.lineSoft, marginTop: 6 },
  exName: { flex: 1, fontFamily: mira.font, fontSize: 14, lineHeight: 18, color: c.text },
  exNums: { fontFamily: mira.fontSemi, fontSize: 14, color: c.soft },
  empty: { fontFamily: mira.font, fontSize: 13, color: c.dim, paddingTop: 4, paddingBottom: 8 },
  restRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 4 },
  restText: { fontFamily: mira.font, fontSize: 13, color: c.dim },
});
