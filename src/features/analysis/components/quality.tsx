import { Check, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Quality } from '../types';
import { mira } from './mira';

/** Оценка видео (annotator/research/video_quality.py): крупный балл, пять делений, замечания — красный крестик, текст
 *  и отрезки (нажал — видео перематывается). Честно показываем, где и почему разбор может быть неточным. */
export function QualityPanel({ q, seek, title = 'Оценка видео' }: { q: Quality; seek?: (t: number) => void; title?: string }) {
  const issues = Object.values(q.issues);
  const tone = q.score >= 4 ? GOOD : q.score === 3 ? MID : BAD;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.eyebrow}>{title}</Text>
          <View style={styles.bars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= q.score ? tone : mira.track }]} />
            ))}
          </View>
          <Text style={styles.verdict}>{VERDICT[q.score] ?? VERDICT[1]}</Text>
        </View>
        <Text style={[styles.score, { color: tone }]}>
          {q.score}
          <Text style={styles.of}>/5</Text>
        </Text>
      </View>

      {issues.length ? (
        <View style={styles.list}>
          {issues.map((it) => (
            <View key={it.text} style={styles.row}>
              <View style={styles.cross}>
                <X size={13} color="#fff" strokeWidth={3} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.issue}>{cap(it.text)}</Text>
                {it.spans.length ? (
                  <View style={styles.spans}>
                    {it.spans.slice(0, 6).map(([a, b]) => (
                      <Pressable key={a} onPress={seek ? () => seek(a) : undefined} style={styles.span}>
                        <Text style={styles.spanText}>
                          {fmt(a)}–{fmt(b)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.row}>
          <View style={[styles.cross, { backgroundColor: GOOD }]}>
            <Check size={13} color="#0A0A0B" strokeWidth={3} />
          </View>
          <Text style={[styles.issue, { flex: 1 }]}>Снято хорошо — разбору ничего не мешает.</Text>
        </View>
      )}
    </View>
  );
}

const GOOD = '#4FD18B';
const MID = '#F2B53B';
const BAD = mira.red;
const VERDICT: Record<number, string> = {
  5: 'Отличное видео для разбора',
  4: 'Хорошее видео, есть мелкие помехи',
  3: 'Разбор может быть неточным',
  2: 'Многое закрыто — разбор будет приблизительным',
  1: 'Разобрать почти нельзя',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// время для человека — до полсекунды (эксперт: доли секунды не называть)
const fmt = (t: number) => `${(Math.round(t * 2) / 2).toString().replace('.', ',')} с`;

const styles = StyleSheet.create({
  card: { backgroundColor: mira.bubble, borderWidth: 1, borderColor: mira.bubbleBorder, borderRadius: 18, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontFamily: mira.fontSemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: mira.muted },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  verdict: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.text },
  score: { fontFamily: mira.display, fontSize: 44, lineHeight: 46 },
  of: { fontFamily: mira.displayBold, fontSize: 18, color: mira.muted },
  list: { gap: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cross: { width: 20, height: 20, borderRadius: 10, backgroundColor: BAD, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  issue: { fontFamily: mira.font, fontSize: 14, lineHeight: 20, color: mira.soft },
  spans: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  span: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: mira.chip, borderWidth: 1, borderColor: mira.chipBorder },
  spanText: { fontFamily: mira.fontSemi, fontSize: 12, color: mira.text },
});
