import { StyleSheet, Text, View } from 'react-native';

import { GlassHeaderScreen } from '@/components/glass-header-screen';
import { colors, fonts, space } from '@/theme/tokens';

/** Заглушка для вкладок, которые ещё не сверстаны. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <GlassHeaderScreen>
      {(top) => (
        <View style={[styles.body, { paddingTop: top + space.gutter }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>Раздел в разработке</Text>
        </View>
      )}
    </GlassHeaderScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.gutter },
  title: { fontFamily: fonts.display, fontSize: 32, textTransform: 'uppercase', color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 8 },
});
