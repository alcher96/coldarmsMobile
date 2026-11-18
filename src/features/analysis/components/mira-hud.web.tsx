import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CyberEyes, type CyberState } from './cyber-eyes';
import { mira } from './mira';

/** В браузере (проверка прототипа) — прежние глаза 4a и подпись: HUD шлема рисует Skia на телефоне (mira-hud.tsx). */
export const MiraHud = memo(function MiraHud({ state, width, intro = 0, down = false, statusText, statusColor, collapsed = false, sleep = false }: {
  state: CyberState; width: number; intro?: number; down?: boolean; statusText: string; statusColor: string; collapsed?: boolean; sleep?: boolean;
}) {
  const w = Math.min(320, width - 70);
  return (
    <View style={{ width, alignItems: 'center', gap: 8, paddingVertical: 10 }}>
      {collapsed ? null : <CyberEyes state={state} w={w} intro={intro} down={down} sleep={sleep} />}
      <View style={styles.row}>
        <Text style={styles.name}>MIRA</Text>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: mira.display, fontSize: 17, letterSpacing: 1.7, color: mira.name, marginRight: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontFamily: mira.font, fontSize: 12 },
});
