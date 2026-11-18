// Экран MIRA из шаблона «MIRA Main Menu.dc.html»: когда работает разбор (21:00–06:00 МСК), сколько до открытия /
// закрытия, окно разбора в мировых часовых поясах, как устроена очередь. Кнопка внизу — выбор видео → обрезка →
// разговор с MIRA (кнопки «Разбери свой поединок» из шаблона здесь нет: она на главной и ведёт сюда — эксперт, 2026-11-16).
// ?mode=open / ?mode=closed — проверить экран в любое время (как переключатель в шаблоне).
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Upload } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { MONO } from '@/features/analysis/components/mira-button';
import { mira } from '@/features/analysis/components/mira';
import type { CyberState } from '@/features/analysis/components/cyber-eyes';
import { MiraHud } from '@/features/analysis/components/mira-hud';
import { DUSK, SEA } from '@/features/analysis/components/mira-theme';
import { usePickVideo } from '@/features/analysis/pick';
import { hhmm, localOffset, localWindow, zoneRows } from '@/features/analysis/schedule';
import { useSchedule } from '@/features/analysis/use-schedule';

const SCENE: [CyberState, number][] = [['attention', 3.5], ['idle', 2.4], ['scan', 2.2], ['attention', 3], ['thinking', 2.6]];
const PAD = 16;

