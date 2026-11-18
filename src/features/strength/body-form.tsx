// Профиль → Настройки → «Параметры»: рост и вес (кг или lb — как выбрано в «Силовых»), пол — указан при регистрации.
// Аккаунтам, заведённым до появления этого поля, пол можно выбрать здесь один раз. От пола и веса — весовой класс.
// «Стиль борьбы»: до трёх техник по порядку (кто борется одним стилем — оставляет одну) и «чаще атакую / защищаюсь» —
// разбор MIRA учитывает их в тактике (annotator/tactics.py, Т11–Т12).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fc } from '@/components/fight/palette';
import { Section } from '@/components/profile/overview';
import { colors, fonts, radii } from '@/theme/tokens';

import { TECHNIQUES } from '@/features/analysis/choices';

import { getStrength, saveBody, type Body, type Sex, type Standards, type Tendency } from './api';
import { Toggle, classLabel } from './ui';
import { fromKg, parseNum, toKg, useUnit } from './units';

export function BodyForm() {
  const unit = useUnit();
  const [loaded, setLoaded] = useState<{ body: Body; std: Standards } | null>(null);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    const ac = new AbortController();
    getStrength(ac.signal)
      .then((d) => setLoaded({ body: d.body, std: d.standards }))
      .catch((e) => !ac.signal.aborted && setErr(String((e as Error).message ?? e)));
    return () => ac.abort();
  }, []);
  if (!loaded) {
    return (
      <Section title="Параметры">
        {err ? <Text style={styles.err}>{err}</Text> : <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} />}
      </Section>
    );
  }
  return (
    <>
      <Form key={unit} initial={loaded.body} std={loaded.std} onSaved={(body) => setLoaded({ ...loaded, body })} />
      <StyleForm initial={loaded.body} onSaved={(body) => setLoaded({ ...loaded, body })} />
    </>
  );
}

// стили — техники борьбы (без «удар со старта», «держал оборону», «без техники», «другое»)
const STYLE_OPTIONS = TECHNIQUES.filter((t) => !['hit', 'post', 'none', 'other'].includes(t.key));

