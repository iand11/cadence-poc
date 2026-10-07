import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ListMusic, Search, ArrowUpDown, Check, X } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import Pagination from '../components/shared/Pagination';
import FilterBar from '../components/shared/FilterBar';
import { PlatformBadge, TypeBadge } from '../components/playlists/PlaylistBits';
import { useAsync } from '../hooks/useAsync';
import { fetchPlaylists, fetchPlaylist, fetchPlacements } from '../data/playlistsRemote';
import { useFollowedArtists } from '../hooks/useFollowedArtists';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];
const TYPE_OPTIONS = { All: '', Editorial: 'editorial', Chart: 'chart', Algorithmic: 'algorithmic', 'This Is': 'this_is', 'Major label': 'label', Brand: 'brand', User: 'user' };
const PLATFORM_OPTIONS = { All: '', Spotify: 'spotify', 'Apple Music': 'apple', Deezer: 'deezer' };

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function SortHeader({ label, field, active, onSort, className = '' }) {
  return (
    <button onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider cursor-pointer hover:text-[#F5F0E8] transition-colors ${active === field ? 'text-[#DA7756]' : 'text-[#9B9590]'} ${className}`}>
      {label}
      <ArrowUpDown size={10} className={active === field ? 'opacity-100' : 'opacity-30'} />
    </button>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
      <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-mono text-[#F5F0E8] mt-1">{value}</p>
    </div>
  );
}

export default function PlaylistsPage() {
  const { followedArtists, loading: rosterLoading } = useFollowedArtists();
  const slugs = useMemo(() => followedArtists.map((a) => a.slug), [followedArtists]);
  const slugKey = slugs.join(',');

  const [scope, setScope] = useState('roster'); // roster | all
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const [sortKey, setSortKey] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const rosterScope = scope === 'roster' && slugs.length > 0;
  const effectiveSort = sortKey || (rosterScope ? 'roster' : 'followers');

  const { data: listData, loading } = useAsync(
    () => (rosterLoading ? Promise.resolve(null) : fetchPlaylists({
      q: q.length >= 2 ? q : undefined,
      type: TYPE_OPTIONS[typeFilter],
      platform: PLATFORM_OPTIONS[platformFilter],
      slugs: rosterScope ? slugs : undefined,
      sort: effectiveSort,
      page,
      perPage,
    })),
    [rosterLoading, q, typeFilter, platformFilter, rosterScope, slugKey, effectiveSort, page, perPage],
  );
  const playlists = listData?.playlists || [];
  const total = listData?.total || 0;

  const { data: summaryData } = useAsync(
    () => (slugs.length ? fetchPlacements({ slugs, limit: 1 }) : Promise.resolve(null)),
    [slugKey],
  );
  const summary = summaryData?.summary;

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((s) => s !== id));
    else if (selectedIds.length < 4) setSelectedIds([...selectedIds, id]);
  };
  // Any filter / sort / scope change starts again at page 1.
  const reset = (setter) => (v) => { setter(v); setPage(1); };
  const handleSort = reset(setSortKey);

  const { data: comparisons = [] } = useAsync(
    () => (showComparison ? Promise.all(selectedIds.map((id) => fetchPlaylist(id, { slugs }))).then((r) => r.filter(Boolean)) : Promise.resolve([])),
    [showComparison, selectedIds.join(','), slugKey],
  );

  const overlap = useMemo(() => {
    if (comparisons.length < 2) return [];
    const m = new Map();
    for (const pl of comparisons) {
      for (const t of pl.tracks || []) {
        for (const a of t.artists || []) {
          if (!m.has(a.slug)) m.set(a.slug, { ...a, playlists: new Set(), roster: false });
          const e = m.get(a.slug);
          e.playlists.add(pl.id);
          if (t.roster) e.roster = true;
        }
      }
    }
    return [...m.values()].filter((a) => a.playlists.size > 1)
      .sort((a, b) => (b.playlists.size - a.playlists.size) || (b.roster - a.roster));
  }, [comparisons]);
  const maxFollowers = Math.max(...comparisons.map((p) => p.followers || 0), 1);

  const cols = rosterScope ? 'grid-cols-[40px_1fr_120px_70px_90px_70px_100px]' : 'grid-cols-[40px_1fr_120px_90px_70px_100px]';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#7BAF73]/10 text-[#7BAF73] border-[#7BAF73]/20">playlists</span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Playlists</h1>
        <p className="text-sm text-[#9B9590] mt-1">
          Editorial, chart and label playlists across Apple Music, Deezer and Spotify — crawled daily
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Kpi label={slugs.length ? 'Following playlists' : 'Tracked playlists'} value={formatNumber(slugs.length ? (summary?.playlists ?? 0) : total)} />
          <Kpi label="Editorial / chart" value={summary ? `${formatNumber(summary.editorialPlaylists)}${summary.playlists ? ` · ${Math.round((summary.editorialPlaylists / summary.playlists) * 100)}%` : ''}` : '—'} />
          <Kpi label="Playlist reach" value={summary?.reach ? formatNumber(summary.reach) : '—'} />
          <Kpi label="Adds / drops · 30d" value={summary ? `+${formatNumber(summary.added30d)} / −${formatNumber(summary.removed30d)}` : '—'} />
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        {slugs.length > 0 && (
          <div className="flex rounded border border-[#2C2B28] overflow-hidden text-[10px] uppercase tracking-wider">
            {[['roster', 'Following'], ['all', 'All tracked']].map(([v, l]) => (
              <button key={v} onClick={() => reset(setScope)(v)}
                className={`px-3 py-2 ${scope === v ? 'bg-[#DA7756] text-[#0D0C0B]' : 'text-[#9B9590] hover:text-[#F5F0E8]'}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-1 max-w-md h-9 px-3 rounded bg-[#171614] border border-[#2C2B28] focus-within:border-[#3D3B37] transition-colors">
          <Search size={14} className="text-[#6B6560] shrink-0" />
          <input type="text" value={query} onChange={(e) => reset(setQuery)(e.target.value)} placeholder="Search playlists..."
            className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none" />
          {query && <button onClick={() => reset(setQuery)('')} className="cursor-pointer"><X size={12} className="text-[#6B6560]" /></button>}
        </div>
        <span className="text-[10px] text-[#6B6560]">{loading ? 'Loading…' : `${formatNumber(total)} playlists`}</span>
      </div>

      <FilterBar filters={[
        { label: 'Type', options: Object.keys(TYPE_OPTIONS), value: typeFilter, onChange: reset(setTypeFilter) },
        { label: 'Platform', options: Object.keys(PLATFORM_OPTIONS), value: platformFilter, onChange: reset(setPlatformFilter) },
      ]} />

      <div className="bg-[#171614] border border-[#2C2B28] rounded overflow-hidden">
        <div className={`grid ${cols} items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28] bg-[#0D0C0B]`}>
          <div className="text-[10px] text-[#6B6560] text-center">#</div>
          <SortHeader active={effectiveSort} onSort={handleSort} label="Playlist" field="name" />
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider hidden md:block">Type</div>
          {rosterScope && <SortHeader active={effectiveSort} onSort={handleSort} label="Following" field="roster" className="justify-end" />}
          <SortHeader active={effectiveSort} onSort={handleSort} label="Followers" field="followers" className="justify-end" />
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider text-right">Tracks</div>
          <SortHeader active={effectiveSort} onSort={handleSort} label="Changed" field="changed" className="justify-end hidden md:flex" />
        </div>

        {playlists.map((pl, i) => {
          const isSelected = selectedIds.includes(pl.id);
          const colorIdx = selectedIds.indexOf(pl.id);
          return (
            <div key={pl.id} className={`grid ${cols} items-center gap-2 px-3 py-2 border-b border-[#2C2B28]/50 hover:bg-[#1C1B18] transition-colors group ${isSelected ? 'bg-[#1C1B18]' : ''}`}>
              <div className="flex items-center justify-center">
                <button onClick={() => toggleSelect(pl.id)} disabled={!isSelected && selectedIds.length >= 4}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${isSelected ? 'border-[#DA7756] bg-[#DA7756]' : 'border-[#3D3B37] group-hover:border-[#6B6560]'} ${!isSelected && selectedIds.length >= 4 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                  {isSelected ? <Check size={10} className="text-[#0D0C0B]" /> : <span className="text-[9px] font-mono text-[#6B6560]">{(page - 1) * perPage + i + 1}</span>}
                </button>
              </div>
              <Link to={`/app/playlist/${pl.id}`} className="min-w-0 flex items-center gap-2">
                {pl.imageUrl
                  ? <img src={pl.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
                  : <div className="w-8 h-8 rounded bg-[#2C2B28] shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                    {isSelected && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[colorIdx] }} />}
                    {pl.name}
                  </p>
                  <p className="text-[9px] text-[#6B6560] truncate">{pl.curator}</p>
                </div>
              </Link>
              <div className="hidden md:flex items-center gap-1"><PlatformBadge platform={pl.platform} /><TypeBadge type={pl.type} /></div>
              {rosterScope && <span className="text-xs font-mono text-[#F5F0E8] text-right">{pl.rosterTracks ?? '—'}</span>}
              <span className="text-xs font-mono text-[#F5F0E8] text-right">{pl.followers != null ? formatNumber(pl.followers) : '—'}</span>
              <span className="text-xs font-mono text-[#9B9590] text-right">{pl.trackCount ?? '—'}</span>
              <span className="text-[10px] font-mono text-[#9B9590] text-right hidden md:block">
                {pl.lastChangedAt ? new Date(pl.lastChangedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </span>
            </div>
          );
        })}

        {!loading && playlists.length === 0 && (
          <div className="text-center py-12">
            <ListMusic size={24} className="mx-auto text-[#2C2B28] mb-2" />
            <p className="text-xs text-[#6B6560]">
              {rosterScope ? 'None of the artists you follow are on a tracked playlist matching these filters.' : 'No playlists match these filters.'}
            </p>
          </div>
        )}
        {total > 0 && (
          <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        )}
      </div>

      <AnimatePresence>
        {selectedIds.length >= 2 && !showComparison && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-4 px-5 py-3 bg-[#171614] border border-[#2C2B28] rounded-full shadow-2xl">
              <span className="text-[10px] text-[#9B9590]">{selectedIds.length} selected</span>
              <button onClick={() => setSelectedIds([])} className="text-[10px] text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">Clear</button>
              <button onClick={() => setShowComparison(true)}
                className="px-4 py-1.5 bg-[#DA7756] text-[#0D0C0B] text-xs font-medium rounded-full hover:bg-[#DA7756]/90 transition-colors cursor-pointer">
                Compare {selectedIds.length}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComparison && comparisons.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg text-[#F5F0E8]">Playlist Comparison</h2>
                <p className="text-xs text-[#9B9590]">Comparing {comparisons.length} playlists side by side</p>
              </div>
              <button onClick={() => setShowComparison(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] border border-[#2C2B28] rounded transition-colors cursor-pointer">
                <X size={12} /> Close
              </button>
            </div>

            <div className={`grid gap-3 ${comparisons.length <= 2 ? 'grid-cols-2' : comparisons.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {comparisons.map((pl, i) => (
                <Link key={pl.id} to={`/app/playlist/${pl.id}`} className="block group">
                  <div className="bg-[#171614] border border-[#2C2B28] rounded p-4" style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                    <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors mb-1">{pl.name}</p>
                    <p className="text-[10px] text-[#6B6560] truncate mb-3">{pl.curator}</p>
                    <div className="space-y-2">
                      {[
                        ['Followers', pl.followers != null ? formatNumber(pl.followers) : '—'],
                        ['Tracks', pl.tracks.length],
                        ['Tracks by artists you follow', pl.rosterTracks ?? 0],
                        ['Best position (following)', pl.bestRosterPosition ? `#${pl.bestRosterPosition}` : '—'],
                        ['Changes · 90d', pl.changes.length],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between">
                          <span className="text-[10px] text-[#9B9590]">{l}</span>
                          <span className="text-xs font-mono text-[#F5F0E8]">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <ChartCard title="Followers" subtitle="Current followers / fans">
              <div className="space-y-3 pt-2">
                {comparisons.map((pl, i) => (
                  <div key={pl.id} className="flex items-center gap-3">
                    <span className="w-32 text-right text-[10px] text-[#9B9590] truncate shrink-0">{pl.name}</span>
                    <div className="flex-1 h-6 bg-[#2C2B28] rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.max(((pl.followers || 0) / maxFollowers) * 100, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }} />
                    </div>
                    <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">{pl.followers != null ? formatNumber(pl.followers) : 'n/a'}</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {overlap.length > 0 && (
              <ChartCard title="Artist Overlap" subtitle={`${overlap.length} artist${overlap.length === 1 ? '' : 's'} on more than one selected playlist`}>
                <div className="space-y-1">
                  {overlap.slice(0, 15).map((a) => (
                    <Link key={a.slug} to={`/app/artist/${a.slug}`} className="block">
                      <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                        <p className="flex-1 min-w-0 text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                          {a.name}{a.roster && <span className="ml-2 text-[9px] text-[#DA7756] uppercase tracking-wider">following</span>}
                        </p>
                        <div className="flex gap-1">
                          {comparisons.map((pl, i) => (
                            <div key={pl.id} className="w-3 h-3 rounded-full" title={pl.name}
                              style={{ backgroundColor: a.playlists.has(pl.id) ? COLORS[i] : '#2C2B28', opacity: a.playlists.has(pl.id) ? 0.8 : 0.3 }} />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-[#9B9590] shrink-0">{a.playlists.size}/{comparisons.length}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </ChartCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
