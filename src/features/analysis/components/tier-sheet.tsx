// Уровень разбора — модалка по «Новый разбор» (эксперт, 2026-11-25), как оценка видео: размытый фон, крупные кнопки.
// Быстрый — только модель по видео, без видеокарты: в любое время, лишь бы MIRA была на связи. Продвинутый — измерения на
// видеокарте: в окне разбора 21:00–06:00 МСК, точки «где я / соперник» обязательны. Среднего нет: без SAM 3D Body слежение
// за захватом хуже (направление атак 70% против 76%), а экономия — только этот этап (research/anchors_from_pose.py).
// Фон — та же готовая размытая картинка, что у оценки видео (снимок экрана на Android давал фриз — quality-modal.tsx).
import { ScanLine, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getSchedule } from '../jobs';
import type { Tier } from '../types';
import { mira } from './mira';
import { MONO } from './mira-button';
import { SEA } from './mira-theme';

const BG = require('../../../../assets/mira/modal-bg.jpg');

type Props = { visible: boolean; onClose: () => void; onPick: (t: Tier) => void };

export function TierSheet({ visible, onClose, onPick }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* содержимое монтируется заново при каждом открытии — ожидание «сейчас» перечитывается */}
      {visible ? <TierBody onPick={onPick} onClose={onClose} /> : null}
    </Modal>
  );
}

const inText = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.max(1, Math.round((s % 3600) / 60));
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};

function TierBody({ onPick, onClose }: { onPick: (t: Tier) => void; onClose: () => void }) {
  const op = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [op]);
  // состояние MIRA сейчас: окно разбора и на связи ли движок (рабочий)
  const [s, setS] = useState<{ open: boolean; online: boolean; changeInS: number } | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    getSchedule(ac.signal).then(setS).catch(() => {});
    return () => ac.abort();
  }, []);
  const offline = s ? !s.online : false;
  const away = 'MIRA сейчас не на связи — начнёт, как выйдет';
  const rows: { key: Tier; name: string; text: string; wait: string; Icon: typeof Zap }[] = [
    { key: 'fast', name: 'Быстрый', Icon: Zap, wait: offline ? away : '~2–4 мин',
      text: 'MIRA смотрит видео: техника, кисть, причины поражения, тактика и план тренировок.' },
    { key: 'advanced', name: 'Продвинутый', Icon: ScanLine,
      wait: !s ? '…' : !s.open ? `с 21:00 МСК — через ${inText(s.changeInS)}` : offline ? away : '~6–15 мин, по длине видео',
      text: '+ измерения: кто начал, финал, угол в локте и углы против соперника. Отметишь себя и соперника точками.' },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: op }]}>
      <Image source={BG} style={FILL} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,9,.45)' }]} />
      <View style={st.wrap}>
        <Text style={st.title}>Какой разбор?</Text>
        <Text style={st.sub}>Любой уровень — 1 токен</Text>
        {rows.map((r) => (
          <Pressable key={r.key} onPress={() => onPick(r.key)} accessibilityRole="button"
            style={({ pressed }) => [st.option, pressed && st.optionPressed]}>
            <View style={st.head}>
              <View style={st.icon}>
                <r.Icon size={18} color={SEA.onSea} strokeWidth={2} />
              </View>
              <Text style={st.name}>{r.name}</Text>
            </View>
            <Text style={st.text}>{r.text}</Text>
            <Text style={st.wait}>{r.wait}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={({ pressed }) => [st.cancel, pressed && { backgroundColor: '#1E1E23' }]}>
          <Text style={st.cancelText}>Отмена</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// на вебе у <img> absoluteFill не растягивает — размер явно
const FILL = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

const st = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, gap: 12 },
  title: { fontFamily: mira.display, fontSize: 30, letterSpacing: 0.6, textTransform: 'uppercase', color: '#F4F4F5', textAlign: 'center' },
  sub: { fontFamily: mira.font, fontSize: 13, color: mira.soft, textAlign: 'center', marginTop: -6, marginBottom: 4 },
  option: {
    padding: 16, gap: 8, borderRadius: 18, backgroundColor: 'rgba(18,18,20,.92)', borderWidth: 1, borderColor: '#2E2E33',
  },
  optionPressed: { borderColor: SEA.sea, backgroundColor: 'rgba(103,193,215,.14)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: SEA.sea, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: mira.display, fontSize: 20, letterSpacing: 0.5, textTransform: 'uppercase', color: '#F4F4F5' },
  text: { fontFamily: mira.font, fontSize: 13, lineHeight: 18, color: mira.soft },
  wait: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.4, color: SEA.lavender },
  cancel: {
    height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141416',
    borderWidth: 1, borderColor: '#2E2E33', marginTop: 4,
  },
  cancelText: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.text },
});
