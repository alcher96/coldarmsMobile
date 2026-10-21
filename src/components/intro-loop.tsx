import { useEventListener } from 'expo';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet } from 'react-native';

import { SITE_URL } from '@/api/http';

/**
 * Видео-луп бойца поверх его фото — как на сайте.
 *
 * - `cycle` (страница атлета, шторка бойца): фото и видео сменяют друг друга каждые `periodMs`,
 *   видео крутится по кругу (сайт: baMediaCycle, 7 с).
 * - `show` (интро на экране боя): каждые `periodMs` ролик проигрывается с начала, плавно
 *   проявляется и гаснет чуть раньше конца, чтобы не замирать на последнем кадре (сайт: baFightLoops, 10 с).
 *
 * Пока видео не загрузилось или его нет, виден только слой под ним (фото).
 * Звука нет; чужую музыку не прерываем. Вне экрана и в фоне не играет.
 */
export function IntroLoop({
  id,
  mode = 'cycle',
  periodMs = mode === 'cycle' ? 7000 : 10000,
}: {
  id: string;
  mode?: 'cycle' | 'show';
  periodMs?: number;
}) {
  // webm в разы легче, но AVPlayer на iOS его не умеет — там mp4.
  const format = Platform.OS === 'ios' ? 'mp4' : 'webm';
  const player = useVideoPlayer(`${SITE_URL}/api/ArmWrestler/${id}/video/file?format=${format}`, (p) => {
    p.muted = true;
    p.loop = mode === 'cycle';
    p.audioMixingMode = 'mixWithOthers';
    p.keepScreenOnWhilePlaying = false;
  });
  // Готовность запоминаем один раз: перемотка на начало снова даёт «loading», и без защёлки
  // показ сбрасывался бы при каждом повторе.
  const [ready, setReady] = useState(() => player.status === 'readyToPlay');
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') setReady(true);
  });
  const [opacity] = useState(() => new Animated.Value(0));
  const active = useActive();

  useEffect(() => {
    if (!ready || !active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const fade = (on: boolean) =>
      Animated.timing(opacity, { toValue: on ? 1 : 0, duration: 600, useNativeDriver: true }).start();
    const hide = () => {
      fade(false);
      later(() => player.pause(), 700);
    };

    if (mode === 'cycle') {
      let on = false;
      const id = setInterval(() => {
        on = !on;
        if (on) {
          player.play();
          fade(true);
        } else hide();
      }, periodMs);
      return () => {
        clearInterval(id);
        timers.forEach(clearTimeout);
        opacity.setValue(0);
        stop(player);
      };
    }

    const show = () => {
      player.currentTime = 0;
      player.play();
      fade(true);
      const length = (player.duration || 6) * 1000;
      later(hide, Math.max(600, length - 800));
      later(show, Math.max(periodMs, length + 1500));
    };
    later(show, 1200);
    return () => {
      timers.forEach(clearTimeout);
      opacity.setValue(0);
      stop(player);
    };
  }, [ready, active, mode, periodMs, player, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {/* textureView: SurfaceView на Android не умеет полупрозрачность, и фейд бы не работал. */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

/** Пауза при уходе с экрана: к этому моменту useVideoPlayer мог уже освободить плеер. */
function stop(player: VideoPlayer) {
  try {
    player.pause();
  } catch {}
}

/** Экран в фокусе и приложение на переднем плане. */
function useActive() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}
