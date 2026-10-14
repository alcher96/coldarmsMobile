import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Card, Eyebrow } from '@/components/ui';
import { useAuth } from '@/auth/auth-context';
import { colors, fonts, space, radii } from '@/theme/tokens';

/** Пока только данные аккаунта и выход — полноценный профиль сверстаем по макету. */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <View style={styles.body}>
        <Text style={styles.title}>Профиль</Text>
        <Card style={styles.card}>
          <Eyebrow>Ник</Eyebrow>
          <Text style={styles.value}>{user?.nickname ?? '—'}</Text>
          <Eyebrow style={styles.gap}>Почта</Eyebrow>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>
          {user && !user.emailVerified ? (
            <Text style={styles.warn}>Почта не подтверждена — часть функций будет недоступна</Text>
          ) : null}
        </Card>
        <Pressable
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await signOut();
          }}>
          {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.logoutText}>Выйти</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.gutter, gap: space.gap },
  title: { fontFamily: fonts.display, fontSize: 32, textTransform: 'uppercase', color: colors.text },
  card: { gap: 4 },
  gap: { marginTop: 12 },
  value: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  warn: { fontFamily: fonts.body, fontSize: 12, color: colors.accent, marginTop: 12 },
  logout: {
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.display, fontSize: 16, textTransform: 'uppercase', color: colors.text },
});
