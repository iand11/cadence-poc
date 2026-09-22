import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, ArrowUpDown, Check, X } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import Pagination from '../components/shared/Pagination';
import FilterBar from '../components/shared/FilterBar';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import { getBenchmarkComparison } from '../data/artists';
import { fetchArtists, fetchFacets } from '../data/artistsRemote';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];

// Listener-tier filter options → server minListeners/maxListeners params
// (maxListeners is exclusive on the server, matching the old `< 1M` check).
const TIER_PARAMS = {
  '1M+': { minListeners: 1_000_000 },
  '100K–1M': { minListeners: 100_000, maxListeners: 1_000_000 },
  '<100K': { maxListeners: 100_000 },
};

const GRID_COLS = 'grid-cols-[40px_1fr_120px_100px_80px_60px]';

function SortHeader({ label, sortField, activeKey, onSort, className = '' }) {
  return (
    <button
      onClick={() => onSort(sortField)}
      className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider cursor-pointer hover:text-[#F5F0E8] transition-colors ${
        activeKey === sortField ? 'text-[#DA7756]' : 'text-[#9B9590]'
      } ${className}`}
    >
      {label}
      <ArrowUpDown size={10} className={activeKey === sortField ? 'opacity-100' : 'opacity-30'} />
    </button>
  );
}

export default function ArtistsPage() {
  const [facets, setFacets] = useState(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortKey, setSortKey] = useState('listeners');
  const [sortAsc, setSortAsc] = useState(false);
  const [genreFilter, setGenreFilter] = useState('All');
  const [labelFilter, setLabelFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [artists, setArtists] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const comparisonRef = useRef(null);

  // Facet options + catalog-wide headline stats (one-time load).
  useEffect(() => {
    let cancelled = false;
    fetchFacets()
      .then((data) => { if (!cancelled) setFacets(data); })
      .catch((err) => { if (!cancelled) console.error('Failed to load artist facets', err); });
    return () => { cancelled = true; };
  }, []);

  // Debounce the free-text query (and reset to page 1 when it settles).
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Current server query params; `loading` is derived by comparing the params
  // key against the key of the last response applied to state.
  const listParams = useMemo(() => {
    const params = { sort: sortKey, order: sortAsc ? 'asc' : 'desc', page, perPage };
    if (debouncedQuery.length >= 2) params.q = debouncedQuery;
    if (genreFilter !== 'All') params.genre = genreFilter;
    if (labelFilter !== 'All') params.label = labelFilter;
    if (countryFilter !== 'All') params.country = countryFilter;
    if (typeFilter !== 'All') params.isBand = typeFilter === 'Band' ? '1' : '0';
    Object.assign(params, TIER_PARAMS[tierFilter] || {});
    return params;
  }, [debouncedQuery, genreFilter, labelFilter, countryFilter, tierFilter, typeFilter, sortKey, sortAsc, page, perPage]);

  const listKey = JSON.stringify(listParams);
  const loading = loadedKey !== listKey;

  // Server-driven list: refetch on any query/filter/sort/page change.
  useEffect(() => {
    let cancelled = false;
    fetchArtists(listParams)
      .then((data) => {
        if (cancelled) return;
        setArtists(data.artists);
        setTotal(data.total);
        setLoadedKey(listKey);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load artists', err);
        setArtists([]);
        setTotal(0);
        setLoadedKey(listKey);
      });
    return () => { cancelled = true; };
  }, [listParams, listKey]);

  const stats = facets?.stats;

  const topGenres = useMemo(
    () => ['All', ...(facets?.genres || []).slice(0, 8).map((g) => g.value)],
    [facets]
  );

  const topLabels = useMemo(
    () => [
      'All',
      'Independent',
      ...(facets?.labels || [])
        .filter((l) => l.value !== 'Independent')
        .slice(0, 7)
        .map((l) => l.value),
    ],
    [facets]
  );

  const topCountries = useMemo(
    () => ['All', ...(facets?.countries || []).slice(0, 8).map((c) => c.value)],
    [facets]
  );

  const selectedSlugs = useMemo(() => selectedArtists.map((a) => a.slug), [selectedArtists]);

  // Keep the full artist objects in state — after filter/page changes the
  // selected artists may no longer be in the currently loaded page.
  const toggleSelect = (artist) => {
    setSelectedArtists((prev) => {
      if (prev.some((a) => a.slug === artist.slug)) return prev.filter((a) => a.slug !== artist.slug);
      if (prev.length >= 4) return prev;
      return [...prev, artist];
    });
  };

  const removeSelected = (slug) => {
    setSelectedArtists((prev) => prev.filter((a) => a.slug !== slug));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(1);
  };

  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header + KPIs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20">
            artists
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Artists</h1>
        <p className="text-sm text-[#9B9590] mt-1">Browse, search, and compare artists across the catalog</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Total Artists</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats ? formatNumber(stats.total) : '—'}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Monthly Listeners</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats ? formatNumber(stats.totalListeners) : '—'}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Avg Score</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats ? Math.round(stats.avgScore) : '—'}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Followers</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats ? formatNumber(stats.totalFollowers) : '—'}</p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md h-9 px-3 rounded bg-[#171614] border border-[#2C2B28] focus-within:border-[#3D3B37] transition-colors">
          <Search size={14} className="text-[#6B6560] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, genre, label, or city..."
            className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer">
              <X size={12} className="text-[#6B6560]" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-[#6B6560]">{total.toLocaleString()} artists</span>
      </div>

      {/* Filters */}
      <FilterBar filters={[
        { label: 'Genre', options: topGenres, value: genreFilter, onChange: changeFilter(setGenreFilter) },
        { label: 'Label', options: topLabels, value: labelFilter, onChange: changeFilter(setLabelFilter) },
        { label: 'Country', options: topCountries, value: countryFilter, onChange: changeFilter(setCountryFilter) },
        { label: 'Tier', options: ['All', '1M+', '100K–1M', '<100K'], value: tierFilter, onChange: changeFilter(setTierFilter) },
        { label: 'Type', options: ['All', 'Solo', 'Band'], value: typeFilter, onChange: changeFilter(setTypeFilter) },
      ]} />

      {/* Table */}
      <div className="bg-[#171614] border border-[#2C2B28] rounded overflow-hidden">
        {/* Table header */}
        <div className={`grid ${GRID_COLS} items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28] bg-[#0D0C0B]`}>
          <div className="text-[10px] text-[#6B6560] text-center">#</div>
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider">Artist</div>
          <SortHeader label="Listeners" sortField="listeners" activeKey={sortKey} onSort={handleSort} className="justify-end" />
          <SortHeader label="Followers" sortField="followers" activeKey={sortKey} onSort={handleSort} className="justify-end" />
          {/* Playlist counts aren't a server sort key — column stays, sorting dropped */}
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider text-right">Playlists</div>
          <SortHeader label="Score" sortField="score" activeKey={sortKey} onSort={handleSort} className="justify-end" />
        </div>

        {/* Table rows (dimmed while a fetch is in flight) */}
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          {artists.map((artist, i) => {
            const globalIdx = (page - 1) * perPage + i;
            const isSelected = selectedSlugs.includes(artist.slug);
            const colorIdx = selectedSlugs.indexOf(artist.slug);
            return (
              <div
                key={artist.slug}
                className={`grid ${GRID_COLS} items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28]/50 hover:bg-[#1C1B18] transition-colors group ${
                  isSelected ? 'bg-[#1C1B18]' : ''
                }`}
              >
                {/* Checkbox / rank */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => toggleSelect(artist)}
                    disabled={!isSelected && selectedSlugs.length >= 4}
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#DA7756] bg-[#DA7756]'
                        : 'border-[#3D3B37] group-hover:border-[#6B6560]'
                    } ${!isSelected && selectedSlugs.length >= 4 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {isSelected ? (
                      <Check size={10} className="text-[#0D0C0B]" />
                    ) : (
                      <span className="text-[9px] font-mono text-[#6B6560]">{globalIdx + 1}</span>
                    )}
                  </button>
                </div>

                {/* Artist info */}
                <Link to={`/app/artist/${artist.slug}`} className="flex items-center gap-2.5 min-w-0">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0">
                      <Users size={12} className="text-[#6B6560]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                      {isSelected && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[colorIdx] }} />}
                      {artist.name}
                    </p>
                    <p className="text-[9px] text-[#6B6560] truncate">{artist.label}</p>
                  </div>
                </Link>

                {/* Monthly Listeners */}
                <span className="text-xs font-mono text-[#F5F0E8] text-right">{formatNumber(artist.spotify.monthlyListeners)}</span>

                {/* Followers */}
                <span className="text-xs font-mono text-[#F5F0E8] text-right">{formatNumber(artist.spotify.followers)}</span>

                {/* Playlists */}
                <span className="text-xs font-mono text-[#F5F0E8] text-right">{formatNumber(artist.playlists.spotify.total)}</span>

                {/* Score */}
                <span className="text-xs font-mono text-[#F5F0E8] text-right">{artist.score}</span>
              </div>
            );
          })}

          {/* Skeleton rows for the initial load */}
          {loading && artists.length === 0 && (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`grid ${GRID_COLS} items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28]/50 animate-pulse`}>
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 rounded border border-[#2C2B28]" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#2C2B28] shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-28 rounded bg-[#2C2B28]" />
                    <div className="h-2 w-16 rounded bg-[#2C2B28]/60" />
                  </div>
                </div>
                <div className="h-2.5 w-12 rounded bg-[#2C2B28] justify-self-end" />
                <div className="h-2.5 w-10 rounded bg-[#2C2B28] justify-self-end" />
                <div className="h-2.5 w-8 rounded bg-[#2C2B28] justify-self-end" />
                <div className="h-2.5 w-6 rounded bg-[#2C2B28] justify-self-end" />
              </div>
            ))
          )}
        </div>

        {!loading && artists.length === 0 && (
          <div className="text-center py-12">
            <Users size={24} className="mx-auto text-[#2C2B28] mb-2" />
            <p className="text-xs text-[#6B6560]">
              {query ? `No artists match "${query}"` : 'No artists match the current filters'}
            </p>
          </div>
        )}

        {total > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          />
        )}
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {selectedArtists.length >= 2 && !showComparison && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-5 py-3 bg-[#171614] border border-[#2C2B28] rounded-full shadow-2xl">
              <div className="flex items-center gap-2">
                {selectedArtists.map((a, i) => (
                  <div key={a.slug} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                    style={{ backgroundColor: COLORS[i] + '15', color: COLORS[i] }}>
                    <span className="truncate max-w-[80px]">{a.name}</span>
                    <button onClick={() => removeSelected(a.slug)} className="cursor-pointer">
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowComparison(true);
                  setTimeout(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }}
                className="px-4 py-1.5 bg-[#DA7756] text-[#0D0C0B] text-xs font-medium rounded-full hover:bg-[#DA7756]/90 transition-colors cursor-pointer"
              >
                Compare {selectedArtists.length}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison panels */}
      <AnimatePresence>
        {showComparison && selectedArtists.length >= 2 && (
          <motion.div
            ref={comparisonRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* Comparison header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg text-[#F5F0E8]">Artist Comparison</h2>
                <p className="text-xs text-[#9B9590]">Comparing {selectedArtists.length} artists side by side</p>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] border border-[#2C2B28] rounded transition-colors cursor-pointer"
              >
                <X size={12} /> Close
              </button>
            </div>

            {/* Side-by-side KPIs */}
            <div className={`grid gap-3 ${selectedArtists.length <= 2 ? 'grid-cols-2' : selectedArtists.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {selectedArtists.map((a, i) => (
                <Link key={a.slug} to={`/app/artist/${a.slug}`} className="block group">
                  <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 hover:border-[#2C2B28]/80 transition-colors"
                    style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                    <div className="flex items-center gap-2 mb-1">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0">
                          <Users size={12} className="text-[#6B6560]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{a.name}</p>
                        <p className="text-[10px] text-[#6B6560] truncate">{a.label}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Monthly Listeners</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(a.spotify.monthlyListeners)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Followers</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(a.spotify.followers)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Playlists</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(a.playlists.spotify.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Score</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{a.score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Rank</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">#{a.rank}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Listeners Comparison Bars */}
            <ChartCard title="Monthly Listeners Comparison" subtitle="Spotify monthly listeners">
              <div className="space-y-3 pt-2">
                {(() => {
                  const maxListeners = Math.max(...selectedArtists.map(a => a.spotify.monthlyListeners), 1);
                  return selectedArtists.map((a, i) => {
                    const pct = (a.spotify.monthlyListeners / maxListeners) * 100;
                    return (
                      <div key={a.slug} className="flex items-center gap-3">
                        <span className="w-28 text-right text-[10px] text-[#9B9590] truncate shrink-0">{a.name}</span>
                        <div className="flex-1 h-6 bg-[#2C2B28] rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">{formatNumber(a.spotify.monthlyListeners)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </ChartCard>

            {/* Benchmark Radar for each artist */}
            <div className={`grid gap-3 ${selectedArtists.length <= 2 ? 'grid-cols-2' : selectedArtists.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {selectedArtists.map((a, i) => {
                const bench = getBenchmarkComparison(a, selectedArtists);
                return (
                  <ChartCard key={a.slug} title={a.name} subtitle="vs comparison group">
                    <div style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }} className="rounded">
                      <BenchmarkRadarChart
                        artist={bench.artist}
                        benchmark={bench.benchmark}
                        dimensions={bench.dimensions}
                        artistName={a.name}
                      />
                    </div>
                  </ChartCard>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
