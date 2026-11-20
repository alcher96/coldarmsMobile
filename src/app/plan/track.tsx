import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { Segmented } from '@/components/segmented';
import { Button, Screen } from '@/features/analysis/components/kit';
import { mira } from '@/features/analysis/components/mira';
import { BigButton, c, GearButton, HeaderTitle, SheetText } from '@/features/plan/layout';
import { PlanView } from '@/features/plan/plan-view';
import { usePlan } from '@/features/plan/store';
import { adjustedWeeks, logKey, type TrackMode } from '@/features/plan/track';

const MODES: { key: TrackMode; label: string }[] = [
  { key: 'simple', label: 'Сделал / не сделал' },
  { key: 'track', label: 'Слежу за весами' },
];

/** Начатый план: отметки по неделям; в режиме слежения веса следующих недель — от сделанного. */
export default function Track() {
  const { ready, active, setMode, setLog, dropPlan } = usePlan();
  const [settings, setSettings] = useState(false);
  if (!active && !ready) {
    return (
      <Screen eyebrow="План тренировок" title="Мой план">
        <ActivityIndicator color={c.text} />
      </Screen>
    );
  }
  if (!active) {
    return (
      <Screen eyebrow="План тренировок" title="Плана нет" footer={<Button label="К разборам" onPress={() => router.dismissTo('/analysis')} />}>
        <Text style={st.lead}>Собери план по разбору и нажми «Начать этот план».</Text>
      </Screen>
    );
  }
  const { plan, mode } = active;

  const drop = () => {
    const go = () => {
      dropPlan();
      router.dismissTo('/analysis');
    };
    if (Platform.OS === 'web') go();
    else Alert.alert('Удалить план?', 'Отметки тоже удалятся.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: go }]);
  };

  return (
    <PlanView
      plan={plan}
      track={{ active, setLog }}
      right={
        <>
          <HeaderTitle>Мой план</HeaderTitle>
          <GearButton onPress={() => setSettings(true)} />
        </>
      }
      extraSheet={
        settings
          ? {
              title: 'Как отмечать',
              body: (
                <>
                  <Segmented options={MODES} value={mode} onChange={setMode} />
                  <SheetText dim>
                    {mode === 'simple'
                      ? 'Отмечаешь, что сделал. Веса — как в плане.'
                      : 'Отмечаешь, что сделал, и поправляешь цифры, если вышло иначе. Не добил — следующая неделя с тем же весом; поднял больше или меньше плана — дальше веса от сделанного.'}
                  </SheetText>
                  <Pressable onPress={drop} style={st.drop}>
                    <Text style={st.dropText}>Удалить план</Text>
                  </Pressable>
                </>
              ),
            }
          : null
      }
      onCloseExtra={() => setSettings(false)}
      footer={(day, wk, items) => {
        if (!items.length) return <BigButton label="Сегодня отдых" off />;
        const open = items.map((e, i) => [e, i] as const).filter(([, i]) => !active.logs[logKey(wk, day, i)]);
        if (!open.length) return <BigButton label="День отмечен" off />;
        // всё, что не отмечено, — «сделал по плану» (в слежении — с цифрами плана этой недели)
        return (
          <BigButton
            label="Всё сделал по плану"
            onPress={() =>
              open.forEach(([e, i]) => {
                const l = (mode === 'track' ? adjustedWeeks(e, day, i, plan, active.logs) : e.weeks)?.[wk];
                setLog(logKey(wk, day, i), { done: true, sets: l?.sets, reps: l?.reps, weight: l?.weight ?? null });
              })
            }
          />
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  lead: { fontFamily: mira.font, fontSize: 14, lineHeight: 20, color: c.muted },
  drop: { marginTop: 8, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#4A2220', alignItems: 'center', justifyContent: 'center' },
  dropText: { fontFamily: mira.fontSemi, fontSize: 14, color: c.red },
});
