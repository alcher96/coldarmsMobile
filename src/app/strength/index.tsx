// «Силовые» (из профиля и с главной): упражнения сеткой (на плитке — мой уровень), мои результаты правой и левой рукой,
// нормативы (мой класс подсвечен), таблица лидеров. Рост и вес — в профиле (Настройки), пол — при регистрации; здесь
// только сводка. Параметры ?ex&arm&sex&cls — открыть сразу нужную таблицу лидеров (карточка «Новые лидеры» на главной).
// Килограммы или фунты — переключатель сверху (на сервер всегда уходят кг). С «Мастера» и выше — только по видео.
// Нет пола, роста или веса — «+» сначала открывает шторку с ними (ProfileGate), потом сам результат.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Info, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  STATUS_RU, getLeaders, getStrength, type Arm, type Leader, type MyResult, type Result, type Sex, type StrengthData,
} from '@/features/strength/api';
import { ProfileGate, bodyReady } from '@/features/strength/profile-gate';
import { ResultSheet } from '@/features/strength/result-sheet';
import { LeadersList, LevelBadge, StandardsTable, Toggle, classLabel } from '@/features/strength/ui';
import { fmtW, setUnit, useUnit } from '@/features/strength/units';
import { colors, fonts, radii, space } from '@/theme/tokens';
import { userMessage } from '@/lib/user-error';

const SEXES: { key: Sex; label: string }[] = [{ key: 'm', label: 'Мужчины' }, { key: 'f', label: 'Женщины' }];
const ARMS: { key: Arm; label: string }[] = [{ key: 'right', label: 'Правая' }, { key: 'left', label: 'Левая' }];

type Preset = { ex?: string; arm?: Arm; sex?: Sex; cls?: string };

export default function StrengthScreen() {
  const unit = useUnit();
  const preset = useLocalSearchParams<Preset>();
  const [data, setData] = useState<StrengthData | null>(null);
  const [err, setErr] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await getStrength(signal));
      setErr(undefined);
    } catch (e) {
      if (!signal?.aborted) setErr(userMessage(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      void load(ac.signal);
      return () => ac.abort();
    }, [load]),
  );

  const [exercise, setExercise] = useState(preset.ex ?? 'side_pressure');
  const [sheet, setSheet] = useState<{ arm: Arm; attach?: Result | null } | null>(null);
  // нет пола, роста или веса — сначала они (шторка), потом запись результата этой рукой
  const [gate, setGate] = useState<Arm | null>(null);

  if (!data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top', 'bottom']}>
        {err ? <Text style={styles.muted}>{err}</Text> : <ActivityIndicator color={colors.text} />}
      </SafeAreaView>
    );
  }
  const std = data.standards;
  const ex = std.exercises.find((e) => e.id === exercise) ?? std.exercises[0];
  const mine = (arm: Arm) => data.results.find((r) => r.exercise === ex.id && r.arm === arm);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} hitSlop={10}
          accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.title}>Силовые</Text>
        <View style={{ width: 110 }}>
          <Toggle options={[{ key: 'kg', label: 'кг' }, { key: 'lb', label: 'lb' }]} value={unit} onChange={setUnit} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <BodySummary data={data} />
        <ExerciseGrid data={data} value={ex.id} onChange={setExercise} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Мой результат</Text>
          {ex.about ? (
            <View style={styles.about}>
              <Info size={14} color={colors.textMuted} strokeWidth={1.8} />
              <Text style={styles.aboutText}>{ex.about}</Text>
            </View>
          ) : null}
          {ARMS.map((a) => (
            <ArmRow key={a.key} label={a.label} r={mine(a.key)} data={data}
              onAdd={() => (bodyReady(data.body) ? setSheet({ arm: a.key }) : setGate(a.key))}
              onAttach={(res) => setSheet({ arm: a.key, attach: res })} />
          ))}
        </View>

        <Tables key={ex.id} data={data} exercise={ex.id} preset={preset.ex === ex.id ? preset : {}} />
      </ScrollView>

      <ProfileGate visible={gate !== null} need="body" onClose={() => setGate(null)}
        onDone={(body) => { const arm = gate; setGate(null); setData({ ...data, body }); if (arm) setSheet({ arm }); }} />
      {sheet && bodyReady(data.body) ? (
        <ResultSheet visible onClose={() => setSheet(null)} onSaved={() => void load()} std={std} body={data.body}
          exercise={ex.id} arm={sheet.arm} attach={sheet.attach} />
      ) : null}
    </SafeAreaView>
  );
}

