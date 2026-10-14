import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

/** Переключатель фильтра: выбранный сегмент светлый (как в макете). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.control + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  item: {
    flex: 1,
    height: 36,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    paddingHorizontal: 4,
  },
  itemActive: { backgroundColor: colors.light, borderColor: colors.light },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  labelActive: { fontFamily: fonts.bodySemi, color: colors.lightText },
});
