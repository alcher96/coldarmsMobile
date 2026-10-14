import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { House, ScanLine, Trophy, User, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'Главная', Icon: House },
  athletes: { label: 'Атлеты', Icon: Users },
  tournaments: { label: 'Турниры', Icon: Trophy },
  analysis: { label: 'Анализ', Icon: ScanLine },
  profile: { label: 'Профиль', Icon: User },
};

/** Таб-бар по макету: активная вкладка белая с красной полоской снизу. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? colors.text : colors.textDim;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}>
            <tab.Icon size={22} color={color} strokeWidth={1.5} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
            <View style={[styles.indicator, focused && styles.indicatorOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, marginTop: 6 },
  indicator: { width: 16, height: 2, marginTop: 5, borderRadius: 1 },
  indicatorOn: { backgroundColor: colors.accent },
});
