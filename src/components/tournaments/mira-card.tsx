import { router } from 'expo-router';
import { ArrowUpRight, Network } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

/** Промо прогнозов M.I.R.A. — ведёт во вкладку «Анализ». */
export function MiraCard() {
  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.brand}>
          <Network size={18} color={colors.accent} strokeWidth={1.6} />
          <Text style={styles.title}>M.I.R.A.</Text>
        </View>
        <Pressable style={styles.link} hitSlop={8} onPress={() => router.navigate('/analysis')}>
          <Text style={styles.linkText}>Прогноз матча</Text>
          <ArrowUpRight size={12} color={colors.text} strokeWidth={1.6} />
        </Pressable>
      </View>
      <Text style={styles.sub}>Match Intelligence & Rating Analytics</Text>
      <Text style={styles.text}>ML, Elo и сочетание стилей. Выберите пару, чтобы сравнить шансы и риск апсета.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontFamily: fonts.body, fontSize: 11, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 8 },
  text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 10 },
});
