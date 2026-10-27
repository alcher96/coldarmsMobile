import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { verifyEmail, type LinkStatus } from '@/api/auth';
import { resendVerification } from '@/api/profile';
import { useAuth } from '@/auth/auth-context';
import { AuthShell, PrimaryButton, TextLink, authStyles } from '@/components/auth/form';

const TEXTS: Record<Exclude<LinkStatus, 'expired' | 'invalid'>, { title: string; text: string }> = {
  ok: {
    title: 'Почта\nподтверждена!',
    text: 'Спасибо, что подтвердили почту. Добро пожаловать в Cold Arms — теперь вам доступны прогнозы, комментарии и рейтинги.',
  },
  already: {
    title: 'Почта уже\nподтверждена',
    text: 'Эта ссылка уже была использована — ваш аккаунт полностью активен.',
  },
};

/**
 * Ссылка из письма «Подтвердите почту» (coldarms.com/verify-email?token=…) — как страница сайта.
 * Доступна и без входа: письмо могут открыть на телефоне, где приложение ещё не авторизовано.
 */
export default function VerifyEmailScreen() {
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const { status: auth, refreshUser } = useAuth();
  const [result, setResult] = useState<LinkStatus | null>(token.trim() ? null : 'invalid');
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token.trim()) return;
    let alive = true;
    verifyEmail(token)
      .catch((): LinkStatus => 'invalid')
      .then(async (s) => {
        // Вошедшему сразу подтягиваем email_verified — баннеры «подтвердите почту» уходят.
        if ((s === 'ok' || s === 'already') && auth === 'signedIn') await refreshUser();
        if (alive) setResult(s);
      });
    return () => {
      alive = false;
    };
  }, [token, auth, refreshUser]);

  const home = () => router.replace(auth === 'signedIn' ? '/' : '/login');
  const resend = async () => {
    setSending(true);
    setNote(null);
    try {
      const r = await resendVerification();
      setNote(r.ok ? 'Письмо отправлено — проверьте почту (и папку «Спам»).' : 'Не удалось отправить письмо, попробуйте позже.');
    } catch {
      setNote('Нет соединения. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  };

  if (!result) {
    return (
      <AuthShell eyebrow="Подтверждение почты" title={'Проверяем\nссылку'}>
        <ActivityIndicator color="#fff" />
      </AuthShell>
    );
  }

  if (result === 'ok' || result === 'already') {
    const t = TEXTS[result];
    return (
      <AuthShell eyebrow="Подтверждение почты" title={t.title}>
        <Text style={authStyles.muted}>{t.text}</Text>
        <PrimaryButton title={auth === 'signedIn' ? 'На главную' : 'Войти'} onPress={home} />
      </AuthShell>
    );
  }

  const expired = result === 'expired';
  return (
    <AuthShell
      eyebrow="Подтверждение почты"
      title={expired ? 'Ссылка\nустарела' : 'Ссылка\nне работает'}
      footer={
        <View style={authStyles.row}>
          <TextLink accent onPress={home}>
            {auth === 'signedIn' ? 'На главную' : 'Ко входу'}
          </TextLink>
        </View>
      }>
      <Text style={authStyles.muted}>
        {expired
          ? 'Срок действия ссылки истёк. Запросите новое письмо — ссылка в нём будет действовать снова.'
          : 'Ссылка повреждена или уже не действует. Откройте последнее письмо или запросите новое.'}
      </Text>
      {auth === 'signedIn' ? (
        <>
          <PrimaryButton title="Отправить письмо ещё раз" onPress={resend} busy={sending} />
          {note ? <Text style={authStyles.muted}>{note}</Text> : null}
        </>
      ) : (
        <Text style={authStyles.muted}>Войдите в аккаунт — новое письмо можно запросить в настройках профиля.</Text>
      )}
    </AuthShell>
  );
}
