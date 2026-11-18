import { requireOptionalNativeModule } from 'expo';

/** Обрезка и сжатие видео на телефоне перед отправкой (modules/video-prep, Android: Media3 Transformer).
 *  В Expo Go и на вебе модуля нет — тогда видео уходит как есть, а обрезает и сжимает сервер. */
type Prepared = { uri: string; bytes: number; durationS: number; sourceWidth: number; sourceHeight: number; bitrate: number };
/** Силуэт человека на кадре: контур в долях кадра (x0, y0, x1, y1, …), left/right — края по горизонтали. */
export type ScannedPerson = { points: number[]; left: number; right: number };

/** Кадры вступления: временная папка в кэше (стереть — releaseIntroFrames), файлы по порядку, частота исходника. */
export type IntroFrames = { dir: string; frames: string[]; fps: number; width: number; height: number };
type Native = {
  prepare(uri: string, start: number | null, end: number | null): Promise<Prepared>;
  cancel(): void;
  introFrames(uri: string, startS: number, durS: number, maxSide: number): Promise<IntroFrames>;
  cancelIntro(): void;
  releaseIntro(dir: string): void;
  releasePrepared(uri: string): void;
  scanPeople(uri: string, maxPeople: number, deadlineMs: number): Promise<{ people: ScannedPerson[] }>;
  cancelScan(): void;
  cleanCache(keep: string[]): void;
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

/** Кадры секунды схватки для вступления MIRA со смешиванием кадров (features/analysis/components/intro-blend).
 *  Не получилось (нет модуля, короткое видео, отмена) — null: вступления не будет, видео просто стоит на кадре.
 *  maxSide 960 — как у серверной нарезки (make_intro.py): на экране кадр не больше трети высоты. */
export async function extractIntroFrames(uri: string, startS: number, signal?: AbortSignal): Promise<IntroFrames | null> {
  if (!native || signal?.aborted) return null;
  const stop = () => native.cancelIntro();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const r = await native.introFrames(uri, startS, 1, 960);
    if (signal?.aborted) {
      native.releaseIntro(r.dir);
      return null;
    }
    return r;
  } catch {
    return null;
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}

/** Стереть временные кадры вступления (папку в кэше). */
export const releaseIntroFrames = (dir: string) => native?.releaseIntro(dir);

/** Наша сжатая копия в кэше (prep_*.mp4) — её можно стирать; оригинал из галереи — нельзя. */
export const isPreparedVideo = (uri: string) => /\/cache\/prep_\d+\.mp4$/.test(uri);

/** Стереть сжатую копию — видео уже на сервере (или разбор удалён). */
export const releasePreparedVideo = (uri: string) => {
  if (isPreparedVideo(uri)) native?.releasePrepared(uri);
};

/** Уборка кэша: сжатые копии, кроме ещё не досланных (keep), и папки кадров прерванных вступлений. */
export const cleanVideoCache = (keep: string[]) => native?.cleanCache(keep);

/** Силуэты людей на кадре (файл кадра вступления) — для «скана» MIRA поверх замершего кадра.
 *  deadlineMs — не дольше (0 — без срока): вышло время — поиск на телефоне останавливается и отдаёт готовые силуэты;
 *  signal — ушли с экрана: поиск останавливается. Нет модуля / ошибка / ни одного силуэта — null. */
export async function scanPeople(
  frameUri: string, maxPeople = 8, deadlineMs = 0, signal?: AbortSignal,
): Promise<ScannedPerson[] | null> {
  if (!native || signal?.aborted) return null;
  const stop = () => native.cancelScan();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const people = (await native.scanPeople(frameUri, maxPeople, Number.isFinite(deadlineMs) ? deadlineMs : 0)).people;
    return people.length && !signal?.aborted ? people : null;
  } catch {
    return null;
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}
