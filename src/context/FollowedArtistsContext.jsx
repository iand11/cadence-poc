import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { fetchArtistsBySlugs } from '../data/artistsRemote';
import { setRoster } from '../data/rosterStore';
import { useFavorites } from './FavoritesContext';
import { useAuth } from '../hooks/useAuth';
import { GROUP_COLORS } from '../constants/artistGroups';

const EMPTY = [];

/**
 * The artists the user follows, which scope the whole app, plus the
 * user-named groups they organize them into.
 *
 * Followed slugs persist per-account (usePersistedState → /api/user-data with
 * localStorage fallback). The storage key keeps its original
 * "tracked-artists" name: /api/user-data mirrors it into the tracked_artists
 * table that drives the refresh pipeline, and the artist-request trigger
 * appends to it. The full artist summaries are fetched from the database
 * (/api/artists?slugs=...) whenever the slug list changes, and pushed into
 * rosterStore so non-React data modules see the same set.
 *
 * Following an artist also favorites it (unfollowing does not unfavorite —
 * that stays the user's call).
 *
 * Groups are many-to-many: an artist can be in any number of groups, and
 * unfollowing an artist removes it from every group.
 *
 * `loading` is true until BOTH the persisted slug list and the artist
 * summaries have resolved — pages should gate follow-dependent rendering on
 * it. An empty `followedArtists` after loading triggers onboarding.
 */
const FOLLOWED_KEY = 'musicspace-tracked-artists-v1';
const GROUPS_KEY = 'musicspace-artist-groups-v1';

const FollowedArtistsContext = createContext(null);

export function FollowedArtistsProvider({ children }) {
  const [followed, setFollowed, { loaded }] = usePersistedState(FOLLOWED_KEY, []);
  const [groups, setGroups, { loaded: groupsLoaded }] = usePersistedState(GROUPS_KEY, []);
  const { addFavorite } = useFavorites();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Summaries tagged with the uid they were fetched for, so a sign-out /
  // account switch never shows the previous user's artists.
  const [fetched, setFetched] = useState({ uid: undefined, artists: [] });
  const current = loaded && fetched.uid === uid;
  const followedArtists = current ? fetched.artists : EMPTY;
  const loading = !current;

  // New user (or signed out): clear the shared store right away so
  // non-React modules don't keep serving the previous account's artists.
  useEffect(() => { setRoster([]); }, [uid]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      // null on failure: API unreachable — keep whatever we had rather than
      // wiping the UI
      const artists = followed.length
        ? await fetchArtistsBySlugs(followed).catch(() => null)
        : [];
      if (cancelled) return;
      if (artists) setRoster(artists);
      setFetched((prev) => ({ uid, artists: artists ?? (prev.uid === uid ? prev.artists : []) }));
    })();
    return () => { cancelled = true; };
  }, [loaded, followed, uid]);

  // ── Following ──

  const follow = useCallback((slug) => {
    setFollowed((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
    addFavorite(slug);
  }, [setFollowed, addFavorite]);

  const unfollow = useCallback((slug) => {
    setFollowed((prev) => prev.filter((s) => s !== slug));
    setGroups((prev) => (prev.some((g) => g.slugs.includes(slug))
      ? prev.map((g) => ({ ...g, slugs: g.slugs.filter((s) => s !== slug) }))
      : prev));
  }, [setFollowed, setGroups]);

  const isFollowing = useCallback((slug) => followed.includes(slug), [followed]);

  const toggleFollow = useCallback((slug) => {
    if (followed.includes(slug)) unfollow(slug);
    else follow(slug);
  }, [followed, follow, unfollow]);

  // ── Groups ──

  // Returns the new group's id (or the existing one's, if the name is taken).
  const createGroup = useCallback((name, slugs = []) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = groups.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (slugs.length) {
        setGroups((prev) => prev.map((g) => (g.id === existing.id
          ? { ...g, slugs: [...new Set([...g.slugs, ...slugs])] }
          : g)));
      }
      return existing.id;
    }
    const id = `grp-${Date.now().toString(36)}`;
    setGroups((prev) => [
      ...prev,
      { id, name: trimmed, color: GROUP_COLORS[prev.length % GROUP_COLORS.length], slugs: [...new Set(slugs)] },
    ]);
    return id;
  }, [groups, setGroups]);

  const renameGroup = useCallback((id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
  }, [setGroups]);

  const deleteGroup = useCallback((id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, [setGroups]);

  const toggleInGroup = useCallback((id, slug) => {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== id) return g;
      return { ...g, slugs: g.slugs.includes(slug) ? g.slugs.filter((s) => s !== slug) : [...g.slugs, slug] };
    }));
  }, [setGroups]);

  // Groups only ever list followed artists (a slug may linger in storage if it
  // was unfollowed on another device before groups existed there).
  const visibleGroups = useMemo(() => {
    const set = new Set(followed);
    return (groups || []).map((g) => ({ ...g, slugs: g.slugs.filter((s) => set.has(s)) }));
  }, [groups, followed]);

  const groupsFor = useCallback(
    (slug) => visibleGroups.filter((g) => g.slugs.includes(slug)),
    [visibleGroups],
  );

  const value = {
    followed,
    followedArtists,
    isFollowing,
    follow,
    unfollow,
    toggleFollow,
    count: followed.length,
    loaded,
    loading,
    groups: visibleGroups,
    groupsLoaded,
    groupsFor,
    createGroup,
    renameGroup,
    deleteGroup,
    toggleInGroup,
  };

  return (
    <FollowedArtistsContext.Provider value={value}>
      {children}
    </FollowedArtistsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook pair
export function useFollowedArtists() {
  const ctx = useContext(FollowedArtistsContext);
  if (!ctx) throw new Error('useFollowedArtists must be used inside <FollowedArtistsProvider>');
  return ctx;
}
