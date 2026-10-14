import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronLeft, Play } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  competitionVideoUrl,
  countView,
  loadCompetitionPage,
  type CompetitionPage,
} from "@/api/competition";
import { coverUrl, isUpcoming } from "@/api/competitions";
import { CompetitionFightCard } from "@/components/competition/fight-card";
import { fc } from "@/components/fight/palette";
import { SearchField } from "@/components/search-field";
import { Segmented } from "@/components/segmented";
import {
  CoverBackground,
  textOnCover,
} from "@/components/tournaments/cover-background";
import { useAsync } from "@/hooks/use-async";
import { useBackStep, useHistoryState } from "@/hooks/use-back-step";
import { useCountdown } from "@/hooks/use-countdown";
import { useSearch } from "@/hooks/use-search";
import { dateLong, plural } from "@/lib/format";
import { colors, fonts, radii } from "@/theme/tokens";

type HandFilter = "all" | "Right" | "Left";
const HANDS: { key: HandFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "Right", label: "Правая" },
  { key: "Left", label: "Левая" },
];

/** Страница турнира: шапка с обложкой, сводка и все бои с раундами или прогнозом — как на сайте. */
export default function CompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => loadCompetitionPage(id), [id]);
  const { data, error, loading, refresh } = useAsync(load);

  // Просмотр засчитываем один раз на открытие экрана.
  useEffect(() => {
    if (id) countView(id);
  }, [id]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/tournaments")
          }
          hitSlop={10}
          style={styles.back}
          accessibilityLabel="Назад"
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {data?.competition.competitionName ?? "Турнир"}
        </Text>
      </View>
      {data ? (
        <Content page={data} onRefresh={refresh} />
      ) : (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : error ? (
            <>
              <Text style={styles.muted}>Не удалось загрузить турнир</Text>
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

function Content({
  page,
  onRefresh,
}: {
  page: CompetitionPage;
  onRefresh: () => void;
}) {
  const { query, setQuery, search, submit } = useSearch();
  const handState = useHistoryState<HandFilter>("all");
  const hand = handState.value;

  // «Назад»: сначала стираем поиск, потом возвращаем фильтр руки, потом — с экрана.
  useBackStep(() => {
    if (query) {
      setQuery("");
      return true;
    }
    return handState.back();
  });

  const q = search.toLowerCase();
  const fights = page.fights.filter(
    (f) =>
      (hand === "all" || f.hand === hand) &&
      (!q ||
        f.wrestler1Name.toLowerCase().includes(q) ||
        f.wrestler2Name.toLowerCase().includes(q)),
  );

  return (
    <FlatList
      data={fights}
      keyExtractor={(f) => f.fightId}
      renderItem={({ item, index }) => (
        <CompetitionFightCard
          f={item}
          initiallyOpen={index === 0 && !q && hand === "all"}
        />
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          <Hero page={page} />
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>
              {page.fights.length}{" "}
              {plural(page.fights.length, ["матч", "матча", "матчей"])}
            </Text>
          </View>
          <SearchField
            value={query}
            onChangeText={setQuery}
            onSubmit={submit}
            placeholder="Поиск по бойцу"
          />
          <Segmented options={HANDS} value={hand} onChange={handState.set} />
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {page.fights.length ? "Ничего не найдено" : "Кард ещё не объявлен"}
          </Text>
          {page.fights.length ? (
            <Text style={styles.muted}>Попробуйте изменить поиск</Text>
          ) : null}
        </View>
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onRefresh={onRefresh}
      refreshing={false}
    />
  );
}

const Separator = () => <View style={{ height: 8 }} />;

function Hero({ page }: { page: CompetitionPage }) {
  const c = page.competition;
  const cover = coverUrl(c);
  const upcoming = isUpcoming(c);
  const left = useCountdown(
    upcoming ? new Date(c.competitionDate) : null,
    60_000,
  );
  const countdown = upcoming
    ? left
      ? `${left.days} дн ${left.hours} ч ${left.minutes} мин`
      : "Сегодня"
    : null;

  // Число матчей уже в заголовке списка ниже, просмотры не показываем.
  const stats: [string, string][] = [];
  if (page.mira) {
    stats.push([
      `${Math.round(page.mira.avgConfidence)}%`,
      "уверенность M.I.R.A.",
    ]);
    stats.push([`${Math.round(page.mira.avgUpsetRisk)}%`, "риск апсета"]);
  }

  return (
    <View style={styles.hero}>
      <View style={[styles.cover, cover && styles.coverTall]}>
        {cover ? <CoverBackground uri={cover} /> : null}
        <Text style={styles.meta}>
          {[dateLong(c.competitionDate), c.location]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={[styles.name, cover && textOnCover]}>
          {c.competitionName}
        </Text>
        {page.mainEvent ? (
          <View style={styles.mainRow}>
            <Text style={styles.mainLabel}>Главный бой</Text>
            <Text
              style={[styles.mainEvent, cover && textOnCover]}
              numberOfLines={2}
            >
              {page.mainEvent}
            </Text>
          </View>
        ) : null}
        {countdown ? (
          <View style={styles.countdown}>
            <View style={styles.dot} />
            <Text style={styles.countdownText}>До старта · {countdown}</Text>
          </View>
        ) : null}
      </View>
      {stats.length ? (
        <View style={styles.stats}>
          {stats.map(([v, l]) => (
            <View key={l} style={styles.stat}>
              <Text style={styles.statValue}>{v}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {page.hasVideo ? (
        <Pressable
          onPress={() =>
            WebBrowser.openBrowserAsync(competitionVideoUrl(c.competitionId))
          }
          style={({ pressed }) => [styles.video, pressed && { opacity: 0.8 }]}
        >
          <Play size={16} color={colors.text} fill={colors.text} />
          <Text style={styles.videoText}>Смотреть видео турнира</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  retry: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.control,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 20,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: "center" },
  barTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 19,
    textTransform: "uppercase",
    color: colors.text,
  },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 12 },
  hero: { gap: 10 },
  cover: {
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    padding: 16,
    justifyContent: "flex-end",
  },
  coverTall: { minHeight: 280 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#C9CAD0" },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    textTransform: "uppercase",
    color: colors.text,
    marginTop: 4,
  },
  mainRow: { marginTop: 10 },
  mainLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.accent,
  },
  mainEvent: {
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
    color: colors.text,
    marginTop: 2,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(11,11,12,0.7)",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  countdownText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.coral },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stat: {
    flexGrow: 1,
    minWidth: "23%",
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: fc.muted,
    marginTop: 1,
  },
  video: {
    height: 46,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  listHead: { marginTop: 10 },
  listTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    textTransform: "uppercase",
    color: colors.text,
  },
  empty: { alignItems: "center", gap: 6, paddingVertical: 28 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
    color: colors.text,
  },
});
