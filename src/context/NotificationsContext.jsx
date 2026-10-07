import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFollowedArtists } from './FollowedArtistsContext';
import { fetchNotifications, markDelivered, markRead } from '../data/notifications';

/**
 * Polls the signed-in user's notifications (every minute + on tab focus).
 *
 * Newly arrived ("undelivered") notifications are applied, toasted, then
 * acked as delivered:
 *   artist_added → the requested artist is added to the roster. The DB trigger
 *   already added it server-side; re-adding locally keeps the in-memory roster
 *   in sync so the next roster save can't drop it.
 *
 * Processing waits until the roster has loaded (track() is a no-op before
 * then), so nothing is acked without being applied.
 */
const POLL_MS = 60_000;
const TOAST_MS = 8_000;

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { follow: track, loaded: rosterLoaded } = useFollowedArtists();

  const [feed, setFeed] = useState({ uid: null, notifications: [], unread: 0 });
  const [toasts, setToasts] = useState([]);
  const handled = useRef(new Set()); // ids applied this session (guards double-processing)
  const trackRef = useRef(track);
  useEffect(() => { trackRef.current = track; }, [track]);

  const current = feed.uid === uid;
  const notifications = current ? feed.notifications : [];
  const unread = current ? feed.unread : 0;

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return;
    let data;
    try {
      data = await fetchNotifications();
    } catch {
      return; // offline / DB hiccup — try again next poll
    }
    setFeed({ uid, notifications: data.notifications, unread: data.unread });

    const fresh = data.notifications.filter((n) => !n.delivered && !handled.current.has(n.id));
    if (!fresh.length) return;
    for (const n of fresh) {
      handled.current.add(n.id);
      if (n.type === 'artist_added' && n.data?.slug) trackRef.current(n.data.slug);
    }
    setToasts((prev) => [...prev, ...fresh]);
    fresh.forEach((n) => setTimeout(() => dismissToast(n.id), TOAST_MS));
    markDelivered(fresh.map((n) => n.id)).catch(() => {});
  }, [uid, dismissToast]);

  // Poll while signed in, once the roster is ready to receive additions.
  useEffect(() => {
    if (!uid || !rosterLoaded) return;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [uid, rosterLoaded, refresh]);

  // New account: forget what the previous one handled.
  useEffect(() => { handled.current = new Set(); }, [uid]);

  const markAllRead = useCallback(async () => {
    if (!unread) return;
    setFeed((prev) => ({
      ...prev,
      unread: 0,
      notifications: prev.notifications.map((n) => ({ ...n, read: true, delivered: true })),
    }));
    await markRead().catch(() => {});
  }, [unread]);

  return (
    <NotificationsContext.Provider value={{ notifications, unread, toasts, dismissToast, markAllRead, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook pair
export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
