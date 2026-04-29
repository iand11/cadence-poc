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

const COLORS = ['#DA7756', '#7BAF73', '#C75F4F', '#D4A574'];

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
        className="flex items-center gap-2 px-3 py-2 text-xs text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
      >
        <Music size={12} />
        {selected.length === 0 ? 'Select tracks to compare' : `${selected.length} track${selected.length === 1 ? '' : 's'} selected`}
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
                placeholder="Search tracks..."
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
                    disabled ? 'opacity-30' : 'hover:bg-[#2C2B28]/50'
                  } ${checked ? 'text-[#F5F0E8]' : 'text-[#9B9590]'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'
                  }`}>
                    {checked && <Check size={8} className="text-[#0D0C0B]" />}
                  </div>
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                      <Music size={9} className="text-[#6B6560]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{t.name}</p>
                    <p className="text-[9px] text-[#6B6560] truncate">{artistName}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#6B6560] shrink-0">{formatNumber(t.streams)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-[10px] text-[#6B6560] py-4">No tracks match "{query}"</p>
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
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20">
            tracks
          </span>
        </div>
        <h1 className="text-3xl font-light text-[#F5F0E8] mt-2">Track Comparison</h1>
        <p className="text-sm text-[#9B9590] mt-1">Compare up to 4 tracks side by side</p>
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
          <Music size={32} className="mx-auto text-[#2C2B28] mb-3" />
          <p className="text-sm text-[#9B9590]">Select tracks to compare</p>
        </div>
      ) : (
        <div className="space-y-6">
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
