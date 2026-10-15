import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarSource, loadMyProfile, removeFavorite, uploadAvatar, type Favorite, type ProfilePage } from '@/api/profile';
import { useAuth } from '@/auth/auth-context';
import { AppHeader } from '@/components/app-header';
import { fc } from '@/components/fight/palette';
import { Empty, FavoriteRow, ProfileOverview } from '@/components/profile/overview';
import { ProfileSettings } from '@/components/profile/settings';
import { useAsync } from '@/hooks/use-async';
import { countryName, flagOf } from '@/lib/countries';
import { initialsOf, plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

type Tab = 'overview' | 'subs' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'subs', label: 'Подписки' },
  { key: 'settings', label: 'Настройки' },
];

/** Личный кабинет — как /profile на сайте: обзор, подписки на атлетов, настройки. */
export default function ProfileScreen() {
  const { data, error, loading, refresh, refreshing } = useAsync(loadMyProfile);
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const confirmSignOut = () =>
    Alert.alert('Выйти из аккаунта?', 'Чтобы вернуться, понадобится снова ввести почту и пароль.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      {!data ? (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : error ? (
            <>
              <Text style={styles.muted}>Не удалось загрузить профиль</Text>
              <Pressable onPress={refresh} style={styles.retry}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : (
        <ScrollView
          stickyHeaderIndices={[1]}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
          <Hero page={data} />
          <View style={styles.tabsWrap}>
            <View style={styles.tabs}>
              {TABS.map((t) => {
                const on = t.key === tab;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab} accessibilityRole="tab">
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                    <View style={[styles.tabBar, on && styles.tabBarOn]} />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            {tab === 'overview' ? <ProfileOverview page={data} onAllFavorites={() => setTab('subs')} /> : null}
            {tab === 'subs' ? <Subscriptions initial={data.favorites} /> : null}
            {tab === 'settings' ? <ProfileSettings page={data} onSaved={refresh} onSignOut={confirmSignOut} /> : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Hero({ page }: { page: ProfilePage }) {
  const p = page.profile;
  const nick = p.nickname || p.email.split('@')[0];
  const [version, setVersion] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Сколько дней с регистрации — считаем один раз при открытии, «сейчас» берём из того же момента.
  const [days] = useState(() =>
    p.createdAt ? Math.max(0, Math.trunc((Date.now() - new Date(p.createdAt).getTime()) / 864e5)) : null,
  );
  const unlocked = page.achievements.filter((a) => a.unlocked).length;

  const pick = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if ((a.fileSize ?? 0) > 8 * 1024 * 1024) {
      Alert.alert('Слишком большой файл', 'Выберите фото до 8 МБ.');
      return;
    }
    setUploading(true);
    const ok = await uploadAvatar(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? 'avatar.jpg').catch(() => false);
    setUploading(false);
    if (ok) {
      setFailed(false);
      setVersion(Date.now());
    } else Alert.alert('Не удалось загрузить фото', 'Попробуйте другое изображение.');
  }, []);

  return (
    <View style={styles.hero}>
      <Pressable onPress={pick} style={styles.avatar} accessibilityLabel="Сменить фото">
        {/* Круг обрезает фото отдельным слоем — значок камеры снаружи должен оставаться видимым. */}
        <View style={styles.avatarClip}>
          <Text style={styles.avatarText}>{initialsOf(nick)}</Text>
          {!failed ? (
            <Image
              source={avatarSource(version)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              onError={() => setFailed(true)}
            />
          ) : null}
        </View>
        <View style={styles.avatarBadge}>
          {uploading ? <ActivityIndicator size="small" color={colors.text} /> : <Camera size={13} color={colors.text} strokeWidth={2} />}
        </View>
      </Pressable>
      <Text style={styles.nick}>{nick}</Text>
      <View style={styles.metaRow}>
        {p.country ? (
          <Text style={styles.meta}>
            {flagOf(p.country)} {countryName(p.country)}
          </Text>
        ) : null}
        {days != null ? <Text style={styles.meta}>с нами {days} {plural(days, ['день', 'дня', 'дней'])}</Text> : null}
      </View>
      {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat value={`${unlocked}/${page.achievements.length}`} label="достижений" />
        <Stat value={String(page.favorites.length)} label="в избранном" />
        <Stat value={String(page.activity.length)} label="действий" />
      </View>
    </View>
  );
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/** Избранные атлеты с отпиской. */
function Subscriptions({ initial }: { initial: Favorite[] }) {
  const [list, setList] = useState(initial);
  const remove = async (id: string) => {
    const prev = list;
    setList((l) => l.filter((f) => f.armWrestlerId !== id));
    if (!(await removeFavorite(id).catch(() => false))) setList(prev);
  };
  return (
    <View style={styles.subs}>
      <Text style={styles.subsTitle}>
        {list.length} {plural(list.length, ['атлет', 'атлета', 'атлетов'])} в избранном
      </Text>
      {list.length === 0 ? <Empty text="Добавляйте атлетов в избранное закладкой на их странице" /> : null}
      {list.map((f) => (
        <FavoriteRow
          key={f.armWrestlerId}
          f={f}
          right={
            <Pressable onPress={() => remove(f.armWrestlerId)} hitSlop={10} style={styles.remove} accessibilityLabel="Убрать из избранного">
              <X size={16} color={fc.muted} strokeWidth={2} />
            </Pressable>
          }
        />
      ))}
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
  hero: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: fc.chip,
    borderWidth: 2,
    borderColor: fc.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarClip: { ...StyleSheet.absoluteFill, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: fc.muted },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nick: { fontFamily: fonts.display, fontSize: 30, textTransform: 'uppercase', color: colors.text, marginTop: 12 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.second },
  bio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft, textAlign: 'center', marginTop: 10 },
  stats: { flexDirection: 'row', gap: 6, marginTop: 16, alignSelf: 'stretch' },
  stat: {
    flex: 1,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.muted },
  tabsWrap: { backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  tab: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: fc.muted },
  tabTextOn: { fontFamily: fonts.bodySemi, color: colors.text },
  tabBar: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 2, borderRadius: 1 },
  tabBarOn: { backgroundColor: colors.accent },
  subs: { padding: 16, paddingBottom: 28 },
  subsTitle: { fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text, marginBottom: 4 },
  remove: { width: 32, height: 32, borderRadius: 16, backgroundColor: fc.chip, alignItems: 'center', justifyContent: 'center' },
});
