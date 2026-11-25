// Какое видео подойдёт — перед выбором из галереи (эксперт, 2026-11-25): спортсмен выбирает видео, уже зная, что
// разбору мешает. Пункты — то, что оценка видео (annotator/research/video_quality.py) отмечает как помехи: ракурс,
// мелкие или закрытые борцы, тряска и зум, вставки и склейки, темнота и смаз. Оформление — как у оценки видео и выбора
// уровня: готовый размытый фон, крупные кнопки.
import { Camera, Crop, Eye, Move, Scissors, Sun } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { mira } from './mira';
import { SEA } from './mira-theme';

const BG = require('../../../../assets/mira/modal-bg.jpg');

const TIPS: { Icon: typeof Camera; text: string }[] = [
  { Icon: Camera, text: 'Сбоку стола или чуть под углом — видны оба локтя, руки и захват.' },
  { Icon: Eye, text: 'Оба борца в кадре целиком и крупно; захват не закрывают судья, зрители или своя рука.' },
  { Icon: Move, text: 'Камера неподвижна: без зума, тряски и обхода стола.' },
  { Icon: Scissors, text: 'Одна схватка, без вставок, повторов и склеек. Лишнее до и после обрежешь на следующем шаге.' },
  { Icon: Sun, text: 'Светло и чётко, без смаза. Подойдёт и горизонтальное, и вертикальное видео.' },
  { Icon: Crop, text: 'Токен спишется, когда после обрезки выберешь уровень разбора.' },
];

type Props = { visible: boolean; onClose: () => void; onContinue: () => void };

export function VideoTipsModal({ visible, onClose, onContinue }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible ? <Body onClose={onClose} onContinue={onContinue} /> : null}
    </Modal>
  );
}

function Body({ onClose, onContinue }: Omit<Props, 'visible'>) {
  const op = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [op]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: op }]}>
      <Image source={BG} style={FILL} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,9,.5)' }]} />
      <ScrollView contentContainerStyle={st.wrap}>
        <Text style={st.title}>Какое видео подойдёт</Text>
        <Text style={st.sub}>От видео зависит, насколько точным будет разбор</Text>
        <View style={st.card}>
          {TIPS.map(({ Icon, text }) => (
            <View key={text} style={st.tip}>
              <View style={st.icon}>
                <Icon size={16} color={SEA.sea} strokeWidth={1.9} />
              </View>
              <Text style={st.text}>{text}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onContinue} style={({ pressed }) => [st.go, pressed && { backgroundColor: SEA.seaPressed }]}>
          <Text style={st.goText}>Выбрать видео</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [st.cancel, pressed && { backgroundColor: '#1E1E23' }]}>
          <Text style={st.cancelText}>Отмена</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

// на вебе у <img> absoluteFill не растягивает — размер явно
const FILL = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

const st = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48, gap: 12 },
  title: { fontFamily: mira.display, fontSize: 28, letterSpacing: 0.6, textTransform: 'uppercase', color: '#F4F4F5', textAlign: 'center' },
  sub: { fontFamily: mira.font, fontSize: 13, color: mira.soft, textAlign: 'center', marginTop: -6, marginBottom: 4 },
  card: { padding: 14, gap: 12, borderRadius: 18, backgroundColor: 'rgba(18,18,20,.92)', borderWidth: 1, borderColor: '#2E2E33' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(103,193,215,.12)', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontFamily: mira.font, fontSize: 13.5, lineHeight: 19, color: mira.text },
  go: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: SEA.sea, marginTop: 4 },
  goText: { fontFamily: mira.display, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: SEA.onSea },
  cancel: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141416', borderWidth: 1, borderColor: '#2E2E33' },
  cancelText: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.text },
});
