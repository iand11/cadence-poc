// In-app notifications (/api/notifications, Firebase-authed).
import { getIdToken } from '../lib/firebase';

async function authHeaders(base = {}) {
  const headers = { ...base };
  const token = await getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** @returns {Promise<{notifications: Array, unread: number}>} */
export async function fetchNotifications() {
  const res = await fetch('/api/notifications', { headers: await authHeaders() });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  return res.json();
}

async function post(body) {
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
}

export const markDelivered = (ids) => post({ action: 'delivered', ids });
/** No ids = mark everything read. */
export const markRead = (ids) => post({ action: 'read', ...(ids ? { ids } : {}) });
