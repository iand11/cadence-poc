import { useMemo, useCallback, useEffect, useSyncExternalStore } from 'react';
import { CAMPAIGN_PLATFORMS, isCampaignPlatform } from '../data/directives';
import { fetchCampaigns, putCampaign, importCampaigns, removeCampaign } from '../data/campaignsRemote';
import { useAuth } from './useAuth';

// Campaigns are saved per account (/api/campaigns). Earlier versions kept them only in
// this browser under LEGACY_KEY; those are moved into the signed-in account on first load.
const LEGACY_KEY = 'musicspace-directives-v2';

function loadLegacy() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    // Drop the sample campaigns earlier versions seeded (ids "seed-1"…"seed-6")
    return Array.isArray(parsed) ? parsed.filter(d => d?.id && !String(d.id).startsWith('seed-')) : [];
  } catch {
    return [];
  }
}

const EMPTY = [];
const newestFirst = (list) => [...list].sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));

// One store shared by every hook instance, for the signed-in account
let store = { uid: undefined, directives: [], loaded: false, error: null };
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => store;
function setStore(patch) {
  store = { ...store, ...patch };
  for (const fn of listeners) fn();
}

async function loadFor(uid) {
  cancelCampaignSaves();
  setStore({ uid, directives: [], loaded: !uid, error: null });
  if (!uid) return;
  try {
    let { campaigns } = await fetchCampaigns();
    const legacy = loadLegacy();
    if (legacy.length) {
      const known = new Set(campaigns.map(c => c.id));
      const missing = legacy.filter(d => !known.has(d.id));
      if (missing.length) {
        await importCampaigns(missing);
        campaigns = newestFirst([...campaigns, ...missing]);
      }
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    }
    if (store.uid === uid) setStore({ directives: campaigns, loaded: true });
  } catch (e) {
    if (store.uid === uid) setStore({ loaded: true, error: `Couldn't load your campaigns: ${e.message}` });
  }
}

// Saves are per campaign, debounced (the Meta panel updates a campaign on every sync)
const SAVE_DEBOUNCE_MS = 500;
const pendingSaves = new Map(); // id -> timer

function saveNow(id) {
  pendingSaves.delete(id);
  const d = store.directives.find(x => x.id === id);
  if (!d) return Promise.resolve();
  return putCampaign(d).catch(e => setStore({ error: `Couldn't save a campaign change: ${e.message}` }));
}

function queueSave(id) {
  clearTimeout(pendingSaves.get(id));
  pendingSaves.set(id, setTimeout(() => saveNow(id), SAVE_DEBOUNCE_MS));
}

/** Send queued campaign saves now. Call before signing out. */
export function flushCampaignSaves() {
  const ids = [...pendingSaves.keys()];
  for (const id of ids) clearTimeout(pendingSaves.get(id));
  return Promise.all(ids.map(saveNow));
}

function cancelCampaignSaves() {
  for (const t of pendingSaves.values()) clearTimeout(t);
  pendingSaves.clear();
}

/** Apply `fn` to the list and save the campaigns whose object changed. Ignored until loaded. */
function change(fn) {
  if (!store.loaded || !store.uid) return;
  const prev = new Map(store.directives.map(d => [d.id, d]));
  const next = fn(store.directives);
  setStore({ directives: next });
  for (const d of next) if (prev.get(d.id) !== d) queueSave(d.id);
}

export function useDirectives() {
  const { user, loading: authLoading } = useAuth();
  const uid = authLoading ? undefined : user?.uid ?? null;
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (uid !== undefined && store.uid !== uid) loadFor(uid);
  }, [uid]);

  const current = uid !== undefined && snap.uid === uid;
  const allDirectives = current ? snap.directives : EMPTY;
  // Older campaigns on platforms Campaigns no longer covers stay saved but are hidden
  const directives = useMemo(() => allDirectives.filter(d => isCampaignPlatform(d.platform)), [allDirectives]);

  const directivesByArtist = useCallback((slug) => {
    return directives.filter(d => d.artistSlug === slug);
  }, [directives]);

  const directivesByStatus = useMemo(() => {
    const map = { draft: [], pending_approval: [], approved: [], executing: [], paused: [], active: [], completed: [], failed: [], rejected: [] };
    for (const d of directives) {
      if (map[d.status]) map[d.status].push(d);
    }
    return map;
  }, [directives]);

  const createDirective = useCallback((data) => {
    change(list => [data, ...list]);
    return data.id;
  }, []);

  const updateDirective = useCallback((id, updates) => {
    change(list => list.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDirective = useCallback((id) => {
    if (!store.loaded || !store.uid) return;
    clearTimeout(pendingSaves.get(id));
    pendingSaves.delete(id);
    setStore({ directives: store.directives.filter(d => d.id !== id) });
    removeCampaign(id).catch(e => setStore({ error: `Couldn't delete the campaign: ${e.message}` }));
  }, []);

  const approveDirective = useCallback((id) => {
    change(list => list.map(d =>
      d.id === id ? { ...d, status: 'approved', approvedAt: new Date().toISOString() } : d
    ));
  }, []);

  const rejectDirective = useCallback((id) => {
    change(list => list.map(d =>
      d.id === id ? { ...d, status: 'rejected' } : d
    ));
  }, []);

  const submitForApproval = useCallback((id) => {
    change(list => list.map(d =>
      d.id === id ? { ...d, status: 'pending_approval' } : d
    ));
  }, []);

  const executeDirective = useCallback((id) => {
    change(list => list.map(d =>
      d.id === id ? { ...d, status: 'active' } : d
    ));
  }, []);

  const counts = useMemo(() => ({
    total: directives.length,
    drafts: directivesByStatus.draft.length,
    pending: directivesByStatus.pending_approval.length,
    active: directivesByStatus.active.length + directivesByStatus.paused.length + directivesByStatus.executing.length + directivesByStatus.approved.length,
    completed: directivesByStatus.completed.length,
    failed: directivesByStatus.failed.length,
  }), [directives, directivesByStatus]);

  return {
    directives,
    connectedPlatforms: CAMPAIGN_PLATFORMS,
    directivesByArtist,
    directivesByStatus,
    counts,
    loading: !(current && snap.loaded),
    error: current ? snap.error : null,
    apiAvailable: true,
    createDirective,
    updateDirective,
    deleteDirective,
    approveDirective,
    rejectDirective,
    submitForApproval,
    executeDirective,
  };
}
