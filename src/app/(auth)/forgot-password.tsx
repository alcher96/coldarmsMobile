import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { forgotPassword } from '@/api/auth';
import { AuthShell, ErrorBox, Field, PrimaryButton, TextLink, authStyles } from '@/components/auth/form';

const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const e = email.trim();
    const msg = !e ? 'Введите почту' : EMAIL_RE.test(e) ? undefined : 'Некорректная почта';
    setFieldError(msg);
    setError(null);
    if (msg) return;
    setBusy(true);
    try {
      await forgotPassword(e);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <View style={authStyles.row}>
      <TextLink accent onPress={() => router.back()}>
        Вернуться ко входу
      </TextLink>
    </View>
  );

  if (sent) {
    return (
      <AuthShell eyebrow="Восстановление" title={'Проверьте\nпочту'} footer={back}>
        <Text style={authStyles.muted}>
          Если аккаунт с адресом <Text style={{ color: '#fff' }}>{email.trim()}</Text> существует, мы
          отправили на него ссылку для сброса пароля.
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Восстановление" title={'Забыли\nпароль?'} footer={back}>
      <Text style={authStyles.muted}>Укажите почту аккаунта — пришлём ссылку для сброса пароля.</Text>
      <ErrorBox message={error} />
      <Field
        label="Почта"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <PrimaryButton title="Отправить ссылку" onPress={submit} busy={busy} />
    </AuthShell>
  );
}
