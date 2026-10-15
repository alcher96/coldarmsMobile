import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notifIcon, notifMessage, notifTitle, routeFor } from '@/api/notifications';
import { fc } from '@/components/fight/palette';
import { useNotifications } from '@/notifications/notifications-context';
import { colors, fonts, radii } from '@/theme/tokens';

const SHOW_MS = 5000;

/** Баннер сверху, когда уведомление пришло «вживую» через хаб: тап — к цели, сам скрывается через 5 с. */
export function NotificationBanner() {
  const { incoming, dismissIncoming, read } = useNotifications();
  const insets = useSafeAreaInsets();
  const [y] = useState(() => new Animated.Value(-160));

  useEffect(() => {
    if (!incoming) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => dismissIncoming());
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [incoming, y, dismissIncoming]);

  if (!incoming) return null;
  const open = () => {
    read(incoming.id);
    dismissIncoming();
    const route = routeFor(incoming.linkUrl);
    router.push(route ?? '/notifications');
  };

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <Pressable onPress={open} style={styles.card}>
        <Text style={styles.icon}>{notifIcon(incoming.type)}</Text>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {notifTitle(incoming)}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notifMessage(incoming)}
          </Text>
        </View>
        <Pressable onPress={dismissIncoming} hitSlop={10} accessibilityLabel="Скрыть">
          <X size={16} color={fc.muted} strokeWidth={2} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: 'rgba(229,53,43,0.45)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  icon: { fontSize: 22 },
  title: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  message: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: fc.soft, marginTop: 2 },
});
