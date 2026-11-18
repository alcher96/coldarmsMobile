import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { useAnalysisDraft } from './draft';
import { videoSize } from './video-size';

/** Выбор видео схватки из галереи → обрезка (оставить только схватку) → разговор с MIRA. */
export function usePickVideo() {
  const draft = useAnalysisDraft();
  return async () => {
    // на вебе выбор файла — только по нажатию пользователя
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const size = await videoSize(a.uri, a.width, a.height);
    draft.reset();
    // размер файла — для отправки кусками; на вебе его даёт File, на телефоне — сам выбор из галереи
    const bytes = a.fileSize ?? a.file?.size ?? (await fetch(a.uri).then((r) => r.blob()).then((b) => b.size));
    draft.setVideo(a.uri, a.fileName ?? undefined, size ? size.w / size.h : undefined, bytes,
      a.duration ? a.duration / 1000 : undefined);
    router.push('/mira/trim');
  };
}
