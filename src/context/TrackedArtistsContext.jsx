import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { fetchArtistsBySlugs } from '../data/artistsRemote';
import { setRoster } from '../data/rosterStore';

/**
 * The user's curated set of "tracked" artists that scopes the whole app.
 *
 * Slugs persist per-account (usePersistedState → /api/user-data with
 * localStorage fallback). The full artist summary objects are fetched from
 * the database (/api/artists?slugs=...) whenever the slug list changes, and
 * pushed into rosterStore so non-React data modules see the same roster.
 *
 * `loading` is true until BOTH the persisted slug list and the artist
 * summaries have resolved — pages should gate roster-dependent rendering on
 * it. An empty `trackedArtists` after loading triggers onboarding.
 */
const STORAGE_KEY = 'musicspace-tracked-artists-v1';

const TrackedArtistsContext = createContext(null);

export function TrackedArtistsProvider({ children }) {
  const [tracked, setTracked, { loaded }] = usePersistedState(STORAGE_KEY, []);
  const [trackedArtists, setTrackedArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      // null on failure: API unreachable — keep whatever we had rather than
      // wiping the UI
      const artists = tracked.length
        ? await fetchArtistsBySlugs(tracked).catch(() => null)
        : [];
      if (cancelled) return;
      if (artists) {
        setTrackedArtists(artists);
        setRoster(artists);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loaded, tracked]);

  const track = useCallback((slug) => {
    setTracked((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, [setTracked]);

  const untrack = useCallback((slug) => {
    setTracked((prev) => prev.filter((s) => s !== slug));
  }, [setTracked]);

  const toggleTracked = useCallback((slug) => {
    setTracked((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, [setTracked]);

  const isTracked = useCallback((slug) => tracked.includes(slug), [tracked]);

  const value = {
    tracked,
    trackedArtists,
    isTracked,
    track,
    untrack,
    toggleTracked,
    count: tracked.length,
    loaded,
    loading,
  };

  return (
    <TrackedArtistsContext.Provider value={value}>
      {children}
    </TrackedArtistsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook pair
export function useTrackedArtists() {
  const ctx = useContext(TrackedArtistsContext);
  if (!ctx) throw new Error('useTrackedArtists must be used inside <TrackedArtistsProvider>');
  return ctx;
}
