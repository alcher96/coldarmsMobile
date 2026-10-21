import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Achievement, Activity, CompStat, Favorite, ProfilePage } from '@/api/profile';
import { fc } from '@/components/fight/palette';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { flagOf } from '@/lib/countries';
import { timeAgo } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

const CATS: [string, string][] = [
  ['all', 'Все'],
  ['activity', 'Активность'],
  ['predictions', 'Прогнозы'],
  ['community', 'Сообщество'],
  ['special', 'Особые'],
];

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** API отдаёт время без пояса, но это UTC. */
const utc = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
const monthYear = (iso: string) => {
  const d = utc(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const winRateColor = (wr: number) => (wr >= 75 ? '#4AC87C' : wr >= 50 ? colors.text : colors.accent);

/** Обзор профиля: достижения, точность прогнозов по турнирам, активность, отслеживаемые атлеты. */
export function ProfileOverview({ page, onAllFavorites }: { page: ProfilePage; onAllFavorites: () => void }) {
  return (
    <View style={styles.list}>
      <Achievements items={page.achievements} />
      <CompStats items={page.compStats} />
      <ActivityFeed items={page.activity} />
      <Section title="Отслеживаемые атлеты" count={page.favorites.length}>
        {page.favorites.length === 0 ? (
          <Empty text="Нажмите «Отслеживать» на странице атлета — здесь появятся его бои и результаты" />
        ) : (
          <>
            {page.favorites.slice(0, 4).map((f) => (
              <FavoriteRow key={f.armWrestlerId} f={f} />
            ))}
            {page.favorites.length > 4 ? (
              <Pressable onPress={onAllFavorites} style={styles.more}>
                <Text style={styles.moreText}>Все {page.favorites.length} →</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Section>
    </View>
  );
}

export function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {count != null ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export const Empty = ({ text }: { text: string }) => <Text style={styles.empty}>{text}</Text>;

export function Achievements({ items }: { items: Achievement[] }) {
  const [cat, setCat] = useState('all');
  const sorted = items
    .slice()
    .sort((a, b) => (a.unlocked !== b.unlocked ? (a.unlocked ? -1 : 1) : a.title.localeCompare(b.title)));
  const shown = sorted.filter((a) => cat === 'all' || a.category === cat);
  const unlocked = items.filter((a) => a.unlocked).length;
  return (
    <Section title="Достижения" count={`${unlocked} / ${items.length}`}>
      {items.length === 0 ? (
        <Empty text="Достижений пока нет" />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
            {CATS.map(([k, l]) => (
              <Pressable key={k} onPress={() => setCat(k)} style={[styles.chip, cat === k && styles.chipOn]}>
                <Text style={[styles.chipText, cat === k && styles.chipTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.grid}>
            {shown.map((a) => (
              <View key={a.key} style={[styles.ach, !a.unlocked && styles.achLocked]}>
                <Text style={styles.achIcon}>{a.icon}</Text>
                <Text style={[styles.achName, a.unlocked && a.color ? { color: a.color } : null]} numberOfLines={2}>
                  {a.title}
                </Text>
                <Text style={styles.achDesc} numberOfLines={3}>
                  {a.description}
                </Text>
                {a.unlocked && a.unlockedAt ? <Text style={styles.achDate}>{monthYear(a.unlockedAt)}</Text> : null}
              </View>
            ))}
          </View>
        </>
      )}
    </Section>
  );
}

export function CompStats({ items }: { items: CompStat[] }) {
  return (
    <Section title="Точность прогнозов" count={items.length}>
      {items.length === 0 ? (
        <Empty text="Сделайте прогноз на бой — здесь появится, как вы угадываете против M.I.R.A." />
      ) : (
        items.map((s) => (
          <View key={s.competitionName} style={styles.stat}>
            <View style={styles.statHead}>
              <Text style={styles.statName} numberOfLines={1}>
                {s.competitionName}
              </Text>
              <Text style={styles.statMeta}>
                {s.userPredicted} из {s.totalFights}
              </Text>
            </View>
            {[
              ['Вы', s.accuracy, colors.text],
              ['M.I.R.A.', s.miraAccuracy, '#6366F1'],
            ].map(([label, v, color]) => (
              <View key={label as string} style={styles.bar}>
                <Text style={styles.barLabel}>{label}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Number(v) || 0}%`, backgroundColor: color as string }]} />
                </View>
                <Text style={styles.barValue}>{Math.round(Number(v) || 0)}%</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </Section>
  );
}

function activityBadge(a: Activity) {
  if (a.result === 'correct') return { text: 'Угадал', good: true };
  if (a.result === 'wrong') return { text: 'Не угадал', good: false };
  if (a.status === 'accepted') return { text: 'Принята', good: true };
  if (a.status === 'rejected') return { text: 'Отклонена', good: false };
  return null;
}
const typeLabel = (t: string) => (t === 'prediction' ? 'Прогноз' : t === 'comment' ? 'Комментарий' : 'Правка');

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <Section title="Активность" count={items.length}>
      {items.length === 0 ? (
        <Empty text="Здесь будут ваши прогнозы, комментарии и правки" />
      ) : (
        items.slice(0, 10).map((a, i) => {
          const b = activityBadge(a);
          return (
            <View key={i} style={[styles.act, i > 0 && styles.actBorder]}>
              <View style={styles.flex}>
                <Text style={styles.actType}>
                  {typeLabel(a.type)} · <Text style={styles.actDate}>{timeAgo(utc(a.date).toISOString())}</Text>
                </Text>
                {a.target ? <Text style={styles.actTarget}>{a.target}</Text> : null}
                {a.detail ? (
                  <Text style={styles.actDetail} numberOfLines={3}>
                    {a.detail}
                  </Text>
                ) : null}
              </View>
              {b ? <Text style={[styles.badge, b.good ? styles.badgeGood : styles.badgeBad]}>{b.text}</Text> : null}
            </View>
          );
        })
      )}
    </Section>
  );
}

export function FavoriteRow({ f, right }: { f: Favorite; right?: React.ReactNode }) {
  const name = `${f.firstName} ${f.lastName}`.trim();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: f.armWrestlerId } })}
      style={({ pressed }) => [styles.fav, pressed && styles.pressed]}>
      <FighterAvatar id={f.armWrestlerId} name={name} size={40} round />
      <View style={styles.flex}>
        <Text style={styles.favName} numberOfLines={1}>
          {name}
        </Text>
        {f.country ? (
          <Text style={styles.favMeta}>
            {flagOf(f.country)} {f.country}
          </Text>
        ) : null}
      </View>
      <View style={styles.favRight}>
        <Text style={[styles.favRate, { color: winRateColor(f.winRate) }]}>{Math.round(f.winRate)}%</Text>
        <Text style={styles.favRateLabel}>WIN RATE</Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  card: { backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  count: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  empty: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.muted, marginTop: 8 },
  chipsScroll: { marginHorizontal: -16, marginTop: 8 },
  chips: { gap: 6, paddingHorizontal: 16 },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: fc.border,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: fc.coralBg },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.soft },
  chipTextOn: { color: fc.coral },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  ach: { width: '48.8%', flexGrow: 1, backgroundColor: fc.chip, borderRadius: radii.control, padding: 12, gap: 3 },
  achLocked: { opacity: 0.4 },
  achIcon: { fontSize: 24 },
  achName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginTop: 4 },
  achDesc: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: fc.muted },
  achDate: { fontFamily: fonts.bodyMedium, fontSize: 10, color: fc.dim, marginTop: 2 },
  stat: { marginTop: 12 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  statName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  statMeta: { fontFamily: fonts.body, fontSize: 11, color: fc.muted },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  barLabel: { width: 58, fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.second },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: fc.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  barValue: { width: 38, textAlign: 'right', fontFamily: fonts.display, fontSize: 14, color: colors.text },
  act: { flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'flex-start' },
  actBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fc.line },
  actType: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.soft },
  actDate: { fontFamily: fonts.body, color: fc.dim },
  actTarget: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, marginTop: 2 },
  actDetail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, fontStyle: 'italic', color: fc.muted, marginTop: 2 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgeGood: { backgroundColor: 'rgba(61,190,122,0.14)', color: '#5FD99A' },
  badgeBad: { backgroundColor: fc.coralBg, color: fc.coral },
  fav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  pressed: { opacity: 0.7 },
  favName: { fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
  favMeta: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 1 },
  favRight: { alignItems: 'flex-end' },
  favRate: { fontFamily: fonts.display, fontSize: 18 },
  favRateLabel: { fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 0.6, color: fc.dim },
  more: { height: 40, justifyContent: 'center' },
  moreText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.coral },
});
