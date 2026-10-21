import { useState, useEffect, useCallback } from 'react';
import { fetchTikTokConnection } from '../data/tiktokAds';

// Shared across hook instances (like useMetaConnection) so the Campaigns page, the account
// dialog and the builders agree on the TikTok connection without each refetching.
let _state = { loading: true, connection: null, error: null };
let _inflight = null;
const _listeners = new Set();

function setState(next) {
  _state = { ..._state, ...next };
  for (const fn of _listeners) fn(_state);
}

function load() {
  if (_inflight) return _inflight;
  _inflight = fetchTikTokConnection()
    .then(connection => setState({ loading: false, connection, error: null }))
    .catch(error => setState({ loading: false, error }))
    .finally(() => { _inflight = null; });
  return _inflight;
}

let _loadedOnce = false;

/** TikTok connection: { loading, connection, error, refresh() } */
export function useTikTokConnection() {
  const [state, setLocal] = useState(_state);

  useEffect(() => {
    _listeners.add(setLocal);
    if (!_loadedOnce) { _loadedOnce = true; load(); }
    return () => { _listeners.delete(setLocal); };
  }, []);

  const refresh = useCallback(() => load(), []);

  return { ...state, refresh };
}
