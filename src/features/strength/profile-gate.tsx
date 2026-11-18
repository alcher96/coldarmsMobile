// «Сначала заполни»: перед первым результатом — пол, рост и вес (от них класс и уровень); перед разбором — стиль борьбы
// (до трёх техник) и «чаще атакую / защищаюсь» (MIRA учитывает их в тактике). Шторка с теми же формами, что в профиле;
// заполнил и сохранил — onDone, и спортсмен сразу продолжает то, что начал.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Sheet, SheetScrollView } from '@/components/fight/info-sheet';
import { colors, fonts } from '@/theme/tokens';

import { getStrength, type Body, type Standards } from './api';
import { Form, StyleForm } from './body-form';

export const bodyReady = (b: Body) => !!b.sex && !!b.heightCm && !!b.weightKg;
export const styleReady = (b: Body) => (b.styles?.length ?? 0) > 0 && !!b.tendency;

type Props = { visible: boolean; need: 'body' | 'style'; onClose: () => void; onDone: (b: Body) => void };

export function ProfileGate({ visible, onClose, ...rest }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} tall>
      <GateBody {...rest} />
    </Sheet>
  );
}

function GateBody({ need, onDone }: Omit<Props, 'visible' | 'onClose'>) {
  const [d, setD] = useState<{ body: Body; std: Standards } | null>(null);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    const ac = new AbortController();
    getStrength(ac.signal)
      .then((x) => setD({ body: x.body, std: x.standards }))
      .catch((e) => !ac.signal.aborted && setErr(String((e as Error).message ?? e)));
    return () => ac.abort();
  }, []);
  const saved = (body: Body) => {
    if (!d) return;
    setD({ ...d, body });
    if (need === 'body' ? bodyReady(body) : styleReady(body)) onDone(body);
  };
  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{need === 'body' ? 'Сначала — о тебе' : 'Сначала — твой стиль'}</Text>
      <Text style={styles.sub}>
        {need === 'body'
          ? 'Пол, рост и вес нужны, чтобы определить весовой класс и уровень. Это один раз — потом меняется в профиле.'
          : 'MIRA учитывает твой стиль в разборе: что навязывать сопернику, во что переключаться. Это один раз — потом меняется в профиле.'}
      </Text>
      {!d ? (
        err ? <Text style={styles.err}>{err}</Text> : <ActivityIndicator color={colors.text} style={{ marginTop: 16 }} />
      ) : need === 'body' ? (
        <Form initial={d.body} std={d.std} onSaved={saved} />
      ) : (
        <StyleForm initial={d.body} onSaved={saved} />
      )}
      {d && (need === 'body' ? !bodyReady(d.body) : !styleReady(d.body)) ? (
        <Text style={styles.hint}>
          {need === 'body' ? 'Заполни все три поля и сохрани.' : 'Выбери хотя бы одну технику и манеру, затем сохрани.'}
        </Text>
      ) : null}
      <View style={{ height: 8 }} />
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10, paddingBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  err: { fontFamily: fonts.body, fontSize: 13, color: '#FF6B6B' },
});
