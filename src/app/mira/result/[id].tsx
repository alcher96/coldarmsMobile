import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { GraduationCap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, Eyebrow } from '@/components/ui';
import { fetchAnalysis, videoSource } from '@/features/analysis/api';
import { getJob, type Quality } from '@/features/analysis/jobs';
import { Badge, Button, Screen } from '@/features/analysis/components/kit';
import type { AnalysisResult } from '@/features/analysis/types';
import { colors, fonts, radii } from '@/theme/tokens';
import { VIDEO_FILL } from '@/features/analysis/video-size';
import { UserError, userMessage } from '@/lib/user-error';

/** Разбор: видео + бейджи, ход схватки с перемоткой, главная причина, тактика эксперта, полный текст. */
export default function ResultScreen() {
  const { id, fromUpload } = useLocalSearchParams<{ id: string; fromUpload?: string }>();
  const [r, setR] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // своё видео — номер задачи (32 знака), иначе демо-клип; чужой разбор сервер не отдаст (404 — «нет такого»)
    const ac = new AbortController();
    const load = /^[0-9a-f]{32}$/.test(id)
      ? getJob(id, ac.signal).then((j) => {
          if (!j.result) throw new UserError('Разбор ещё не готов.');
          return j.result;
        })
      : fetchAnalysis(id, ac.signal);
    load.then(setR).catch((e) => !ac.signal.aborted && setError(userMessage(e)));
    return () => ac.abort();
  }, [id]);

  return (
    <Screen
      eyebrow={r?.demo ? 'MIRA · разбор · демо' : 'MIRA · разбор'}
      title="Почему проиграл"
      footer={<Button label="Разобрать другую схватку" kind="secondary" onPress={() => router.dismissTo('/analysis')} />}>
      {fromUpload ? (
        <Text style={styles.demoNote}>
          Прототип: анализ загруженного видео ещё не подключён — показан готовый разбор примера.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!r && !error ? <ActivityIndicator color={colors.text} /> : null}
      {r ? <Body r={r} /> : null}
    </Screen>
  );
}

function Body({ r }: { r: AnalysisResult }) {
  const player = useVideoPlayer(videoSource(r), (p) => {
    p.muted = true;
  });
  const [full, setFull] = useState(false);
  // вертикальное видео — выше, горизонтальное — как было; кадр всегда во всю ширину. Размер кадра даёт сервер
  const ratio = r.videoRatio;
  const box = ratio && ratio < 0.9 ? { height: 420 } : { height: 240 }; // во всю ширину, вертикальное — выше

  return (
    <>
      <View style={[styles.video, box]}>
        <VideoView player={player} style={VIDEO_FILL} contentFit="contain" nativeControls />
      </View>
      {r.quality ? <QualityCard q={r.quality} seek={(t) => {
        // eslint-disable-next-line react-hooks/immutability -- expo-video: перемотка — присваиванием свойства плеера
        player.currentTime = t;
        player.play();
      }} /> : null}
      <View style={styles.badges}>
        {r.badges.map((b) => (
          // выделена техника соперника (раньше — третья плашка: без завязок или типа схватки съезжало)
          <Badge key={b} accent={b.startsWith('соперник:')}>
            {b}
          </Badge>
        ))}
      </View>

      {r.mainReason.length ? (
        <Card style={{ gap: 8 }}>
          <Eyebrow>Главная причина</Eyebrow>
          {r.mainReason.map((c) => (
            <Text key={c.text} style={styles.main}>
              {c.text}
            </Text>
          ))}
        </Card>
      ) : null}

      {r.tactics.map((t) => (
        <View key={t.id} style={styles.tactic}>
          <View style={styles.tacticTop}>
            <GraduationCap size={18} color={colors.lightText} strokeWidth={1.6} />
            <Eyebrow style={styles.tacticEyebrow}>Совет тренера · {t.situation}</Eyebrow>
          </View>
          <Text style={styles.tacticText}>{t.move.charAt(0).toUpperCase() + t.move.slice(1)}</Text>
        </View>
      ))}

      {r.secondary.length ? (
        <Card style={{ gap: 8 }}>
          <Eyebrow>Ещё повлияло</Eyebrow>
          {r.secondary.map((c) => (
            <Text key={c.text} style={styles.item}>
              — {c.text}
            </Text>
          ))}
        </Card>
      ) : null}

      {r.training.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Что тренировать</Eyebrow>
          <View style={styles.badges}>
            {r.training.map((c) => (
              <Badge key={c.text}>{c.aspect}</Badge>
            ))}
          </View>
          {r.training.map((c) => (
            <Text key={c.text} style={styles.item}>
              — {c.text}
            </Text>
          ))}
        </View>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Eyebrow>Полный разбор</Eyebrow>
        <Text style={styles.summary} numberOfLines={full ? undefined : 6}>
          {r.summary}
        </Text>
        <Text style={styles.more} onPress={() => setFull((f) => !f)}>
          {full ? 'Свернуть' : 'Читать полностью'}
        </Text>
      </Card>

      <Button label="Улучшить мой план" onPress={() => router.push(`/plan/upgrade?analysis=${encodeURIComponent(r.id)}`)} />
    </>
  );
}

/** Качество видео (annotator/research/video_quality.py): честно — что мешало и где, чтобы спортсмен знал, где разбор
 *  может ошибаться. Отрезки нажимаются — видео перематывается туда. */
function QualityCard({ q, seek }: { q: Quality; seek: (t: number) => void }) {
  const issues = Object.values(q.issues);
  if (!issues.length) {
    return <Text style={styles.qualityOk}>Видео {q.score} из 5 — снято хорошо, разбору ничего не мешало.</Text>;
  }
  return (
    <Card style={{ gap: 8 }}>
      <Eyebrow>Видео {q.score} из 5 · разбор может быть неточным</Eyebrow>
      {issues.map((it) => (
        <View key={it.text} style={{ gap: 4 }}>
          <Text style={styles.item}>— {it.text.charAt(0).toUpperCase() + it.text.slice(1)}</Text>
          {it.spans.length ? (
            <View style={styles.spans}>
              {it.spans.slice(0, 6).map(([a, b]) => (
                <Text key={`${a}`} style={styles.span} onPress={() => seek(a)}>
                  {fmt(a)}–{fmt(b)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

// время для человека — с точностью до полсекунды (плеер показывает секунды; эксперт: доли секунды не называть)
const fmt = (t: number) => `${(Math.round(t * 2) / 2).toString().replace('.', ',')} с`;

const styles = StyleSheet.create({
  qualityOk: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  spans: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 12 },
  span: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.text,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.row,
    overflow: 'hidden',
  },
  demoNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.accent },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.accent },
  video: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.row },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  main: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 25, color: colors.text },
  tactic: { backgroundColor: colors.light, borderRadius: radii.card, padding: 16, gap: 10 },
  tacticTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tacticEyebrow: { color: colors.lightText, fontFamily: fonts.bodySemi, flex: 1 },
  tacticText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.lightText },
  item: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text },
  summary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.text },
  more: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted },
});
