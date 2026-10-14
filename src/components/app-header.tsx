import { router } from 'expo-router';
import { Bell, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { initialsOf } from '@/lib/format';
import { colors, fonts, space, radii } from '@/theme/tokens';

/** Шапка: логотип, колокольчик уведомлений, аватар с инициалами пользователя. */
export function AppHeader() {
  const { user } = useAuth();
  const initials = initialsOf(user?.nickname ?? user?.email);
  return (
    <View style={styles.root}>
      <View style={styles.logo}>
        <View style={styles.logoBar} />
        <Text style={styles.logoText}>COLD ARMS</Text>
        <Text style={styles.logoDomain}>.COM</Text>
      </View>
      <View style={styles.actions}>
        <Pressable hitSlop={10} accessibilityLabel="Уведомления">
          <Bell size={20} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Pressable style={styles.avatar} accessibilityLabel="Профиль" onPress={() => router.navigate('/profile')}>
          {initials ? (
            <Text style={styles.avatarText}>{initials}</Text>
          ) : (
            <User size={16} color={colors.text} strokeWidth={1.8} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    paddingHorizontal: space.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  logo: { flexDirection: 'row', alignItems: 'center' },
  logoBar: { width: 3, height: 22, backgroundColor: colors.accent, marginRight: 8 },
  logoText: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.3 },
  logoDomain: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textMuted,
    marginLeft: 10,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: '#222226',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.text },
});
