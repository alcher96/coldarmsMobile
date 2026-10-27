import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, type TextInputInstance } from 'react-native';

import { resetPassword, validateResetToken, type LinkStatus } from '@/api/auth';
import { useAuth } from '@/auth/auth-context';
import { AuthShell, ErrorBox, Field, PrimaryButton, TextLink, authStyles } from '@/components/auth/form';

type Phase = 'checking' | 'form' | 'done' | 'expired' | 'invalid';

/**
 * Ссылка из письма «Сброс пароля» (coldarms.com/reset-password?token=…) — как страница сайта:
 * сначала проверяем токен, потом просим новый пароль дважды.
 */
export default function ResetPasswordScreen() {
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const { status: auth } = useAuth();
  const [phase, setPhase] = useState<Phase>(token.trim() ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (!token.trim()) return;
    let alive = true;
    validateResetToken(token)
      .catch((): LinkStatus => 'invalid')
      .then((s) => {
        if (alive) setPhase(s === 'ok' ? 'form' : s === 'expired' ? 'expired' : 'invalid');
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async () => {
    const e = {
      password: !password ? 'Введите пароль' : password.length < 6 ? 'Минимум 6 символов' : undefined,
      confirm: !confirm ? 'Повторите пароль' : confirm !== password ? 'Пароли не совпадают' : undefined,
    };
    setErrors(e);
    setError(null);
    if (e.password || e.confirm) return;
    setBusy(true);
    try {
      const s = await resetPassword(token, password);
      setPhase(s === 'ok' ? 'done' : s === 'expired' ? 'expired' : 'invalid');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exit = () => router.replace(auth === 'signedIn' ? '/' : '/login');
  const exitLink = (
    <View style={authStyles.row}>
      <TextLink accent onPress={exit}>
        {auth === 'signedIn' ? 'На главную' : 'Ко входу'}
      </TextLink>
    </View>
  );

  if (phase === 'checking') {
    return (
      <AuthShell eyebrow="Сброс пароля" title={'Проверяем\nссылку'}>
        <ActivityIndicator color="#fff" />
      </AuthShell>
    );
  }

  if (phase === 'done') {
    return (
      <AuthShell eyebrow="Сброс пароля" title={'Пароль\nизменён'}>
        <Text style={authStyles.muted}>Новый пароль сохранён. Войдите с ним в аккаунт.</Text>
        <PrimaryButton title={auth === 'signedIn' ? 'На главную' : 'Войти'} onPress={exit} />
      </AuthShell>
    );
  }

  if (phase === 'expired' || phase === 'invalid') {
    return (
      <AuthShell
        eyebrow="Сброс пароля"
        title={phase === 'expired' ? 'Ссылка\nустарела' : 'Ссылка\nне работает'}
        footer={exitLink}>
        <Text style={authStyles.muted}>
          {phase === 'expired'
            ? 'Срок действия ссылки истёк. Запросите сброс пароля ещё раз — придёт новое письмо.'
            : 'Ссылка повреждена или уже использована. Запросите сброс пароля ещё раз.'}
        </Text>
        {auth !== 'signedIn' ? (
          <PrimaryButton title="Запросить новую ссылку" onPress={() => router.replace('/forgot-password')} />
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Сброс пароля" title={'Новый\nпароль'} footer={exitLink}>
      <Text style={authStyles.muted}>Придумайте новый пароль для аккаунта — не короче 6 символов.</Text>
      <ErrorBox message={error} />
      <Field
        label="Новый пароль"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Field
        ref={confirmRef}
        label="Повторите пароль"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <PrimaryButton title="Сохранить новый пароль" onPress={submit} busy={busy} />
    </AuthShell>
  );
}
