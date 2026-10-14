import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * Системная «Назад» сначала откатывает последнее действие на экране (стереть поиск, вернуть
 * фильтр), и только когда откатывать нечего — уводит с экрана. `undo` возвращает true, если
 * что-то откатил. Работает, пока экран в фокусе.
 */
export function useBackStep(undo: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', undo);
      return () => sub.remove();
    }, [undo]),
  );
}

/** Состояние с историей: каждое изменение запоминает прошлое значение, `back` возвращает его. */
export function useHistoryState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [history, setHistory] = useState<T[]>([]);

  const set = (next: T | ((prev: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    if (Object.is(resolved, value)) return;
    setHistory((h) => [...h, value]);
    setValue(resolved);
  };

  const back = () => {
    if (!history.length) return false;
    setValue(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    return true;
  };

  return { value, set, back };
}
