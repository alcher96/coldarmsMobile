/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/set-state-in-effect --
   покадровая анимация / жесты: изменяемое состояние кадра живёт в ref и SharedValue мимо React (иначе — перерисовка
   экрана на каждый кадр); плеер expo-video управляется присваиванием свойств. React Compiler такие компоненты
   не оптимизирует (сам пропускает), поведение проверено на телефоне (прототип coldarmsAI/mobile). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useAnalysisDraft } from '@/features/analysis/draft';
import { TierSheet } from '@/features/analysis/components/tier-sheet';
import { Button, Screen } from '@/features/analysis/components/kit';
import { VIDEO_FILL } from '@/features/analysis/video-size';
import { colors, fonts, radii } from '@/theme/tokens';

/** Обрезка перед отправкой — как в CapCut: лента кадров, две ручки (начало и конец), бегунок текущего кадра.
 *  Пока тянешь ручку, видео показывает этот кадр. Оставить только схватку — отправка в разы быстрее, а разбору
 *  не мешают подготовка, повторы и разговоры у стола. Сам отрезок режет телефон при сжатии (в своей сборке приложения)
 *  или сервер — точно по кадрам. */

const THUMBS = 10;
const MIN_LEN = 1; // с — короче схватки не бывает
const HANDLE = 18; // ширина ручки, px

