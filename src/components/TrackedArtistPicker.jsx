import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Check, Plus, Music, Send, Loader2 } from 'lucide-react';
import { fetchArtists, fetchArtistsBySlugs, requestArtist } from '../data/artistsRemote';
import { formatNumber } from '../utils/formatters';

const SEARCH_LIMIT = 24;

/**
 * Search-first artist picker for building/editing the tracked-artist set.
 * Used both as the dashboard empty-state (onboarding) and inside the
 * "Manage artists" modal. No catalog browsing — with 200k+ artists the only
 * request made is a name search once the user types. The default (empty
 * query) view shows the current roster so artists can be removed.
 * When a search comes up short, the user can submit a request for the artist
 * to be added (an outside service fulfills artist_requests rows).
 */
export default function TrackedArtistPicker({ tracked, onToggle }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Last search response; `searching` is derived by comparing its key to the
  // current debounced query (no setState in effect bodies — lint rule).
  const [searched, setSearched] = useState({ key: '', results: [], total: 0 });
  const [rosterArtists, setRosterArtists] = useState([]);
  const inputRef = useRef(null);

  const trackedSet = useMemo(() => new Set(tracked), [tracked]);

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

  // Roster view (empty query): resolve tracked slugs to summaries so the
  // current roster is visible without any catalog browsing. Merges instead of
  // replacing so an artist untracked mid-session keeps its card (re-addable).
  useEffect(() => {
    if (!tracked?.length) return;
    let cancelled = false;
    fetchArtistsBySlugs(tracked)
      .then((artists) => {
        if (cancelled) return;
        setRosterArtists((prev) => {
          const seen = new Set(prev.map((a) => a.slug));
          return [...prev, ...artists.filter((a) => !seen.has(a.slug))];
        });
      })
      .catch((err) => { if (!cancelled) console.error('Failed to load tracked artists', err); });
    return () => { cancelled = true; };
  }, [tracked]);

  const showRequestFlow = hasQuery && !searching;
  const noResults = showRequestFlow && results.length === 0;

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
            <RequestArtistFlow key={debouncedQuery} query={debouncedQuery} prominent={noResults} />
          )}
        </>
      ) : tracked?.length ? (
        <>
          {/* Roster view (no search active): current tracked artists */}
          <p className="text-[10px] uppercase tracking-wider text-[#6B6560]">
            Your tracked artists — search above to add more
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {rosterArtists.map((artist) => (
              <ArtistCard
                key={artist.slug}
                artist={artist}
                isTracked={trackedSet.has(artist.slug)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Music size={24} className="mx-auto text-[#2C2B28] mb-2" />
          <p className="text-xs text-[#6B6560]">Search for the artists you want to track</p>
        </div>
      )}
    </div>
  );
}

function ArtistCard({ artist, isTracked, onToggle }) {
  return (
    <button
      onClick={() => onToggle(artist.slug)}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded border text-left transition-all cursor-pointer ${
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
      </div>
      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
        isTracked ? 'bg-[#DA7756] text-[#0D0C0B]' : 'bg-[#2C2B28] text-[#6B6560]'
      }`}>
        {isTracked ? <Check size={11} /> : <Plus size={11} />}
      </div>
    </button>
  );
}

/**
 * "Can't find them?" → submit a request for the artist to be added to the
 * catalog. POSTs to /api/artists/requests; an outside service picks up the
 * row and populates the artist's data.
 */
function RequestArtistFlow({ query, prominent }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(query);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [state, setState] = useState('idle'); // idle | submitting | done | duplicate | error
  const [submittedName, setSubmittedName] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || state === 'submitting') return;
    setState('submitting');
    setError('');
    try {
      const result = await requestArtist({ name: trimmed, spotifyUrl: spotifyUrl.trim() });
      setSubmittedName(trimmed);
      if (result.exists) {
        setError(`"${result.artist.name}" is already in the catalog — try searching for that exact name.`);
        setState('error');
      } else {
        setState(result.duplicate ? 'duplicate' : 'done');
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
            ? `"${submittedName}" has already been requested — they'll appear once the data is ready.`
            : `Request submitted — "${submittedName}" will appear here once their data is ready.`}
        </p>
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
    <form onSubmit={submit} className="rounded border border-[#2C2B28] bg-[#0D0C0B] p-4 space-y-3 max-w-md">
      <div>
        <p className="text-xs font-medium text-[#F5F0E8]">Request an artist</p>
        <p className="text-[10px] text-[#6B6560] mt-0.5">
          We'll gather their data and add them to the catalog — usually within a day.
        </p>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artist name"
          autoFocus
          className="w-full h-8 px-2.5 rounded bg-[#171614] border border-[#2C2B28] focus:border-[#3D3B37] text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none transition-colors"
        />
        <input
          type="url"
          value={spotifyUrl}
          onChange={(e) => setSpotifyUrl(e.target.value)}
          placeholder="Spotify profile link (optional, speeds things up)"
          className="w-full h-8 px-2.5 rounded bg-[#171614] border border-[#2C2B28] focus:border-[#3D3B37] text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none transition-colors"
        />
      </div>
      {state === 'error' && <p className="text-[10px] text-[#C75F4F]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={name.trim().length < 2 || state === 'submitting'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#DA7756] text-[#0D0C0B] font-semibold hover:bg-[#DA7756]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {state === 'submitting'
            ? <Loader2 size={12} className="animate-spin" />
            : <Send size={12} />}
          Submit request
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs text-[#6B6560] hover:text-[#9B9590] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
