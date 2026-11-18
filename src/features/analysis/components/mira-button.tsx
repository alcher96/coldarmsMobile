// Кнопка «Разбери свой поединок» из шаблона «MIRA Main Menu.dc.html».
// Глаз MIRA с прицелом слева на событие не реагирует — поэтому он ЗАПЕЧЁН в короткое видео по кругу
// (scripts/bake-mira-button.js → assets/mira/button-*.mp4): его рисует аппаратный видеодекодер, процессор и
// видеокарта телефона свободны. Глаз на кнопке всегда бодрствует, в любое время (эксперт, 2026-11-16): «сон» вне окна
// разбора — только у визора MIRA на экране с расписанием. Подпись справа — живая (окно разбора 21:00–06:00 МСК).
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { mira } from './mira';
import { DUSK, SEA, dusk } from './mira-theme';

const LOOP = require('../../../../assets/mira/button-awake.mp4');
const POSTER = require('../../../../assets/mira/button-awake.jpg');
const AW = 358, AH = 156;   // размер рисунка в шаблоне
// во весь блок: на вебе у <video> и <img> absoluteFill не растягивает — свой размер ролика (1074×468)
const FILL = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function MiraButton({ width, open, onPress, sub }: { width: number; open: boolean; onPress: () => void; sub?: string }) {
  const k = width / AW, h = AH * k;
  const player = useVideoPlayer(LOOP, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';   // не останавливать музыку спортсмена
    p.play();
  });
  // ролик не идёт, пока экран не виден (другая вкладка, разговор с MIRA) — не тратить батарею
  useFocusEffect(useCallback(() => {
    player.play();
    return () => player.pause();
  }, [player]));
  const [shown, setShown] = useState(false);
  const [down, setDown] = useState(false);
  const dot = DUSK.accent;   // вариант G — розовая точка, как неон визора
  return (
    <View style={[styles.root, { width, height: h }, down && styles.pressed]}>
      {/* до первого кадра — тот же кадр картинкой, без чёрной вспышки */}
      <Image source={POSTER} style={FILL} resizeMode="cover" />
      {/* нативный плеер Android забирает касания себе (pointerEvents на нём не действует) — поэтому видео под слоем,
          который касаний не принимает, а нажатие ловит прозрачный слой поверх всего */}
      <View style={FILL} pointerEvents="none">
        <VideoView
          player={player}
          style={[FILL, { opacity: shown ? 1 : 0 }]}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"   // скругление углов кнопки (SurfaceView не обрезается)
          onFirstFrameRender={() => setShown(true)}
        />
      </View>
      <View style={[styles.text, { left: 172 * k, gap: 10 * Math.min(1, k) }]} pointerEvents="none">
        <View style={styles.tagRow}>
          <View style={[styles.dot, { backgroundColor: dot, shadowColor: dot }]} />
          <Text style={styles.tag}>MIRA AI</Text>
        </View>
        <Text style={[styles.title, { fontSize: 23 * Math.min(1.1, k) }]}>Разбери свой поединок</Text>
        <View style={styles.subRow}>
          <View style={styles.up}>
            <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={dusk('#E5E7FF')} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 15V4M7.5 8.5L12 4L16.5 8.5M5 15V18A2 2 0 0 0 7 20H17A2 2 0 0 0 19 18V15" />
            </Svg>
          </View>
          <Text style={styles.sub}>{sub ?? (open ? 'Загрузи видео схватки' : 'Загрузи видео · разбор с 21:00 МСК')}</Text>
        </View>
      </View>
      <Pressable
        style={FILL}
        onPress={onPress}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        accessibilityRole="button"
        accessibilityLabel="Разбери свой поединок"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0A0A0B',
    borderWidth: 1,
    borderColor: dusk('rgba(186,154,255,.14)'),
  },
  pressed: { borderColor: dusk('rgba(186,154,255,.34)'), transform: [{ scale: 0.99 }] },
  text: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  tag: { fontFamily: MONO, fontWeight: '600', fontSize: 9, letterSpacing: 1.6, color: dusk('#C9C8FF') },
  title: { fontFamily: mira.display, lineHeight: 24, letterSpacing: 0.3, textTransform: 'uppercase', color: mira.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  up: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: dusk('rgba(186,154,255,.16)'), borderWidth: 1, borderColor: dusk('rgba(186,154,255,.3)'),
  },
  sub: { flex: 1, fontFamily: mira.font, fontSize: 12, lineHeight: 15, color: SEA.lavender },
});
