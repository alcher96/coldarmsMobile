import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  resendVerification,
  saveProfile,
  saveSettings,
  saveTelegramSettings,
  startTelegramLink,
  unlinkTelegram,
  type ProfilePage,
  type Settings,
  type TelegramStatus,
} from '@/api/profile';
import { Sheet, SheetScrollView } from '@/components/fight/info-sheet';
import { fc } from '@/components/fight/palette';
import { countryName, flagOf } from '@/lib/countries';
import { colors, fonts, radii } from '@/theme/tokens';

import { Section } from './overview';

const COUNTRY_CODES = [
  'AM', 'AT', 'AU', 'AZ', 'BG', 'BR', 'BY', 'CA', 'CH', 'CN', 'CZ', 'DE', 'EE', 'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR',
  'HU', 'IL', 'IN', 'IR', 'IT', 'JP', 'KG', 'KR', 'KZ', 'LT', 'LV', 'MD', 'NO', 'NZ', 'PL', 'RO', 'RS', 'RU', 'SE', 'SK',
  'TJ', 'TR', 'UA', 'US', 'UZ', 'ZA',
];

/** Настройки: данные профиля, почта, уведомления, приватность, Telegram, выход. */
export function ProfileSettings({
  page,
  onSaved,
  onSignOut,
}: {
  page: ProfilePage;
  onSaved: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.list}>
      <ProfileForm page={page} onSaved={onSaved} />
      <EmailCard page={page} />
      <Toggles initial={page.settings} />
      {page.telegram?.available !== false ? <TelegramCard initial={page.telegram} onChanged={onSaved} /> : null}
      <Pressable onPress={onSignOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </View>
  );
}

