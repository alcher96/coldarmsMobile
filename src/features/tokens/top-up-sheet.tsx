// Пополнение ColdArms Token — шторка с пакетами 1 / 3 / 5 / 15. Открывается «+» на вкладке «Анализ», в профиле и в
// разговоре с MIRA, когда на разбор не хватило токена. Оплата пока заглушка: выбрал пакет — токены начислены сразу.
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/fight/info-sheet';
import { colors, fonts } from '@/theme/tokens';

import { rub, tokensWord, type Pack } from './api';
import { useTokens } from './store';
import { userMessage } from '@/lib/user-error';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** цвет выбранного пакета и кнопки (MIRA — «морской», профиль — фирменный красный) и цвет текста на нём */
  accent: string;
  onAccent: string;
  /** почему открыли («Для разбора нужен 1 токен») — вместо подзаголовка */
  reason?: string;
  /** токены начислены (вызывается перед закрытием шторки) */
  onBought?: (n: number) => void;
};

export function TopUpSheet({ visible, onClose, ...rest }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {/* содержимое шторки монтируется заново при каждом открытии — выбор и «начислено» сбрасываются сами */}
      <TopUpBody onClose={onClose} {...rest} />
    </Sheet>
  );
}

function TopUpBody({ onClose, accent, onAccent, reason, onBought }: Omit<Props, 'visible'>) {
  const { data, error, buy, refresh } = useTokens();
  const [pick, setPick] = useState('t3');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [got, setGot] = useState<number | null>(null);
  const packs = data?.packs ?? [];
  const pack = packs.find((p) => p.id === pick) ?? packs[0];
  const base = packs[0]?.perTokenRub ?? 0;

  const pay = async () => {
    if (!pack || busy) return;
    setBusy(true);
    setErr(undefined);
    try {
      const n = await buy(pack.id);
      setGot(n);
      setTimeout(() => {
        onBought?.(n);   // раньше закрытия: разговор MIRA ждёт «купил», а закрытие без покупки значит «не буду»
        onClose();
      }, 1100);
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <View style={styles.loading}>
        {error ? (
          <>
            <Text style={styles.err}>{error}</Text>
            <Pressable onPress={() => void refresh()} style={styles.retry}>
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.text} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.title}>Пополнить токены</Text>
      <Text style={styles.sub}>
        {reason ?? `Разбор — ${data.cost} ${tokensWord(data.cost)}.`} На балансе: {data.balance}
      </Text>

      <View style={styles.grid}>
        {packs.map((p) => (
          <PackCard key={p.id} p={p} on={p.id === pack?.id} accent={accent} onAccent={onAccent} base={base}
            onPress={() => !busy && got === null && setPick(p.id)} />
        ))}
      </View>

      {got !== null ? (
        <View style={[styles.cta, styles.done]}>
          <Check size={20} color={colors.text} strokeWidth={2.4} />
          <Text style={[styles.ctaText, { color: colors.text }]}>
            Начислено +{got} · баланс {data.balance}
          </Text>
        </View>
      ) : (
        <Pressable onPress={pay} disabled={busy || !pack}
          style={({ pressed }) => [styles.cta, { backgroundColor: accent }, (pressed || busy) && { opacity: 0.85 }]}>
          {busy ? (
            <ActivityIndicator color={onAccent} />
          ) : pack ? (
            <Text style={[styles.ctaText, { color: onAccent }]}>
              +{pack.tokens} {tokensWord(pack.tokens)} за {rub(pack.priceRub)}
            </Text>
          ) : null}
        </Pressable>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text style={styles.note}>
        Токен списывается, когда видео встаёт в очередь на разбор. Если разбор не получится из-за сбоя — токен
        вернётся.
        {data.payments === 'stub' ? '\nОплата пока не подключена: токены начисляются сразу, деньги не списываются.' : ''}
      </Text>
    </View>
  );
}

function PackCard({ p, on, accent, onAccent, base, onPress }: {
  p: Pack; on: boolean; accent: string; onAccent: string; base: number; onPress: () => void;
}) {
  const off = base > 0 ? Math.round((1 - p.perTokenRub / base) * 100) : 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={[styles.pack, on && { borderColor: accent, backgroundColor: '#18181B' }]}>
      {off > 0 ? (
        <View style={[styles.badge, { backgroundColor: on ? accent : '#26262A' }]}>
          <Text style={[styles.badgeText, { color: on ? onAccent : colors.text }]}>−{off}%</Text>
        </View>
      ) : null}
      <Text style={styles.packN}>{p.tokens}</Text>
      <Text style={styles.packWord}>{tokensWord(p.tokens)}</Text>
      <Text style={styles.packPrice}>{rub(p.priceRub)}</Text>
      <Text style={styles.packPer}>{rub(p.perTokenRub)} за разбор</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  body: { gap: 14, paddingBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pack: {
    flexBasis: '47%', flexGrow: 1, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5,
    borderColor: colors.cardBorder, backgroundColor: colors.card,
  },
  badge: { position: 'absolute', top: 10, right: 10, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11 },
  packN: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.text },
  packWord: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: -2 },
  packPrice: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text, marginTop: 10 },
  packPer: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  cta: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  done: { backgroundColor: '#1B2A22', borderWidth: 1, borderColor: '#2F5A43' },
  ctaText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 0.4, textTransform: 'uppercase' },
  note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  err: { fontFamily: fonts.body, fontSize: 13, color: '#FF6B6B' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder },
  retryText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
});
