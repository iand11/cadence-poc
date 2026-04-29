import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Search, ArrowUpDown, Check, X, TrendingUp, BarChart3, ListMusic, Disc3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '../components/shared/ChartCard';
import { getTopTracksAcrossRoster, getArtist } from '../data/artists';
import { getTrackComparison, getRosterTrackStats } from '../data/trackData';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#00D4FF', '#7ab87a', '#e85d5d', '#c084fc'];

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
          tick={{ fill: '#444444', fontSize: 10 }}
          axisLine={{ stroke: '#1E1E1E' }}
          tickLine={false}
          tickFormatter={(v) => v.slice(5)}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tick={{ fill: '#444444', fontSize: 10 }}
          axisLine={{ stroke: '#1E1E1E' }}
          tickLine={false}
          tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v}
        />
        <Tooltip
          contentStyle={{ background: '#0F0F0F', border: '1px solid #1E1E1E', borderRadius: 4, fontSize: 11 }}
          labelStyle={{ color: '#888888' }}
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
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#5b9bd5]/10 text-[#5b9bd5] border-[#5b9bd5]/20">
            tracks
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F4F0EA] mt-2">Tracks</h1>
        <p className="text-sm text-[#888888] mt-1">Browse, search, and compare roster tracks</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Total Streams</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{formatNumber(stats.totalStreams)}</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Avg Popularity</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{stats.avgPopularity}/100</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Editorial Rate</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{stats.editorialRate}%</p>
          </div>
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-3">
            <p className="text-[10px] text-[#888888] uppercase tracking-wider">Total Playlists</p>
            <p className="text-lg font-mono text-[#F4F0EA] mt-1">{formatNumber(stats.totalPlaylists)}</p>
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
            placeholder="Search by track or artist name..."
            className="flex-1 bg-transparent text-xs text-[#F4F0EA] placeholder-[#444444] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer">
              <X size={12} className="text-[#444444]" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-[#444444]">{filtered.length} tracks</span>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_140px_80px_80px_80px_80px] items-center gap-2 px-3 py-2.5 border-b border-[#1E1E1E] bg-[#080808]">
          <div className="text-[10px] text-[#444444] text-center">#</div>
          <div className="text-[10px] font-medium text-[#888888] uppercase tracking-wider">Track</div>
          <div className="text-[10px] font-medium text-[#888888] uppercase tracking-wider">Artist</div>
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
              className={`grid grid-cols-[40px_1fr_140px_80px_80px_80px_80px] items-center gap-2 px-3 py-2.5 border-b border-[#1E1E1E]/50 hover:bg-[#141414] transition-colors group ${
                isSelected ? 'bg-[#141414]' : ''
              }`}
            >
              {/* Checkbox / rank */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => toggleSelect(track.id)}
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

              {/* Track info */}
              <Link to={`/track/${track.id}`} className="flex items-center gap-2.5 min-w-0">
                {track.imageUrl ? (
                  <img src={track.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                    <Music size={12} className="text-[#444444]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">
                    {isSelected && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[colorIdx] }} />}
                    {track.name}
                  </p>
                  <p className="text-[9px] text-[#444444] truncate md:hidden">{artist?.name}</p>
                </div>
              </Link>

              {/* Artist */}
              <Link to={`/artist/${track.artistSlug}`} className="text-[11px] text-[#888888] hover:text-[#F4F0EA] transition-colors truncate hidden md:block">
                {artist?.name}
              </Link>

              {/* Streams */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">{formatNumber(track.streams)}</span>

              {/* Popularity */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">{track.popularity}</span>

              {/* Playlists */}
              <span className="text-xs font-mono text-[#F4F0EA] text-right">{formatNumber(track.spotifyPlaylists)}</span>

              {/* Growth */}
              <span className={`text-xs font-mono text-right ${track.perf.growthDelta >= 0 ? 'text-[#7ab87a]' : 'text-[#e85d5d]'}`}>
                {track.perf.growthDelta >= 0 ? '+' : ''}{track.perf.growthDelta}%
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Music size={24} className="mx-auto text-[#1E1E1E] mb-2" />
            <p className="text-xs text-[#444444]">No tracks match "{query}"</p>
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
                <h2 className="text-lg text-[#F4F0EA]">Track Comparison</h2>
                <p className="text-xs text-[#888888]">Comparing {comparisons.length} tracks side by side</p>
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
              {comparisons.map((c, i) => (
                <Link key={c.track.id} to={`/track/${c.track.id}`} className="block group">
                  <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-4 hover:border-[#1E1E1E]/80 transition-colors"
                    style={{ borderTopColor: COLORS[i], borderTopWidth: 2 }}>
                    <div className="flex items-center gap-2 mb-1">
                      {c.track.imageUrl ? (
                        <img src={c.track.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                          <Music size={12} className="text-[#444444]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{c.track.name}</p>
                        <p className="text-[10px] text-[#444444] truncate">{c.artist?.name || ''}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Streams</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(c.track.streams)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Popularity</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{c.track.popularity}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Playlists</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(c.track.spotifyPlaylists)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">Growth</span>
                        <span className={`text-xs font-mono ${c.performance.growthDelta >= 0 ? 'text-[#7ab87a]' : 'text-[#e85d5d]'}`}>
                          {c.performance.growthDelta >= 0 ? '+' : ''}{c.performance.growthDelta}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[#888888]">TikTok Videos</span>
                        <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(c.track.tiktokVideos)}</span>
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
                      <span className="w-28 text-right text-[10px] text-[#888888] truncate shrink-0">{c.track.name}</span>
                      <div className="flex-1 h-6 bg-[#1E1E1E] rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: COLORS[i], opacity: 0.7 }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs font-mono text-[#F4F0EA] shrink-0">{formatNumber(c.track.streams)}</span>
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
                    <tr className="border-b border-[#2A2A2A]">
                      <th className="px-3 py-2 text-xs font-medium text-[#888888] text-left">Platform</th>
                      {comparisons.map((c, i) => (
                        <th key={c.track.id} className="px-3 py-2 text-xs font-medium text-right" style={{ color: COLORS[i] }}>
                          {c.track.name.length > 15 ? c.track.name.slice(0, 15) + '...' : c.track.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['Spotify', 'Apple Music', 'Deezer', 'YouTube', 'TikTok'].map((platform, pi) => (
                      <tr key={platform} className="border-b border-[#1E1E1E]">
                        <td className="px-3 py-2 text-xs text-[#888888]">{platform}</td>
                        {comparisons.map((c) => {
                          const vals = [c.track.spotifyPlaylists, c.track.applePlaylists, c.track.deezerPlaylists, c.track.youtubePlaylists, c.track.tiktokVideos];
                          return (
                            <td key={c.track.id} className="px-3 py-2 text-xs font-mono text-[#F4F0EA] text-right">
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
