import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { colors, fonts, space } from '@/theme/tokens';

/** Заглушка для вкладок, которые ещё не сверстаны. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>Раздел в разработке</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.gutter },
  title: { fontFamily: fonts.display, fontSize: 32, textTransform: 'uppercase', color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 8 },
});
