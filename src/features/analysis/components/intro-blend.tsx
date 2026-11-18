/* eslint-disable react-hooks/immutability --
   покадровая анимация: общие значения Reanimated пишутся в ворклете useFrameCallback (поток интерфейса), правило
   React Compiler этого не различает — как в mira-hud.tsx */
import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';

import type { IntroFrames } from '../../../../modules/video-prep';

// Вступление MIRA на телефоне: секунда схватки — 0,55 с как есть, затем плавное замедление до замершего кадра (0,4 с).
// Промежутки между кадрами при замедлении заполняет смешивание кадров (наплыв соседнего кадра), без дорисовки на
// сервере. Кривая и цифры — как у серверной нарезки (annotator/make_intro.py) и стенда annotator/report/intro_blend.html
// (эксперт, 2026-11-18: «смешивание чётко работает»).
const SRC = 1;          // секунда схватки
const T1 = 0.55;        // как есть
const D = 1.225;        // показ замедления (столько же, сколько ступени ×1,5 → ×7 серверной нарезки)
const HOLD = 0.4;       // замерший последний кадр
const P = D / (SRC - T1) - 1; // скорость падает как (1 − u)^P — за D секунд показа уходит ровно 0,45 с исходника
export const INTRO_TOTAL_S = T1 + D + HOLD;
const FADE_MS = 220;    // под вступлением — плеер на том же последнем кадре: уходим наплывом

/** Время исходника и скорость для времени показа tau (с). */
function sourceAt(tau: number) {
  'worklet';
  if (tau <= T1) return { s: tau, speed: 1 };
  if (tau <= T1 + D) {
    const u = (tau - T1) / D;
    return { s: T1 + (D / (P + 1)) * (1 - Math.pow(1 - u, P + 1)), speed: Math.pow(1 - u, P) };
  }
  return { s: SRC, speed: 0 };
}

/** На обычной скорости ролика 60 к/с хватит каждого второго кадра — в памяти держим только нужные. */
const stepOf = (fps: number) => (fps > 40 ? 2 : 1);
const needed = (i: number, fps: number) => i >= Math.floor(T1 * fps) || i % stepOf(fps) === 0;

/**
 * Проиграть вступление поверх видео. onFreeze — кадр замер (наезд камеры), onDone — вступление ушло: компонент можно
 * убирать, кадры из памяти освобождаются при размонтировании (SkImage.dispose), папку с файлами стирает вызывающий.
 * Не загрузились кадры — сразу onDone.
 */
export function IntroBlend({ intro, fit, onFreeze, onDone }: {
  intro: IntroFrames;
  fit: 'cover' | 'contain';
  onFreeze: () => void;
  onDone: () => void;
}) {
  const [imgs, setImgs] = useState<(SkImage | null)[] | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const list = useSharedValue<(SkImage | null)[]>([]);
  const imgA = useSharedValue<SkImage | null>(null);
  const imgB = useSharedValue<SkImage | null>(null);
  const alphaB = useSharedValue(0);
  const fade = useSharedValue(1);
  const t0 = useSharedValue(-1);
  const frozen = useSharedValue(false);
  const fps = intro.fps;

  // кадры с диска → картинки Skia; уходим с экрана — освобождаем всё, что успели загрузить
  useEffect(() => {
    let alive = true;
    const loaded: SkImage[] = [];
    (async () => {
      try {
        const out: (SkImage | null)[] = [];
        for (let i = 0; i < intro.frames.length; i++) {
          if (!needed(i, fps)) {
            out.push(null);
            continue;
          }
          const bytes = await new File(intro.frames[i]).bytes();
          if (!alive) return;
          const im = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
          if (im) loaded.push(im);
          out.push(im);
        }
        if (!out[0] || !out[out.length - 1]) throw new Error('кадры не прочитались');
        if (alive) setImgs(out);
      } catch {
        if (alive) onDone();
      }
    })();
    return () => {
      alive = false;
      list.set([]);
      imgA.set(null);
      imgB.set(null);
      loaded.forEach((im) => im.dispose());
    };
  }, [intro]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    fade.set(withTiming(0, { duration: FADE_MS }, (ok) => {
      if (ok) runOnJS(onDone)();
    }));
  };

  const frame = useFrameCallback((fi) => {
    'worklet';
    const all = list.value;
    if (!all.length) return;
    if (t0.value < 0) t0.value = fi.timestamp;
    const tau = (fi.timestamp - t0.value) / 1000;
    const { s, speed } = sourceAt(tau);
    const f = Math.min(all.length - 1, s * fps);
    let i = Math.floor(f + 1e-6);
    if (speed >= 1) i -= i % (fps > 40 ? 2 : 1);           // обычная скорость — как плеер, без смешивания
    while (i > 0 && !all[i]) i--;
    const j = Math.min(all.length - 1, i + 1);
    imgA.value = all[i];
    // при замедлении — наплыв следующего кадра (прозрачность растёт с долей пути между кадрами)
    const k = speed < 1 && all[j] && j !== i ? f - i : 0;
    imgB.value = k > 0.001 ? all[j] : null;
    alphaB.value = k;
    if (!frozen.value && tau >= T1 + D) {
      frozen.value = true;
      runOnJS(onFreeze)();
    }
    if (tau >= INTRO_TOTAL_S) {
      t0.value = -2;                                        // больше не запускать
      list.value = [];
      runOnJS(finish)();
    }
  }, false);

  // старт — когда картинки загружены и известен размер кадра
  useEffect(() => {
    if (!imgs || !box.w || t0.get() === -2) return;
    list.set(imgs);
    frame.setActive(true);
    return () => frame.setActive(false);
  }, [imgs, box.w]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {imgs && box.w ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Image image={imgA} x={0} y={0} width={box.w} height={box.h} fit={fit} />
          <Image image={imgB} x={0} y={0} width={box.w} height={box.h} fit={fit} opacity={alphaB} />
        </Canvas>
      ) : (
        // пока кадры грузятся — первый кадр видео (плеер под нами) не перекрываем
        <View />
      )}
    </Animated.View>
  );
}
