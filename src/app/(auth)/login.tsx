import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View, type TextInput } from 'react-native';

import { AuthShell, ErrorBox, Field, PrimaryButton, TextLink, authStyles } from '@/components/auth/form';
import { useAuth } from '@/auth/auth-context';

const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const e = email.trim();
    const next = {
      email: !e ? 'Введите почту' : EMAIL_RE.test(e) ? undefined : 'Некорректная почта',
      password: password ? undefined : 'Введите пароль',
    };
    setErrors(next);
    setError(null);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await signIn(e, password);
      // Навигатор сам переключится на вкладки (Stack.Protected в корневом layout).
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Армрестлинг в цифрах"
      title={'Вход в\nаккаунт'}
      footer={
        <View style={authStyles.row}>
          <Text style={authStyles.muted}>Нет аккаунта? </Text>
          <TextLink accent onPress={() => router.push('/register')}>
            Зарегистрироваться
          </TextLink>
        </View>
      }>
      <ErrorBox message={error} />
      <Field
        label="Почта"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <Field
        ref={passwordRef}
        label="Пароль"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="••••••••"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View style={{ alignItems: 'flex-end' }}>
        <TextLink onPress={() => router.push('/forgot-password')}>Забыли пароль?</TextLink>
      </View>
      <PrimaryButton title="Войти" onPress={submit} busy={busy} />
    </AuthShell>
  );
}
