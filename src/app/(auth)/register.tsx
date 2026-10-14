import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { register } from '@/api/auth';
import { SITE_URL } from '@/api/http';
import { AuthShell, Checkbox, ErrorBox, Field, PrimaryButton, TextLink, authStyles } from '@/components/auth/form';

const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

type Errors = Partial<Record<'nickname' | 'email' | 'password' | 'confirm' | 'terms' | 'pd', string>>;

const openDoc = (path: string) => WebBrowser.openBrowserAsync(SITE_URL + path);

export default function RegisterScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [pd, setPd] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Те же правила, что в форме регистрации на сайте.
  const validate = () => {
    const e = email.trim();
    const next: Errors = {
      nickname: nickname.trim() ? undefined : 'Введите ник',
      email: !e ? 'Введите почту' : EMAIL_RE.test(e) ? undefined : 'Некорректная почта',
      password: !password ? 'Введите пароль' : password.length < 6 ? 'Минимум 6 символов' : undefined,
      confirm: !confirm ? 'Повторите пароль' : confirm !== password ? 'Пароли не совпадают' : undefined,
      terms: terms ? undefined : 'required',
      pd: pd ? undefined : 'required',
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const submit = async () => {
    setError(null);
    if (!validate()) {
      if (!terms || !pd) setError('Нужно принять условия и согласие на обработку данных');
      return;
    }
    setBusy(true);
    try {
      await register({
        nickname: nickname.trim(),
        email: email.trim(),
        password,
        acceptTerms: terms,
        acceptPersonalData: pd,
      });
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell eyebrow="Регистрация" title={'Проверьте\nпочту'}>
        <Text style={authStyles.muted}>
          Мы отправили письмо на <Text style={{ color: '#fff' }}>{sentTo}</Text>. Перейдите по ссылке из
          письма, чтобы подтвердить почту, а затем войдите.
        </Text>
        <PrimaryButton title="Ко входу" onPress={() => router.back()} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Новый аккаунт"
      title="Регистрация"
      footer={
        <View style={authStyles.row}>
          <Text style={authStyles.muted}>Уже есть аккаунт? </Text>
          <TextLink accent onPress={() => router.back()}>
            Войти
          </TextLink>
        </View>
      }>
      <ErrorBox message={error} />
      <Field
        label="Ник"
        value={nickname}
        onChangeText={setNickname}
        error={errors.nickname}
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
      />
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
      />
      <Field
        label="Пароль"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field
        label="Повторите пароль"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Checkbox checked={terms} onChange={setTerms} error={!!errors.terms}>
        Принимаю{' '}
        <TextLink accent onPress={() => openDoc('/terms')}>
          пользовательское соглашение
        </TextLink>
      </Checkbox>
      <Checkbox checked={pd} onChange={setPd} error={!!errors.pd}>
        Даю согласие на обработку персональных данных в соответствии с{' '}
        <TextLink accent onPress={() => openDoc('/privacy')}>
          политикой конфиденциальности
        </TextLink>
      </Checkbox>
      <PrimaryButton title="Создать аккаунт" onPress={submit} busy={busy} />
    </AuthShell>
  );
}
