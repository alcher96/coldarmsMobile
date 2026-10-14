import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { suggestCorrection, type AthletePage } from '@/api/athlete';
import { FightRow } from '@/components/athlete/fights';
import { ageOf } from '@/api/fight';
import { Sheet } from '@/components/fight/info-sheet';
import { feet, inches, lb } from '@/components/fight/model';
import { fc } from '@/components/fight/palette';
import { RadarChart } from '@/components/radar-chart';
import { plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

const GOLD = '#E8B931';

export function AthleteOverview({ page }: { page: AthletePage }) {
  const { athlete: a, stats, styles: usage } = page;
  const [correction, setCorrection] = useState(false);
  const age = ageOf(a.birthDate);

  const phys: [string, string, string?][] = [
    ['Вес', a.weight ? `${a.weight} кг` : '—', a.weight ? `${lb(a.weight)} lb` : undefined],
    ['Рост', a.height ? `${a.height} см` : '—', a.height ? feet(a.height) : undefined],
    ['Возраст', age ? `${age}` : '—', age ? plural(age, ['год', 'года', 'лет']) : undefined],
    ['Бицепс', a.bicep ? `${a.bicep} см` : '—', a.bicep ? inches(a.bicep) : undefined],
    ['Предплечье', a.forearm ? `${a.forearm} см` : '—', a.forearm ? inches(a.forearm) : undefined],
    ['Запястье', a.wristSize ? `${a.wristSize} см` : '—', a.wristSize ? inches(a.wristSize) : undefined],
  ];
  const perf: [string, number | null][] = [
    ['Боковое давление', a.sidePressure],
    ['Запястье', a.wrist],
    ['Угол', a.angle],
    ['Выносливость', a.stamina],
    ['Пронация', a.pronaton],
  ];
  const rs = stats?.roundStats;
  const grips: [string, number][] = rs
    ? [
        ['Свободный захват', rs.freeGrip],
        ['Судейский захват', rs.refereeGrip],
        ['Свободный + ремень', rs.freeGripAndStrap],
        ['Судейский + ремень', rs.refereeGripAndStrap],
      ]
    : [];
  const gripTotal = Math.max(1, grips.reduce((s, [, n]) => s + (n ?? 0), 0));
  const styleMax = Math.max(1, ...usage.map((s) => s.usageCount));
  // Флешпины обеих рук одним списком, новые сверху.
  const flashes = [
    ...(stats?.rightFlashPinsDetails ?? []).map((f) => ({ ...f, hand: 'R' })),
    ...(stats?.leftFlashPinsDetails ?? []).map((f) => ({ ...f, hand: 'L' })),
  ].sort((x, y) => y.competitionDate.localeCompare(x.competitionDate));

  return (
    <View style={styles.list}>
      <View style={styles.card}>
        <Text style={styles.title}>Физические данные</Text>
        <View style={styles.grid}>
          {phys.map(([label, value, sub]) => (
            <View key={label} style={styles.tile}>
              <Text style={styles.tileValue}>{value}</Text>
              <Text style={styles.tileLabel}>{sub ? `${sub} · ${label.toLowerCase()}` : label.toLowerCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {perf.some(([, v]) => v != null) ? (
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Профиль силы</Text>
            <Text style={styles.meta}>из 10</Text>
          </View>
          <View style={styles.radar}>
            <RadarChart
              labels={['Боковое', 'Запястье', 'Угол', 'Выносл.', 'Пронация']}
              series={[{ values: perf.map(([, v]) => v ?? 0), color: GOLD }]}
              max={10}
              size={320}
            />
          </View>
          {perf.map(([label, v]) => (
            <View key={label} style={styles.perf}>
              <Text style={styles.perfLabel}>{label}</Text>
              <View style={styles.perfTrack}>
                <View style={[styles.perfFill, { width: `${(v ?? 0) * 10}%` }]} />
              </View>
              <Text style={styles.perfValue}>{v ?? '—'}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {stats ? (
        <View style={styles.card}>
          <Text style={styles.title}>Дополнительная статистика</Text>
          <View style={styles.grid}>
            <Kpi label="Всего фолов" value={stats.totalFouls} />
            <Kpi label="Побед по фолам" value={stats.winsByFouls} />
            <Kpi label="Флешпины правой" value={stats.rightFlashPins} />
            <Kpi label="Флешпины левой" value={stats.leftFlashPins} />
          </View>
          {flashes.length ? (
            <>
              <Text style={[styles.sub, styles.subTop]}>Флешпины · где и в каком раунде</Text>
              {flashes.map((f) => (
                <FightRow key={`${f.fightId}-${f.roundNumber}-${f.hand}`} f={f} badge={`R${f.roundNumber}`} />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {rs ? (
        <View style={styles.card}>
          <Text style={styles.title}>Статистика раундов</Text>
          <View style={styles.grid}>
            <Kpi label="Всего боёв" value={rs.totalFights} />
            <Kpi label="Всего раундов" value={rs.totalRounds} />
            <Kpi label="Матчей в раундах" value={rs.totalMatchesInRounds} />
            <Kpi label="Матчей на раунд" value={rs.averageMatchesPerRound ? Math.round(rs.averageMatchesPerRound * 10) / 10 : null} />
          </View>
          <Text style={[styles.sub, styles.subTop]}>Захваты · доля раундов</Text>
          {grips.map(([name, n]) => (
            <View key={name} style={styles.grip}>
              <View style={styles.gripHead}>
                <Text style={styles.gripName}>{name}</Text>
                <Text style={styles.gripValue}>
                  {n ?? 0} <Text style={styles.gripPct}>· {Math.round(((n ?? 0) / gripTotal) * 100)}%</Text>
                </Text>
              </View>
              <View style={styles.gripTrack}>
                <View style={[styles.gripFill, { width: `${((n ?? 0) / gripTotal) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {usage.length ? (
        <View style={styles.card}>
          <Text style={styles.title}>Использование стилей</Text>
          {usage.map((s) => (
            <View key={s.styleName} style={styles.style}>
              <View style={styles.gripHead}>
                <Text style={styles.gripName}>{s.styleName}</Text>
                <Text style={styles.gripValue}>
                  {s.usageCount} <Text style={styles.gripPct}>{plural(s.usageCount, ['раунд', 'раунда', 'раундов'])}</Text>
                </Text>
              </View>
              <View style={styles.gripTrack}>
                <View style={[styles.styleFill, { width: `${(s.usageCount / styleMax) * 100}%` }]} />
              </View>
              <Text style={styles.styleHands}>
                Правая: {s.rightHandCount} · Левая: {s.leftHandCount}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>Данные в процессе калибровки</Text>
        <Text style={styles.note}>Видите грубую ошибку в статистике атлета? Сообщите — данные калибруются.</Text>
        <Pressable onPress={() => setCorrection(true)} style={styles.outline}>
          <Text style={styles.outlineText}>Предложить правку</Text>
        </Pressable>
      </View>

      <CorrectionSheet id={a.armWrestlerId} visible={correction} onClose={() => setCorrection(false)} />
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value ?? '—'}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function CorrectionSheet({ id, visible, onClose }: { id: string; visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const send = async () => {
    if (!text.trim()) return;
    setState('sending');
    try {
      const res = await suggestCorrection(id, text.trim());
      setState(res.ok ? 'ok' : 'error');
      if (res.ok) setText('');
    } catch {
      setState('error');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setState('idle');
        onClose();
      }}>
      <Text style={styles.sheetTitle}>Предложить правку</Text>
      <Text style={styles.note}>Опишите, что не так: вес, рост, результат боя — модераторы проверят.</Text>
      <TextInput
        style={styles.textarea}
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (state !== 'sending') setState('idle');
        }}
        placeholder="Например: вес на EvW 26 был 172 кг"
        placeholderTextColor={fc.dim}
        multiline
        maxLength={1000}
      />
      <Text style={styles.counter}>{text.length}/1000</Text>
      {state === 'ok' ? <Text style={styles.ok}>Спасибо! Правка отправлена модераторам.</Text> : null}
      {state === 'error' ? <Text style={styles.err}>Не удалось отправить. Попробуйте ещё раз.</Text> : null}
      <Pressable
        onPress={send}
        disabled={!text.trim() || state === 'sending'}
        style={[styles.primary, !text.trim() && styles.disabled]}>
        {state === 'sending' ? <ActivityIndicator color={colors.text} /> : <Text style={styles.primaryText}>Отправить</Text>}
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  card: { backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  sub: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: fc.muted },
  subTop: { marginTop: 16, marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tile: { width: '48.8%', flexGrow: 1, backgroundColor: fc.chip, borderRadius: radii.control, padding: 12 },
  tileValue: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  tileLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted, marginTop: 3 },
  radar: { alignItems: 'center', marginTop: 4 },
  perf: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  perfLabel: { width: 128, fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  perfTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: fc.track, overflow: 'hidden' },
  perfFill: { height: '100%', borderRadius: 3, backgroundColor: GOLD },
  perfValue: { width: 24, textAlign: 'right', fontFamily: fonts.display, fontSize: 16, color: colors.text },
  grip: { marginTop: 12 },
  gripHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gripName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  gripValue: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  gripPct: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  gripTrack: { height: 5, borderRadius: 3, backgroundColor: fc.track, overflow: 'hidden', marginTop: 6 },
  gripFill: { height: '100%', borderRadius: 3, backgroundColor: colors.text },
  style: { marginTop: 12 },
  styleFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  styleHands: { fontFamily: fonts.body, fontSize: 11, color: fc.dim, marginTop: 4 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.second, marginTop: 6 },
  outline: {
    marginTop: 12,
    height: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, textTransform: 'uppercase', color: colors.text },
  textarea: {
    marginTop: 12,
    minHeight: 110,
    maxHeight: 200,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: colors.bg,
    color: colors.text,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 11, color: fc.dim, marginTop: 4 },
  ok: { fontFamily: fonts.bodyMedium, fontSize: 13, color: '#5FD99A', marginTop: 8 },
  err: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.coral, marginTop: 8 },
  primary: {
    marginTop: 12,
    height: 48,
    borderRadius: radii.control,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
});
