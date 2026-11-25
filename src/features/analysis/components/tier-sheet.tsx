// Уровень разбора — шторка по «Новый разбор» (эксперт, 2026-11-25): быстрый / продвинутый и сколько ждать сейчас.
// Быстрый — только модель по видео, без видеокарты: в любое время, лишь бы MIRA была на связи. Продвинутый — измерения на
// видеокарте: в окне разбора 21:00–06:00 МСК, точки «где я / соперник» обязательны. Среднего нет: без SAM 3D Body слежение
// за захватом хуже (направление атак 70% против 76%), а экономия — только этот этап (research/anchors_from_pose.py).
import { ScanLine, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/fight/info-sheet';

import { getSchedule } from '../jobs';
import type { Tier } from '../types';
import { mira } from './mira';
import { MONO } from './mira-button';
import { SEA } from './mira-theme';

type Props = { visible: boolean; onClose: () => void; onPick: (t: Tier) => void };

export function TierSheet({ visible, onClose, onPick }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <TierBody onPick={onPick} />
    </Sheet>
  );
}

const inText = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.max(1, Math.round((s % 3600) / 60));
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};

function TierBody({ onPick }: { onPick: (t: Tier) => void }) {
  // состояние MIRA сейчас: окно разбора и на связи ли движок (рабочий)
  const [s, setS] = useState<{ open: boolean; online: boolean; changeInS: number } | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    getSchedule(ac.signal).then(setS).catch(() => {});
    return () => ac.abort();
  }, []);
  const offline = s ? !s.online : false;
  const wait = {
    fast: offline ? 'MIRA сейчас не на связи — начнёт, как выйдет' : '~2–4 мин',
    advanced: !s ? '…' : !s.open ? `с 21:00 МСК — через ${inText(s.changeInS)}` : offline
      ? 'MIRA сейчас не на связи — начнёт, как выйдет' : '~6–15 мин, по длине видео',
  };

  const rows: { key: Tier; name: string; text: string; wait: string; Icon: typeof Zap }[] = [
    { key: 'fast', name: 'Быстрый', Icon: Zap, wait: wait.fast,
      text: 'MIRA смотрит видео: техника, кисть, причины поражения, тактика и план тренировок.' },
    { key: 'advanced', name: 'Продвинутый', Icon: ScanLine, wait: wait.advanced,
      text: '+ измерения: кто начал, финал, угол в локте и углы против соперника. Отметишь себя и соперника точками на трёх кадрах.' },
  ];

  return (
    <View style={styles.body}>
      <Text style={styles.title}>Какой разбор?</Text>
      <Text style={styles.sub}>Любой уровень — 1 токен.</Text>
      {rows.map((r) => (
        <Pressable key={r.key} onPress={() => onPick(r.key)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <View style={styles.head}>
            <r.Icon size={16} color={SEA.pink} strokeWidth={1.9} />
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.wait}>{r.wait}</Text>
          </View>
          <Text style={styles.text}>{r.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24, gap: 10 },
  title: { fontFamily: mira.display, fontSize: 24, letterSpacing: 0.5, color: '#F4F4F5' },
  sub: { fontFamily: mira.font, fontSize: 12.5, color: mira.muted, marginTop: -6, marginBottom: 4 },
  row: { padding: 14, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: '#2A2A30', backgroundColor: '#121214' },
  rowPressed: { borderColor: SEA.sea, backgroundColor: 'rgba(103,193,215,.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: mira.fontSemi, fontSize: 15, color: '#F4F4F5' },
  wait: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.4, color: SEA.lavender, textAlign: 'right', flexShrink: 1 },
  text: { fontFamily: mira.font, fontSize: 12.5, lineHeight: 17, color: mira.muted },
});
