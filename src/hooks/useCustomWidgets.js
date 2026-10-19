import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { fetchWidgets, putWidget, removeWidget, rebuildWidgetSpec } from '../data/customWidgets';
import { useAuth } from './useAuth';
import { useFollowedArtists } from './useFollowedArtists';

// Custom dashboard widgets, saved per account (/api/widgets). A widget is
// { id, requests, spec, hidden, createdAt, updatedAt }: `requests` is the first ask
// plus each change the user made in the builder, `hidden` takes it off the dashboard
// (it stays under Available Widgets). While a refresh runs the store also holds
// { refreshing, error } for it, which is never saved.

let store = { uid: undefined, widgets: [], loaded: false, error: null };
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => store;
function setStore(patch) {
  store = { ...store, ...patch };
  for (const fn of listeners) fn();
}
const patchWidget = (id, patch) =>
  setStore({ widgets: store.widgets.map(w => (w.id === id ? { ...w, ...patch } : w)) });

// Widgets saved before builder iterations kept a single `prompt`
const normalize = (w) => ({ ...w, requests: w.requests || (w.prompt ? [w.prompt] : []) });
const saved = ({ id, requests, spec, hidden, createdAt, updatedAt }) => ({ id, requests, spec, hidden: !!hidden, createdAt, updatedAt });

async function loadFor(uid) {
  setStore({ uid, widgets: [], loaded: !uid, error: null });
  if (!uid) return;
  try {
    const { widgets } = await fetchWidgets();
    if (store.uid === uid) setStore({ widgets: widgets.map(normalize), loaded: true });
  } catch (e) {
    if (store.uid === uid) setStore({ loaded: true, error: `Couldn't load your widgets: ${e.message}` });
  }
}

function persist(widget) {
  return putWidget(saved(widget)).catch(e => setStore({ error: `Couldn't save the widget: ${e.message}` }));
}

export function useCustomWidgets() {
  const { user, loading: authLoading } = useAuth();
  const { groups } = useFollowedArtists();
  const uid = authLoading ? undefined : user?.uid ?? null;
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (uid !== undefined && store.uid !== uid) loadFor(uid);
  }, [uid]);

  const current = uid !== undefined && snap.uid === uid;

  /** Save a widget confirmed in the builder: a new one (no id) or an edited one. Returns its id. */
  const saveWidget = useCallback(({ id, requests, spec }) => {
    if (!store.uid) return null;
    const now = new Date().toISOString();
    const existing = id && store.widgets.find(w => w.id === id);
    const widget = existing
      ? { ...existing, requests, spec, hidden: false, updatedAt: now, error: null }
      : { id: `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, requests, spec, hidden: false, createdAt: now, updatedAt: now };
    setStore({ widgets: existing ? store.widgets.map(w => (w.id === id ? widget : w)) : [...store.widgets, widget] });
    persist(widget);
    return widget.id;
  }, []);

  /** Show or hide a widget on the dashboard. */
  const setHidden = useCallback((id, hidden) => {
    const w = store.widgets.find(x => x.id === id);
    if (!w || !!w.hidden === hidden) return;
    const next = { ...w, hidden };
    patchWidget(id, { hidden });
    persist(next);
  }, []);

  /** Rebuild from the saved requests with fresh data. */
  const refreshWidget = useCallback(async (id) => {
    const w = store.widgets.find(x => x.id === id);
    if (!w || w.refreshing) return;
    const uidAtStart = store.uid;
    patchWidget(id, { refreshing: true, error: null });
    try {
      const spec = await rebuildWidgetSpec(w, { groups });
      if (store.uid !== uidAtStart || !store.widgets.some(x => x.id === id)) return;
      const next = { ...store.widgets.find(x => x.id === id), spec, updatedAt: new Date().toISOString(), refreshing: false };
      patchWidget(id, next);
      persist(next);
    } catch (e) {
      if (store.uid === uidAtStart) patchWidget(id, { refreshing: false, error: e.message });
    }
  }, [groups]);

  const deleteWidget = useCallback((id) => {
    setStore({ widgets: store.widgets.filter(x => x.id !== id) });
    removeWidget(id).catch(e => setStore({ error: `Couldn't delete the widget: ${e.message}` }));
  }, []);

  return {
    widgets: current ? snap.widgets : [],
    loaded: current && snap.loaded,
    error: current ? snap.error : null,
    saveWidget,
    setHidden,
    refreshWidget,
    deleteWidget,
  };
}
