import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = { data: T | null; error: Error | null; loading: boolean };

/**
 * Загрузка данных экрана с поддержкой pull-to-refresh. Смена `load` (например, другой фильтр)
 * перезапускает загрузку; ответ устаревшего запроса отбрасывается.
 */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await load();
      if (id === requestId.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (id === requestId.current) setState((s) => ({ data: s.data, error: e as Error, loading: false }));
    }
  }, [load]);

  useEffect(() => {
    run();
  }, [run]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  return { ...state, refreshing, refresh };
}
