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
