import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronLeft, Search, Trophy, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coverUrl } from '@/api/competitions';
import { loadMyId } from '@/api/profile';
import { search, userAvatarUrl, type SearchResult } from '@/api/search';
import { fc } from '@/components/fight/palette';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { useAsync } from '@/hooks/use-async';
import { useBackStep } from '@/hooks/use-back-step';
import { flagOf, countryName } from '@/lib/countries';
import { initialsOf } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** Общий поиск по атлетам, турнирам и пользователям — как поиск в шапке сайта. */
export default function SearchScreen() {
  const myId = useAsync(loadMyId).data ?? null;
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const input = useRef<TextInputInstance>(null);

  // Ищем, когда пользователь перестал печатать; одна буква — слишком широко, ждём вторую.
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // «Назад» сначала стирает запрос, потом закрывает поиск.
  useBackStep(() => {
    if (!query) return false;
    setQuery('');
    return true;
  });

  const load = useCallback(
    () => (term.length >= 2 ? search(term) : Promise.resolve<SearchResult | null>(null)),
    [term],
  );
  const { data, loading, error } = useAsync(load);
  const empty =
    !!data && data.wrestlers.length === 0 && data.competitions.length === 0 && data.users.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <View style={styles.field}>
          <Search size={16} color={fc.muted} strokeWidth={1.8} />
          <TextInput
            ref={input}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Атлеты, турниры, пользователи"
            placeholderTextColor={fc.dim}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => setTerm(query.trim())}
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                input.current?.focus();
              }}
              hitSlop={10}
              accessibilityLabel="Очистить">
              <X size={16} color={fc.muted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {term.length < 2 ? (
          <Text style={styles.hint}>Начните вводить имя атлета, название турнира или ник пользователя</Text>
        ) : loading && !data ? (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        ) : error ? (
          <Text style={styles.hint}>Не удалось выполнить поиск</Text>
        ) : empty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ничего не найдено</Text>
            <Text style={styles.hint}>Попробуйте другое написание — латиницей, как на сайте</Text>
          </View>
        ) : data ? (
          <View style={[styles.groups, loading && styles.stale]}>
            {data.wrestlers.length ? (
              <Group title="Атлеты">
                {data.wrestlers.map((w) => (
                  <Row
                    key={w.id}
                    onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: w.id } })}
                    avatar={<FighterAvatar id={w.thumbnailPath ? w.id : null} name={w.name} size={40} round />}
                    title={w.name}
                    sub={w.country ? `${flagOf(w.country)} ${countryName(w.country)}` : null}
                  />
                ))}
              </Group>
            ) : null}
            {data.competitions.length ? (
              <Group title="Турниры">
                {data.competitions.map((c) => {
                  const cover = coverUrl({ competitionId: c.id, photoPath: c.photoPath } as Parameters<typeof coverUrl>[0]);
                  return (
                    <Row
                      key={c.id}
                      onPress={() => router.push({ pathname: '/competition/[id]', params: { id: c.id } })}
                      avatar={
                        <View style={styles.cover}>
                          <Trophy size={16} color={fc.muted} strokeWidth={1.8} />
                          {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                        </View>
                      }
                      title={c.name}
                    />
                  );
                })}
              </Group>
            ) : null}
            {data.users.length ? (
              <Group title="Пользователи">
                {data.users.map((u) => {
                  const own = !!myId && u.id === myId;
                  const avatar = userAvatarUrl(u.avatarUrl);
                  return (
                    <Row
                      key={u.id}
                      onPress={() =>
                        own ? router.navigate('/profile') : router.push({ pathname: '/user/[id]', params: { id: u.id } })
                      }
                      avatar={
                        <View style={styles.userAvatar}>
                          <Text style={styles.userInitials}>{initialsOf(u.nickname)}</Text>
                          {avatar ? <Image source={avatar} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                        </View>
                      }
                      title={u.nickname}
                      sub={own ? 'Это вы' : null}
                    />
                  );
                })}
              </Group>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  avatar,
  title,
  sub,
  onPress,
}: {
  avatar: React.ReactNode;
  title: string;
  sub?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {avatar}
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: colors.row,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: 0 },
  content: { padding: 16, paddingBottom: 32 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.muted, textAlign: 'center', marginTop: 24 },
  loader: { marginTop: 32 },
  empty: { alignItems: 'center', marginTop: 24 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  groups: { gap: 18 },
  stale: { opacity: 0.5 },
  groupTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: fc.muted,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.card,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  pressed: { opacity: 0.7 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 1 },
  cover: {
    width: 40,
    height: 40,
    borderRadius: radii.small,
    backgroundColor: fc.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: fc.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
});
