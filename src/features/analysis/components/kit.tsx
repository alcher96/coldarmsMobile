import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/ui';
import { colors, fonts, radii, space } from '@/theme/tokens';

/** Экран модуля: шапка с «назад», надзаголовок + крупный заголовок, прокрутка, кнопка снизу. */
export function Screen({
  eyebrow,
  title,
  back = true,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  back?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {back ? (
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/analysis'))}>
            <ChevronLeft size={22} color={colors.text} strokeWidth={1.6} />
          </Pressable>
        ) : (
          <View style={styles.logo}>
            <View style={styles.logoBar} />
            <Text style={styles.logoText}>COLD ARMS</Text>
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.content}>{children}</View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Крупная кнопка: светлая — основная, тёмная — второстепенная. */
export function Button({
  label,
  onPress,
  disabled,
  kind = 'primary',
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary';
  icon?: ReactNode;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** Кнопка-вариант ответа (выбранный — светлый, как сегмент в coldarmsMob). */
export function Option({
  label,
  hint,
  selected,
  disabled,
  onPress,
  style,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled, style]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      {hint ? <Text style={[styles.optionHint, selected && styles.optionHintSelected]}>{hint}</Text> : null}
    </Pressable>
  );
}

export function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Badge({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <View style={[styles.badge, accent && styles.badgeAccent]}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 52, paddingHorizontal: space.gutter, justifyContent: 'center' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBar: { width: 4, height: 18, backgroundColor: colors.accent, borderRadius: 2 },
  logoText: { fontFamily: fonts.display, fontSize: 18, color: colors.text, letterSpacing: 0.5 },
  body: { paddingHorizontal: space.gutter, paddingBottom: 32 },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    textTransform: 'uppercase',
    color: colors.text,
    marginTop: 6,
  },
  content: { marginTop: space.gap, gap: space.gap },
  footer: { paddingHorizontal: space.gutter, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  button: {
    height: 52,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonPrimary: { backgroundColor: colors.light },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  buttonTextPrimary: { color: colors.lightText },
  disabled: { opacity: 0.4 },
  option: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.control,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
  },
  optionSelected: { backgroundColor: colors.light, borderColor: colors.light },
  optionLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  optionLabelSelected: { fontFamily: fonts.bodySemi, color: colors.lightText },
  optionHint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMuted, marginTop: 4 },
  optionHintSelected: { color: colors.lightMuted },
  question: { gap: 10 },
  questionTitle: { fontFamily: fonts.displaySemi, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  badgeAccent: { borderColor: colors.accent },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.text },
});