export function StyleForm({ initial, onSaved }: { initial: Body; onSaved: (b: Body) => void }) {
  const [styles_, setStyles] = useState<string[]>(initial.styles ?? []);
  const [tendency, setTendency] = useState<Tendency | null>(initial.tendency);
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');
  const dirty = styles_.join() !== (initial.styles ?? []).join() || tendency !== initial.tendency;
  const toggle = (k: string) => {
    setState('idle');
    setStyles((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length < 3 ? [...cur, k] : cur));
  };
  const save = async () => {
    setState('saving');
    try {
      const r = await saveBody({ styles: styles_, tendency: tendency ?? undefined });
      onSaved(r.body);
      setState('ok');
    } catch (e) {
      setErr(String((e as Error).message ?? e));
      setState('error');
    }
  };
  return (
    <Section title="Стиль борьбы">
      <Text style={styles.hint}>
        Выбери до трёх техник по порядку: первая — основная. Борешься одним стилем — оставь одну.
      </Text>
      <View style={styles.chips}>
        {STYLE_OPTIONS.map((t) => {
          const n = styles_.indexOf(t.key);
          const on = n >= 0;
          return (
            <Pressable key={t.key} onPress={() => toggle(t.key)} disabled={!on && styles_.length >= 3}
              style={[styles.chip, on && styles.chipOn, !on && styles_.length >= 3 && { opacity: 0.4 }]}>
              {on ? <Text style={styles.chipNum}>{n + 1}</Text> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>В схватке чаще</Text>
      <Toggle options={[{ key: 'attack', label: 'Атакую' }, { key: 'defense', label: 'Защищаюсь' }]}
        value={tendency ?? ('' as Tendency)} onChange={(v) => { setTendency(v); setState('idle'); }} />
      <Pressable onPress={save} disabled={!dirty || state === 'saving'} style={[styles.primary, !dirty && styles.disabled]}>
        {state === 'saving' ? (
          <ActivityIndicator color={colors.lightText} />
        ) : (
          <Text style={styles.primaryText}>{state === 'ok' && !dirty ? 'Сохранено' : 'Сохранить'}</Text>
        )}
      </Pressable>
      {state === 'error' ? <Text style={styles.err}>{err}</Text> : null}
    </Section>
  );
}

export function Form({ initial, std, onSaved }: { initial: Body; std: Standards; onSaved: (b: Body) => void }) {
  const unit = useUnit();
  const [sex, setSex] = useState<Sex | null>(initial.sex);
  const [h, setH] = useState(initial.heightCm ? String(initial.heightCm) : '');
  const [w, setW] = useState(initial.weightKg ? String(fromKg(initial.weightKg, unit)) : '');
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');
  const hv = parseNum(h);
  const wKg = parseNum(w) ? toKg(parseNum(w) as number, unit) : null;
  const dirty = sex !== initial.sex || (hv ?? null) !== (initial.heightCm ?? null) || (wKg ?? null) !== (initial.weightKg ?? null);
  const save = async () => {
    setState('saving');
    try {
      const r = await saveBody({ sex: sex ?? undefined, heightCm: hv ?? undefined, weightKg: wKg ?? undefined });
      onSaved(r.body);
      setState('ok');
    } catch (e) {
      setErr(String((e as Error).message ?? e));
      setState('error');
    }
  };
  const edit = (f: (v: string) => void) => (v: string) => {
    f(v);
    setState('idle');
  };
  return (
    <Section title="Параметры">
      <Text style={styles.label}>Пол</Text>
      {initial.sex ? (
        <Text style={styles.value}>{initial.sex === 'm' ? 'Мужской' : 'Женский'} · указан при регистрации</Text>
      ) : (
        <Toggle options={[{ key: 'm', label: 'Мужской' }, { key: 'f', label: 'Женский' }]} value={sex ?? ('' as Sex)}
          onChange={(v) => { setSex(v); setState('idle'); }} />
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Рост, см</Text>
          <TextInput style={styles.input} value={h} onChangeText={edit(setH)} keyboardType="decimal-pad" maxLength={5} placeholder="—"
            placeholderTextColor={fc.dim} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Вес, {unit === 'lb' ? 'lb' : 'кг'}</Text>
          <TextInput style={styles.input} value={w} onChangeText={edit(setW)} keyboardType="decimal-pad" maxLength={5} placeholder="—"
            placeholderTextColor={fc.dim} />
        </View>
      </View>
      {initial.sex && initial.classIdx !== null ? (
        <Text style={styles.hint}>Весовой класс: {classLabel(std, initial.sex, initial.classIdx, unit)} — для нормативов и таблиц лидеров</Text>
      ) : (
        <Text style={styles.hint}>От пола и веса зависят весовой класс, уровни и таблицы лидеров в «Силовых».</Text>
      )}
      <Pressable onPress={save} disabled={!dirty || state === 'saving'} style={[styles.primary, !dirty && styles.disabled]}>
        {state === 'saving' ? (
          <ActivityIndicator color={colors.lightText} />
        ) : (
          <Text style={styles.primaryText}>{state === 'ok' && !dirty ? 'Сохранено' : 'Сохранить'}</Text>
        )}
      </Pressable>
      {state === 'error' ? <Text style={styles.err}>{err}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted, marginTop: 12, marginBottom: 6 },
  value: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  input: {
    minHeight: 46, borderRadius: radii.control, borderWidth: 1, borderColor: fc.borderStrong, backgroundColor: colors.bg,
    color: colors.text, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 15,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: fc.muted, marginTop: 10 },
  primary: { marginTop: 14, height: 48, borderRadius: radii.control, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.lightText },
  err: { fontFamily: fonts.body, fontSize: 13, color: '#FF6B6B', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: fc.borderStrong,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipNum: {
    width: 18, height: 18, borderRadius: 9, textAlign: 'center', lineHeight: 18, overflow: 'hidden',
    backgroundColor: '#fff', color: colors.accent, fontFamily: fonts.bodySemi, fontSize: 11,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  chipTextOn: { color: '#fff' },
});