function ArmRow({ label, r, data, onAdd, onAttach }: {
  label: string; r?: MyResult; data: StrengthData; onAdd: () => void; onAttach: (r: Result) => void;
}) {
  const unit = useUnit();
  const std = data.standards;
  const best = r?.best;
  const latest = r?.latest;
  const newer = latest && latest.id !== best?.id && latest.status !== 'ok' ? latest : null;
  return (
    <View style={styles.armRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.armLabel}>{label} рука</Text>
        {best ? (
          <View style={styles.armVal}>
            <Text style={styles.kg}>{fmtW(best.kg, unit)}</Text>
            <LevelBadge std={std} level={best.level} />
          </View>
        ) : (
          <Text style={styles.muted}>нет результата</Text>
        )}
        {newer ? (
          <Text style={[styles.status, newer.status === 'rejected' && { color: '#FF7B72' }]}>
            {fmtW(newer.kg, unit)} · {STATUS_RU[newer.status]}
            {newer.status === 'rejected' && newer.reviewNote ? `: ${newer.reviewNote}` : ''}
          </Text>
        ) : null}
        {newer && (newer.status === 'needs_video' || newer.status === 'rejected') ? (
          <Pressable onPress={() => onAttach(newer)}>
            <Text style={styles.link}>{newer.status === 'rejected' ? 'Отправить другое видео' : 'Прикрепить видео'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onAdd} accessibilityLabel="Записать результат"
        style={({ pressed }) => [styles.plus, pressed && { opacity: 0.85 }]}>
        <Plus size={20} color="#fff" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const openSettings = () => router.push({ pathname: '/profile', params: { tab: 'settings' } });

/** Сводка: пол, рост, вес, класс — меняются в профиле. */
function BodySummary({ data }: { data: StrengthData }) {
  const unit = useUnit();
  const b = data.body;
  const ready = !!b.sex && !!b.weightKg;
  return (
    <Pressable onPress={openSettings} style={({ pressed }) => [styles.summary, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.summaryMain}>
          {ready
            ? [b.sex === 'm' ? 'Мужчина' : 'Женщина', b.heightCm ? `${b.heightCm} см` : null, fmtW(b.weightKg as number, unit)]
                .filter(Boolean).join(' · ')
            : 'Укажи рост и вес'}
        </Text>
        <Text style={styles.muted}>
          {ready && b.sex && b.classIdx !== null
            ? `Весовой класс: ${classLabel(data.standards, b.sex, b.classIdx, unit)} · изменить в профиле`
            : 'В профиле → Настройки. От пола и веса зависят класс и уровень'}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={1.8} />
    </Pressable>
  );
}

/** Упражнения сеткой: все видны сразу, на плитке — мой лучший уровень (любой рукой). */
function ExerciseGrid({ data, value, onChange }: { data: StrengthData; value: string; onChange: (id: string) => void }) {
  const std = data.standards;
  const mine = (id: string) => data.results.filter((r) => r.exercise === id && r.best).map((r) => r.best!.level);
  return (
    <View style={styles.grid}>
      {std.exercises.map((e) => {
        const on = e.id === value;
        const lv = mine(e.id);
        return (
          <Pressable key={e.id} onPress={() => onChange(e.id)} style={[styles.tile, on && styles.tileOn]}>
            <Text style={[styles.tileName, on && { color: '#fff' }]} numberOfLines={2}>{e.name}</Text>
            {lv.length ? <LevelBadge std={std} level={Math.max(...lv)} small /> : <Text style={styles.tileNone}>нет результата</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function Tables({ data, exercise, preset }: { data: StrengthData; exercise: string; preset: Preset }) {
  const unit = useUnit();
  const std = data.standards;
  const [sex, setSex] = useState<Sex>(preset.sex ?? data.body.sex ?? 'm');
  const [arm, setArm] = useState<Arm>(preset.arm ?? 'right');
  const myCls = data.body.sex === sex ? data.body.classIdx : null;
  const [cls, setCls] = useState<number>(preset.cls !== undefined ? Number(preset.cls) : (myCls ?? 0));
  const [board, setBoard] = useState<{ items: Leader[]; me: Leader | null; total: number } | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    getLeaders(exercise, arm, sex, cls, ac.signal).then(setBoard).catch(() => {});
    return () => ac.abort();
  }, [exercise, arm, sex, cls]);
  const ex = std.exercises.find((e) => e.id === exercise);
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Нормативы</Text>
        <View style={styles.toggles}>
          <View style={{ flex: 1 }}><Toggle options={SEXES} value={sex} onChange={(s) => { setSex(s); setCls(0); }} /></View>
          <View style={{ flex: 1 }}><Toggle options={ARMS} value={arm} onChange={setArm} /></View>
        </View>
        <StandardsTable std={std} exercise={exercise} sex={sex} arm={arm} mine={myCls} unit={unit} />
        <Text style={styles.muted}>
          Вес на снаряде для каждого уровня. С «Мастера» и выше засчитывается по видео.
          {ex?.estimated ? ' Нормативы этого упражнения — оценка, уточняются.' : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Лидеры · {ex?.name}</Text>
        <View style={styles.classes}>
          {std.classes[sex].map((_, i) => (
            <Pressable key={i} onPress={() => setCls(i)} style={[styles.chip, i === cls && styles.chipOn]}>
              <Text style={[styles.chipText, i === cls && styles.chipTextOn]}>
                {classLabel(std, sex, i, unit)}{i === myCls ? ' · мой' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.muted}>{sex === 'm' ? 'Мужчины' : 'Женщины'} · {arm === 'right' ? 'правая' : 'левая'} рука</Text>
        {board ? <LeadersList std={std} items={board.items} me={board.me} total={board.total} unit={unit} /> : <ActivityIndicator color={colors.text} />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, textTransform: 'uppercase', color: colors.text },
  content: { padding: space.gutter, paddingBottom: 48, gap: space.gap },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.card, padding: 16, gap: 12 },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  err: { fontFamily: fonts.body, fontSize: 13, color: '#FF6B6B' },
  classes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#141416', borderWidth: 1, borderColor: colors.cardBorder },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted },
  chipTextOn: { color: '#fff' },
  about: { flexDirection: 'row', gap: 6 },
  aboutText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  armRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  armLabel: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  armVal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kg: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  status: { fontFamily: fonts.body, fontSize: 12, color: '#F2C46A' },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radii.card,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  summaryMain: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '31%', flexGrow: 1, minHeight: 74, padding: 10, gap: 8, borderRadius: 14, justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder,
  },
  tileOn: { borderColor: colors.accent, backgroundColor: '#24120F' },
  tileName: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17, color: colors.text },
  tileNone: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  toggles: { flexDirection: 'row', gap: 8 },
});
