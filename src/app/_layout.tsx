import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { RobotoCondensed_600SemiBold, RobotoCondensed_700Bold } from '@expo-google-fonts/roboto-condensed';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { NotificationBanner } from '@/components/notification-banner';
import { NotificationsProvider } from '@/notifications/notifications-context';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    RobotoCondensed_600SemiBold,
    RobotoCondensed_700Bold,
  });

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <NotificationsProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <RootNavigator />
          <NotificationBanner />
        </ThemeProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}

/** Без входа доступны только экраны (auth) — приложение открывается сразу с авторизации. */
function RootNavigator() {
  const { status } = useAuth();

  // Сплэш держим, пока не ясно, есть ли сессия, — иначе мелькнёт экран входа.
  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Без redirectTo закрытый экран на старте (свежая установка, сессии нет) — «Unmatched Route». */}
      <Stack.Protected guard={status === 'signedIn'} redirectTo="/login">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="fight/[id]" />
        <Stack.Screen name="athlete/[id]" />
        <Stack.Screen name="competition/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="user/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
