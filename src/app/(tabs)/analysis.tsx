// Вкладка «Анализ» — хаб MIRA: визор, баланс ColdArms Token и пополнение (features/tokens; оплата пока заглушка),
// «Новый разбор» (не хватает токена — сначала шторка пополнения) и мои разборы.
// Мои разборы — с сервера и только этого аккаунта (annotator/auth.py); удалить — корзина: сервер стирает видео и всё
// насчитанное. Ушли с вкладки — запросы обрываются (AbortController).
// «Новый разбор» → экран окна разбора (mira/schedule: 21:00–06:00 МСК, очередь) → выбор видео → обрезка → разговор с MIRA.
// Сюда же ведёт кнопка «Разбери свой поединок» на главной.
import { router, useFocusEffect } from 'expo-router';
import { ArrowUpRight, Plus, ScanLine, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassHeaderScreen } from '@/components/glass-header-screen';
import type { CyberState } from '@/features/analysis/components/cyber-eyes';
import { mira } from '@/features/analysis/components/mira';
import { MONO } from '@/features/analysis/components/mira-button';
import { MiraHud } from '@/features/analysis/components/mira-hud';
import { DUSK, SEA } from '@/features/analysis/components/mira-theme';
import { TierSheet } from '@/features/analysis/components/tier-sheet';
import { useAnalysisDraft } from '@/features/analysis/draft';
import { cleanupLocalVideos, deleteJob, listJobs, stateLabel, type Job } from '@/features/analysis/jobs';
import { usePickVideo } from '@/features/analysis/pick';
import type { Tier } from '@/features/analysis/types';
import { useSchedule } from '@/features/analysis/use-schedule';
import { usePlan } from '@/features/plan/store';
import { getStrength } from '@/features/strength/api';
import { ProfileGate, styleReady } from '@/features/strength/profile-gate';
import { tokensWord } from '@/features/tokens/api';
import { useTokens } from '@/features/tokens/store';
import { TopUpSheet } from '@/features/tokens/top-up-sheet';
import { currentWeek } from '@/features/plan/track';
import { colors, fonts, space } from '@/theme/tokens';
import { userMessage } from '@/lib/user-error';

const SCENE: [CyberState, number][] = [['attention', 3.5], ['idle', 2.4], ['scan', 2.2], ['attention', 3], ['thinking', 2.6]];

