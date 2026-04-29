import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, ArrowUpDown, Check, X } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import { allArtists, getAggregateStats, getBenchmarkComparison } from '../data/artists';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];

const SORT_OPTIONS = [
  { key: 'listeners', label: 'Listeners' },
  { key: 'followers', label: 'Followers' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'score', label: 'Score' },
];

export default function ArtistsPage() {
  const stats = useMemo(() => getAggregateStats(), []);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('listeners');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const filtered = useMemo(() => {
    let list = allArtists;
    if (query.length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.label || '').toLowerCase().includes(q) ||
        (a.genres?.primary?.name || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'listeners': av = a.spotify.monthlyListeners; bv = b.spotify.monthlyListeners; break;
        case 'followers': av = a.spotify.followers; bv = b.spotify.followers; break;
        case 'playlists': av = a.playlists.spotify.total; bv = b.playlists.spotify.total; break;
        case 'score': av = a.score; bv = b.score; break;
        default: av = a.spotify.monthlyListeners; bv = b.spotify.monthlyListeners;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return sorted;
  }, [query, sortKey, sortAsc]);

  const toggleSelect = (slug) => {
    if (selectedSlugs.includes(slug)) {
      setSelectedSlugs(selectedSlugs.filter(s => s !== slug));
    } else if (selectedSlugs.length < 4) {
      setSelectedSlugs([...selectedSlugs, slug]);
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

  const selectedArtists = useMemo(
    () => allArtists.filter(a => selectedSlugs.includes(a.slug)),
    [selectedSlugs]
  );

  const SortHeader = ({ label, sortField, className = '' }) => (
    <button
      onClick={() => handleSort(sortField)}
      className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider cursor-pointer hover:text-[#F5F0E8] transition-colors ${
        sortKey === sortField ? 'text-[#DA7756]' : 'text-[#9B9590]'
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
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20">
            artists
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Artists</h1>
        <p className="text-sm text-[#9B9590] mt-1">Browse, search, and compare roster artists</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Total Artists</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats.total}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Monthly Listeners</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{formatNumber(stats.totalListeners)}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Avg Score</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{Math.round(stats.avgScore)}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Playlist Reach</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{formatNumber(stats.totalPlaylistReach)}</p>
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
        <span className="text-[10px] text-[#6B6560]">{filtered.length} artists</span>
      </div>

      {/* Table */}
      <div className="bg-[#171614] border border-[#2C2B28] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_120px_100px_80px_60px] items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28] bg-[#0D0C0B]">
          <div className="text-[10px] text-[#6B6560] text-center">#</div>
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider">Artist</div>
          <SortHeader label="Listeners" sortField="listeners" className="justify-end" />
          <SortHeader label="Followers" sortField="followers" className="justify-end" />
          <SortHeader label="Playlists" sortField="playlists" className="justify-end" />
          <SortHeader label="Score" sortField="score" className="justify-end" />
        </div>

        {/* Table rows */}
        {filtered.map((artist, i) => {
          const isSelected = selectedSlugs.includes(artist.slug);
          const colorIdx = selectedSlugs.indexOf(artist.slug);
          return (
            <div
              key={artist.slug}
              className={`grid grid-cols-[40px_1fr_120px_100px_80px_60px] items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28]/50 hover:bg-[#1C1B18] transition-colors group ${
                isSelected ? 'bg-[#1C1B18]' : ''
              }`}
            >
              {/* Checkbox / rank */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => toggleSelect(artist.slug)}
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
                    <span className="text-[9px] font-mono text-[#6B6560]">{i + 1}</span>
                  )}
                </button>
              </div>

              {/* Artist info */}
              <Link to={`/artist/${artist.slug}`} className="flex items-center gap-2.5 min-w-0">
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

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users size={24} className="mx-auto text-[#2C2B28] mb-2" />
            <p className="text-xs text-[#6B6560]">No artists match "{query}"</p>
          </div>
        )}
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {selectedSlugs.length >= 2 && !showComparison && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-5 py-3 bg-[#171614] border border-[#2C2B28] rounded-full shadow-2xl">
              <div className="flex items-center gap-2">
                {selectedSlugs.map((slug, i) => {
                  const a = allArtists.find(a => a.slug === slug);
                  return (
                    <div key={slug} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: COLORS[i] + '15', color: COLORS[i] }}>
                      <span className="truncate max-w-[80px]">{a?.name}</span>
                      <button onClick={() => setSelectedSlugs(selectedSlugs.filter(s => s !== slug))} className="cursor-pointer">
                        <X size={8} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowComparison(true)}
                className="px-4 py-1.5 bg-[#DA7756] text-[#0D0C0B] text-xs font-medium rounded-full hover:bg-[#DA7756]/90 transition-colors cursor-pointer"
              >
                Compare {selectedSlugs.length}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison panels */}
      <AnimatePresence>
        {showComparison && selectedArtists.length >= 2 && (
          <motion.div
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
                <Link key={a.slug} to={`/artist/${a.slug}`} className="block group">
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
                const bench = getBenchmarkComparison(a);
                return (
                  <ChartCard key={a.slug} title={a.name} subtitle="vs roster average">
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
