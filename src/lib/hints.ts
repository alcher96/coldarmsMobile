import * as SecureStore from 'expo-secure-store';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Подсказки жестом («ленту можно листать»): не чаще раза за запуск, не больше трёх раз всего
 * и больше никогда, когда человек сделал жест сам. Счётчик — в SecureStore: другого хранилища
 * в приложении нет. При включённом «Уменьшении движения» подсказки не показываем.
 */
const MAX_SHOWS = 3;
const LEARNED = 'learned';
const shownThisLaunch = new Set<string>();
const learnedThisLaunch = new Set<string>();
const storeKey = (hint: string) => `ca_hint_${hint}`;

const read = (hint: string) => SecureStore.getItemAsync(storeKey(hint)).catch(() => null);
const write = (hint: string, value: string) => {
  SecureStore.setItemAsync(storeKey(hint), value).catch(() => {});
};

export async function shouldShowHint(hint: string) {
  if (Platform.OS === 'web' || shownThisLaunch.has(hint) || learnedThisLaunch.has(hint)) return false;
  const [stored, reduceMotion] = await Promise.all([
    read(hint),
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
  ]);
  return stored !== LEARNED && (Number(stored) || 0) < MAX_SHOWS && !reduceMotion;
}

export function markHintShown(hint: string) {
  shownThisLaunch.add(hint);
  read(hint).then((stored) => {
    // Пока читали, человек мог пролистать сам — тогда отметка «выучил» важнее счётчика.
    if (stored !== LEARNED && !learnedThisLaunch.has(hint)) write(hint, String((Number(stored) || 0) + 1));
  });
}

/** Человек сделал жест сам — подсказка больше не нужна. */
export function markHintLearned(hint: string) {
  shownThisLaunch.add(hint);
  learnedThisLaunch.add(hint);
  if (Platform.OS !== 'web') write(hint, LEARNED);
}
