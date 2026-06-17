import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'cadence-directives-v2';

const SEED_CAMPAIGNS = [
  {
    id: 'seed-1', artistSlug: 'bruno-mars', artistName: 'Bruno Mars',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5ebc7688aad1bf03986934d7e26',
    platform: 'tiktok', status: 'active', objective: 'followers',
    budget: { amount: 3000, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-05-20', endDate: '2026-06-20' },
    audience: { locations: ['US', 'BR'], ageRange: [18, 34] },
    creative: { type: 'video', headline: 'New single promo' },
    rationale: 'Capitalize on viral TikTok moment — "Die With A Smile" trend driving 2M+ sound uses.',
    createdAt: '2026-05-18T10:00:00Z',
  },
  {
    id: 'seed-2', artistSlug: 'the-weeknd', artistName: 'The Weeknd',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5ebc1719ac9e6a75c1c25835018',
    platform: 'youtube', status: 'active', objective: 'views',
    budget: { amount: 5000, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-05-25', endDate: '2026-06-25' },
    audience: { locations: ['US', 'UK', 'CA'], ageRange: [18, 44] },
    creative: { type: 'video', headline: 'After Hours Til Dawn tour recap' },
    rationale: 'Pre-save push ahead of album release. YouTube strongest platform by subscriber count.',
    createdAt: '2026-05-23T14:00:00Z',
  },
  {
    id: 'seed-3', artistSlug: 'bad-bunny', artistName: 'Bad Bunny',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5eb81f47f44084e0a09b5f0fa13',
    platform: 'meta', status: 'active', objective: 'engagement',
    budget: { amount: 2500, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-06-01', endDate: '2026-06-28' },
    audience: { locations: ['US', 'MX'], ageRange: [18, 34] },
    creative: { type: 'image', headline: 'Summer tour announcement' },
    rationale: 'Instagram engagement rate 3.2x above roster average. Boost tour awareness in key markets.',
    createdAt: '2026-05-30T09:00:00Z',
  },
  {
    id: 'seed-4', artistSlug: 'taylor-swift', artistName: 'Taylor Swift',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5ebe2e8e7ff002a4afda1c7147e',
    platform: 'spotify', status: 'completed', objective: 'streams',
    budget: { amount: 4000, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-05-01', endDate: '2026-05-28' },
    audience: { locations: ['US', 'UK', 'AU'], ageRange: [16, 34] },
    creative: { type: 'audio', headline: 'New album awareness' },
    rationale: 'Album release window — maximize first-week streams across editorial playlists.',
    createdAt: '2026-04-28T11:00:00Z',
  },
  {
    id: 'seed-5', artistSlug: 'rihanna', artistName: 'Rihanna',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5ebcb565a8e684e3be458d329ac',
    platform: 'meta', status: 'completed', objective: 'followers',
    budget: { amount: 2000, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-04-15', endDate: '2026-05-15' },
    audience: { locations: ['US', 'UK', 'FR'], ageRange: [18, 44] },
    creative: { type: 'image', headline: 'Comeback single teaser' },
    rationale: 'Re-engagement campaign targeting lapsed followers ahead of new music cycle.',
    createdAt: '2026-04-13T16:00:00Z',
  },
  {
    id: 'seed-6', artistSlug: 'justin-bieber', artistName: 'Justin Bieber',
    artistImage: 'https://i.scdn.co/image/ab6761610000e5ebaf20f7db5288bce9beede034',
    platform: 'tiktok', status: 'draft', objective: 'followers',
    budget: { amount: 1500, currency: 'USD', period: 'lifetime' },
    schedule: { startDate: '2026-06-20', endDate: '2026-07-10' },
    audience: { locations: ['US'], ageRange: [16, 28] },
    creative: { type: 'video', headline: 'Acoustic sessions promo' },
    rationale: 'TikTok follower growth lagging behind Instagram. Target Gen-Z with acoustic content.',
    createdAt: '2026-06-15T08:00:00Z',
  },
];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_CAMPAIGNS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...SEED_CAMPAIGNS];
  } catch {
    return [...SEED_CAMPAIGNS];
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
  const [directives, setDirectives] = useState(() => getShared());

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
    const map = { draft: [], pending_approval: [], approved: [], executing: [], active: [], completed: [], failed: [], rejected: [] };
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
    active: directivesByStatus.active.length + directivesByStatus.executing.length + directivesByStatus.approved.length,
    completed: directivesByStatus.completed.length,
    failed: directivesByStatus.failed.length,
  }), [directives, directivesByStatus]);

  return {
    directives,
    connectedPlatforms: ['spotify', 'meta', 'google', 'youtube', 'tiktok', 'x'],
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
