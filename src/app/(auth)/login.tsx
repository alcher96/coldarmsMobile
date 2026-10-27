import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View, type TextInputInstance } from 'react-native';

import { pollTelegramLogin, startTelegramLogin } from '@/api/auth';
import { useAuth } from '@/auth/auth-context';
import {
  AuthShell,
  Divider,
  ErrorBox,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextLink,
  authStyles,
} from '@/components/auth/form';

// Как на сайте: опрос раз в 2 секунды, не дольше 5 минут.
const TG_POLL_MS = 2000;
const TG_POLL_TRIES = 150;

const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export default function LoginScreen() {
  const { signIn, completeSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const tgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTelegram = () => {
    if (tgTimer.current) clearInterval(tgTimer.current);
    tgTimer.current = null;
  };
  // Ушли с экрана — опрос больше не нужен.
  useEffect(() => stopTelegram, []);

  const telegram = async () => {
    if (tgBusy) return;
    setError(null);
    setTgBusy(true);
    try {
      const { deepLink, token } = await startTelegramLogin();
      await Linking.openURL(deepLink);
      let tries = 0;
      let inFlight = false;
      tgTimer.current = setInterval(async () => {
        if (inFlight) return;
        if (++tries > TG_POLL_TRIES) {
          stopTelegram();
          setTgBusy(false);
          return;
        }
        inFlight = true;
        try {
          const status = await pollTelegramLogin(token);
          if (status === 'ok') {
            stopTelegram();
            await completeSignIn();
          } else if (status === 'expired') {
            stopTelegram();
            setTgBusy(false);
            setError('Время на подтверждение истекло. Попробуйте ещё раз');
          }
        } catch (err) {
          stopTelegram();
          setTgBusy(false);
          setError((err as Error).message || 'Не удалось войти через Telegram');
        } finally {
          inFlight = false;
        }
      }, TG_POLL_MS);
    } catch (err) {
      setTgBusy(false);
      setError((err as Error).message || 'Не удалось открыть Telegram');
    }
  };

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
      <Divider label="ИЛИ" />
      <SecondaryButton
        title={tgBusy ? 'Подтвердите вход в боте' : 'Войти через Telegram'}
        onPress={telegram}
        busy={tgBusy}
        icon={<Send size={18} color="#fff" strokeWidth={2} />}
      />
      {tgBusy ? (
        <Text style={authStyles.muted}>
          Откроется бот Cold Arms в Telegram — нажмите в нём «Подтвердить» и вернитесь в приложение.
        </Text>
      ) : null}
    </AuthShell>
  );
}
