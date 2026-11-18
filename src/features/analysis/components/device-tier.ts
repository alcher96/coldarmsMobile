import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** Класс устройства для анимаций MIRA (по образцу Telegram, SharedConfig.measureDevicePerformanceClass):
 *  high — полная анимация глаз; mid — 30 кадров/с без мелких деталей; low — статичный кадр на каждое состояние.
 *  Считается один раз при запуске по характеристикам, без замеров. Пороги — прикидка, не проверены на слабых телефонах. */
export type DeviceTier = 'low' | 'mid' | 'high';

const GB = 1024 ** 3;

let tier: DeviceTier | null = null;

export function deviceTier(): DeviceTier {
  if (tier) return tier;
  // для проверки на своём телефоне: EXPO_PUBLIC_DEVICE_TIER=low|mid|high при запуске Expo
  const forced = process.env.EXPO_PUBLIC_DEVICE_TIER;
  if (forced === 'low' || forced === 'mid' || forced === 'high') return (tier = forced);
  const year = Device.deviceYearClass; // «год» телефона по памяти, ядрам и частоте (Facebook Device Year Class)
  const mem = Device.totalMemory; // байты; телефон «3 ГБ» сообщает ~2.6–2.8 ГБ
  if (Platform.OS === 'web') tier = 'high';
  else if (Platform.OS === 'ios') {
    // у iPhone мало памяти даже у быстрых моделей — память не учитываем
    tier = year != null && year <= 2016 ? 'low' : year != null && year <= 2018 ? 'mid' : 'high';
  } else if (mem != null) {
    // Android — по памяти: «год телефона» на новых Android врёт (Galaxy S23 Ultra, Android 17 — «2016»: частоты
    // процессора приложению больше не видны), и глаза становились статичными (эксперт, 2026-11-15)
    tier = mem < 2.5 * GB ? 'low' : mem < 4.5 * GB ? 'mid' : 'high'; // ≤ 2 ГБ / 3–4 ГБ (Galaxy A30) / больше
  } else tier = year != null && year <= 2016 ? 'low' : year != null && year <= 2019 ? 'mid' : 'high';
  return tier;
}
