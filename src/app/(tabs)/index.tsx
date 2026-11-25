import { router } from 'expo-router';
import { useState } from 'react';
import { ArrowUpRight, Dumbbell } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadHome } from '@/api/home';
import { GlassHeaderScreen } from '@/components/glass-header-screen';
import { FocusCard } from '@/components/home/focus-card';
import { NextTournament } from '@/components/home/next-tournament';
import { MiraButton } from '@/features/analysis/components/mira-button';
import { useSchedule } from '@/features/analysis/use-schedule';
import { usePlan } from '@/features/plan/store';
import { currentWeek } from '@/features/plan/track';
import { LeadersCard } from '@/features/strength/leaders-card';
import { useAsync } from '@/hooks/use-async';
import { colors, fonts, space, radii } from '@/theme/tokens';
import { userMessage } from '@/lib/user-error';

const load = () => loadHome('ru');

export default function HomeScreen() {
  const { data, error, loading, refreshing, refresh } = useAsync(load);
  const sched = useSchedule();
  const [heroW, setHeroW] = useState(0);
  const { active } = usePlan();   // начатый план тренировок — сразу под «Разбери свой поединок»

  return (
    <GlassHeaderScreen>
      {(top) => (
        <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + space.gutter }]}
        scrollIndicatorInsets={{ top }}
        refreshControl={<RefreshControl progressViewOffset={top} refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
        {loading && <ActivityIndicator color={colors.text} style={styles.loader} />}

        {!data && error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{userMessage(error, 'Не удалось загрузить данные')}</Text>
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {data?.competition && <NextTournament competition={data.competition} mainFight={data.mainFight} />}
        {/* MIRA: глаз запечён в видео (mobile/scripts/bake-mira-button.js в coldarmsAI) → вкладка «Анализ» */}
        {data && (
          <View onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
            {heroW ? <MiraButton width={heroW} open={sched.open} onPress={() => router.navigate('/analysis')} /> : null}
          </View>
        )}
        {data && active ? (
          <Pressable onPress={() => router.push('/plan/track')}
            style={({ pressed }) => [styles.plan, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={styles.planIcon}>
              <Dumbbell size={18} color={colors.text} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.planEyebrow}>План тренировок · идёт</Text>
              <Text style={styles.planTitle}>Неделя {currentWeek(active) + 1} из {active.plan.weeks.length}</Text>
            </View>
            <ArrowUpRight size={18} color={colors.textMuted} strokeWidth={1.6} />
          </Pressable>
        ) : null}
        {/* силовые: таблицы, где сменился лидер (вместо технического рейтинга) */}
        {data && <LeadersCard />}
        {data?.news[0] && <FocusCard news={data.news[0]} />}
      </ScrollView>
        </>
      )}
    </GlassHeaderScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.gutter, gap: space.gap, paddingBottom: 32 },
  loader: { marginTop: 24 },
  error: { alignItems: 'center', gap: 12, marginTop: 16 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  plan: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.card,
    backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder,
  },
  planIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.row, alignItems: 'center', justifyContent: 'center' },
  planEyebrow: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  planTitle: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
});
