import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Music, TrendingUp, Search, X, Check, ArrowLeft, ListMusic } from 'lucide-react';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import { getTopTracksAcrossRoster, getArtist } from '../data/artists';
import { getTrackComparison } from '../data/trackData';
import { formatNumber } from '../utils/formatters';

const COLORS = ['#00D4FF', '#7ab87a', '#e85d5d', '#c084fc'];

function TrackSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const allTracks = useMemo(() => getTopTracksAcrossRoster(20), []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = query
    ? allTracks.filter(t =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        (getArtist(t.artistSlug)?.name || '').toLowerCase().includes(query.toLowerCase())
      )
    : allTracks;

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
        className="flex items-center gap-2 px-3 py-2 text-xs text-[#00D4FF] border border-[#00D4FF]/20 hover:border-[#00D4FF]/40 rounded transition-colors cursor-pointer"
      >
        <Music size={12} />
        {selected.length === 0 ? 'Select tracks to compare' : `${selected.length} track${selected.length === 1 ? '' : 's'} selected`}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-[#0F0F0F] border border-[#1E1E1E] rounded shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#1E1E1E]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#080808] rounded">
              <Search size={12} className="text-[#444444]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracks..."
                className="flex-1 bg-transparent text-xs text-[#F4F0EA] placeholder-[#444444] outline-none"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="cursor-pointer">
                  <X size={10} className="text-[#444444]" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map(t => {
              const checked = selected.includes(t.id);
              const disabled = !checked && selected.length >= 4;
              const artistName = getArtist(t.artistSlug)?.name || '';
              return (
                <button
                  key={t.id}
                  onClick={() => !disabled && toggle(t.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors cursor-pointer ${
                    disabled ? 'opacity-30' : 'hover:bg-[#1E1E1E]/50'
                  } ${checked ? 'text-[#F4F0EA]' : 'text-[#888888]'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-[#00D4FF] border-[#00D4FF]' : 'border-[#2A2A2A]'
                  }`}>
                    {checked && <Check size={8} className="text-[#080808]" />}
                  </div>
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                      <Music size={9} className="text-[#444444]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{t.name}</p>
                    <p className="text-[9px] text-[#444444] truncate">{artistName}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#444444] shrink-0">{formatNumber(t.streams)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-[10px] text-[#444444] py-4">No tracks match "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Merge multiple track trends into a single multi-series dataset for the chart
function mergeStreamingTrends(comparisons) {
  if (comparisons.length === 0) return [];
  const first = comparisons[0].trend;
  return first.map((_, i) => {
    const row = { date: first[i].date };
    // Sum all platforms for each track, store under track name keys
    comparisons.forEach((c) => {
      const d = c.trend[i];
      row[c.track.name] = (d.spotify || 0) + (d.apple || 0) + (d.youtube || 0) + (d.amazon || 0) + (d.tidal || 0);
    });
    return row;
  });
}

export default function TrackComparison() {
  const allTracks = useMemo(() => getTopTracksAcrossRoster(20), []);
  const [selectedIds, setSelectedIds] = useState(() => allTracks.slice(0, 3).map(t => t.id));

  const selectedTracks = useMemo(
    () => allTracks.filter(t => selectedIds.includes(t.id)),
    [allTracks, selectedIds]
  );

  const comparisons = useMemo(() => getTrackComparison(selectedTracks), [selectedTracks]);

  const mergedTrend = useMemo(() => mergeStreamingTrends(comparisons), [comparisons]);
  const trendKeys = comparisons.map(c => c.track.name);

  const maxStreams = Math.max(...comparisons.map(c => c.track.streams || 0), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#F4F0EA] transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#5b9bd5]/10 text-[#5b9bd5] border-[#5b9bd5]/20">
            tracks
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F4F0EA] mt-2">Track Comparison</h1>
        <p className="text-sm text-[#888888] mt-1">Compare up to 4 tracks side by side</p>
      </motion.div>

      {/* Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <TrackSelector selected={selectedIds} onChange={setSelectedIds} />
        {selectedIds.map((id, i) => {
          const c = comparisons.find(c => c.track.id === id);
          if (!c) return null;
          return (
            <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded border text-[11px]"
              style={{ borderColor: COLORS[i] + '40', color: COLORS[i] }}>
              <span className="truncate max-w-[120px]">{c.track.name}</span>
              <button onClick={() => setSelectedIds(selectedIds.filter(s => s !== id))} className="cursor-pointer">
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {comparisons.length === 0 ? (
        <div className="text-center py-16">
          <Music size={32} className="mx-auto text-[#1E1E1E] mb-3" />
          <p className="text-sm text-[#888888]">Select tracks to compare</p>
        </div>
      ) : (
        <div className="space-y-6">
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
        </div>
      )}
    </div>
  );
}

// Simple multi-line chart using Recharts
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
