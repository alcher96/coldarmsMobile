import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SocialKind, SocialLink } from '@/api/athlete';
import { fc } from '@/components/fight/palette';
import { colors, fonts, radii } from '@/theme/tokens';

/** Логотипы — те же контуры, что на странице атлета сайта (viewBox 24×24). У Instagram логотипа нет и на сайте. */
const ICONS: Partial<Record<SocialKind, string>> = {
  youtube:
    'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.5v-7l6.1 3.5-6.1 3.5Z',
  tiktok:
    'M16.6 2h-3.3v13.6a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.4a6.3 6.3 0 1 0 5.4 6.2V8.7a8 8 0 0 0 4.7 1.5V6.9a4.7 4.7 0 0 1-4.7-4.9Z',
  telegram:
    'M21.9 4.3 18.7 19.5c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.2l-4.8-1.5c-1-.3-1-1 .2-1.5L20.5 2.9c.9-.3 1.6.2 1.4 1.4Z',
};

/** Ссылки атлета на соцсети — открываются в приложении соцсети, если оно стоит, иначе в браузере. */
export function AthleteSocials({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;
  return (
    <View style={styles.row}>
      {links.map((l) => {
        const icon = ICONS[l.kind];
        return (
          <Pressable
            key={l.kind}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            hitSlop={4}
            accessibilityRole="link"
            accessibilityLabel={l.label}>
            {icon ? (
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d={icon} fill={colors.text} />
              </Svg>
            ) : null}
            <Text style={styles.label}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(11,11,12,0.55)',
  },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.soft },
});
