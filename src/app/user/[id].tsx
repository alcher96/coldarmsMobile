import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadPublicProfile, userAvatarUrl, type PublicProfile } from '@/api/search';
import { fc } from '@/components/fight/palette';
import { Achievements, ActivityFeed, CompStats, Empty, FavoriteRow, Section } from '@/components/profile/overview';
import { useAsync } from '@/hooks/use-async';
import { countryName, flagOf } from '@/lib/countries';
import { initialsOf } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

type Tab = 'overview' | 'subs';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const since = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Публичный профиль пользователя — как /user/{id} на сайте; скрытые им разделы показываем заглушкой. */
export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => loadPublicProfile(id), [id]);
  const { data, error, loading, refresh } = useAsync(load);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.back}
          accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {data?.nickname ?? 'Профиль'}
        </Text>
      </View>
      {data ? (
        <Content p={data} />
      ) : (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : error ? (
            <>
              <Text style={styles.muted}>Пользователь не найден</Text>
              <Pressable onPress={refresh} style={styles.retry}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function Content({ p }: { p: PublicProfile }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [failed, setFailed] = useState(false);
  const avatar = userAvatarUrl(p.avatarUrl);
  const s = p.stats;
  const kpis: { label: string; value: string; sub: string; color?: string }[] = [
    {
      label: 'Точность',
      value: s.accuracy != null ? `${s.accuracy}%` : '—',
      sub: `${s.correctPredictions} из ${s.totalPredictions}`,
      color: s.accuracy != null && s.accuracy > 59 ? '#4AC87C' : undefined,
    },
    { label: 'Прогнозов', value: String(s.totalPredictions), sub: 'на бои' },
    { label: 'Комментариев', value: String(s.totalComments), sub: 'к боям' },
    { label: 'Правок', value: String(s.correctionsAccepted), sub: 'принято', color: '#4AADC8' },
  ];
  const month = since(p.memberSince);

  return (
    <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(p.nickname)}</Text>
          {avatar && !failed ? (
            <Image source={avatar} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(true)} />
          ) : null}
        </View>
        <Text style={styles.nick}>{p.nickname}</Text>
        <View style={styles.metaRow}>
          {p.country ? (
            <Text style={styles.meta}>
              {flagOf(p.country)} {countryName(p.country)}
            </Text>
          ) : null}
          {month ? <Text style={styles.meta}>на сайте с {month}</Text> : null}
        </View>
        {p.bio?.trim() ? <Text style={styles.bio}>{p.bio.trim()}</Text> : null}
        <View style={styles.kpis}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={[styles.kpiValue, k.color ? { color: k.color } : null]}>{k.value}</Text>
              <Text style={styles.kpiSub}>{k.sub}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {(
            [
              ['overview', 'Обзор'],
              ['subs', `Подписки · ${p.favorites.length}`],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} accessibilityRole="tab">
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
              <View style={[styles.tabBar, tab === key && styles.tabBarOn]} />
            </Pressable>
          ))}
        </View>
      </View>
      {tab === 'overview' ? (
        <View style={styles.list}>
          {p.achievements ? <Achievements items={p.achievements} /> : <Hidden title="Достижения" />}
          {p.compStats ? <CompStats items={p.compStats} /> : <Hidden title="Точность прогнозов" />}
          {p.activity ? <ActivityFeed items={p.activity} /> : <Hidden title="Активность" />}
        </View>
      ) : (
        <View style={styles.list}>
          <Section title="Отслеживаемые атлеты" count={p.favorites.length}>
            {p.favorites.length === 0 ? (
              <Empty text="Пользователь пока никого не отслеживает" />
            ) : (
              p.favorites.map((f) => <FavoriteRow key={f.armWrestlerId} f={f} />)
            )}
          </Section>
        </View>
      )}
    </ScrollView>
  );
}

const Hidden = ({ title }: { title: string }) => (
  <Section title={title}>
    <Empty text="Пользователь скрыл этот раздел" />
  </Section>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
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
  barTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  scroll: { paddingBottom: 24 },
  hero: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: fc.chip,
    borderWidth: 2,
    borderColor: fc.borderStrong,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: fc.muted },
  nick: { fontFamily: fonts.display, fontSize: 30, textTransform: 'uppercase', color: colors.text, marginTop: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 4 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.second },
  bio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft, textAlign: 'center', marginTop: 10 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, alignSelf: 'stretch' },
  kpi: {
    width: '48.8%',
    flexGrow: 1,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    padding: 12,
  },
  kpiLabel: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: fc.muted },
  kpiValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginTop: 2 },
  kpiSub: { fontFamily: fonts.body, fontSize: 12, color: fc.dim },
  tabsWrap: { backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  tab: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: fc.muted },
  tabTextOn: { fontFamily: fonts.bodySemi, color: colors.text },
  tabBar: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 2, borderRadius: 1 },
  tabBarOn: { backgroundColor: colors.accent },
  list: { padding: 16, paddingBottom: 28, gap: 10 },
});
