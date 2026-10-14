import { Check, CircleAlert, Eye, EyeOff } from 'lucide-react-native';
import { useState, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/ui';
import { colors, fonts, space, radii } from '@/theme/tokens';

/** Каркас экранов входа: логотип, надзаголовок, заголовок, форма. */
export function AuthShell({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <View style={styles.logoBar} />
            <Text style={styles.logoText}>COLD ARMS</Text>
            <Text style={styles.logoDomain}>.COM</Text>
          </View>
          <View style={styles.head}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({
  label,
  error,
  secure,
  ref,
  ...input
}: TextInputProps & { label: string; error?: string; secure?: boolean; ref?: Ref<TextInput> }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          {...input}
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textDim}
          selectionColor={colors.accent}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={hidden ? 'Показать пароль' : 'Скрыть пароль'}>
            {hidden ? (
              <Eye size={18} color={colors.textMuted} strokeWidth={1.6} />
            ) : (
              <EyeOff size={18} color={colors.textMuted} strokeWidth={1.6} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, busy }: { title: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
      accessibilityRole="button">
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <CircleAlert size={16} color={colors.accent} strokeWidth={1.8} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <Pressable
      style={styles.checkRow}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn, error && !checked && styles.inputError]}>
        {checked ? <Check size={13} color={colors.text} strokeWidth={2.5} /> : null}
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

/** Ссылка-текст под формой («Забыли пароль?», «Регистрация»). */
export function TextLink({ children, onPress, accent }: { children: ReactNode; onPress: () => void; accent?: boolean }) {
  return (
    <Text onPress={onPress} style={[styles.link, accent && styles.linkAccent]} suppressHighlighting>
      {children}
    </Text>
  );
}

export const authStyles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: space.gutter, paddingTop: 16 },
  logo: { flexDirection: 'row', alignItems: 'center' },
  logoBar: { width: 3, height: 22, backgroundColor: colors.accent, marginRight: 8 },
  logoText: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.3 },
  logoDomain: { fontFamily: fonts.body, fontSize: 8, color: colors.textMuted, marginLeft: 10, marginTop: 4 },
  head: { marginTop: 48, marginBottom: 28 },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    textTransform: 'uppercase',
    color: colors.text,
    marginTop: 8,
  },
  form: { gap: 16 },
  footer: { marginTop: 'auto', paddingTop: 32, alignItems: 'center', gap: 12 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.control,
  },
  inputFocused: { borderColor: '#4A4A50' },
  inputError: { borderColor: colors.accent },
  input: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: 15, color: colors.text },
  fieldError: { fontFamily: fonts.body, fontSize: 11, color: colors.accent, marginTop: 5 },
  button: {
    height: 50,
    borderRadius: radii.control,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.text },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'rgba(229,53,43,0.4)',
    backgroundColor: 'rgba(229,53,43,0.08)',
  },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  linkAccent: { color: colors.text, textDecorationLine: 'underline' },
});
