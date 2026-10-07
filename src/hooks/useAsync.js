import { useEffect, useState } from 'react';

/**
 * Run an async loader whenever `deps` change.
 * Returns { data, loading, error } — `data` keeps the previous result while a
 * new one loads (no flash of empty lists when paging / filtering).
 */
export function useAsync(loader, deps) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: undefined, error: null });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(loader)
      .then((data) => { if (!cancelled) setState({ key, data, error: null }); })
      .catch((error) => { if (!cancelled) setState((s) => ({ key, data: s.data, error })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the caller's deps
  }, [key]);
  return { data: state.data, loading: state.key !== key, error: state.key === key ? state.error : null };
}