export default function MiraScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const force = mode === 'open' || mode === 'closed' ? mode : null;
  const S = useSchedule(force);
  const now = S.now;
  const [w, setW] = useState(0);
  const pick = usePickVideo();

  // сценарий взгляда MIRA, пока не спит
  const [st, setSt] = useState<CyberState>('attention');
  useEffect(() => {
    if (!S.open) return;
    let i = 0, tm: ReturnType<typeof setTimeout>;
    const next = () => { const [s, d] = SCENE[i++ % SCENE.length]; setSt(s); tm = setTimeout(next, d * 1000); };
    next();
    return () => clearTimeout(tm);
  }, [S.open]);

  const zones = zoneRows(S.msk, now);
  const th = (S.msk / 1440) * Math.PI * 2;
  const cw = w - PAD * 2;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/analysis'))}>
          <ChevronLeft size={22} color={mira.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.brand}>MIRA</Text>
        <Text style={styles.msk}>{hhmm(S.msk)} МСК</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {cw > 0 ? (
          <>
            {/* визор MIRA: во сне веки опущены, визор приглушён */}
            <View style={[styles.hudCard, { height: 206 * (cw / 390) }]}>
              <View style={{ position: 'absolute', left: 0, top: -30 * (cw / 390) }}>
                <MiraHud state={S.open ? st : 'idle'} width={cw} sleep={!S.open}
                  statusText={S.open ? 'на связи' : 'спит до 21:00 МСК'} statusColor={S.open ? DUSK.attention : mira.dim} />
              </View>
            </View>
          </>
        ) : null}

        {/* часы: окно разбора на циферблате суток, «сейчас», сколько до смены */}
        <View style={[styles.card, styles.clock]}>
          <View style={{ width: 104, height: 104 }}>
            <Svg viewBox="0 0 120 120" width={104} height={104}>
              <Defs>
                <LinearGradient id="mmArc" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={SEA.sea} />
                  <Stop offset="1" stopColor={SEA.pink} />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={56} fill="none" stroke="#E5E7FF" strokeOpacity={0.2} strokeWidth={3} strokeDasharray=".6 14.06" transform="rotate(-90 60 60)" />
              <Circle cx={60} cy={60} r={46} fill="none" stroke="#1E1E23" strokeWidth={7} />
              <Path d="M27.47 27.47A46 46 0 0 1 106 60" fill="none" stroke="url(#mmArc)" strokeWidth={7} strokeLinecap="round" strokeOpacity={S.open ? 1 : 0.45} />
              {[['00', 60, 30], ['06', 91, 62.5], ['12', 60, 95], ['18', 29, 62.5]].map(([t, x, y]) => (
                <SvgText key={t as string} x={x as number} y={y as number} textAnchor="middle" fontFamily={MONO} fontSize={7} fill={mira.dim}>{t}</SvgText>
              ))}
              <Circle cx={60 + 46 * Math.sin(th)} cy={60 - 46 * Math.cos(th)} r={4.5} fill="#F4F4F5" stroke="#121214" strokeWidth={2.5} />
            </Svg>
            <View style={styles.cd}>
              <Text style={styles.cdShort}>{Math.floor(S.left / 60)}:{String(Math.floor(S.left % 60)).padStart(2, '0')}</Text>
              <Text style={styles.cdLabel}>{S.open ? 'ДО ЗАКРЫТИЯ' : 'ДО СТАРТА'}</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.pill, { backgroundColor: S.open ? 'rgba(247,190,200,.14)' : '#1E1E23' }]}>
              <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={S.open ? SEA.pink : mira.muted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 14.5A8 8 0 0 1 9.5 4A8 8 0 1 0 20 14.5Z" />
              </Svg>
              <Text style={[styles.pillText, { color: S.open ? SEA.pink : mira.muted }]}>{S.open ? 'Разбор открыт' : 'MIRA спит'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.win}>21:00–06:00</Text>
              <Text style={styles.winMsk}>МСК</Text>
            </View>
            <Text style={styles.cdLine}>
              {S.open ? `Закроется через ${S.leftText}.` : `Откроется через ${S.leftText}.`}
              {localOffset(now) !== 180 ? ` По вашему времени: ${localWindow(now)}.` : ''}
            </Text>
          </View>
        </View>

        {/* окно разбора в часовых поясах мира */}
        <View style={[styles.card, styles.zones]}>
          <View style={styles.zHead}>
            <View style={styles.zTitleRow}>
              <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke={SEA.sea} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={9} />
                <Path d="M3 12H21M12 3C14.5 5.6 15.7 8.6 15.7 12S14.5 18.4 12 21C9.5 18.4 8.3 15.4 8.3 12S9.5 5.6 12 3Z" />
              </Svg>
              <Text style={styles.zTitle}>Часовые пояса</Text>
            </View>
            <View style={styles.zTitleRow}>
              <View style={styles.legend} />
              <Text style={styles.legendText}>окно разбора</Text>
            </View>
          </View>
          <View style={styles.zRow}>
            <View style={styles.zCity} />
            <View style={[styles.zTrackBox, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              {['00', '06', '12', '18', '24'].map((t) => <Text key={t} style={styles.zTick}>{t}</Text>)}
            </View>
            <View style={styles.zRange} />
          </View>
          {zones.map((z) => (
            <View key={z.city} style={[styles.zRow, styles.zItem, z.you && styles.zYou]}>
              <View style={styles.zCity}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={styles.zName} numberOfLines={1}>{z.city}</Text>
                  {z.you ? <Text style={styles.you}>ВЫ</Text> : null}
                </View>
                <Text style={styles.zUtc}>{z.utc}</Text>
              </View>
              <View style={styles.zTrackBox}>
                <View style={styles.zTrack}>
                  {z.segs.map((g, i) => (
                    <View key={i} style={[styles.zSeg, { left: `${g.l}%`, width: `${g.w}%`, opacity: S.open ? 1 : 0.55 }]} />
                  ))}
                  <View style={[styles.zNow, { left: `${z.now}%` }]} />
                </View>
              </View>
              <Text style={[styles.zRange, { color: z.you ? mira.text : SEA.lavender }]}>{z.range}</Text>
            </View>
          ))}
        </View>

        {/* как это работает: очередь, уведомления, оплата */}
        <View style={[styles.card, styles.note]}>
          <Text style={styles.noteHead}>Как это работает</Text>
          <Text style={styles.noteText}>
            Видео можно загрузить в любое время. При загрузке MIRA задаст пару базовых вопросов кнопками, и видео встанет
            в очередь. В 21:00 МСК MIRA проснётся, пришлёт уведомление и начнёт разбор.
          </Text>
          <Text style={styles.noteText}>
            Если по ходу разбора появятся уточняющие вопросы — тоже придёт уведомление: ответишь, и MIRA продолжит.
          </Text>
          <Text style={[styles.noteText, { color: mira.dim }]}>
            Разбор оплачивается внутренними токенами ColdArms Token (скоро).
          </Text>
        </View>
      </ScrollView>
      {/* выбор видео → обрезка → разговор с MIRA; вне окна разбора видео встанет в очередь */}
      <View style={styles.footer}>
        <Pressable onPress={pick} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Upload size={18} color={SEA.onSea} strokeWidth={2} />
          <Text style={styles.ctaText}>{S.open ? 'Выбрать видео' : 'Выбрать видео в очередь'}</Text>
        </Pressable>
        {S.open ? null : <Text style={styles.ctaNote}>Разбор начнётся в 21:00 МСК — MIRA пришлёт уведомление</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mira.bg },
  header: { height: 52, paddingHorizontal: PAD + 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { flex: 1, fontFamily: mira.display, fontSize: 20, letterSpacing: 2, color: '#F4F4F5' },
  msk: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.4, color: mira.dim },
  body: { paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 28, gap: 16 },
  // без обрезки: свечение рамки визора выходит за карточку (фон карточки = фон экрана, края не видно)
  hudCard: { overflow: 'visible' },
  card: { borderRadius: 22, backgroundColor: '#121214', borderWidth: 1, borderColor: '#232327' },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  cd: { position: 'absolute', left: 22, right: 22, top: 36, alignItems: 'center', gap: 4 },
  cdShort: { fontFamily: MONO, fontWeight: '600', fontSize: 15, color: '#F4F4F5' },
  cdLabel: { fontFamily: MONO, fontSize: 7, letterSpacing: 0.4, color: mira.muted, textAlign: 'center' },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingLeft: 7, paddingRight: 9, borderRadius: 999 },
  pillText: { fontFamily: mira.fontSemi, fontSize: 11 },
  win: { fontFamily: mira.display, fontSize: 27, letterSpacing: 0.5, color: '#F4F4F5' },
  winMsk: { fontFamily: MONO, fontWeight: '600', fontSize: 10, letterSpacing: 1, color: mira.muted },
  cdLine: { fontFamily: mira.font, fontSize: 12, lineHeight: 16, color: mira.muted },
  zones: { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  zHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 },
  zTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  zTitle: { fontFamily: mira.fontSemi, fontSize: 13, color: '#F4F4F5' },
  legend: { width: 14, height: 4, borderRadius: 2, backgroundColor: SEA.sea },
  legendText: { fontFamily: mira.font, fontSize: 10, color: mira.muted },
  zRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  zItem: { paddingVertical: 8, borderRadius: 13, borderWidth: 1, borderColor: 'transparent' },
  zYou: { backgroundColor: 'rgba(103,193,215,.08)', borderColor: 'rgba(103,193,215,.32)' },
  zCity: { width: 96, gap: 4 },
  zName: { flexShrink: 1, fontFamily: mira.font, fontSize: 13, color: '#F4F4F5' },
  you: { fontFamily: MONO, fontWeight: '600', fontSize: 7.5, letterSpacing: 0.6, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: SEA.pink, color: SEA.onSea, overflow: 'hidden' },
  zUtc: { fontFamily: MONO, fontSize: 9, color: mira.dim },
  zTrackBox: { flex: 1, minWidth: 0 },
  zTick: { fontFamily: MONO, fontSize: 7.5, color: mira.dim },
  zTrack: { height: 6, borderRadius: 3, backgroundColor: '#1E1E23' },
  zSeg: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: SEA.sea },
  zNow: { position: 'absolute', top: -3, width: 2, height: 12, marginLeft: -1, borderRadius: 1, backgroundColor: '#F4F4F5' },
  zRange: { width: 76, textAlign: 'right', fontFamily: MONO, fontSize: 11, color: SEA.lavender },
  note: { padding: 16, gap: 8 },
  footer: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#232327' },
  cta: {
    height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: SEA.sea,
  },
  ctaPressed: { backgroundColor: SEA.seaPressed },
  ctaText: { fontFamily: mira.display, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: SEA.onSea },
  ctaNote: { fontFamily: mira.font, fontSize: 11.5, color: mira.muted, textAlign: 'center' },
  noteHead: { fontFamily: mira.fontSemi, fontSize: 13, color: '#F4F4F5' },
  noteText: { fontFamily: mira.font, fontSize: 12.5, lineHeight: 18, color: mira.muted },
});