export default function AnalysisHub() {
  const S = useSchedule();
  const { active } = usePlan();
  const [w, setW] = useState(0);
  const cw = w - space.gutter * 2;

  // взгляд MIRA по сценарию шаблона, пока не спит
  const [st, setSt] = useState<CyberState>('attention');
  useEffect(() => {
    if (!S.open) return;
    let i = 0, tm: ReturnType<typeof setTimeout>;
    const next = () => { const [s, d] = SCENE[i++ % SCENE.length]; setSt(s); tm = setTimeout(next, d * 1000); };
    next();
    return () => clearTimeout(tm);
  }, [S.open]);

  // мои разборы — с сервера (только этого аккаунта), свежие при каждом открытии вкладки
  const [mine, setMine] = useState<Job[] | null>(null);
  const [listErr, setListErr] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await listJobs(signal);
      setMine(list);
      setListErr(undefined);
      // уборка кэша по свежему списку: копии видео законченных разборов и кадры прерванных вступлений
      void cleanupLocalVideos(list);
    } catch (e) {
      if (signal?.aborted) return;
      setListErr(userMessage(e));
      void cleanupLocalVideos(); // нет связи — по тому, что помнит телефон
    }
  }, []);
  // баланс ColdArms Token — с сервера; перечитывается при каждом открытии вкладки (мог вернуться токен за упавший разбор)
  const tok = useTokens();
  const { refresh: refreshTokens } = tok;
  const [topUp, setTopUp] = useState<null | 'plus' | 'start'>(null);
  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      load(ac.signal);
      void refreshTokens(ac.signal);
      return () => ac.abort();
    }, [load, refreshTokens]),
  );
  // новый разбор: сначала стиль борьбы и манера (MIRA учитывает их в тактике), потом токен (не хватает — пополнение),
  // потом уровень разбора (шторка: быстрый / средний / продвинутый и сколько ждать сейчас)
  const [styleGate, setStyleGate] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const draft = useAnalysisDraft();
  const pickVideo = usePickVideo();
  const afterStyle = () => {
    if (tok.data && tok.data.balance < tok.data.cost) setTopUp('start');
    else setTierOpen(true);
  };
  // быстрый — сразу к видео (окно разбора ему не нужно); продвинутый — через экран окна разбора и очереди
  const onTier = (t: Tier) => {
    setTierOpen(false);
    draft.setAnswer('tier', t);
    if (t === 'fast') pickVideo();
    else router.push('/mira/schedule');
  };
  const startNew = async () => {
    const s = await getStrength().catch(() => null);
    if (s && !styleReady(s.body)) setStyleGate(true);
    else afterStyle();
  };
  const askRemove = (j: Job) =>
    Alert.alert(
      'Удалить разбор?',
      'Видео и всё, что MIRA по нему насчитала, будут стёрты с сервера. Отменить это нельзя.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setRemoving(j.id);
            try {
              await deleteJob(j.id);
              setMine((x) => (x ?? []).filter((y) => y.id !== j.id));
            } catch (e) {
              setListErr(userMessage(e));
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );

  return (
    <GlassHeaderScreen>
      {(top) => (
        <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + space.gutter }]}
        scrollIndicatorInsets={{ top }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        refreshControl={
          <RefreshControl progressViewOffset={top} refreshing={refreshing} tintColor={colors.text}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(), refreshTokens()]);
              setRefreshing(false);
            }} />
        }>
        <Text style={styles.title}>Разбор поединка</Text>

        {/* визор MIRA: вне окна разбора (21:00–06:00 МСК) спит */}
        {cw > 0 ? (
          <View style={{ height: 206 * (cw / 390) }}>
            <View style={{ position: 'absolute', left: 0, top: -30 * (cw / 390) }}>
              <MiraHud state={S.open ? st : 'idle'} width={cw} sleep={!S.open}
                statusText={S.open ? 'на связи' : 'спит до 21:00 МСК'} statusColor={S.open ? DUSK.attention : mira.dim} />
            </View>
          </View>
        ) : null}

        {/* баланс токенов и пополнение */}
        <View style={styles.card}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardEyebrow}>Баланс</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balance}>{tok.data?.balance ?? '—'}</Text>
              <Text style={styles.balanceUnit}>ColdArms Token</Text>
            </View>
            <Text style={styles.note}>
              {`Разбор — ${tok.data?.cost ?? 1} ${tokensWord(tok.data?.cost ?? 1)}, списывается при постановке в очередь`}
            </Text>
          </View>
          <Pressable onPress={() => setTopUp('plus')} accessibilityLabel="Пополнить токены" hitSlop={6}
            style={({ pressed }) => [styles.plus, pressed && { backgroundColor: SEA.seaPressed }]}>
            <Plus size={22} color={SEA.onSea} strokeWidth={2.2} />
          </Pressable>
        </View>

        <Pressable onPress={startNew}
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: SEA.seaPressed }]}>
          <ScanLine size={18} color={SEA.onSea} strokeWidth={2} />
          <Text style={styles.ctaText}>Новый разбор</Text>
        </Pressable>
        <Text style={styles.tip}>
          {S.open ? 'Разбор открыт до 06:00 МСК.' : 'MIRA спит — видео встанет в очередь, разбор с 21:00 МСК.'}
        </Text>

        {listErr ? <Text style={styles.err}>{listErr}</Text> : null}
        {mine === null && !listErr ? <ActivityIndicator color={colors.text} /> : null}
        {mine?.length ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.section}>Мои разборы</Text>
            {mine.map((m) => (
              <View key={m.id} style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  disabled={m.state === 'failed' || m.state === 'cancelled'}
                  onPress={() =>
                    m.state === 'done' ? router.push(`/mira/result/${m.id}`) : router.push(`/mira/session?job=${m.id}`)
                  }>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {m.name?.replace(/\.[^.]+$/, '') || 'Моя схватка'}
                    </Text>
                    <Text style={[styles.rowSub, m.state === 'needs_input' && { color: SEA.pink }]}>
                      {m.created ? new Date(m.created * 1000).toLocaleDateString('ru-RU') + ' · ' : ''}
                      {stateLabel(m.state, m.stage)}
                    </Text>
                  </View>
                  {m.state === 'failed' || m.state === 'cancelled' ? null : (
                    <ArrowUpRight size={18} color={colors.textMuted} strokeWidth={1.6} />
                  )}
                </Pressable>
                {/* удалить — с подтверждением (стирается навсегда) */}
                <Pressable onPress={() => askRemove(m)} hitSlop={10} disabled={removing === m.id}
                  accessibilityLabel="Удалить разбор" style={styles.trash}>
                  {removing === m.id ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <Trash2 size={18} color={colors.textMuted} strokeWidth={1.6} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        ) : mine ? (
          <Text style={styles.empty}>Разборов пока нет — загрузи видео своей схватки.</Text>
        ) : null}

        {active ? (
          <Pressable onPress={() => router.push('/plan/track')}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardEyebrow}>План тренировок · идёт</Text>
                <Text style={styles.rowTitle}>Неделя {currentWeek(active) + 1} из {active.plan.weeks.length}</Text>
              </View>
              <ArrowUpRight size={18} color={colors.textMuted} strokeWidth={1.6} />
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
      <ProfileGate visible={styleGate} need="style" onClose={() => setStyleGate(false)}
        onDone={() => { setStyleGate(false); afterStyle(); }} />
      <TopUpSheet visible={topUp !== null} onClose={() => setTopUp(null)} accent={SEA.sea} onAccent={SEA.onSea}
        reason={topUp === 'start' ? 'Для нового разбора нужен 1 токен.' : undefined}
        onBought={() => topUp === 'start' && setTierOpen(true)} />
      <TierSheet visible={tierOpen} onClose={() => setTierOpen(false)} onPick={onTier} />
        </>
      )}
    </GlassHeaderScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, textTransform: 'uppercase', color: colors.text },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  trash: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  err: { fontFamily: mira.font, fontSize: 13, color: mira.red },
  content: { padding: space.gutter, paddingBottom: 120, gap: space.gap },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18,
    backgroundColor: '#121214', borderWidth: 1, borderColor: '#232327',
  },
  cardEyebrow: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: SEA.lavender },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balance: { fontFamily: mira.display, fontSize: 34, color: mira.text },
  balanceUnit: { fontFamily: mira.fontSemi, fontSize: 13, color: SEA.mist },
  note: { fontFamily: mira.font, fontSize: 12, color: mira.muted },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: SEA.sea },
  cta: {
    height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: SEA.sea,
  },
  ctaText: { fontFamily: mira.display, fontSize: 19, letterSpacing: 0.6, textTransform: 'uppercase', color: SEA.onSea },
  tip: { fontFamily: mira.font, fontSize: 12, color: mira.muted, textAlign: 'center', marginTop: -10 },
  section: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  rowTitle: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  empty: { fontFamily: mira.font, fontSize: 13, color: mira.muted },
});
