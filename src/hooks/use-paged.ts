import { useCallback, useEffect, useRef, useState } from 'react';

type Page<T> = { items: T[]; totalPages: number; totalCount?: number };

/**
 * Постраничный список с догрузкой. Смена `fetchPage` (другой фильтр) сбрасывает список;
 * ответы, пришедшие после сброса, отбрасываются.
 */
export function usePaged<T>(fetchPage: (page: number) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);

  // Сброс при смене фильтра — прямо в рендере (https://react.dev/learn/you-might-not-need-an-effect),
  // чтобы не показывать кадр со старым списком.
  const [current, setCurrent] = useState(() => fetchPage);
  if (current !== fetchPage) {
    setCurrent(() => fetchPage);
    setItems([]);
    setPage(0);
    setTotalPages(1);
    setTotalCount(null);
    setLoading(true);
    setError(false);
  }

  /** Запрос страницы. Состояние меняется только в колбэках ответа; «загрузка» выставлена заранее. */
  const request = useCallback(
    (p: number, reset: boolean) => {
      const gen = reset ? ++generation.current : generation.current;
      return fetchPage(p).then(
        (res) => {
          if (gen !== generation.current) return;
          setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
          setPage(p);
          setTotalPages(res.totalPages);
          if (res.totalCount != null) setTotalCount(res.totalCount);
          setLoading(false);
        },
        () => {
          if (gen !== generation.current) return;
          setError(true);
          setLoading(false);
        },
      );
    },
    [fetchPage],
  );

  useEffect(() => {
    request(1, true);
  }, [request]);

  const start = useCallback(
    (p: number, reset: boolean) => {
      setLoading(true);
      setError(false);
      request(p, reset);
    },
    [request],
  );

  const loadMore = useCallback(() => {
    if (!loading && !error && page < totalPages) start(page + 1, false);
  }, [loading, error, page, totalPages, start]);

  const retry = useCallback(() => start(page === 0 ? 1 : page + 1, page === 0), [start, page]);
  const reload = useCallback(() => start(1, true), [start]);

  return { items, totalCount, loading, error, loadMore, retry, reload };
}
