import { Check, Minus, Plus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mira } from '@/features/analysis/components/mira';

import { c, DayStrip, exGear, exName, PlanShell, s, Sheet, SheetText, Tag, WeekCard, weekLabel } from './layout';
import { adjustedWeeks, currentWeek, logKey, type ActivePlan, type Log } from './track';
import { DAYS, DAY_RU, exerciseLine, exerciseNumbers, loadNumbers, type Exercise, type Plan, type WeekLoad } from './types';

type SheetState = { title: string; body: ReactNode } | null;

const RULES = [
  'Прогрессия: веса посчитаны от твоих рабочих (вес × повторы). Все подходы прошли чисто, с запасом — бери вес плана; не добил повторы — повтори вес прошлой недели. Нужного веса нет — ближайший, и подгони повторами.',
  'Каждую неделю: «Эта неделя рабочая или разгрузочная? Смотри по самочувствию». Разгрузочная — на 40% меньше подходов.',
  'Болит — те же упражнения с весом около 10–15% от рабочего в больших повторах, для кровотока. Острая боль — не тренировать.',
  'В конце плана — контрольный спарринг на видео и новый разбор: посмотрим, что изменилось.',
];

/**
 * План в раскладке 1a: слабые звенья, неделя цикла, лента дней, упражнения выбранного дня.
 * Без track — просмотр результата коррекции (вес 1-й недели правится кнопками); с track — отметки «сделал / не сделал»,
 * в режиме слежения ещё и фактические цифры, а веса следующих недель считаются от сделанного.
 */
