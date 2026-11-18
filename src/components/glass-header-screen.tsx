import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, type ComponentRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, HEADER_HEIGHT } from '@/components/app-header';
import { colors } from '@/theme/tokens';

// Системное «жидкое стекло» — только iOS 26 и новее (на остальных GlassView — обычный View); проверка один раз.
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * Экран вкладки со «стеклянной» шапкой: содержимое прокручивается под шапкой, шапка мягко его размывает.
 *
 *  • iOS 26 — системное Liquid Glass (expo-glass-effect);
 *  • Android 12+ и iOS до 26 — размытие того, что под шапкой (expo-blur: на Android — RenderNode, считает видеокарта);
 *  • Android 11 и старше — полупрозрачная тёмная заливка без размытия (dimezisBlurViewSdk31Plus сам откатывается на
 *    неё: старый способ размытия тормозит на слабых телефонах).
 * Поверх — мягкий тёмный тон, едва заметный блик сверху и светлая кромка снизу — край стекла.
 *
 * children(top) — содержимое; top — высота шапки вместе с полосой состояния: отступ сверху у прокрутки и у колеса
 * обновления. underScroll=false — содержимое начинается под шапкой (экран с «липкими» вкладками: прилипли бы под стекло).
 */
export function GlassHeaderScreen({
  children,
  underScroll = true,
}: {
  children: (top: number) => ReactNode;
  underScroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT;
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={[styles.fill, !underScroll && { paddingTop: top }]}>
        {children(underScroll ? top : 0)}
      </BlurTargetView>
      <View style={[styles.bar, { height: top }]} pointerEvents="box-none">
        {LIQUID ? (
          <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(11,11,12,0.6)" />
        ) : (
          <>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurTarget={target}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={45}
              tint="dark"
            />
            <View style={[StyleSheet.absoluteFill, styles.tone]} />
          </>
        )}
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.01)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
        />
        <View pointerEvents="none" style={styles.edge} />
        <View style={{ paddingTop: insets.top }}>
          <AppHeader />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, backgroundColor: colors.bg },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  // тон стекла: содержимое видно, но приглушённо (на Android 11- поверх полупрозрачной заливки — почти сплошной)
  tone: { backgroundColor: 'rgba(11,11,12,0.66)' },   // темнее (эксперт, 2026-11-17): было 0.42
  // край стекла: тонкая светлая линия
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
