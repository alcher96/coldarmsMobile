import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radii } from '@/theme/tokens';

const INDIGO = '#6366F1';
const INDIGO_LIGHT = '#A5B4FC';

/** Кнопка «Разбор M.I.R.A.»: индиговое свечение мягко пульсирует, чтобы разбор не пропустили. */
export function MiraButton({ onPress }: { onPress: () => void }) {
  // Анимированные значения создаём один раз; сами они меняются на нативной стороне, без ререндеров.
  const [{ pulse, glow, dotScale, dotFade }] = useState(() => {
    const v = new Animated.Value(0);
    return {
      pulse: v,
      glow: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
      dotScale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }),
      dotFade: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    };
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Разбор M.I.R.A.">
      {({ pressed }) => (
        <View style={[styles.button, pressed && styles.pressed]}>
          {/* Пульсирующая подсветка — отдельный слой поверх статичной рамки. */}
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />
          <Sparkles size={16} color={INDIGO_LIGHT} strokeWidth={1.8} />
          <Text style={styles.text}>Разбор M.I.R.A.</Text>
          <View style={styles.dotWrap}>
            <Animated.View style={[styles.dot, styles.ring, { opacity: dotFade, transform: [{ scale: dotScale }] }]} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  pressed: { opacity: 0.8 },
  glow: {
    ...StyleSheet.absoluteFill,
    margin: -1,
    borderRadius: radii.control,
    borderWidth: 1.5,
    borderColor: INDIGO,
    backgroundColor: 'rgba(99,102,241,0.14)',
  },
  text: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: INDIGO_LIGHT },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: INDIGO },
  ring: { position: 'absolute' },
  chevron: { fontSize: 20, color: INDIGO_LIGHT, marginTop: -2 },
});
