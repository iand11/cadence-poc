import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { Search, X, Check, Plus, Music, Send, Loader2 } from 'lucide-react';
import { fetchArtists, fetchArtistsBySlugs, requestArtist, searchSpotifyArtists } from '../data/artistsRemote';
import { formatNumber } from '../utils/formatters';
import { useFollowedArtists } from '../hooks/useFollowedArtists';
import { GroupFilterBar, GroupMenu, GroupChips } from './groups/ArtistGroups';

const SEARCH_LIMIT = 24;

/**
 * Search-first picker for choosing which artists the user follows.
 * Used both as the dashboard empty-state (onboarding) and inside the
 * "Manage artists" modal. No catalog browsing — with 200k+ artists the only
 * request made is a name search once the user types. The default (empty
 * query) view shows who the user follows, filterable by group, with
 * controls to regroup or unfollow.
 * When a search comes up short, the user can submit a request for the artist
 * to be added (an outside service fulfills artist_requests rows).
 */
export default function FollowArtistPicker({ followed, onToggle, size = 'md' }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Last search response; `searching` is derived by comparing its key to the
  // current debounced query (no setState in effect bodies — lint rule).
  const [searched, setSearched] = useState({ key: '', results: [], total: 0 });
  const [followedList, setFollowedList] = useState([]);
  const inputRef = useRef(null);

  const trackedSet = useMemo(() => new Set(followed), [followed]);
  const { groups } = useFollowedArtists();
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'ungrouped' | groupId

  // Debounce the free-text query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = debouncedQuery.length >= 2;
  const searching = hasQuery && searched.key !== debouncedQuery;
  const { results, total } = searched;

  // Name search — the only catalog request this component makes.
  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;
    fetchArtists({ q: debouncedQuery, sort: 'listeners', perPage: SEARCH_LIMIT })
      .then((data) => {
        if (!cancelled) setSearched({ key: debouncedQuery, results: data.artists, total: data.total });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Artist search failed', err);
        setSearched({ key: debouncedQuery, results: [], total: 0 });
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, hasQuery]);

  // Following view (empty query): resolve followed slugs to summaries so they
  // are visible without any catalog browsing. Merges instead of replacing so
  // an artist unfollowed mid-session keeps its card (re-followable).
  useEffect(() => {
    if (!followed?.length) return;
    let cancelled = false;
    fetchArtistsBySlugs(followed)
      .then((artists) => {
        if (cancelled) return;
        setFollowedList((prev) => {
          const seen = new Set(prev.map((a) => a.slug));
          return [...prev, ...artists.filter((a) => !seen.has(a.slug))];
        });
      })
      .catch((err) => { if (!cancelled) console.error('Failed to load followed artists', err); });
    return () => { cancelled = true; };
  }, [followed]);

  // Following view, narrowed by the group filter. A deleted group falls back to all.
  const activeGroup = groups.find((g) => g.id === groupFilter);
  const effectiveFilter = groupFilter === 'all' || groupFilter === 'ungrouped' || activeGroup ? groupFilter : 'all';
  const groupedSlugs = useMemo(() => new Set(groups.flatMap((g) => g.slugs)), [groups]);
  const visibleFollowing = useMemo(() => {
    if (effectiveFilter === 'all') return followedList;
    if (effectiveFilter === 'ungrouped') return followedList.filter((a) => trackedSet.has(a.slug) && !groupedSlugs.has(a.slug));
    const set = new Set(activeGroup?.slugs || []);
    return followedList.filter((a) => set.has(a.slug));
  }, [effectiveFilter, followedList, trackedSet, groupedSlugs, activeGroup]);
  const ungroupedCount = (followed || []).filter((s) => !groupedSlugs.has(s)).length;

  const showRequestFlow = hasQuery && !searching;
  const noResults = showRequestFlow && results.length === 0;

  if (size === 'lg') {
    const selected = followedList.filter((a) => trackedSet.has(a.slug));
    // Seed the chip from the search result so it shows instantly instead of
    // waiting on the fetchArtistsBySlugs round trip.
    const toggleFromResult = (artist) => {
      setFollowedList((prev) => (prev.some((a) => a.slug === artist.slug) ? prev : [...prev, artist]));
      onToggle(artist.slug);
    };
    return (
      <div className="space-y-5">
        {/* Search */}
        <div className="flex items-center gap-3 h-14 px-4 rounded-lg bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/50 focus-within:ring-4 focus-within:ring-[#DA7756]/10 transition-all">
          {searching
            ? <Loader2 size={18} className="text-[#9B9590] shrink-0 animate-spin" />
            : <Search size={18} className="text-[#9B9590] shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists by name"
            autoFocus
            className="flex-1 bg-transparent text-base text-[#F5F0E8] placeholder-[#6B6560] outline-none"
          />
          {hasQuery && !searching && (
            <span className="text-xs text-[#6B6560] shrink-0">
              {total.toLocaleString()} match{total === 1 ? '' : 'es'}
            </span>
          )}
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-1 -mr-1 rounded hover:bg-[#2C2B28] cursor-pointer"
              aria-label="Clear search"
            >
              <X size={14} className="text-[#9B9590]" />
            </button>
          )}
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((artist) => (
              <span
                key={artist.slug}
                className="inline-flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/30"
              >
                <Avatar artist={artist} className="w-6 h-6" />
                <span className="text-xs text-[#F5F0E8]">{artist.name}</span>
                <button
                  onClick={() => onToggle(artist.slug)}
                  className="p-0.5 rounded-full text-[#DA7756] hover:bg-[#DA7756]/20 cursor-pointer"
                  aria-label={`Remove ${artist.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {hasQuery ? (
          <>
            {searching && results.length === 0 ? (
              <div className="rounded-lg border border-[#2C2B28] divide-y divide-[#2C2B28] overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[#2C2B28] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-[#2C2B28]" />
                      <div className="h-2.5 w-20 rounded bg-[#2C2B28]/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 && (
              <div className={`rounded-lg border border-[#2C2B28] bg-[#131211] divide-y divide-[#2C2B28] overflow-hidden transition-opacity duration-200 ${searching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                {results.map((artist) => (
                  <ArtistRow
                    key={artist.slug}
                    artist={artist}
                    isTracked={trackedSet.has(artist.slug)}
                    onToggle={() => toggleFromResult(artist)}
                  />
                ))}
              </div>
            )}
            {showRequestFlow && (
              <RequestArtistFlow key={debouncedQuery} query={debouncedQuery} prominent={noResults} trackedSet={trackedSet} onToggle={onToggle} />
            )}
          </>
        ) : selected.length === 0 && (
          <p className="text-sm text-[#6B6560] flex items-center gap-2">
            <Music size={14} className="text-[#3D3B37]" />
            Start typing to search the catalog.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md h-9 px-3 rounded bg-[#0D0C0B] border border-[#2C2B28] focus-within:border-[#3D3B37] transition-colors">
          {searching
            ? <Loader2 size={14} className="text-[#6B6560] shrink-0 animate-spin" />
            : <Search size={14} className="text-[#6B6560] shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an artist by name..."
            className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="cursor-pointer">
              <X size={12} className="text-[#6B6560]" />
            </button>
          )}
        </div>
        {hasQuery && !searching && (
          <span className="text-[10px] text-[#6B6560] shrink-0">
            {total.toLocaleString()} match{total === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {hasQuery ? (
        <>
          {/* Search results */}
          {results.length > 0 && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-opacity duration-200 ${searching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {results.map((artist) => (
                <ArtistCard
                  key={artist.slug}
                  artist={artist}
                  isTracked={trackedSet.has(artist.slug)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}

          {/* Skeletons while the first search for this query is in flight */}
          {searching && results.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-[#2C2B28] animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-[#2C2B28] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-24 rounded bg-[#2C2B28]" />
                    <div className="h-2 w-16 rounded bg-[#2C2B28]/60" />
                  </div>
                  <div className="w-5 h-5 rounded bg-[#2C2B28] shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Request flow — prominent on zero results, quiet link otherwise.
              Keyed by query so a new search resets the form. */}
          {showRequestFlow && (
            <RequestArtistFlow key={debouncedQuery} query={debouncedQuery} prominent={noResults} trackedSet={trackedSet} onToggle={onToggle} />
          )}
        </>
      ) : followed?.length ? (
        <>
          {/* Following view (no search active): followed artists, by group */}
          <p className="text-[10px] uppercase tracking-wider text-[#6B6560]">
            Following — search above to follow more, or tag artists into groups
          </p>
          <GroupFilterBar
            value={effectiveFilter}
            onChange={setGroupFilter}
            total={followed.length}
            ungroupedCount={ungroupedCount}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {visibleFollowing.map((artist) => (
              <ArtistCard
                key={artist.slug}
                artist={artist}
                isTracked={trackedSet.has(artist.slug)}
                onToggle={onToggle}
              />
            ))}
          </div>
          {visibleFollowing.length === 0 && (
            <p className="text-xs text-[#6B6560] py-6 text-center">
              {effectiveFilter === 'ungrouped'
                ? 'Every artist you follow is in a group.'
                : 'No artists in this group yet. Use the tag button on an artist card to add them.'}
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Music size={24} className="mx-auto text-[#2C2B28] mb-2" />
          <p className="text-xs text-[#6B6560]">Search for the artists you want to follow</p>
        </div>
      )}
    </div>
  );
}

function Avatar({ artist, className }) {
  return artist.imageUrl ? (
    <img src={artist.imageUrl} alt="" className={`${className} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${className} rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0`}>
      <Music size={12} className="text-[#6B6560]" />
    </div>
  );
}

function ArtistRow({ artist, isTracked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1C1A18] transition-colors cursor-pointer"
    >
      <Avatar artist={artist} className="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#F5F0E8] truncate">{artist.name}</p>
        <p className="text-xs text-[#6B6560] truncate mt-0.5">
          {artist.genres?.primary?.name || 'Artist'} · {formatNumber(artist.spotify.monthlyListeners)} monthly listeners
        </p>
      </div>
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium shrink-0 transition-colors ${
        isTracked
          ? 'bg-[#DA7756] text-[#0D0C0B]'
          : 'border border-[#2C2B28] text-[#9B9590] group-hover:border-[#DA7756]/50 group-hover:text-[#DA7756]'
      }`}>
        {isTracked ? <><Check size={12} /> Following</> : <><Plus size={12} /> Follow</>}
      </span>
    </button>
  );
}

function ArtistCard({ artist, isTracked, onToggle }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded border text-left transition-all ${
        isTracked
          ? 'border-[#DA7756]/40 bg-[#DA7756]/5'
          : 'border-[#2C2B28] hover:border-[#3D3B37] bg-transparent'
      }`}
    >
      {artist.imageUrl ? (
        <img src={artist.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0">
          <Music size={13} className="text-[#6B6560]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#F5F0E8] truncate">{artist.name}</p>
        <p className="text-[9px] text-[#6B6560] truncate">
          {artist.genres?.primary?.name || 'Artist'} · {formatNumber(artist.spotify.monthlyListeners)}
        </p>
        {isTracked && <div className="mt-1"><GroupChips slug={artist.slug} /></div>}
      </div>
      {isTracked && <GroupMenu slug={artist.slug} />}
      <button
        onClick={() => onToggle(artist.slug)}
        title={isTracked ? 'Unfollow' : 'Follow'}
        aria-label={isTracked ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isTracked ? 'bg-[#DA7756] text-[#0D0C0B] hover:bg-[#C75F4F]' : 'bg-[#2C2B28] text-[#6B6560] hover:text-[#DA7756]'
        }`}
      >
        {isTracked ? <Check size={12} /> : <Plus size={12} />}
      </button>
    </div>
  );
}

/**
 * "Can't find them?" → pick the artist from a Spotify search and submit a
 * request for them to be added to the catalog. Requests carry a real Spotify
 * id (re-validated server-side), so there's no free-text name to spam.
 * POSTs to /api/artists/requests; an outside service picks up the row and
 * populates the artist's data.
 */
function RequestArtistFlow({ query, prominent, trackedSet, onToggle }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null); // Spotify artist chosen from the dropdown
  const [state, setState] = useState('idle'); // idle | submitting | done | duplicate | exists | error
  const [result, setResult] = useState(null); // { name } or { artist: {slug,name} } for exists
  const [error, setError] = useState('');

  const reset = () => { setPicked(null); setState('idle'); setError(''); setResult(null); };

  const submit = async () => {
    if (!picked || state === 'submitting') return;
    setState('submitting');
    setError('');
    try {
      const res = await requestArtist({ spotifyId: picked.spotifyId });
      if (res.exists) {
        setResult({ artist: res.artist });
        setState('exists');
      } else {
        setResult({ name: res.request?.name || picked.name });
        setState(res.duplicate ? 'duplicate' : 'done');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again.');
      setState('error');
    }
  };

  if (state === 'done' || state === 'duplicate') {
    return (
      <div className={`rounded border border-[#7BAF73]/30 bg-[#7BAF73]/5 px-4 py-3 ${prominent ? 'text-center' : ''}`}>
        <p className="text-xs text-[#7BAF73]">
          <Check size={12} className="inline mr-1.5 -mt-px" />
          {state === 'duplicate'
            ? `"${result.name}" has already been requested — they'll appear once the data is ready.`
            : `Request submitted — "${result.name}" will appear here once their data is ready.`}
        </p>
        <button onClick={reset} className="mt-1.5 text-[11px] text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer">
          Request another artist
        </button>
      </div>
    );
  }

  if (!open) {
    return prominent ? (
      <div className="text-center py-10 border border-dashed border-[#2C2B28] rounded">
        <Music size={24} className="mx-auto text-[#2C2B28] mb-2" />
        <p className="text-xs text-[#6B6560] mb-3">No artists match "{query}"</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded bg-[#DA7756] text-[#0D0C0B] font-semibold hover:bg-[#DA7756]/90 transition-colors cursor-pointer"
        >
          <Plus size={12} /> Request this artist
        </button>
      </div>
    ) : (
      <p className="text-[11px] text-[#6B6560]">
        Can't find who you're looking for?{' '}
        <button onClick={() => setOpen(true)} className="text-[#DA7756] hover:underline cursor-pointer">
          Request an artist
        </button>
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[#2C2B28] bg-[#0D0C0B] p-4 space-y-3 max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#F5F0E8]">Request an artist</p>
          <p className="text-[10px] text-[#6B6560] mt-0.5">
            Find them on Spotify — we'll gather their data and add them, usually within a day.
          </p>
        </div>
        <button
          onClick={() => { setOpen(false); reset(); }}
          className="p-1 -m-1 rounded text-[#6B6560] hover:text-[#9B9590] cursor-pointer"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      {picked ? (
        <PickedArtist
          artist={picked}
          state={state}
          error={error}
          existing={state === 'exists' ? result.artist : null}
          trackedSet={trackedSet}
          onToggle={onToggle}
          onSubmit={submit}
          onChange={reset}
        />
      ) : (
        <SpotifyArtistSearch
          initialQuery={query}
          trackedSet={trackedSet}
          onAddExisting={onToggle}
          onPick={setPicked}
        />
      )}
    </div>
  );
}

/** Debounced Spotify artist search with a keyboard-navigable dropdown. */
function SpotifyArtistSearch({ initialQuery, trackedSet, onAddExisting, onPick }) {
  const [q, setQ] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [searched, setSearched] = useState({ key: null, results: [], error: '' });
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const hasQuery = debounced.length >= 2;
  const loading = hasQuery && searched.key !== debounced;
  const results = hasQuery && searched.key === debounced ? searched.results : [];

  useEffect(() => {
    if (!hasQuery) return;
    const ctrl = new AbortController();
    searchSpotifyArtists(debounced, { signal: ctrl.signal })
      .then((artists) => setSearched({ key: debounced, results: artists, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setSearched({ key: debounced, results: [], error: err.message || 'Spotify search failed' });
      });
    return () => ctrl.abort();
  }, [debounced, hasQuery]);

  const choose = (artist) => {
    if (!artist) return;
    // Definitely in the catalog (same Spotify id) — just follow them.
    if (artist.catalogMatch?.by === 'spotify') {
      if (!trackedSet.has(artist.catalogMatch.slug)) onAddExisting(artist.catalogMatch.slug);
      setOpen(false);
      return;
    }
    onPick(artist);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open) choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && hasQuery;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-[#171614] border border-[#2C2B28] focus-within:border-[#1DB954]/50 transition-colors">
        {loading
          ? <Loader2 size={13} className="text-[#6B6560] shrink-0 animate-spin" />
          : <SpotifyMark className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />}
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Search Spotify for an artist"
          autoFocus
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-md border border-[#2C2B28] bg-[#171614] shadow-2xl shadow-black/60 py-1"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-3 text-[11px] text-[#6B6560]">Searching Spotify…</li>
          )}
          {!loading && searched.error && (
            <li className="px-3 py-3 text-[11px] text-[#C75F4F]">{searched.error}</li>
          )}
          {!loading && !searched.error && results.length === 0 && (
            <li className="px-3 py-3 text-[11px] text-[#6B6560]">No Spotify artists match "{debounced}"</li>
          )}
          {results.map((a, i) => {
            const inCatalog = a.catalogMatch?.by === 'spotify';
            const tracked = inCatalog && trackedSet.has(a.catalogMatch.slug);
            return (
              <li
                key={a.spotifyId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown (not click) so the input's blur doesn't close the list first
                onMouseDown={(e) => { e.preventDefault(); choose(a); }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === active ? 'bg-[#2C2B28]/70' : ''}`}
              >
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F5F0E8] truncate">{a.name}</p>
                  <p className="text-[10px] text-[#6B6560] truncate">
                    {[
                      a.followers != null ? `${formatNumber(a.followers)} followers` : null,
                      a.genres?.[0],
                    ].filter(Boolean).join(' · ') || 'Spotify artist'}
                  </p>
                </div>
                {inCatalog ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${tracked ? 'bg-[#DA7756] text-[#0D0C0B]' : 'border border-[#DA7756]/40 text-[#DA7756]'}`}>
                    {tracked ? 'Following' : 'In catalog · Follow'}
                  </span>
                ) : a.requested ? (
                  <span className="text-[10px] px-2 py-0.5 rounded border border-[#7BAF73]/30 text-[#7BAF73] shrink-0">Requested</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The chosen Spotify artist, with the submit / change controls. */
function PickedArtist({ artist, state, error, existing, trackedSet, onToggle, onSubmit, onChange }) {
  const nameMatch = artist.catalogMatch?.by === 'name' ? artist.catalogMatch : null;
  const catalogArtist = existing || nameMatch;
  const catalogTracked = catalogArtist && trackedSet.has(catalogArtist.slug);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-2.5 rounded-md bg-[#171614] border border-[#2C2B28]">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0">
            <Music size={13} className="text-[#6B6560]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F5F0E8] truncate">{artist.name}</p>
          <a
            href={artist.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[#1DB954] hover:underline"
          >
            <SpotifyMark className="w-2.5 h-2.5" />
            {artist.followers != null ? `${formatNumber(artist.followers)} followers` : 'View on Spotify'}
          </a>
        </div>
        <button onClick={onChange} className="text-[11px] text-[#9B9590] hover:text-[#F5F0E8] px-2 cursor-pointer">
          Change
        </button>
      </div>

      {catalogArtist && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-[#DA7756]/20 bg-[#DA7756]/5">
          <p className="text-[11px] text-[#9B9590]">
            {existing
              ? <>“{existing.name}” is already in the catalog.</>
              : <>A catalog artist named “{nameMatch.name}” already exists — is it them?</>}
          </p>
          <button
            onClick={() => !catalogTracked && onToggle(catalogArtist.slug)}
            disabled={catalogTracked}
            className="shrink-0 text-[11px] text-[#DA7756] hover:underline disabled:no-underline disabled:text-[#9B9590] cursor-pointer disabled:cursor-default"
          >
            {catalogTracked ? 'Following' : 'Follow them'}
          </button>
        </div>
      )}

      {state === 'error' && <p className="text-[10px] text-[#C75F4F]">{error}</p>}

      {state !== 'exists' && (
        <button
          onClick={onSubmit}
          disabled={state === 'submitting'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#DA7756] text-[#0D0C0B] font-semibold hover:bg-[#DA7756]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {state === 'submitting' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {nameMatch ? 'Request this Spotify artist anyway' : `Request ${artist.name}`}
        </button>
      )}
    </div>
  );
}

function SpotifyMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-.99-.12-1.11-.6-.12-.48.12-.99.6-1.11C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  );
}
