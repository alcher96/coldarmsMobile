import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isUpcoming, thumbnailUrl } from '@/api/competitions';
import { loadFightPage, loadStatsAsOf, type FightPage, type Hand, type Wrestler } from '@/api/fight';
import { Compare, type CompareState } from '@/components/fight/compare';
import { FighterSheet } from '@/components/fight/fighter-sheet';
import { History } from '@/components/fight/history';
import { InfoSheet, type Info } from '@/components/fight/info-sheet';
import { bestOfLabel, handLabel, sides, type Side } from '@/components/fight/model';
import { Overview } from '@/components/fight/overview';
import { fc } from '@/components/fight/palette';
import { StylesTab } from '@/components/fight/styles-tab';
import { useAsync } from '@/hooks/use-async';
import { useCountdown } from '@/hooks/use-countdown';
import { initialsOf, plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

type Tab = 'overview' | 'compare' | 'styles' | 'history';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'compare', label: 'Сравнение' },
  { key: 'styles', label: 'Стили' },
  { key: 'history', label: 'История' },
];

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const shortDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : null;
};

/** Экран боя (Fight Center): прогноз M.I.R.A., сравнение бойцов, стили, история, голоса и обсуждение. */
export default function FightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => loadFightPage(id), [id]);
  const { data, error, loading, refresh } = useAsync(load);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {data ? (
        <Fight data={data} />
      ) : (
        <>
          <TopBar />
          <View style={styles.center}>
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : error ? (
              <>
                <Text style={styles.muted}>Не удалось загрузить бой</Text>
                <Pressable onPress={refresh} style={styles.retry}>
                  <Text style={styles.retryText}>Повторить</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Fight({ data }: { data: FightPage }) {
  const [a, b] = sides(data);
  const fightHand: Hand = data.fight.hand === 'Left' ? 'Left' : 'Right';
  const finished = !!data.fight.winnerName && data.fight.winnerName !== 'Draw';
  const [tab, setTab] = useState<Tab>('overview');
  const [cmp, setCmp] = useState<CompareState>({
    hand: fightHand,
    cat: 'form',
    expert: false,
    gripMode: 'win',
    asOf: false,
  });
  const [info, setInfo] = useState<Info | null>(null);
  const [fighter, setFighter] = useState<1 | 2 | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const scroll = useRef<ScrollView>(null);
  // Вкладка не короче экрана: при переключении на короткую вкладки остаются прилипшими сверху.
  const minContent = useWindowDimensions().height - 52 - 46;
  const heroHeight = useRef(0);
  const scrollY = useRef(0);

  // Статистика «на момент боя» грузится, только когда её выбрали.
  const competitionDate = data.competition?.competitionDate ?? null;
  const loadAsOf = useCallback(
    () => (cmp.asOf && competitionDate ? loadStatsAsOf(data.fight, competitionDate) : Promise.resolve(null)),
    [cmp.asOf, competitionDate, data.fight],
  );
  const asOfStats = useAsync(loadAsOf).data;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    const c = y > heroHeight.current - 24;
    if (c !== collapsed) setCollapsed(c);
  };

  // При смене вкладки не бросаем пользователя в середину новой: вкладки остаются под шапкой.
  const go = (t: Tab) => {
    setTab(t);
    if (scrollY.current > heroHeight.current) scroll.current?.scrollTo({ y: heroHeight.current, animated: false });
  };

  const score = finished ? `${data.w1Score}–${data.w2Score}` : null;

  return (
    <>
      <TopBar
        title={collapsed ? [a.last, b.last] : null}
        mid={score}
        onTitle={() => scroll.current?.scrollTo({ y: 0, animated: true })}
      />
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.scroll}>
        <View onLayout={(e) => (heroHeight.current = e.nativeEvent.layout.height)}>
          <Hero data={data} a={a} b={b} onFighter={setFighter} />
        </View>
        {/* Прилипающий элемент ScrollView оборачивается в свой контейнер — ряд задаём во внутреннем View. */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => go(t.key)}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}>
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                  <View style={[styles.tabBar, on && styles.tabBarOn]} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ minHeight: minContent }}>
          {tab === 'overview' ? (
            <Overview
              data={data}
              a={a}
              b={b}
              onInfo={setInfo}
              onStyles={() => go('styles')}
              onCompareForm={() => {
                setCmp((s) => ({ ...s, cat: 'form', hand: fightHand }));
                go('compare');
              }}
            />
          ) : tab === 'compare' ? (
            <Compare
              data={data}
              a={a}
              b={b}
              state={cmp}
              onChange={(patch) =>
                setCmp((s) => {
                  const next = { ...s, ...patch };
                  // Выключили «Эксперт» на экспертном разделе — возвращаемся к форме.
                  if (patch.expert === false && !['form', 'grips', 'phys'].includes(next.cat)) next.cat = 'form';
                  return next;
                })
              }
              asOfStats={asOfStats}
              finished={finished}
              onInfo={setInfo}
            />
          ) : tab === 'styles' ? (
            <StylesTab data={data} a={a} b={b} onInfo={setInfo} />
          ) : (
            <History data={data} a={a} b={b} onInfo={setInfo} />
          )}
        </View>
      </ScrollView>
      <InfoSheet info={info} onClose={() => setInfo(null)} />
      <FighterSheet
        side={fighter === 1 ? a : fighter === 2 ? b : null}
        wrestler={fighter === 1 ? data.wrestler1 : fighter === 2 ? data.wrestler2 : null}
        onClose={() => setFighter(null)}
      />
    </>
  );
}

