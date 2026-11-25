// Оценка видео — модалка поверх разговора с MIRA, фон размыт (эксперт, 2026-11-16).
//
// Фон — ГОТОВАЯ размытая картинка (assets/mira/modal-bg.jpg, 3 КБ; scripts/make_modal_bg.py), одна на всех: снимок
// экрана в момент открытия на Android давал фриз ~3 с (весь экран рисуется в картинку в основном потоке). Картинка
// растягивается на экран и показывается плавным появлением (анимация прозрачности на нативной стороне) — без затрат
// на любом телефоне. Пока модалка открыта, визор MIRA свёрнут и не рисуется, фон MIRA выключен, видео на паузе.
import { useEffect, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Quality } from '../types';
import { QualityPanel } from './quality';
import { NOTE, styles } from './quality-modal.shared';
import { SEA } from './mira-theme';

const BG = require('../../../../assets/mira/modal-bg.jpg');

export function QualityModal({ q, onGo, onOther }: { q: Quality; onGo: () => void; onOther: () => void }) {
  const op = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [op]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: op }]}>
      <Image source={BG} style={FILL} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,9,.35)' }]} />
      <View style={styles.wrap}>
        <View style={styles.card}>
          <QualityPanel q={q} />
          <Text style={styles.note}>{NOTE(q.score)}</Text>
          <Pressable onPress={onGo} style={({ pressed }) => [styles.go, pressed && { backgroundColor: SEA.seaPressed }]}>
            <Text style={styles.goText}>Продолжить к разбору</Text>
          </Pressable>
          <Pressable onPress={onOther} style={({ pressed }) => [styles.other, pressed && { backgroundColor: '#1E1E23' }]}>
            <Text style={styles.otherText}>Другое видео — новый разбор и токен</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// на вебе у <img> absoluteFill не растягивает — размер явно
const FILL = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;
