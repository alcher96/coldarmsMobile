// Баланс ColdArms Token в профиле и «+» — шторка пополнения.
import { useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fc } from '@/components/fight/palette';
import { colors, fonts, radii } from '@/theme/tokens';

import { tokensWord } from './api';
import { useTokens } from './store';
import { TopUpSheet } from './top-up-sheet';

export function TokensCard() {
  const { data, error, refresh } = useTokens();
  const [open, setOpen] = useState(false);
  // при каждом открытии профиля — свежий баланс (мог вернуться токен за упавший разбор)
  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      void refresh(ac.signal);
      return () => ac.abort();
    }, [refresh]),
  );
  return (
    <View style={styles.card}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.eyebrow}>Баланс</Text>
        <View style={styles.row}>
          <Text style={styles.balance}>{data?.balance ?? '—'}</Text>
          <Text style={styles.unit}>ColdArms Token</Text>
        </View>
        <Text style={styles.note}>
          {error && !data ? error : `Разбор поединка MIRA — ${data?.cost ?? 1} ${tokensWord(data?.cost ?? 1)}`}
        </Text>
      </View>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Пополнить токены" hitSlop={6}
        style={({ pressed }) => [styles.plus, pressed && { opacity: 0.85 }]}>
        <Plus size={22} color="#fff" strokeWidth={2.2} />
      </Pressable>
      <TopUpSheet visible={open} onClose={() => setOpen(false)} accent={colors.accent} onAccent="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.card,
    backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border,
  },
  eyebrow: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: fc.muted },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balance: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.text },
  unit: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 12, color: fc.muted },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});
