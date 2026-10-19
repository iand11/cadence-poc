import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { fetchWidgets, putWidget, removeWidget, generateWidget } from '../data/customWidgets';
import { useAuth } from './useAuth';
import { useFollowedArtists } from './useFollowedArtists';

// Custom dashboard widgets, saved per account (/api/widgets). A widget is
// { id, prompt, spec, createdAt, updatedAt }; while it is being (re)built the store
// also holds { status, error } for it, which is never saved.

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

async function loadFor(uid) {
  setStore({ uid, widgets: [], loaded: !uid, error: null });
  if (!uid) return;
  try {
    const { widgets } = await fetchWidgets();
    if (store.uid === uid) setStore({ widgets, loaded: true });
  } catch (e) {
    if (store.uid === uid) setStore({ loaded: true, error: `Couldn't load your widgets: ${e.message}` });
  }
}

const saved = ({ id, prompt, spec, createdAt, updatedAt }) => ({ id, prompt, spec, createdAt, updatedAt });

async function build(id, prompt, groups) {
  const uid = store.uid;
  const current = store.widgets.find(w => w.id === id);
  patchWidget(id, { status: 'Thinking', error: null });
  try {
    const spec = await generateWidget(prompt, { groups, previous: current?.spec }, (status) => patchWidget(id, { status }));
    if (store.uid !== uid || !store.widgets.some(w => w.id === id)) return;
    const widget = { ...saved(store.widgets.find(w => w.id === id)), prompt, spec, updatedAt: new Date().toISOString() };
    patchWidget(id, { ...widget, status: null });
    await putWidget(widget);
  } catch (e) {
    if (store.uid === uid) patchWidget(id, { status: null, error: e.message });
  }
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

  /** Build a new widget from a request. Returns its id at once; the card shows progress. */
  const createWidget = useCallback((prompt) => {
    if (!store.uid) return null;
    const now = new Date().toISOString();
    const id = `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setStore({ widgets: [...store.widgets, { id, prompt, spec: null, createdAt: now, updatedAt: now }] });
    build(id, prompt, groups);
    return id;
  }, [groups]);

  /** Rebuild with fresh data, optionally from an edited request. */
  const rebuildWidget = useCallback((id, prompt) => {
    const w = store.widgets.find(x => x.id === id);
    if (w) build(id, prompt ?? w.prompt, groups);
  }, [groups]);

  const deleteWidget = useCallback((id) => {
    const w = store.widgets.find(x => x.id === id);
    setStore({ widgets: store.widgets.filter(x => x.id !== id) });
    // Never saved if it failed on its first build
    if (w?.spec) removeWidget(id).catch(e => setStore({ error: `Couldn't delete the widget: ${e.message}` }));
  }, []);

  return {
    widgets: current ? snap.widgets : [],
    loaded: current && snap.loaded,
    error: current ? snap.error : null,
    createWidget,
    rebuildWidget,
    deleteWidget,
  };
}
