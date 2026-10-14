import { useEffect, useState } from 'react';

/**
 * Строка поиска: `query` — то, что в поле, `search` — то, по чему ищем.
 * `search` догоняет `query`, когда пользователь перестал печатать; `submit` — искать сразу.
 */
export function useSearch(initial = '', delay = 400) {
  const [query, setQuery] = useState(initial);
  const [search, setSearch] = useState(initial.trim());

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const submit = () => setSearch(query.trim());

  return { query, setQuery, search, submit };
}
