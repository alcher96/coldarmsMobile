import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

/** Заголовок раздела: надзаголовок, крупное название, подпись («МИРОВАЯ СЦЕНА / ТУРНИРЫ»). */
export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <View>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
    color: colors.text,
    marginTop: 6,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
