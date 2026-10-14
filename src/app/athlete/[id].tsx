import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, ChevronLeft } from 'lucide-react-native';
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

import { loadAthletePage, recentForm, setFavorite, winPct, type AthletePage } from '@/api/athlete';
import { isElite } from '@/api/athletes';
import { ageOf, wrestlerPhotoUrl, type Hand } from '@/api/fight';
import { AthleteAnalytics, type AnalyticsCat } from '@/components/athlete/analytics';
import { AthleteFights } from '@/components/athlete/fights';
import { AthleteOverview } from '@/components/athlete/overview';
import { fc } from '@/components/fight/palette';
import { useAsync } from '@/hooks/use-async';
import { countryName, flagOf } from '@/lib/countries';
import { initialsOf, plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

type Tab = 'overview' | 'fights' | 'analytics';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'fights', label: 'Бои' },
  { key: 'analytics', label: 'Аналитика' },
];

/** Страница атлета: профиль, руки, история боёв и аналитика — как /athlete/{slug}/{id} на сайте. */
export default function AthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => loadAthletePage(id), [id]);
  const { data, error, loading, refresh } = useAsync(load);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {data ? (
        <Athlete page={data} />
      ) : (
        <>
          <TopBar />
          <View style={styles.center}>
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : error ? (
              <>
                <Text style={styles.muted}>Не удалось загрузить атлета</Text>
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

function Athlete({ page }: { page: AthletePage }) {
  const a = page.athlete;
  const s = page.stats;
  const [tab, setTab] = useState<Tab>('overview');
  const [hand, setHand] = useState<Hand>(() => ((s?.leftArmWins ?? 0) + (s?.leftArmLosses ?? 0) > (s?.rightArmWins ?? 0) + (s?.rightArmLosses ?? 0) ? 'Left' : 'Right'));
  const [cat, setCat] = useState<AnalyticsCat>('grips');
  const [fav, setFav] = useState(page.isFavorite);
  const [collapsed, setCollapsed] = useState(false);
  const scroll = useRef<ScrollView>(null);
  // Вкладка не короче экрана: при переключении на короткую вкладки остаются прилипшими сверху.
  const minContent = useWindowDimensions().height - 52 - 46;
  const heroHeight = useRef(0);
  const scrollY = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    const c = y > heroHeight.current - 24;
    if (c !== collapsed) setCollapsed(c);
  };
  const go = (t: Tab) => {
    setTab(t);
    if (scrollY.current > heroHeight.current) scroll.current?.scrollTo({ y: heroHeight.current, animated: false });
  };

  const toggleFav = async () => {
    const next = !fav;
    setFav(next);
    if (!(await setFavorite(a.armWrestlerId, next).catch(() => false))) setFav(!next);
  };

  const full = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();

  return (
    <>
      <TopBar
        title={collapsed ? full : null}
        onTitle={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        fav={fav}
        onFav={toggleFav}
      />
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.scroll}>
        <View onLayout={(e) => (heroHeight.current = e.nativeEvent.layout.height)}>
          <Hero page={page} />
        </View>
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
          {tab === 'overview' ? <AthleteOverview page={page} /> : null}
          {tab === 'fights' ? <AthleteFights stats={s} hand={hand} onHand={setHand} /> : null}
          {tab === 'analytics' ? <AthleteAnalytics athlete={a} stats={s} cat={cat} onCat={setCat} /> : null}
        </View>
      </ScrollView>
    </>
  );
}

function TopBar({
  title,
  onTitle,
  fav,
  onFav,
}: {
  title?: string | null;
  onTitle?: () => void;
  fav?: boolean;
  onFav?: () => void;
}) {
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
            {title}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.barTitle}>
          <View style={styles.logoBar} />
          <Text style={styles.logo}>Cold Arms</Text>
          <Text style={styles.logoCom}>.COM</Text>
        </View>
      )}
      {onFav ? (
        <Pressable onPress={onFav} hitSlop={10} style={styles.fav} accessibilityLabel={fav ? 'Убрать из избранного' : 'В избранное'}>
          <Bookmark size={20} color={colors.text} fill={fav ? colors.text : 'transparent'} strokeWidth={1.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Hero({ page }: { page: AthletePage }) {
  const a = page.athlete;
  const s = page.stats;
  const [failed, setFailed] = useState(false);
  const rW = s?.rightArmWins ?? a.rArmWins;
  const rL = s?.rightArmLosses ?? a.rArmLosses;
  const lW = s?.leftArmWins ?? a.lArmWins;
  const lL = s?.leftArmLosses ?? a.lArmLosses;
  const w = rW + lW;
  const l = rL + lL;
  const form = recentForm(s, 5);
  const age = ageOf(a.birthDate);
  const meta = [a.country ? `${flagOf(a.country)} ${countryName(a.country)}` : null, age ? `${age} ${plural(age, ['год', 'года', 'лет'])}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <View style={styles.photo}>
        <Text style={styles.photoInitials}>{initialsOf(`${a.firstName ?? ''} ${a.lastName ?? ''}`)}</Text>
        {a.photoPath && !failed ? (
          <Image
            source={wrestlerPhotoUrl(a.armWrestlerId)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={200}
            onError={() => setFailed(true)}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(11,11,12,0)', 'rgba(11,11,12,0.6)', colors.bg]}
          locations={[0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroText}>
          {a.nickName?.trim() ? <Text style={styles.nick}>{a.nickName.trim()}</Text> : null}
          <Text style={styles.first}>{a.firstName}</Text>
          <Text style={styles.last}>{a.lastName}</Text>
          <View style={styles.metaRow}>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {isElite(a) ? <Text style={styles.elite}>Elite</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.heroBody}>
        <View style={styles.kpis}>
          <Kpi value={`${winPct(w, l)}%`} label="Win Rate" />
          <Kpi value={String(w + l)} label={plural(w + l, ['бой', 'боя', 'боёв'])} />
          <Kpi value={`${w} · ${l}`} label="Победы · L" />
        </View>
        {form.length ? (
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Последние {form.length}</Text>
            <View style={styles.formChips}>
              {form.map((r, i) => (
                <View key={i} style={[styles.chip, r === 'W' ? styles.chipW : styles.chipL]}>
                  <Text style={[styles.chipText, { color: r === 'W' ? colors.lightText : colors.accent }]}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.arms}>
          <ArmCard title="Правая рука" w={rW} l={rL} color="#4AC87C" />
          <ArmCard title="Левая рука" w={lW} l={lL} color="#4AADC8" />
        </View>
      </View>
    </View>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function ArmCard({ title, w, l, color }: { title: string; w: number; l: number; color: string }) {
  const pct = winPct(w, l);
  return (
    <View style={styles.arm}>
      <View style={styles.armHead}>
        <View style={[styles.armDot, { backgroundColor: color }]} />
        <Text style={styles.armTitle}>{title}</Text>
      </View>
      <Text style={styles.armPct}>{w + l ? `${pct}%` : '—'}</Text>
      <Text style={styles.armRec}>
        {w} W — {l} L
      </Text>
      <View style={styles.armTrack}>
        <View style={[styles.armFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
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
    paddingRight: 12,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  barTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { flexShrink: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  logoBar: { width: 3, height: 22, borderRadius: 1, backgroundColor: colors.accent },
  logo: { fontFamily: fonts.display, fontSize: 21, textTransform: 'uppercase', color: colors.text },
  logoCom: { fontFamily: fonts.bodyMedium, fontSize: 10, color: fc.dim, marginTop: 6, marginLeft: -4 },
  fav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  photo: { height: 360, backgroundColor: '#141416', alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontFamily: fonts.display, fontSize: 48, color: fc.dim },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 12 },
  nick: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.accent },
  first: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, textTransform: 'uppercase', color: colors.text, marginTop: 4 },
  last: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, textTransform: 'uppercase', color: '#B9BAC0' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  elite: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#E8B931',
    backgroundColor: 'rgba(232,185,49,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232,185,49,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  heroBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  kpis: { flexDirection: 'row', gap: 6 },
  kpi: { flex: 1, backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.control, padding: 12 },
  kpiValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  kpiLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.muted, marginTop: 2 },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  formChips: { flexDirection: 'row', gap: 4 },
  chip: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chipW: { backgroundColor: colors.light },
  chipL: { borderWidth: 1, borderColor: 'rgba(229,53,43,0.5)' },
  chipText: { fontFamily: fonts.display, fontSize: 13 },
  arms: { flexDirection: 'row', gap: 6 },
  arm: { flex: 1, backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 14 },
  armHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  armDot: { width: 7, height: 7, borderRadius: 4 },
  armTitle: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: fc.muted },
  armPct: { fontFamily: fonts.display, fontSize: 30, color: colors.text, marginTop: 6 },
  armRec: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.soft },
  armTrack: { height: 4, borderRadius: 2, backgroundColor: fc.track, overflow: 'hidden', marginTop: 10 },
  armFill: { height: '100%', borderRadius: 2 },
  tabsWrap: { backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  tab: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: fc.muted },
  tabTextOn: { fontFamily: fonts.bodySemi, color: colors.text },
  tabBar: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 2, borderRadius: 1 },
  tabBarOn: { backgroundColor: colors.accent },
});
