import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Search, ArrowUpDown, Check, X, TrendingUp, BarChart3, ListMusic, Disc3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '../components/shared/ChartCard';
import { getTopTracksAcrossRoster, getArtist } from '../data/artists';
import { getTrackComparison, getRosterTrackStats } from '../data/trackData';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];

const SORT_OPTIONS = [
  { key: 'streams', label: 'Streams' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'growth', label: 'Growth' },
];

function mergeStreamingTrends(comparisons) {
  if (comparisons.length === 0) return [];
  const first = comparisons[0].trend;
  return first.map((_, i) => {
    const row = { date: first[i].date };
    comparisons.forEach((c) => {
      const d = c.trend[i];
      row[c.track.name] = (d.spotify || 0) + (d.apple || 0) + (d.youtube || 0) + (d.amazon || 0) + (d.tidal || 0);
    });
    return row;
  });
}

function MultiTrackTrendChart({ data, keys, colors }) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#6B6560', fontSize: 10 }}
          axisLine={{ stroke: '#2C2B28' }}
          tickLine={false}
          tickFormatter={(v) => v.slice(5)}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tick={{ fill: '#6B6560', fontSize: 10 }}
          axisLine={{ stroke: '#2C2B28' }}
          tickLine={false}
          tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v}
        />
        <Tooltip
          contentStyle={{ background: '#171614', border: '1px solid #2C2B28', borderRadius: 4, fontSize: 11 }}
          labelStyle={{ color: '#9B9590' }}
          formatter={(value, name) => [formatNumber(value), name]}
        />
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i]}
            strokeWidth={1.5}
            dot={false}
            opacity={0.8}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function TracksPage() {
  const stats = useMemo(() => getRosterTrackStats(), []);
  const allTracks = useMemo(() => stats.topTracks, [stats]);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('streams');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const filtered = useMemo(() => {
    let list = allTracks;
    if (query.length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(t => {
        const artistName = getArtist(t.artistSlug)?.name || '';
        return t.name.toLowerCase().includes(q) || artistName.toLowerCase().includes(q);
      });
    }
    const sorted = [...list].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'streams': av = a.streams; bv = b.streams; break;
        case 'popularity': av = a.popularity; bv = b.popularity; break;
        case 'playlists': av = a.spotifyPlaylists; bv = b.spotifyPlaylists; break;
        case 'growth': av = a.perf.growthDelta; bv = b.perf.growthDelta; break;
        default: av = a.streams; bv = b.streams;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return sorted;
  }, [allTracks, query, sortKey, sortAsc]);

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

  const selectedTracks = useMemo(
    () => allTracks.filter(t => selectedIds.includes(t.id)),
    [allTracks, selectedIds]
  );
  const comparisons = useMemo(() => getTrackComparison(selectedTracks), [selectedTracks]);
  const mergedTrend = useMemo(() => mergeStreamingTrends(comparisons), [comparisons]);
  const trendKeys = comparisons.map(c => c.track.name);
  const maxStreams = Math.max(...comparisons.map(c => c.track.streams || 0), 1);

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
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20">
            tracks
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Tracks</h1>
        <p className="text-sm text-[#9B9590] mt-1">Browse, search, and compare roster tracks</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Total Streams</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{formatNumber(stats.totalStreams)}</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Avg Popularity</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats.avgPopularity}/100</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Editorial Rate</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{stats.editorialRate}%</p>
          </div>
          <div className="bg-[#171614] border border-[#2C2B28] rounded p-3">
            <p className="text-[10px] text-[#9B9590] uppercase tracking-wider">Total Playlists</p>
            <p className="text-lg font-mono text-[#F5F0E8] mt-1">{formatNumber(stats.totalPlaylists)}</p>
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
            placeholder="Search by track or artist name..."
            className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer">
              <X size={12} className="text-[#6B6560]" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-[#6B6560]">{filtered.length} tracks</span>
      </div>

      {/* Table */}
      <div className="bg-[#171614] border border-[#2C2B28] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_140px_80px_80px_80px_80px] items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28] bg-[#0D0C0B]">
          <div className="text-[10px] text-[#6B6560] text-center">#</div>
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider">Track</div>
          <div className="text-[10px] font-medium text-[#9B9590] uppercase tracking-wider">Artist</div>
          <SortHeader label="Streams" sortField="streams" className="justify-end" />
          <SortHeader label="Pop" sortField="popularity" className="justify-end" />
          <SortHeader label="Playlists" sortField="playlists" className="justify-end" />
          <SortHeader label="Growth" sortField="growth" className="justify-end" />
        </div>

        {/* Table rows */}
        {filtered.map((track, i) => {
          const artist = getArtist(track.artistSlug);
          const isSelected = selectedIds.includes(track.id);
          const colorIdx = selectedIds.indexOf(track.id);
          return (
            <div
              key={track.id}
              className={`grid grid-cols-[40px_1fr_140px_80px_80px_80px_80px] items-center gap-2 px-3 py-2.5 border-b border-[#2C2B28]/50 hover:bg-[#1C1B18] transition-colors group ${
                isSelected ? 'bg-[#1C1B18]' : ''
              }`}
            >
              {/* Checkbox / rank */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => toggleSelect(track.id)}
                  disabled={!isSelected && selectedIds.length >= 4}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[#DA7756] bg-[#DA7756]'
                      : 'border-[#3D3B37] group-hover:border-[#6B6560]'
                  } ${!isSelected && selectedIds.length >= 4 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {isSelected ? (
                    <Check size={10} className="text-[#0D0C0B]" />
                  ) : (
                    <span className="text-[9px] font-mono text-[#6B6560]">{i + 1}</span>
                  )}
                </button>
              </div>

              {/* Track info */}
              <Link to={`/track/${track.id}`} className="flex items-center gap-2.5 min-w-0">
                {track.imageUrl ? (
                  <img src={track.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                    {isSelected && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[colorIdx] }} />}
                    {track.name}
                  </p>
                  <p className="text-[9px] text-[#6B6560] truncate md:hidden">{artist?.name}</p>
                </div>
              </Link>

              {/* Artist */}
              <Link to={`/artist/${track.artistSlug}`} className="text-[11px] text-[#9B9590] hover:text-[#F5F0E8] transition-colors truncate hidden md:block">
                {artist?.name}
              </Link>

              {/* Streams */}
              <span className="text-xs font-mono text-[#F5F0E8] text-right">{formatNumber(track.streams)}</span>

              {/* Popularity */}
              <span className="text-xs font-mono text-[#F5F0E8] text-right">{track.popularity}</span>

              {/* Playlists */}
              <span className="text-xs font-mono text-[#F5F0E8] text-right">{formatNumber(track.spotifyPlaylists)}</span>

              {/* Growth */}
              <span className={`text-xs font-mono text-right ${track.perf.growthDelta >= 0 ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}`}>
                {track.perf.growthDelta >= 0 ? '+' : ''}{track.perf.growthDelta}%
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Music size={24} className="mx-auto text-[#2C2B28] mb-2" />
            <p className="text-xs text-[#6B6560]">No tracks match "{query}"</p>
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
            <div className="flex items-center gap-4 px-5 py-3 bg-[#171614] border border-[#2C2B28] rounded-full shadow-2xl">
              <div className="flex items-center gap-2">
                {selectedIds.map((id, i) => {
                  const t = allTracks.find(t => t.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: COLORS[i] + '15', color: COLORS[i] }}>
                      <span className="truncate max-w-[80px]">{t?.name}</span>
                      <button onClick={() => setSelectedIds(selectedIds.filter(s => s !== id))} className="cursor-pointer">
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
                <h2 className="text-lg text-[#F5F0E8]">Track Comparison</h2>
                <p className="text-xs text-[#9B9590]">Comparing {comparisons.length} tracks side by side</p>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] border border-[#2C2B28] rounded transition-colors cursor-pointer"
              >
                <X size={12} /> Close
              </button>
            </div>

            {/* Side-by-side KPIs */}
            <div className={`grid gap-3 ${comparisons.length <= 2 ? 'grid-cols-2' : comparisons.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {comparisons.map((c, i) => (
                <Link key={c.track.id} to={`/track/${c.track.id}`} className="block group">
                  <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 hover:border-[#2C2B28]/80 transition-colors"
                    style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                    <div className="flex items-center gap-2 mb-1">
                      {c.track.imageUrl ? (
                        <img src={c.track.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                          <Music size={12} className="text-[#6B6560]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{c.track.name}</p>
                        <p className="text-[10px] text-[#6B6560] truncate">{c.artist?.name || ''}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Streams</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(c.track.streams)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Popularity</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{c.track.popularity}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Playlists</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(c.track.spotifyPlaylists)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">Growth</span>
                        <span className={`text-xs font-mono ${c.performance.growthDelta >= 0 ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}`}>
                          {c.performance.growthDelta >= 0 ? '+' : ''}{c.performance.growthDelta}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#9B9590]">TikTok Videos</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(c.track.tiktokVideos)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Streaming Trends Overlay */}
            <ChartCard title="Streaming Trends Comparison" subtitle="Estimated daily total streams (90 days)">
              <div className="h-[300px]">
                <MultiTrackTrendChart data={mergedTrend} keys={trendKeys} colors={COLORS} />
              </div>
            </ChartCard>

            {/* Stream Comparison Bars */}
            <ChartCard title="Total Streams Comparison" subtitle="Lifetime Spotify streams">
              <div className="space-y-3 pt-2">
                {comparisons.map((c, i) => {
                  const pct = (c.track.streams / maxStreams) * 100;
                  return (
                    <div key={c.track.id} className="flex items-center gap-3">
                      <span className="w-28 text-right text-[10px] text-[#9B9590] truncate shrink-0">{c.track.name}</span>
                      <div className="flex-1 h-6 bg-[#2C2B28] rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">{formatNumber(c.track.streams)}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            {/* Playlist Distribution Comparison */}
            <ChartCard title="Playlist Distribution" subtitle="Playlists by platform">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3D3B37]">
                      <th className="px-3 py-2 text-xs font-medium text-[#9B9590] text-left">Platform</th>
                      {comparisons.map((c, i) => (
                        <th key={c.track.id} className="px-3 py-2 text-xs font-medium text-right" style={{ color: COLORS[i] }}>
                          {c.track.name.length > 15 ? c.track.name.slice(0, 15) + '...' : c.track.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['Spotify', 'Apple Music', 'Deezer', 'YouTube', 'TikTok'].map((platform, pi) => (
                      <tr key={platform} className="border-b border-[#2C2B28]">
                        <td className="px-3 py-2 text-xs text-[#9B9590]">{platform}</td>
                        {comparisons.map((c) => {
                          const vals = [c.track.spotifyPlaylists, c.track.applePlaylists, c.track.deezerPlaylists, c.track.youtubePlaylists, c.track.tiktokVideos];
                          return (
                            <td key={c.track.id} className="px-3 py-2 text-xs font-mono text-[#F5F0E8] text-right">
                              {formatNumber(vals[pi])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
