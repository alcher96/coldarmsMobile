// Пол, выбранный при регистрации. Сайт coldarms.com такого поля не принимает, а входа сразу после регистрации нет (сначала
// подтверждение почты) — поэтому пол ждёт на телефоне первого входа с той же почтой и уходит на сервер силовых.
// На основном бэкенде (ASP.NET Core) пол станет полем регистрации и этот обходной путь уйдёт.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useAuth } from '@/auth/auth-context';

import { getStrength, saveBody, type Sex } from './api';

const KEY = 'strength:pendingSex';

export async function rememberSex(email: string, sex: Sex) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ email: email.toLowerCase(), sex })).catch(() => {});
}

/** Вошёл тот, кто регистрировался с этого телефона, и пол на сервере ещё не указан — отправить. */
export function StrengthSync() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase();
  const sub = user?.sub;
  useEffect(() => {
    if (!email || !sub) return;
    let alive = true;
    (async () => {
      const raw = await AsyncStorage.getItem(KEY).catch(() => null);
      if (!raw) return;
      const p = JSON.parse(raw) as { email: string; sex: Sex };
      if (p.email !== email) return;
      const cur = await getStrength();
      if (!alive) return;
      if (!cur.body.sex) await saveBody({ sex: p.sex });
      await AsyncStorage.removeItem(KEY);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [email, sub]);
  return null;
}