export default function TrimScreen() {
  const draft = useAnalysisDraft();
  const uri = draft.videoUri!;
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
    p.timeUpdateEventInterval = 0.05;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });

  const [duration, setDuration] = useState(draft.videoDuration ?? 0);
  const [range, setRange] = useState<[number, number]>(draft.trim ?? [0, draft.videoDuration ?? 0]);
  const [thumbs, setThumbs] = useState<VideoThumbnail[]>([]);
  const [width, setWidth] = useState(0);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  // где бегунок после перемотки: на паузе плеер новое время не присылает — без этого бегунок «возвращался» назад
  const [seekT, setSeekT] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);   // тянут ручку или ленту — страница не прокручивается
  // лента: координата пальца — от левого края ленты (locationX — от кадра под пальцем, отсюда дёрганье)
  const stripRef = useRef<ComponentRef<typeof View>>(null);
  const stripX = useRef(0);
  const measureStrip = () => stripRef.current?.measureInWindow((x: number) => { stripX.current = x; });

  // длина видео — из выбора в галерее, а если её нет — у плеера, когда он загрузил видео
  useEffect(() => {
    if (status !== 'readyToPlay') return;
    const d = player.duration || duration;
    if (d && !duration) {
      setDuration(d);
      setRange([0, d]);
    }
    // лента кадров (на вебе плеер кадры не отдаёт — остаются серые плитки)
    if (Platform.OS !== 'web' && d && !thumbs.length) {
      const times = Array.from({ length: THUMBS }, (_, i) => (d * (i + 0.5)) / THUMBS);
      player.generateThumbnailsAsync(times, { maxWidth: 160 }).then(setThumbs).catch(() => {});
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // играем только выбранный кусок, по кругу
  useEffect(() => {
    if (isPlaying && time.currentTime >= range[1]) player.currentTime = range[0];
  }, [time.currentTime, isPlaying, range, player]);

  const toX = (t: number) => (duration ? (t / duration) * width : 0);
  const toT = (x: number) => Math.max(0, Math.min(duration, (x / Math.max(width, 1)) * duration));

  // ручки: тянешь — меняется начало/конец, видео показывает этот кадр
  const makePan = (which: 0 | 1) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        player.pause();
        setDragging(true);
        startX.current = toX(rangeRef.current[which]);
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
      onPanResponderMove: (_, g) => {
        const t = toT(startX.current + g.dx);
        const [a, b] = rangeRef.current;
        const next: [number, number] = which === 0 ? [Math.min(t, b - MIN_LEN), b] : [a, Math.max(t, a + MIN_LEN)];
        next[0] = Math.max(0, next[0]);
        next[1] = Math.min(duration, next[1]);
        setRange(next);
        player.currentTime = next[which];
        setSeekT(next[which]);
      },
    });
  const startX = useRef(0);
  const panStart = useMemo(() => makePan(0), [width, duration]); // eslint-disable-line react-hooks/exhaustive-deps
  const panEnd = useMemo(() => makePan(1), [width, duration]); // eslint-disable-line react-hooks/exhaustive-deps
  // бегунок: нажал или повёл пальцем по ленте внутри выделения — перемотка
  const panScrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          player.pause();
          setDragging(true);
          measureStrip();
          seekTo(e.nativeEvent.pageX - stripX.current);
        },
        onPanResponderMove: (e) => seekTo(e.nativeEvent.pageX - stripX.current),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [width, duration], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const seekTo = (x: number) => {
    const [a, b] = rangeRef.current;
    const t = Math.max(a, Math.min(b, toT(x)));
    player.currentTime = t;
    setSeekT(t);
  };

  // текущее время: пока играет — от плеера, на паузе — куда перемотали
  const cur = isPlaying || seekT === null ? time.currentTime : seekT;
  const toggle = () => {
    if (isPlaying) {
      setSeekT(time.currentTime);
      return player.pause();
    }
    if (cur < range[0] || cur >= range[1] - 0.05) player.currentTime = range[0];
    else player.currentTime = cur;
    setSeekT(null);
    player.play();
  };

  const whole = duration > 0 && range[0] <= 0.05 && range[1] >= duration - 0.05;
  // «Готово» → уровень разбора (быстрый / продвинутый); выбор уровня — оплата: токен спишется в начале загрузки
  const [tierOpen, setTierOpen] = useState(false);
  const done = () => {
    player.pause();
    draft.setTrim(whole ? undefined : [Math.round(range[0] * 100) / 100, Math.round(range[1] * 100) / 100]);
    setTierOpen(true);
  };

  const len = range[1] - range[0];
  const head = toX(Math.max(range[0], Math.min(range[1], cur)));
  const vertical = (draft.videoRatio ?? 16 / 9) < 0.9;

  return (
    <Screen
      eyebrow="Оставь только схватку"
      scrollEnabled={!dragging}
      footer={
        <View style={{ gap: 8 }}>
          <Button label={whole ? 'Отправить всё видео' : `Готово · ${fmt(len)}`} onPress={done} disabled={!duration} />
        </View>
      }>
      <Text style={styles.hint}>Убери подготовку, разговоры и повторы — видео отправится быстрее, разбор будет точнее.</Text>

      <Pressable style={[styles.video, { height: vertical ? 420 : 230 }]} onPress={toggle}>
        <VideoView player={player} style={VIDEO_FILL} contentFit="contain" nativeControls={false} />
        {!isPlaying ? (
          <View style={styles.play}>
            <Play size={26} color="#fff" fill="#fff" />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.times}>
        <Text style={styles.time}>{fmt(range[0])}</Text>
        <View style={styles.playRow}>
          <Pressable onPress={toggle} hitSlop={10}>
            {isPlaying ? <Pause size={18} color={colors.text} /> : <Play size={18} color={colors.text} />}
          </Pressable>
          <Text style={styles.len}>{fmt(len)}</Text>
        </View>
        <Text style={styles.time}>{fmt(range[1])}</Text>
      </View>

      {/* лента кадров с выделением */}
      <View ref={stripRef} style={styles.strip} onLayout={(e: LayoutChangeEvent) => {
        setWidth(e.nativeEvent.layout.width);
        measureStrip();
      }}>
        <View style={styles.thumbs} {...panScrub.panHandlers}>
          {Array.from({ length: THUMBS }, (_, i) => (
            <View key={i} style={styles.thumbBox}>
              {thumbs[i] ? <Image source={thumbs[i]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
          ))}
        </View>
        {width ? (
          <>
            {/* затемнение вне выделения */}
            <View pointerEvents="none" style={[styles.dim, { left: 0, width: toX(range[0]) }]} />
            <View pointerEvents="none" style={[styles.dim, { left: toX(range[1]), right: 0 }]} />
            {/* рамка выделения */}
            <View pointerEvents="none" style={[styles.frame, { left: toX(range[0]), width: toX(range[1]) - toX(range[0]) }]} />
            {/* бегунок */}
            <View pointerEvents="none" style={[styles.head, { left: head - 1 }]} />
            {/* ручки */}
            <View {...panStart.panHandlers} style={[styles.handle, { left: toX(range[0]) - HANDLE }]}>
              <View style={styles.grip} />
            </View>
            <View {...panEnd.panHandlers} style={[styles.handle, { left: toX(range[1]) }]}>
              <View style={styles.grip} />
            </View>
          </>
        ) : null}
      </View>

      <Pressable onPress={() => setRange([0, duration])} disabled={whole}>
        <Text style={[styles.reset, whole && { opacity: 0.4 }]}>Вернуть всё видео</Text>
      </Pressable>
      <TierSheet visible={tierOpen} onClose={() => setTierOpen(false)}
        onPick={(t) => {
          setTierOpen(false);
          draft.setAnswer('tier', t);
          router.replace('/mira/session');
        }} />
    </Screen>
  );
}

// для человека — секунды с одним знаком (плеер в приложении — тоже секунды)
const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1).replace('.', ',')} с`;
};

const STRIP_H = 56;
const styles = StyleSheet.create({
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  video: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted, minWidth: 64 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  len: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  strip: { height: STRIP_H, marginHorizontal: HANDLE, justifyContent: 'center' },
  thumbs: { flexDirection: 'row', height: STRIP_H, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.card },
  thumbBox: { flex: 1, backgroundColor: colors.row, borderRightWidth: 1, borderRightColor: colors.bg },
  dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(11,11,12,.72)' },
  frame: { position: 'absolute', top: -3, bottom: -3, borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.light },
  head: { position: 'absolute', top: -8, bottom: -8, width: 2, borderRadius: 1, backgroundColor: colors.accent },
  handle: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: HANDLE,
    backgroundColor: colors.light,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 3, height: 18, borderRadius: 2, backgroundColor: colors.lightMuted },
  reset: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
