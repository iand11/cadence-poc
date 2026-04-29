import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ListMusic, TrendingUp, Users, BarChart3, Search, X, Check, ArrowLeft } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import { getAllPlaylists, getPlaylistComparison } from '../data/playlistData';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];

function PlaylistSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const allPlaylists = useMemo(() => getAllPlaylists(), []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = query
    ? allPlaylists.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.curator.toLowerCase().includes(query.toLowerCase()))
    : allPlaylists;

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else if (selected.length < 4) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
      >
        <ListMusic size={12} />
        {selected.length === 0 ? 'Select playlists to compare' : `${selected.length} playlist${selected.length === 1 ? '' : 's'} selected`}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-[#171614] border border-[#2C2B28] rounded shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#2C2B28]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#0D0C0B] rounded">
              <Search size={12} className="text-[#6B6560]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search playlists..."
                className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="cursor-pointer">
                  <X size={10} className="text-[#6B6560]" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map(pl => {
              const checked = selected.includes(pl.id);
              const disabled = !checked && selected.length >= 4;
              return (
                <button
                  key={pl.id}
                  onClick={() => !disabled && toggle(pl.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors cursor-pointer ${
                    disabled ? 'opacity-30' : 'hover:bg-[#2C2B28]/50'
                  } ${checked ? 'text-[#F5F0E8]' : 'text-[#9B9590]'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'
                  }`}>
                    {checked && <Check size={8} className="text-[#0D0C0B]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{pl.name}</p>
                    <p className="text-[9px] text-[#6B6560] truncate">{pl.curator} · {pl.rosterTracks} artists</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#6B6560] shrink-0">{formatNumber(pl.totalStreamAttribution)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-[10px] text-[#6B6560] py-4">No playlists match "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlaylistComparison() {
  const allPlaylists = useMemo(() => getAllPlaylists(), []);
  // Default: pick top 3 playlists
  const [selectedIds, setSelectedIds] = useState(() => allPlaylists.slice(0, 3).map(p => p.id));

  const playlists = useMemo(() => getPlaylistComparison(selectedIds), [selectedIds]);

  // Overlap analysis: artists appearing on multiple selected playlists
  const overlap = useMemo(() => {
    if (playlists.length < 2) return [];
    const artistMap = new Map(); // slug → { name, playlists: Set }
    for (const pl of playlists) {
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
  }, [playlists]);

  const maxStreams = Math.max(...playlists.map(p => p.totalStreamAttribution || 0), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#7BAF73]/10 text-[#7BAF73] border-[#7BAF73]/20">
            playlists
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Playlist Comparison</h1>
        <p className="text-sm text-[#9B9590] mt-1">Compare up to 4 playlists side by side</p>
      </motion.div>

      {/* Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <PlaylistSelector selected={selectedIds} onChange={setSelectedIds} />
        {selectedIds.map((id, i) => {
          const pl = playlists.find(p => p.id === id);
          if (!pl) return null;
          return (
            <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded border text-[11px]"
              style={{ borderColor: COLORS[i] + '40', color: COLORS[i] }}>
              <span className="truncate max-w-[120px]">{pl.name}</span>
              <button onClick={() => setSelectedIds(selectedIds.filter(s => s !== id))} className="cursor-pointer">
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-16">
          <ListMusic size={32} className="mx-auto text-[#2C2B28] mb-3" />
          <p className="text-sm text-[#9B9590]">Select playlists to compare</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Side-by-side KPIs */}
          <div className={`grid gap-3 ${playlists.length <= 2 ? 'grid-cols-2' : playlists.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {playlists.map((pl, i) => (
              <Link key={pl.id} to={`/playlist/${pl.id}`} className="block group">
                <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 hover:border-[#2C2B28]/80 transition-colors"
                  style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                  <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors mb-1">{pl.name}</p>
                  <p className="text-[10px] text-[#6B6560] truncate mb-3">{pl.curator}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#9B9590]">Followers</span>
                      <span className="text-xs font-mono text-[#F5F0E8]">{pl.followers ? formatNumber(pl.followers) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#9B9590]">Roster Artists</span>
                      <span className="text-xs font-mono text-[#F5F0E8]">{pl.rosterTracks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#9B9590]">Stream Attribution</span>
                      <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(pl.totalStreamAttribution)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#9B9590]">Avg Position</span>
                      <span className="text-xs font-mono text-[#F5F0E8]">{pl.avgPosition ? `#${pl.avgPosition}` : '—'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Performance Comparison */}
          <ChartCard title="Stream Attribution Comparison" subtitle="Streams attributed to roster artists">
            <div className="space-y-3 pt-2">
              {playlists.map((pl, i) => {
                const pct = (pl.totalStreamAttribution / maxStreams) * 100;
                return (
                  <div key={pl.id} className="flex items-center gap-3">
                    <span className="w-32 text-right text-[10px] text-[#9B9590] truncate shrink-0">{pl.name}</span>
                    <div className="flex-1 h-6 bg-[#2C2B28] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">{formatNumber(pl.totalStreamAttribution)}</span>
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
                    <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{a.name}</p>
                      </div>
                      <div className="flex gap-1">
                        {playlists.map((pl, i) => (
                          <div
                            key={pl.id}
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: a.playlists.has(pl.id) ? COLORS[i] : '#2C2B28',
                              opacity: a.playlists.has(pl.id) ? 0.8 : 0.3,
                            }}
                            title={pl.name}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-[#9B9590] shrink-0">
                        {a.playlists.size}/{playlists.length}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Per-playlist top artists */}
          <div className={`grid gap-3 ${playlists.length <= 2 ? 'grid-cols-2' : playlists.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {playlists.map((pl, i) => (
              <ChartCard key={pl.id} title={pl.name} subtitle={`Top roster artists`}>
                <div className="space-y-0.5">
                  {(pl.tracks || []).slice(0, 5).map((t, j) => (
                    <Link key={`${t.artistSlug}-${j}`} to={`/artist/${t.artistSlug}`} className="block">
                      <div className="group flex items-center gap-2 px-1 py-1 rounded hover:bg-[#0D0C0B] transition-all">
                        <span className="text-[9px] font-mono text-[#6B6560] w-4 text-right shrink-0">{j + 1}</span>
                        <p className="text-[11px] text-[#F5F0E8] truncate flex-1 group-hover:text-[#DA7756] transition-colors">{t.artistName}</p>
                        <span className="text-[9px] font-mono text-[#9B9590] shrink-0">{formatNumber(t.streamsFromPlaylist)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </ChartCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
