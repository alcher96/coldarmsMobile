import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts, space, radii } from '@/theme/tokens';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Мелкая надпись капсом над заголовком блока («СЛЕДУЮЩИЙ ТУРНИР»). */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    overflow: 'hidden',
    padding: space.cardPad,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    textTransform: 'uppercase',
    color: colors.text,
  },
});
