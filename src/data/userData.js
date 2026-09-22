// Per-user key/value persistence (/api/user-data, Firebase-authed).
// Extracted from api.js so the persistence layer has NO dependency on the
// artist data modules — usePersistedState must be importable before any
// roster data exists.
import { getIdToken } from '../lib/firebase';

async function authHeaders(base = {}) {
  const token = await getIdToken();
  const headers = { ...base };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function getUserData(key) {
  const headers = await authHeaders();
  const res = await fetch(`/api/user-data?key=${encodeURIComponent(key)}`, { headers });
  if (!res.ok) throw new Error(`user-data ${res.status}`);
  const body = await res.json();
  return body?.data ?? null;
}

export async function setUserData(key, value) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  await fetch('/api/user-data', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, data: value }),
  });
}

// Debounced saves, keyed by storage key. Kept at module level so sign-out can
// flush them while the auth token is still valid.
const SAVE_DEBOUNCE_MS = 300;
const pending = new Map(); // key -> { value, timer }

export function queueUserData(key, value) {
  const prev = pending.get(key);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    setUserData(key, value).catch(() => {});
  }, SAVE_DEBOUNCE_MS);
  pending.set(key, { value, timer });
}

/** Send every queued save now. Call before signing out. */
export async function flushUserData() {
  const entries = [...pending.entries()];
  pending.clear();
  await Promise.all(entries.map(([key, { value, timer }]) => {
    clearTimeout(timer);
    return setUserData(key, value).catch(() => {});
  }));
}

/** Drop queued saves without sending (the signed-in user changed). */
export function cancelUserData() {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
}
