import { ArrowUpRight, ScanLine } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/ui';
import { colors, fonts, space, radii } from '@/theme/tokens';

/** Светлая промо-карточка. Функция пока концепт — бэкенда под разбор видео нет (см. TODO.md). */
export function AnalyzeCard({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.top}>
        <Eyebrow style={styles.eyebrow}>Новая возможность / концепт</Eyebrow>
        <ScanLine size={20} color={colors.accent} strokeWidth={1.6} />
      </View>
      <Text style={styles.title}>Разбери свой поединок</Text>
      <View style={styles.bottom}>
        <Text style={styles.text}>
          Техника, фазы и точки роста по видео.{'\n'}Демонстрационный анализ.
        </Text>
        <ArrowUpRight size={18} color={colors.lightText} strokeWidth={1.6} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.light, borderRadius: radii.card, padding: space.cardPad },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.lightText, fontFamily: fonts.bodySemi },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    textTransform: 'uppercase',
    color: colors.lightText,
    marginTop: 12,
  },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  text: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.lightMuted },
});
