import { useEventListener } from 'expo';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet } from 'react-native';

import { SITE_URL } from '@/api/http';

/**
 * Видео-луп атлета поверх его фото — как на сайте (baMediaCycle): фото и видео сменяют друг
 * друга каждые `periodMs`, видео крутится по кругу. Пока видео не загрузилось, видно фото.
 * Звука нет; чужую музыку не прерываем. Вне экрана и в фоне не играет.
 */
export function IntroLoop({ id, periodMs = 7000 }: { id: string; periodMs?: number }) {
  // webm в разы легче, но AVPlayer на iOS его не умеет — там mp4.
  const format = Platform.OS === 'ios' ? 'mp4' : 'webm';
  const player = useVideoPlayer(`${SITE_URL}/api/ArmWrestler/${id}/video/file?format=${format}`, (p) => {
    p.muted = true;
    p.loop = true;
    p.audioMixingMode = 'mixWithOthers';
    p.keepScreenOnWhilePlaying = false;
  });
  // Готовность запоминаем один раз: на повторах плеер снова ненадолго уходит в «loading».
  const [ready, setReady] = useState(() => player.status === 'readyToPlay');
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') setReady(true);
  });
  const [opacity] = useState(() => new Animated.Value(0));
  const active = useActive();

  useEffect(() => {
    if (!ready || !active) return;
    let on = false;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    const fade = (to: number) => Animated.timing(opacity, { toValue: to, duration: 600, useNativeDriver: true }).start();
    const tick = setInterval(() => {
      on = !on;
      clearTimeout(pauseTimer);
      if (on) {
        player.play();
        fade(1);
      } else {
        fade(0);
        // Даём фейду закончиться, потом останавливаем декодирование.
        pauseTimer = setTimeout(() => stop(player), 700);
      }
    }, periodMs);
    return () => {
      clearInterval(tick);
      clearTimeout(pauseTimer);
      opacity.setValue(0);
      stop(player);
    };
  }, [ready, active, periodMs, player, opacity]);

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