function ProfileForm({ page, onSaved }: { page: ProfilePage; onSaved: () => void }) {
  const p = page.profile;
  const [nickname, setNickname] = useState(p.nickname ?? '');
  const [country, setCountry] = useState<string | null>(p.country?.trim() || null);
  const [bio, setBio] = useState(p.bio ?? '');
  const [picker, setPicker] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  const dirty = nickname !== (p.nickname ?? '') || country !== (p.country?.trim() || null) || bio !== (p.bio ?? '');

  const save = async () => {
    setState('saving');
    try {
      const r = await saveProfile({ nickname: nickname.trim(), country, bio: bio.trim() || null });
      if (r.ok) {
        setState('ok');
        onSaved();
      } else {
        setError(r.status === 409 ? 'Этот ник уже занят' : r.message || 'Не удалось сохранить');
        setState('error');
      }
    } catch {
      setError('Нет связи. Попробуйте ещё раз');
      setState('error');
    }
  };

  return (
    <Section title="Профиль">
      <Text style={styles.label}>Ник</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={(t) => {
          setNickname(t);
          setState('idle');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={32}
      />
      <Text style={styles.label}>Страна</Text>
      <Pressable onPress={() => setPicker(true)} style={[styles.input, styles.select]}>
        <Text style={[styles.selectText, !country && { color: fc.dim }]}>
          {country ? `${flagOf(country)} ${countryName(country)}` : 'Не указана'}
        </Text>
        <ChevronDown size={16} color={fc.muted} strokeWidth={1.8} />
      </Pressable>
      <Text style={styles.label}>О себе</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={(t) => {
          setBio(t);
          setState('idle');
        }}
        multiline
        maxLength={500}
        placeholder="Пара слов о себе"
        placeholderTextColor={fc.dim}
      />
      {state === 'error' ? <Text style={styles.err}>{error}</Text> : null}
      {state === 'ok' ? <Text style={styles.ok}>Сохранено</Text> : null}
      <Pressable
        onPress={save}
        disabled={!dirty || !nickname.trim() || state === 'saving'}
        style={[styles.primary, (!dirty || !nickname.trim()) && styles.disabled]}>
        {state === 'saving' ? <ActivityIndicator color={colors.lightText} /> : <Text style={styles.primaryText}>Сохранить</Text>}
      </Pressable>

      <Sheet visible={picker} onClose={() => setPicker(false)} bare>
        <Text style={styles.sheetTitle}>Страна</Text>
        <SheetScrollView contentContainerStyle={styles.countryList}>
          {[null, ...COUNTRY_CODES.slice().sort((a, b) => (countryName(a) ?? a).localeCompare(countryName(b) ?? b, 'ru'))].map(
            (code) => (
              <Pressable
                key={code ?? 'none'}
                onPress={() => {
                  setCountry(code);
                  setState('idle');
                  setPicker(false);
                }}
                style={styles.countryRow}>
                <Text style={styles.flag}>{code ? flagOf(code) : '—'}</Text>
                <Text style={[styles.countryName, country === code && { color: colors.text }]}>
                  {code ? countryName(code) : 'Не указана'}
                </Text>
                {country === code ? <Check size={16} color={colors.accent} strokeWidth={2} /> : null}
              </Pressable>
            ),
          )}
        </SheetScrollView>
      </Sheet>
    </Section>
  );
}

function EmailCard({ page }: { page: ProfilePage }) {
  const p = page.profile;
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const send = async () => {
    setState('sending');
    try {
      const r = await resendVerification();
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };
  return (
    <Section title="Почта">
      <Text style={styles.email}>{p.email}</Text>
      {p.emailVerified ? (
        <Text style={styles.ok}>✓ Подтверждена</Text>
      ) : (
        <>
          <Text style={styles.err}>Не подтверждена — без этого закрыты прогнозы, комментарии и часть аналитики</Text>
          <Pressable onPress={send} disabled={state === 'sending' || state === 'sent'} style={styles.outline}>
            <Text style={styles.outlineText}>
              {state === 'sending' ? 'Отправляем…' : state === 'sent' ? 'Письмо отправлено' : 'Отправить письмо ещё раз'}
            </Text>
          </Pressable>
          {state === 'error' ? <Text style={styles.err}>Не удалось отправить. Попробуйте позже</Text> : null}
        </>
      )}
    </Section>
  );
}

const TOGGLES: [keyof Settings, string, string][] = [
  ['notifNewFights', 'Новые бои', 'Когда в кард добавляют бой с атлетами, которых вы отслеживаете'],
  ['notifResults', 'Результаты', 'Итоги боёв, на которые вы делали прогноз'],
  ['notifReplies', 'Ответы', 'Ответы на ваши комментарии'],
  ['privacySearchVisible', 'Профиль в поиске', 'Другие пользователи могут найти вас'],
  ['privacyShowAchievements', 'Показывать достижения', ''],
  ['privacyShowActivity', 'Показывать активность', ''],
  ['privacyShowCompStats', 'Показывать точность прогнозов', ''],
];

/** Уведомления и приватность: каждое переключение сохраняется сразу. */
function Toggles({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [error, setError] = useState(false);
  const toggle = async (key: keyof Settings, value: boolean) => {
    const prev = s;
    const next = { ...s, [key]: value };
    setS(next);
    setError(false);
    const r = await saveSettings(next).catch(() => null);
    if (!r?.ok) {
      setS(prev);
      setError(true);
    }
  };
  return (
    <>
      {[
        ['Уведомления', TOGGLES.slice(0, 3)],
        ['Приватность', TOGGLES.slice(3)],
      ].map(([title, list]) => (
        <Section key={title as string} title={title as string}>
          {(list as typeof TOGGLES).map(([key, label, desc]) => (
            <View key={key} style={styles.toggle}>
              <View style={styles.flex}>
                <Text style={styles.toggleLabel}>{label}</Text>
                {desc ? <Text style={styles.toggleDesc}>{desc}</Text> : null}
              </View>
              <Switch
                value={s[key]}
                onValueChange={(v) => toggle(key, v)}
                trackColor={{ false: '#3A3B40', true: colors.accent }}
                thumbColor={colors.text}
              />
            </View>
          ))}
        </Section>
      ))}
      {error ? <Text style={styles.err}>Не удалось сохранить настройку</Text> : null}
    </>
  );
}

function TelegramCard({ initial, onChanged }: { initial: TelegramStatus | null; onChanged: () => void }) {
  const [t, setT] = useState<TelegramStatus | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async () => {
    setBusy(true);
    setError('');
    const link = await startTelegramLink().catch(() => null);
    setBusy(false);
    if (link) Linking.openURL(link);
    else setError('Не удалось получить ссылку на бота');
  };
  const unlink = async () => {
    setBusy(true);
    const ok = await unlinkTelegram().catch(() => false);
    setBusy(false);
    if (ok) onChanged();
    else setError('Не удалось отвязать Telegram');
  };
  const toggle = async (key: 'notificationsEnabled' | 'roundsEnabled', v: boolean) => {
    if (!t) return;
    const next = { ...t, [key]: v };
    setT(next);
    const r = await saveTelegramSettings({ notificationsEnabled: next.notificationsEnabled, roundsEnabled: next.roundsEnabled }).catch(
      () => null,
    );
    if (!r?.ok) setT(t);
  };

  return (
    <Section title="Telegram">
      {t?.linked ? (
        <>
          <Text style={styles.ok}>✓ Привязан{t.username ? ` · @${t.username}` : ''}</Text>
          {(
            [
              ['notificationsEnabled', 'Уведомления в Telegram'],
              ['roundsEnabled', 'Результаты по раундам'],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={styles.toggle}>
              <Text style={[styles.toggleLabel, styles.flex]}>{label}</Text>
              <Switch
                value={!!t[key]}
                onValueChange={(v) => toggle(key, v)}
                trackColor={{ false: '#3A3B40', true: colors.accent }}
                thumbColor={colors.text}
              />
            </View>
          ))}
          <Pressable onPress={unlink} disabled={busy} style={styles.outline}>
            <Text style={styles.outlineText}>Отвязать</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.note}>Уведомления о боях и результатах прямо в Telegram.</Text>
          <Pressable onPress={connect} disabled={busy} style={styles.outline}>
            {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.outlineText}>Подключить Telegram</Text>}
          </Pressable>
          <Text style={styles.hint}>После подтверждения в боте вернитесь и потяните экран вниз, чтобы обновить.</Text>
        </>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted, marginTop: 12, marginBottom: 6 },
  input: {
    minHeight: 46,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  textarea: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  primary: {
    marginTop: 14,
    height: 48,
    borderRadius: radii.control,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.lightText },
  disabled: { opacity: 0.4 },
  outline: {
    marginTop: 12,
    height: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  email: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginTop: 6 },
  ok: { fontFamily: fonts.bodySemi, fontSize: 13, color: '#5FD99A', marginTop: 8 },
  err: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: fc.coral, marginTop: 8 },
  note: { fontFamily: fonts.body, fontSize: 13, color: fc.second, marginTop: 6 },
  hint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: fc.dim, marginTop: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggleLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  toggleDesc: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: fc.muted, marginTop: 2 },
  logout: {
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'rgba(229,53,43,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  logoutText: { fontFamily: fonts.bodySemi, fontSize: 14, color: fc.coral },
  pressed: { opacity: 0.7 },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    textTransform: 'uppercase',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  countryList: { paddingHorizontal: 20, paddingBottom: 8 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  flag: { fontSize: 20, width: 28 },
  countryName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: fc.muted },
});
