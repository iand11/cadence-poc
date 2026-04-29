import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ListMusic, Search, ArrowUpDown, Check, X, Users, BarChart3 } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import { getAllPlaylists, getPlaylistComparison, getRosterPlaylistStats } from '../data/playlistData';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#00D4FF', '#7ab87a', '#e85d5d', '#c084fc'];

const SORT_OPTIONS = [
  { key: 'streams', label: 'Streams' },
  { key: 'followers', label: 'Followers' },
  { key: 'artists', label: 'Roster Artists' },
];

const TYPE_BADGE = {
  editorial: { bg: 'bg-[#7ab87a]/10', text: 'text-[#7ab87a]', border: 'border-[#7ab87a]/20' },
  algorithmic: { bg: 'bg-[#5b9bd5]/10', text: 'text-[#5b9bd5]', border: 'border-[#5b9bd5]/20' },
  user: { bg: 'bg-[#c084fc]/10', text: 'text-[#c084fc]', border: 'border-[#c084fc]/20' },
};

export default function PlaylistsPage() {
  const rosterStats = useMemo(() => getRosterPlaylistStats(), []);
  const allPlaylists = useMemo(() => getAllPlaylists(), []);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('streams');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const filtered = useMemo(() => {
    let list = allPlaylists;
    if (query.length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.curator.toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'streams': av = a.totalStreamAttribution; bv = b.totalStreamAttribution; break;
        case 'followers': av = a.followers || 0; bv = b.followers || 0; break;
        case 'artists': av = a.rosterTracks; bv = b.rosterTracks; break;
        default: av = a.totalStreamAttribution; bv = b.totalStreamAttribution;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return sorted;
  }, [allPlaylists, query, sortKey, sortAsc]);

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(s => s !== id));
    } else if (selectedIds.length < 4) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const comparisons = useMemo(() => getPlaylistComparison(selectedIds), [selectedIds]);

  const overlap = useMemo(() => {
    if (comparisons.length < 2) return [];
    const artistMap = new Map();
    for (const pl of comparisons) {
      for (const t of (pl.tracks || [])) {
        if (!artistMap.has(t.artistSlug)) {
          artistMap.set(t.artistSlug, { name: t.artistName, slug: t.artistSlug, playlists: new Set() });
        }
        artistMap.get(t.artistSlug).playlists.add(pl.id);
      }
    }
    return [...artistMap.values()]
      .filter(a => a.playlists.size > 1)
      .sort((a, b) => b.playlists.size - a.playlists.size);
  }, [comparisons]);

  const maxStreams = Math.max(...comparisons.map(p => p.totalStreamAttribution || 0), 1);

  const SortHeader = ({ label, sortField, className = '' }) => (
    <button
      onClick={() => handleSort(sortField)}
      className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider cursor-pointer hover:text-[#F4F0EA] transition-colors ${
        sortKey === sortField ? 'text-[#00D4FF]' : 'text-[#888888]'
      } ${className}`}
    >
      {label}
      <ArrowUpDown size={10} className={sortKey === sortField ? 'opacity-100' : 'opacity-30'} />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header + KPIs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#7ab87a]/10 text-[#7ab87a] border-[#7ab87a]/20">
            playlists
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F4F0EA] mt-2">Playlists</h1>
        <p className="text-sm text-[#888888] mt-1">Browse, search, and compare roster playlist placements</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Total Playlists</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{allPlaylists.length}</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Editorial Rate</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{rosterStats.editorialRate}%</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Total Reach</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{formatNumber(rosterStats.totalReach)}</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Stream Attribution</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{formatNumber(rosterStats.totalStreamAttribution)}</p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md h-9 px-3 rounded bg-[#0F0F0F] border border-[#1E1E1E] focus-within:border-[#2A2A2A] transition-colors">
          <Search size={14} className="text-[#444444] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by playlist name or curator..."
            className="flex-1 bg-transparent text-xs text-[#F4F0EA] placeholder-[#444444] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer">
              <X size={12} className="text-[#444444]" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-[#444444]">{filtered.length} playlists</span>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_140px_80px_80px_100px_100px] items-center gap-2 px-3 py-2.5 border-b border-[#1E1E1E] bg-[#080808]">
          <div className="text-[10px] text-[#444444] text-center">#</div>
          <div className="text-[10px] font-medium text-[#888888] uppercase tracking-wider">Playlist</div>
          <div className="text-[10px] font-medium text-[#888888] uppercase tracking-wider hidden md:block">Type</div>
          <SortHeader label="Artists" sortField="artists" className="justify-end" />
          <SortHeader label="Followers" sortField="followers" className="justify-end" />
          <SortHeader label="Streams" sortField="streams" className="justify-end" />
          <div className="text-[10px] font-medium text-[#888888] uppercase tracking-wider text-right hidden md:block">Platform</div>
        </div>

        {/* Table rows */}
        {filtered.map((pl, i) => {
          const isSelected = selectedIds.includes(pl.id);
          const colorIdx = selectedIds.indexOf(pl.id);
          const badge = TYPE_BADGE[pl.type] || TYPE_BADGE.user;
          return (
            <div
              key={pl.id}
              className={`grid grid-cols-[40px_1fr_140px_80px_80px_100px_100px] items-center gap-2 px-3 py-2.5 border-b border-[#1E1E1E]/50 hover:bg-[#141414] transition-colors group ${
                isSelected ? 'bg-[#141414]' : ''
              }`}
            >
              {/* Checkbox / rank */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => toggleSelect(pl.id)}
                  disabled={!isSelected && selectedIds.length >= 4}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[#00D4FF] bg-[#00D4FF]'
                      : 'border-[#2A2A2A] group-hover:border-[#444444]'
                  } ${!isSelected && selectedIds.length >= 4 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {isSelected ? (
                    <Check size={10} className="text-[#080808]" />
                  ) : (
                    <span className="text-[9px] font-mono text-[#444444]">{i + 1}</span>
                  )}
                </button>
              </div>

              {/* Playlist info */}
              <Link to={`/playlist/${pl.id}`} className="min-w-0">
                <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">
                  {isSelected && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[colorIdx] }} />}
                  {pl.name}
                </p>
                <p className="text-[9px] text-[#444444] truncate">{pl.curator}</p>
              </Link>

              {/* Type */}
              <div className="hidden md:block">
                <span className={`text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${badge.bg} ${badge.text} ${badge.border}`}>
                  {pl.type}
                </span>
              </div>

              {/* Roster Artists */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">{pl.rosterTracks}</span>

              {/* Followers */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">
                {pl.followers ? formatNumber(pl.followers) : '—'}
              </span>

              {/* Stream Attribution */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">{formatNumber(pl.totalStreamAttribution)}</span>

              {/* Platform */}
              <span className="text-[10px] text-[#888888] text-right capitalize hidden md:block">{pl.platform}</span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <ListMusic size={24} className="mx-auto text-[#1E1E1E] mb-2" />
            <p className="text-xs text-[#444444]">No playlists match "{query}"</p>
          </div>
        )}
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {selectedIds.length >= 2 && !showComparison && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-5 py-3 bg-[#0F0F0F] border border-[#1E1E1E] rounded-full shadow-2xl">
              <div className="flex items-center gap-2">
                {selectedIds.map((id, i) => {
                  const pl = allPlaylists.find(p => p.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: COLORS[i] + '15', color: COLORS[i] }}>
                      <span className="truncate max-w-[80px]">{pl?.name}</span>
                      <button onClick={() => setSelectedIds(selectedIds.filter(s => s !== id))} className="cursor-pointer">
                        <X size={8} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowComparison(true)}
                className="px-4 py-1.5 bg-[#00D4FF] text-[#080808] text-xs font-medium rounded-full hover:bg-[#00D4FF]/90 transition-colors cursor-pointer"
              >
                Compare {selectedIds.length}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison panels */}
      <AnimatePresence>
        {showComparison && comparisons.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* Comparison header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg text-[#F4F0EA]">Playlist Comparison</h2>
                <p className="text-xs text-[#888888]">Comparing {comparisons.length} playlists side by side</p>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888888] hover:text-[#F4F0EA] border border-[#1E1E1E] rounded transition-colors cursor-pointer"
              >
                <X size={12} /> Close
              </button>
            </div>

            {/* Side-by-side KPIs */}
            <div className={`grid gap-3 ${comparisons.length <= 2 ? 'grid-cols-2' : comparisons.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {comparisons.map((pl, i) => (
                <Link key={pl.id} to={`/playlist/${pl.id}`} className="block group">
                  <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-4 hover:border-[#1E1E1E]/80 transition-colors"
                    style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                    <p className="text-sm text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors mb-1">{pl.name}</p>
                    <p className="text-[10px] text-[#444444] truncate mb-3">{pl.curator}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Followers</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{pl.followers ? formatNumber(pl.followers) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Roster Artists</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{pl.rosterTracks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Stream Attribution</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(pl.totalStreamAttribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Avg Position</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{pl.avgPosition ? `#${pl.avgPosition}` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Stream Attribution Bars */}
            <ChartCard title="Stream Attribution Comparison" subtitle="Streams attributed to roster artists">
              <div className="space-y-3 pt-2">
                {comparisons.map((pl, i) => {
                  const pct = (pl.totalStreamAttribution / maxStreams) * 100;
                  return (
                    <div key={pl.id} className="flex items-center gap-3">
                      <span className="w-32 text-right text-[10px] text-[#888888] truncate shrink-0">{pl.name}</span>
                      <div className="flex-1 h-6 bg-[#1E1E1E] rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs font-mono text-[#F4F0EA] shrink-0">{formatNumber(pl.totalStreamAttribution)}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            {/* Overlap Analysis */}
            {overlap.length > 0 && (
              <ChartCard title="Artist Overlap" subtitle={`${overlap.length} artist${overlap.length === 1 ? '' : 's'} on multiple selected playlists`}>
                <div className="space-y-1">
                  {overlap.slice(0, 12).map((a) => (
                    <Link key={a.slug} to={`/artist/${a.slug}`} className="block">
                      <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#141414] transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{a.name}</p>
                        </div>
                        <div className="flex gap-1">
                          {comparisons.map((pl, i) => (
                            <div
                              key={pl.id}
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: a.playlists.has(pl.id) ? COLORS[i] : '#1E1E1E',
                                opacity: a.playlists.has(pl.id) ? 0.8 : 0.3,
                              }}
                              title={pl.name}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-[#888888] shrink-0">
                          {a.playlists.size}/{comparisons.length}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </ChartCard>
            )}

            {/* Per-playlist top artists */}
            <div className={`grid gap-3 ${comparisons.length <= 2 ? 'grid-cols-2' : comparisons.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {comparisons.map((pl, i) => (
                <ChartCard key={pl.id} title={pl.name} subtitle="Top roster artists">
                  <div className="space-y-0.5">
                    {(pl.tracks || []).slice(0, 5).map((t, j) => (
                      <Link key={`${t.artistSlug}-${j}`} to={`/artist/${t.artistSlug}`} className="block">
                        <div className="group flex items-center gap-2 px-1 py-1 rounded hover:bg-[#080808] transition-all">
                          <span className="text-[9px] font-mono text-[#444444] w-4 text-right shrink-0">{j + 1}</span>
                          <p className="text-[11px] text-[#F4F0EA] truncate flex-1 group-hover:text-[#00D4FF] transition-colors">{t.artistName}</p>
                          <span className="text-[9px] font-mono text-[#888888] shrink-0">{formatNumber(t.streamsFromPlaylist)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </ChartCard>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
