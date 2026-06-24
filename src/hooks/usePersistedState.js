import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../data/api';

/**
 * Hook that persists state to the user_data DB table, with localStorage fallback.
 * On first load: tries API, falls back to localStorage, migrates localStorage data to API.
 *
 * @param {string} key - Storage key (e.g. 'musicspace-favorites')
 * @param {*} defaultValue - Default value if nothing is stored
 * @returns {[value, setValue, { loaded }]}
 */
export function usePersistedState(key, defaultValue) {
  const [value, setValueRaw] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const latestValue = useRef(value);

  // Load from API on mount, fall back to localStorage
  useEffect(() => {
    let cancelled = false;

    api.getUserData(key)
      .then(data => {
        if (cancelled) return;
        if (data !== null && data !== undefined) {
          setValueRaw(data);
          latestValue.current = data;
          setLoaded(true);
        } else {
          // No API data — check localStorage and migrate
          const local = loadLocal(key);
          if (local !== null) {
            setValueRaw(local);
            latestValue.current = local;
            // Migrate to API in background
            api.setUserData(key, local).catch(() => {});
          }
          setLoaded(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // API unavailable — use localStorage
        const local = loadLocal(key);
        if (local !== null) {
          setValueRaw(local);
          latestValue.current = local;
        }
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [key]);

  // Debounced save to API + localStorage
  const setValue = useCallback((updater) => {
    setValueRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      latestValue.current = next;

      // Save to localStorage immediately (fast, offline-safe)
      saveLocal(key, next);

      // Debounce API save (300ms)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.setUserData(key, latestValue.current).catch(() => {});
      }, 300);

      return next;
    });
  }, [key]);

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
