// Общее для модалки оценки видео (телефон — quality-modal.tsx, браузер — quality-modal.web.tsx).
import { StyleSheet } from 'react-native';

import { mira } from './mira';
import { SEA } from './mira-theme';

export const NOTE = (score: number) =>
  score >= 4
    ? 'Видео хорошее — разбор будет точным.'
    : score === 3
      ? 'Разобрать можно, но в отмеченных местах MIRA будет осторожнее.'
      : 'По такому видео разбор может выйти неточным. Можно продолжить или загрузить другое.';

export const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  card: { gap: 12 },
  note: { fontFamily: mira.font, fontSize: 13, lineHeight: 19, color: mira.soft, textAlign: 'center', paddingHorizontal: 8 },
  go: {
    height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SEA.sea,
  },
  goText: { fontFamily: mira.display, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: SEA.onSea },
  other: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141416', borderWidth: 1, borderColor: '#2E2E33' },
  otherText: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.text },
});
