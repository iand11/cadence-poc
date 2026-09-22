import { useState, useEffect, useCallback } from 'react';
import * as api from '../data/userData';
import { useAuth } from './useAuth';

/**
 * Hook that persists state to the user_data DB table, with localStorage fallback.
 *
 * Scoped to the signed-in Firebase user: nothing is read or written until auth
 * has resolved to a user (otherwise the request would go out without a token
 * and hit the wrong — or no — account), and the value reloads from the server
 * whenever the user changes. Signed out, the value resets to the default.
 *
 * On load: tries API, falls back to localStorage, migrates localStorage data to API.
 *
 * @param {string} key - Storage key (e.g. 'musicspace-favorites')
 * @param {*} defaultValue - Default value if nothing is stored
 * @returns {[value, setValue, { loaded }]}
 */
export function usePersistedState(key, defaultValue) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  // Value + the uid it was loaded for; `loaded` is derived so a user switch
  // immediately reads as not-loaded (no setState in the effect body).
  const [state, setState] = useState({ uid: undefined, value: defaultValue });
  // First-render default, stable across renders (callers pass fresh [] / {} literals)
  const [initialDefault] = useState(defaultValue);

  const loaded = !authLoading && state.uid === uid;
  const value = loaded ? state.value : initialDefault;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const settle = (v) => {
      if (!cancelled) setState({ uid, value: v });
    };

    if (!uid) {
      settle(initialDefault);
      return () => { cancelled = true; };
    }

    api.getUserData(key)
      .then(data => {
        if (data !== null && data !== undefined) return settle(data);
        // No API data — check localStorage and migrate
        const local = loadLocal(key);
        if (local !== null) api.setUserData(key, local).catch(() => {});
        settle(local ?? initialDefault);
      })
      .catch(() => {
        // API unavailable — use localStorage
        settle(loadLocal(key) ?? initialDefault);
      });

    return () => { cancelled = true; };
  }, [key, uid, authLoading, initialDefault]);

  // Save to localStorage now + debounced API save (flushed on sign-out).
  // Ignored until loaded, so a write can never clobber the server copy with
  // a not-yet-loaded default.
  const setValue = useCallback((updater) => {
    if (!loaded) return;
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev.value) : updater;
      saveLocal(key, next);
      api.queueUserData(key, next);
      return { ...prev, value: next };
    });
  }, [key, loaded]);

  return [value, setValue, { loaded }];
}

function loadLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, ignore */ }
}