/** Верхняя строка: назад + логотип; при прокрутке логотип сменяется на «Боец VS Боец» (или счёт). */
function TopBar({ title, mid, onTitle }: { title?: [string, string] | null; mid?: string | null; onTitle?: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={styles.back}
        accessibilityLabel="Назад">
        <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
      </Pressable>
      {title ? (
        <Pressable onPress={onTitle} style={styles.barTitle} accessibilityLabel="Наверх">
          <Text style={styles.barName} numberOfLines={1}>
            {title[0]}
          </Text>
          <Text style={styles.barVs}>{mid ?? 'VS'}</Text>
          <Text style={styles.barName} numberOfLines={1}>
            {title[1]}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.barTitle}>
          <View style={styles.logoBar} />
          <Text style={styles.logo}>Cold Arms</Text>
          <Text style={styles.logoCom}>.COM</Text>
        </View>
      )}
    </View>
  );
}

function Hero({ data, a, b, onFighter }: { data: FightPage; a: Side; b: Side; onFighter: (n: 1 | 2) => void }) {
  const { fight, competition, mira } = data;
  const finished = !!fight.winnerName && fight.winnerName !== 'Draw';
  const dateIso = competition?.competitionDate ?? null;
  const target = dateIso ? new Date(dateIso) : null;
  const left = useCountdown(target, 60_000);
  const winner = finished ? (fight.winnerName === fight.wrestler1Name ? 1 : 2) : 0;
  // До боя серым — аутсайдер по M.I.R.A., после — проигравший.
  const dimA = winner ? winner === 2 : !!mira && mira.w1Pct < mira.w2Pct;
  const dimB = winner ? winner === 1 : !!mira && mira.w2Pct < mira.w1Pct;

  let status: string | null = null;
  if (finished) status = 'Завершён';
  else if (left && left.days > 0) status = `через ${left.days} ${plural(left.days, ['день', 'дня', 'дней'])}`;
  else if (left) status = `через ${left.hours} ч ${left.minutes} мин`;
  else if (competition && isUpcoming(competition)) status = 'сегодня';

  const chips = [dateIso ? shortDate(dateIso) : null, handLabel(fight.hand), bestOfLabel(fight.bestOf)].filter(
    Boolean,
  ) as string[];

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={styles.event} numberOfLines={1}>
          {competition?.competitionName ?? ''}
        </Text>
        {status ? (
          <View style={styles.status}>
            <View style={[styles.statusDot, finished && { backgroundColor: fc.dim }]} />
            <Text style={[styles.statusText, finished && { color: fc.second }]}>{status}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.names}>
        <FighterHead side={a} w={data.wrestler1} dim={dimA} onPress={() => onFighter(1)} />
        <View style={styles.vsCol}>
          {finished ? (
            <Text style={styles.score}>
              {data.w1Score}
              <Text style={styles.scoreDash}>–</Text>
              <Text style={{ color: fc.muted }}>{data.w2Score}</Text>
            </Text>
          ) : (
            <Text style={styles.vs}>VS</Text>
          )}
        </View>
        <FighterHead side={b} w={data.wrestler2} dim={dimB} right onPress={() => onFighter(2)} />
      </View>
      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <Text key={c} style={styles.chip}>
              {c}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Боец в шапке: круглое фото, имя с кодом страны, фамилия крупно; тап — карточка бойца. */
function FighterHead({
  side,
  w,
  dim,
  right,
  onPress,
}: {
  side: Side;
  w: Wrestler | null;
  dim: boolean;
  right?: boolean;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const avatar = (
    <View style={[styles.avatar, { borderColor: dim ? fc.dim : colors.text }]}>
      <Text style={styles.avatarText}>{initialsOf(side.full)}</Text>
      {w?.thumbnailPath && !failed ? (
        <Image
          source={thumbnailUrl(side.id)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
  const code = w?.country ? <Text style={styles.code}>{w.country}</Text> : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fighter, right && styles.fighterRight, pressed && styles.pressed]}
      accessibilityLabel={`Карточка бойца ${side.full}`}>
      {!right ? avatar : null}
      <View style={[styles.fighterText, right && styles.alignRight]}>
        <View style={styles.firstRow}>
          {right ? code : null}
          <Text style={styles.first} numberOfLines={1}>
            {side.first}
          </Text>
          {!right ? code : null}
        </View>
        <Text
          style={[styles.last, right && styles.textRight, dim && styles.lastDim]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {side.last}
        </Text>
      </View>
      {right ? avatar : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  scroll: { paddingBottom: 24 },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 20,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  barTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { flexShrink: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  barVs: { fontFamily: fonts.display, fontSize: 15, color: colors.accent },
  logoBar: { width: 3, height: 22, borderRadius: 1, backgroundColor: colors.accent },
  logo: { fontFamily: fonts.display, fontSize: 21, textTransform: 'uppercase', color: colors.text },
  logoCom: { fontFamily: fonts.bodyMedium, fontSize: 10, color: fc.dim, marginTop: 6, marginLeft: -4 },
  hero: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
  event: { flexShrink: 1, fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: fc.second },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  statusText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.coral },
  names: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  fighter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4, borderRadius: radii.control },
  fighterRight: { justifyContent: 'flex-end' },
  pressed: { backgroundColor: fc.card },
  fighterText: { flexShrink: 1 },
  alignRight: { alignItems: 'flex-end' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: fc.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  firstRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  first: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.second },
  code: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: fc.soft,
    backgroundColor: fc.border,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  last: { fontFamily: fonts.display, fontSize: 21, lineHeight: 22, textTransform: 'uppercase', color: colors.text },
  lastDim: { color: '#B9BAC0' },
  textRight: { textAlign: 'right' },
  vsCol: { minWidth: 34, alignItems: 'center' },
  score: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  scoreDash: { color: colors.accent },
  vs: { fontFamily: fonts.display, fontSize: 16, color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingHorizontal: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.small,
    overflow: 'hidden',
    backgroundColor: '#17171A',
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: fc.soft,
  },
  tabsWrap: { backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  tab: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: fc.muted },
  tabTextOn: { fontFamily: fonts.bodySemi, color: colors.text },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: 0, height: 2, borderRadius: 1 },
  tabBarOn: { backgroundColor: colors.accent },
});
