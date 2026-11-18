// Записать результат: вес (кг или lb), уровень — подсказкой сразу; «Мастер» и выше — нужно видео подъёма,
// оно уходит на проверку админу. Режим attach — дослать видео к уже записанному результату.
import * as ImagePicker from 'expo-image-picker';
import { Check, Film } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/fight/info-sheet';
import { colors, fonts } from '@/theme/tokens';

import { levelOf, submitResult, uploadProof, type Arm, type Body, type Result, type Standards } from './api';
import { LevelBadge } from './ui';
import { fmtW, parseNum, toKg, useUnit } from './units';
import { userMessage } from '@/lib/user-error';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  std: Standards;
  body: Body;
  exercise: string;
  arm: Arm;
  /** дослать видео к этому результату (нужно видео / отклонено) */
  attach?: Result | null;
};

export function ResultSheet({ visible, onClose, ...rest }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetBody onClose={onClose} {...rest} />
    </Sheet>
  );
}

function SheetBody({ onClose, onSaved, std, body, exercise, arm, attach }: Omit<Props, 'visible'>) {
  const unit = useUnit();
  const [text, setText] = useState('');
  const [video, setVideo] = useState<{ uri: string; size: number; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState<string | null>(null);
  const ex = std.exercises.find((e) => e.id === exercise);
  const value = parseNum(text);
  const kg = attach ? attach.kg : value ? toKg(value, unit) : null;
  const cls = attach ? attach.classIdx : body.classIdx;
  const sex = attach ? attach.sex : body.sex;
  const level = kg && sex && cls !== null ? levelOf(std, exercise, sex, arm, cls, kg) : null;
  const proof = level !== null && level >= 0 && std.levels[level].proof;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    const a = res.canceled ? null : res.assets[0];
    if (a) setVideo({ uri: a.uri, size: a.fileSize ?? 0, name: a.fileName ?? undefined });
  };

  const save = async () => {
    if (busy || !kg) return;
    if (proof && (!video || !video.size)) {
      setErr('Для этого уровня прикрепи видео подъёма.');
      return;
    }
    setBusy(true);
    setErr(undefined);
    try {
      const r = attach ?? (await submitResult(exercise, arm, kg));
      if ((r.status === 'needs_video' || r.status === 'rejected') && video) {
        setProgress(0);
        await uploadProof(r.id, video, setProgress);
        setDone('Видео отправлено на проверку. Уровень засчитаем после одобрения.');
      } else {
        setDone('Результат записан.');
      }
      onSaved();
      setTimeout(onClose, 1300);
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <View style={styles.body}>
      <Text style={styles.title}>{ex?.name ?? exercise}</Text>
      <Text style={styles.sub}>{arm === 'right' ? 'Правая' : 'Левая'} рука{attach ? ` · ${fmtW(attach.kg, unit)}` : ''}</Text>

      {!attach ? (
        <View style={styles.inputRow}>
          <TextInput value={text} onChangeText={setText} keyboardType="decimal-pad" placeholder="0" autoFocus
            placeholderTextColor="#55555B" style={styles.input} maxLength={6} editable={!busy && !done} />
          <Text style={styles.unit}>{unit === 'lb' ? 'lb' : 'кг'}</Text>
        </View>
      ) : null}
      {level !== null ? (
        <View style={styles.levelRow}>
          <Text style={styles.sub}>Уровень:</Text>
          <LevelBadge std={std} level={level} />
        </View>
      ) : null}

      {proof ? (
        <View style={styles.proof}>
          <Text style={styles.proofText}>
            Уровень «{std.levels[level as number].name}» засчитывается только по видео: подъём целиком, вес на снаряде
            видно, одно повторение. Видео проверит администратор.
          </Text>
          <Pressable onPress={pick} disabled={busy || !!done} style={styles.pick}>
            <Film size={18} color={colors.text} strokeWidth={1.8} />
            <Text style={styles.pickText} numberOfLines={1}>
              {video ? `${video.name ?? 'Видео'} · ${(video.size / 1024 / 1024).toFixed(1)} МБ` : 'Выбрать видео'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {done ? (
        <View style={[styles.cta, styles.ok]}>
          <Check size={18} color={colors.text} strokeWidth={2.4} />
          <Text style={[styles.ctaText, { color: colors.text, fontSize: 13 }]} numberOfLines={2}>{done}</Text>
        </View>
      ) : (
        <Pressable onPress={save} disabled={busy || !kg}
          style={[styles.cta, { backgroundColor: kg ? colors.accent : '#2A2A2E' }]}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color="#fff" />
              {progress !== null ? <Text style={styles.ctaText}>{Math.round(progress * 100)}%</Text> : null}
            </View>
          ) : (
            <Text style={styles.ctaText}>{proof ? 'Отправить на проверку' : 'Записать'}</Text>
          )}
        </Pressable>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  input: {
    flex: 1, fontFamily: fonts.display, fontSize: 44, color: colors.text, paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  unit: { fontFamily: fonts.bodySemi, fontSize: 18, color: colors.textMuted },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proof: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#1C1710', borderWidth: 1, borderColor: '#4A3A1A' },
  proofText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#E9D9B5' },
  pick: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#141416', borderWidth: 1, borderColor: colors.cardBorder,
  },
  pickText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  cta: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  ok: { backgroundColor: '#1B2A22', borderWidth: 1, borderColor: '#2F5A43' },
  ctaText: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: '#fff' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  err: { fontFamily: fonts.body, fontSize: 13, color: '#FF6B6B' },
});
