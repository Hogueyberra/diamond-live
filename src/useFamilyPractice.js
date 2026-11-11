import { useCallback, useEffect, useRef, useState } from 'react';

/** Memory only. Scope changes and denied reads remove data; stale network responses never replace a newer read. */
export function useFamilyPractice(repository) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await repository.load();
      if (generation.current === request) setState({ data, loading: false, error: '' });
      return data;
    } catch (error) {
      if (generation.current === request) setState((previous) => ({ data: error.code === '42501' ? null : previous.data, loading: false, error: error.message }));
      throw error;
    }
  }, [repository]);
  useEffect(() => {
    setState({ data: null, loading: true, error: '' });
    void refresh().catch(() => {});
    const focus = () => { void refresh().catch(() => {}); };
    window.addEventListener('focus', focus);
    const timer = setInterval(focus, 15000);
    return () => { ++generation.current; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);
  const clear = useCallback(() => { ++generation.current; setState({ data: null, loading: false, error: 'Your family access changed. Refresh your access.' }); }, []);
  return { ...state, refresh, clear };
}
