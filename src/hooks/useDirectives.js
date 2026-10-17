import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { CAMPAIGN_PLATFORMS, isCampaignPlatform } from '../data/directives';

const STORAGE_KEY = 'musicspace-directives-v2';

function loadFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Drop the sample campaigns earlier versions seeded (ids "seed-1"…"seed-6")
    return Array.isArray(parsed) ? parsed.filter(d => !String(d?.id).startsWith('seed-')) : [];
  } catch {
    return [];
  }
}

function saveToStorage(directives) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(directives));
  } catch { /* quota exceeded */ }
}

// Shared state across all hook instances so navigation doesn't lose data
let _shared = null;
let _listeners = new Set();

function getShared() {
  if (!Array.isArray(_shared)) _shared = loadFromStorage();
  return _shared;
}

function setShared(directives) {
  _shared = directives;
  saveToStorage(directives);
  for (const fn of _listeners) fn(directives);
}

export function useDirectives() {
  const [allDirectives, setDirectives] = useState(() => getShared());
  // Older campaigns on platforms Campaigns no longer covers stay saved but are hidden
  const directives = useMemo(() => allDirectives.filter(d => isCampaignPlatform(d.platform)), [allDirectives]);

  useEffect(() => {
    const handler = (next) => setDirectives(next);
    _listeners.add(handler);
    // Sync in case another instance already updated
    setDirectives(getShared());
    return () => { _listeners.delete(handler); };
  }, []);

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
    setShared([data, ...getShared()]);
    return data.id;
  }, []);

  const updateDirective = useCallback((id, updates) => {
    setShared(getShared().map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDirective = useCallback((id) => {
    setShared(getShared().filter(d => d.id !== id));
  }, []);

  const approveDirective = useCallback((id) => {
    setShared(getShared().map(d =>
      d.id === id ? { ...d, status: 'approved', approvedAt: new Date().toISOString() } : d
    ));
  }, []);

  const rejectDirective = useCallback((id) => {
    setShared(getShared().map(d =>
      d.id === id ? { ...d, status: 'rejected' } : d
    ));
  }, []);

  const submitForApproval = useCallback((id) => {
    setShared(getShared().map(d =>
      d.id === id ? { ...d, status: 'pending_approval' } : d
    ));
  }, []);

  const executeDirective = useCallback((id) => {
    setShared(getShared().map(d =>
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
    loading: false,
    apiAvailable: false,
    createDirective,
    updateDirective,
    deleteDirective,
    approveDirective,
    rejectDirective,
    submitForApproval,
    executeDirective,
  };
}