export function PlanView({
  plan,
  right,
  footer,
  track,
  onStartWeight,
  extraSheet,
  onCloseExtra,
}: {
  plan: Plan;
  right?: ReactNode;
  footer: (day: string, wk: number, items: Exercise[]) => ReactNode;
  track?: { active: ActivePlan; setLog: (key: string, log: Log | null) => void };
  onStartWeight?: (key: string, kg: number) => void;
  extraSheet?: SheetState; // панель, открытая снаружи (например, настройки)
  onCloseExtra?: () => void;
}) {
  const trainDays = DAYS.filter((d) => (plan.days[d] ?? []).length);
  const [wk, setWk] = useState(() => (track ? currentWeek(track.active) : 0));
  const [day, setDay] = useState<string>(() => {
    if (track) {
      const open = trainDays.find((d) => (plan.days[d] ?? []).some((_, i) => !track.active.logs[logKey(wk, d, i)]));
      if (open) return open;
    }
    return trainDays[0] ?? DAYS[0];
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const shown = sheet ?? extraSheet ?? null;
  const logs = track?.active.logs ?? {};
  const tracking = track?.active.mode === 'track';

  const changed = new Map<string, { kind: 'added' | 'replaced'; old?: Exercise }>();
  for (const ch of plan.changes) {
    if (ch.kind === 'added') changed.set(`${ch.day}|${exerciseLine(ch.new)}`, { kind: 'added' });
    if (ch.kind === 'replaced') changed.set(`${ch.day}|${exerciseLine(ch.new)}`, { kind: 'replaced', old: ch.old });
  }
  const items = plan.days[day] ?? [];
  const cur = plan.weeks[wk];
  const loads = (e: Exercise, d: string, i: number) => (tracking ? adjustedWeeks(e, d, i, plan, logs) : e.weeks);
  const dayDone = (d: string, w = wk) => (plan.days[d] ?? []).every((_, i) => logs[logKey(w, d, i)]?.done);
  const weekDone = (w: number) => trainDays.every((d) => dayDone(d, w));
  const doneCount = items.filter((_, i) => logs[logKey(wk, day, i)]?.done).length;

  const weekSheet = () =>
    setSheet({
      title: `Неделя ${cur.week} · ${weekLabel(cur)}`,
      body: (
        <>
          <SheetText>
            Упражнения слабых звеньев: {cur.dose.sets} × {cur.dose.reps}.
          </SheetText>
          {cur.static ? <SheetText>{cur.static}</SheetText> : null}
          {cur.start_work ? <SheetText>+ спарринги со стартом, срывы.</SheetText> : null}
          {RULES.map((r) => (
            <SheetText key={r} dim>
              {r}
            </SheetText>
          ))}
        </>
      ),
    });
  const weakSheet = () =>
    setSheet({
      title: 'Слабые звенья',
      body: (
        <>
          <SheetText>Красная точка у упражнения — оно на слабое звено из разбора: в нём акцент (+1 подход) или оно добавлено планом.</SheetText>
          {plan.changes.map((ch, i) =>
            ch.kind === 'covered' ? (
              <SheetText key={i}>«{ch.link}» у тебя уже есть — новых упражнений не добавляю, акцент через дозировку по неделям.</SheetText>
            ) : ch.kind === 'no_gear' ? (
              <SheetText key={i}>
                На «{ch.link}» нечего поставить из твоего инвентаря. Нужно что-то одно: {ch.need.join(', или ')}. Появится — пересобери план.
              </SheetText>
            ) : null,
          )}
          <SheetText dim>
            Статика — {plan.static_type.label}
            {plan.static_type.forced ? ' (проигрыш в касание)' : ''}. План на {plan.weeks.length} нед.
          </SheetText>
        </>
      ),
    });
  const exSheet = (e: Exercise, l: WeekLoad | null, ch?: { kind: string; old?: Exercise }) =>
    setSheet({
      title: exName(e),
      body: (
        <>
          <SheetText>{[exGear(e), e.mode !== 'динамика' ? e.mode : null].filter(Boolean).join(' · ')}</SheetText>
          {ch?.kind === 'added' ? <SheetText dim>Добавлено планом · {e.link}</SheetText> : null}
          {ch?.old ? <SheetText dim>Заменено: было «{exerciseLine(ch.old)}» · {e.link}</SheetText> : null}
          {e.instead ? <SheetText dim>Вместо «{e.instead.equipment} · {e.instead.handle}» — для него нет инвентаря.</SheetText> : null}
          {e.note ? <SheetText dim>{e.note}</SheetText> : null}
          {l?.hint ? <SheetText dim>{l.hint}</SheetText> : null}
          {e.advice ? <SheetText>{e.caution ? '⚠ Осторожно с весом. ' : ''}{e.advice}</SheetText> : null}
        </>
      ),
    });
  const tableSheet = () =>
    setSheet({
      title: 'За столом · раз в неделю',
      body: (
        <>
          <SheetText dim>15–20 минут, с партнёром.</SheetText>
          {plan.table_work.map((t) => (
            <SheetText key={t}>— {t.replace(/^за столом: /, '')}</SheetText>
          ))}
        </>
      ),
    });

  const top = (
    <>
      <View style={st.weakHead}>
        <Text style={st.eyebrow}>Слабые звенья</Text>
        <Pressable style={st.info} onPress={weakSheet} accessibilityLabel="Про слабые звенья">
          <Text style={st.infoText}>i</Text>
        </Pressable>
      </View>
      <View style={st.chips}>
        {plan.links.map((l) => (
          <Text key={l.name} style={st.weakChip}>
            {l.name}
          </Text>
        ))}
      </View>
      <WeekCard weeks={plan.weeks} wk={wk} onPick={setWk} onInfo={weekSheet} marks={track ? weekDone : undefined} />
      <DayStrip
        day={day}
        onPick={setDay}
        dot={(d) => ((plan.days[d] ?? []).length ? (track && dayDone(d) ? c.done : c.red) : null)}
      />
    </>
  );

  return (
    <PlanShell
      right={right}
      top={top}
      footer={footer(day, wk, items)}
      sheet={shown ? <Sheet
            title={shown.title}
            onClose={() => {
              setSheet(null);
              onCloseExtra?.();
            }}>{shown.body}</Sheet> : null}>
      <View style={s.dayHead}>
        <Text style={s.dayName}>{DAY_RU[day]}</Text>
        <Text style={s.dayMeta}>
          {!items.length ? '' : track ? `сделано ${doneCount} из ${items.length}` : `${items.length} упр.`}
        </Text>
      </View>
      {!items.length ? (
        <View style={s.rest}>
          <Text style={s.restText}>День отдыха</Text>
        </View>
      ) : null}
      <View style={{ marginTop: 6 }}>
        {items.map((e, i) => {
          const l = loads(e, day, i)?.[wk] ?? null;
          const ch = changed.get(`${day}|${exerciseLine(e)}`);
          const prev = wk > 0 ? loads(e, day, i)?.[wk - 1]?.weight : e.weight;
          const delta = l?.weight && prev ? Math.round((l.weight - prev) * 2) / 2 : 0;
          const weak = !!e.link || !!(e.weeks && e.sets && e.weeks[0].sets > e.sets);
          const key = logKey(wk, day, i);
          return (
            <Row
              key={i}
              e={e}
              l={l}
              weak={weak}
              was={!l ? 'как обычно' : wk === 0 && exerciseNumbers(e) ? `сейчас ${exerciseNumbers(e)}` : ''}
              tags={
                <>
                  {ch ? <Tag label={ch.kind === 'added' ? 'новое' : 'замена'} tone={ch.kind === 'added' ? 'add' : 'rep'} /> : null}
                  {e.advice ? (
                    <Tag label={e.caution ? '⚠ Техника' : 'Совет'} tone={e.caution ? 'warn' : 'plain'} onPress={() => exSheet(e, l, ch)} />
                  ) : null}
                  {l?.mode === 'статика' ? <Tag label="статика" tone="static" /> : null}
                  {delta ? <Tag label={`${delta > 0 ? '+' : '−'}${Math.abs(delta)} кг`} /> : null}
                </>
              }
              onPress={() => exSheet(e, l, ch)}
              start={!track && onStartWeight && !e.weight && e.key && e.equipment !== 'свой вес' && e.weeks ? (kg) => onStartWeight(e.key!, kg) : undefined}
              mark={track ? { log: logs[key], tracking, set: (v) => track.setLog(key, v) } : undefined}
            />
          );
        })}
      </View>
      {items.length && plan.table_work.length ? (
        <Pressable style={st.table} onPress={tableSheet}>
          <Text style={st.tableText}>За столом · раз в неделю</Text>
          <Text style={st.tableMeta}>{plan.table_work.length} ›</Text>
        </Pressable>
      ) : null}
    </PlanShell>
  );
}

function Row({
  e,
  l,
  weak,
  was,
  tags,
  onPress,
  start,
  mark,
}: {
  e: Exercise;
  l: WeekLoad | null;
  weak: boolean;
  was: string;
  tags: ReactNode;
  onPress: () => void;
  start?: (kg: number) => void;
  mark?: { log?: Log; tracking: boolean; set: (v: Log | null) => void };
}) {
  const nums = l ? loadNumbers(l) : exerciseNumbers(e);
  const done = mark?.log?.done === true;
  const skipped = mark?.log?.done === false;
  const toggle = (v: boolean) =>
    mark!.set(mark!.log?.done === v ? null : v ? { done: true, sets: l?.sets, reps: l?.reps, weight: l?.weight ?? null } : { done: false });
  const w1 = e.weeks?.[0]?.weight;
  return (
    <View style={s.row}>
      <Pressable onPress={onPress}>
        <View style={s.rowTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
            {weak ? <View style={s.weakDot} /> : null}
            <Text style={[s.rowName, skipped && { color: c.muted }]}>{exName(e)}</Text>
          </View>
          <Text style={[s.rowNums, skipped && { color: c.muted }]}>{nums}</Text>
        </View>
        <View style={s.rowSub}>
          <Text style={s.rowGear} numberOfLines={1}>
            {exGear(e)}
          </Text>
          {was ? <Text style={s.rowWas}>{was}</Text> : null}
        </View>
      </Pressable>
      <View style={[s.tags, { alignItems: 'center' }]}>
        {tags}
        {mark ? (
          <View style={st.marks}>
            <Pressable onPress={() => toggle(true)} style={[st.mark, done && st.markDone]} accessibilityLabel="Сделал" accessibilityState={{ selected: done }}>
              <Check size={16} color={done ? c.bg : c.text} />
            </Pressable>
            <Pressable onPress={() => toggle(false)} style={[st.mark, skipped && st.markSkip]} accessibilityLabel="Не сделал" accessibilityState={{ selected: skipped }}>
              <X size={16} color={c.text} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {start ? (
        <Stepper
          label="мой вес на 1-й неделе, кг"
          value={w1 ?? null}
          step={(w1 ?? 10) < 10 ? 0.5 : 1}
          onChange={start}
        />
      ) : null}
      {mark?.tracking && done && l ? (
        <View style={{ gap: 4, marginTop: 8 }}>
          <Text style={s.rowWas}>Сделал фактически:</Text>
          <Stepper label="подходы" value={mark.log!.sets ?? l.sets} step={1} onChange={(v) => mark.set({ ...mark.log!, sets: v })} />
          <Stepper label={l.mode === 'статика' ? 'секунды' : 'повторы'} value={mark.log!.reps ?? l.reps} step={1} onChange={(v) => mark.set({ ...mark.log!, reps: v })} />
          {e.equipment !== 'свой вес' ? (
            <Stepper
              label="вес, кг"
              value={mark.log!.weight ?? l.weight ?? null}
              step={(mark.log!.weight ?? l.weight ?? 10) < 10 ? 0.5 : 1}
              onChange={(v) => mark.set({ ...mark.log!, weight: v })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Stepper({ label, value, step, onChange }: { label: string; value: number | null; step: number; onChange: (v: number) => void }) {
  const set = (d: number) => onChange(Math.max(step, Math.round(((value ?? 10) + d * step) / step) * step));
  return (
    <View style={st.stepRow}>
      <Text style={[s.rowGear, { flex: 1 }]}>
        {label}: <Text style={{ color: c.text, fontFamily: mira.fontSemi }}>{value ?? '—'}</Text>
      </Text>
      <Pressable style={s.stepBtn} onPress={() => set(-1)} accessibilityLabel={`Меньше: ${label}`}>
        <Minus size={14} color={c.text} />
      </Pressable>
      <Pressable style={s.stepBtn} onPress={() => set(1)} accessibilityLabel={`Больше: ${label}`}>
        <Plus size={14} color={c.text} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  weakHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: mira.fontSemi, fontSize: 11, letterSpacing: 1.1, color: c.muted, textTransform: 'uppercase' },
  info: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#2E2E33', alignItems: 'center', justifyContent: 'center' },
  infoText: { fontFamily: mira.fontBold, fontSize: 12, color: c.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  weakChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4A2220',
    backgroundColor: '#160E0E',
    overflow: 'hidden',
    fontFamily: mira.font,
    fontSize: 12,
    color: '#F2C4C0',
  },
  marks: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  mark: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: c.done, borderColor: c.done },
  markSkip: { backgroundColor: c.off, borderColor: c.off },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  table: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: c.card },
  tableText: { fontFamily: mira.fontSemi, fontSize: 14, color: c.text },
  tableMeta: { fontFamily: mira.font, fontSize: 13, color: c.muted },
});
