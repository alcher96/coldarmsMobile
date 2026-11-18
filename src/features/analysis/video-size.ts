import { Platform } from 'react-native';

/** Размер кадра видео. На телефоне его даёт галерея (asset.width/height); в браузере галерея может вернуть 0 —
 *  тогда читаем метаданные через скрытый <video>. Нужен, чтобы вертикальное видео показывать по своему шаблону
 *  и чтобы половины «Я слева / Я справа» совпадали с кадром. */
export async function videoSize(uri: string, w?: number, h?: number): Promise<{ w: number; h: number } | null> {
  if (w && h) return { w, h };
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => resolve(v.videoWidth && v.videoHeight ? { w: v.videoWidth, h: v.videoHeight } : null);
    v.onerror = () => resolve(null);
    v.src = uri;
  });
}

/** Растянуть видео на весь кадр. На вебе expo-video отдаёт стиль прямо тегу <video>, а у него left/right: 0 не
 *  растягивают ширину (видео прижималось к левому краю) — нужны явные width/height 100%. */
export const VIDEO_FILL = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
