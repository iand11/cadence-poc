import { useState, useEffect, useCallback } from 'react';
import { fetchMetaConnection } from '../data/metaAds';

// Shared across hook instances so the Campaigns page, the account dialog and the
// detail page agree on connection state without each refetching.
let _state = { loading: true, connection: null, error: null };
let _inflight = null;
const _listeners = new Set();

function setState(next) {
  _state = { ..._state, ...next };
  for (const fn of _listeners) fn(_state);
}

function load({ assets = false } = {}) {
  if (_inflight && !assets) return _inflight;
  const p = fetchMetaConnection({ assets })
    .then(connection => setState({ loading: false, connection, error: null }))
    .catch(error => setState({ loading: false, error }))
    .finally(() => { if (_inflight === p) _inflight = null; });
  if (!assets) _inflight = p;
  return p;
}

let _loadedOnce = false;

/** Meta ad account connection: { loading, connection, error, refresh(withAssets?) } */
export function useMetaConnection() {
  const [state, setLocal] = useState(_state);

  useEffect(() => {
    _listeners.add(setLocal);
    if (!_loadedOnce) { _loadedOnce = true; load(); }
    return () => { _listeners.delete(setLocal); };
  }, []);

  const refresh = useCallback((withAssets = false) => load({ assets: withAssets }), []);

  return { ...state, refresh };
}
