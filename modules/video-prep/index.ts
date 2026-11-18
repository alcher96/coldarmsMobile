import { requireOptionalNativeModule } from 'expo';

/** Обрезка и сжатие видео на телефоне перед отправкой (modules/video-prep, Android: Media3 Transformer).
 *  В Expo Go и на вебе модуля нет — тогда видео уходит как есть, а обрезает и сжимает сервер. */
type Prepared = { uri: string; bytes: number; durationS: number; sourceWidth: number; sourceHeight: number; bitrate: number };
type Native = {
  prepare(uri: string, start: number | null, end: number | null): Promise<Prepared>;
  cancel(): void;
  addListener(event: 'onProgress', cb: (e: { progress: number }) => void): { remove(): void };
};

const native = requireOptionalNativeModule<Native>('VideoPrep');

export const canPrepareOnPhone = native != null;

/** Обрезать (если задан кусок) и привести к стандарту. Не получилось — null: отправим как есть, сервер справится.
 *  signal — токен отмены: ушли с экрана — сжатие останавливается сразу (Media3 Transformer.cancel). */
export async function prepareVideo(
  uri: string,
  trim: [number, number] | undefined,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<Prepared | null> {
  if (!native || signal?.aborted) return null;
  const sub = native.addListener('onProgress', (e) => onProgress(e.progress));
  const stop = () => native.cancel();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    return await native.prepare(uri, trim?.[0] ?? null, trim?.[1] ?? null);
  } catch {
    return null;
  } finally {
    signal?.removeEventListener('abort', stop);
    sub.remove();
  }
}

export const cancelPrepare = () => native?.cancel();
