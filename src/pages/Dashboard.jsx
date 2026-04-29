import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star, Sparkles, ArrowUp, Music, GripVertical,
  RotateCcw, MessageSquare, X, TrendingUp,
  Plus, LayoutGrid, Check, ListMusic,
} from 'lucide-react';
import KpiCard from '../components/shared/KpiCard';
import DataTable from '../components/shared/DataTable';
import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import SocialGrowthChart from '../components/charts/SocialGrowthChart';
import RevenueDonutChart from '../components/charts/RevenueDonutChart';
import ForecastChart from '../components/charts/ForecastChart';
import GeographyHeatMap from '../components/charts/GeographyHeatMap';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import PlatformBreakdownChart from '../components/charts/PlatformBreakdownChart';
import ChatMessage from '../components/ai/ChatMessage';
import TypingIndicator from '../components/ai/TypingIndicator';
import {
  allArtists,
  getTopArtists,
  getAggregateStats,
  getArtist,
  generateStreamingTrend,
  generateSocialTimeline,
  generateRevenue,
  generateForecast,
  getBenchmarkComparison,
  getTopTracksAcrossRoster,
  getRecentReleases,
} from '../data/artists';
import { getRosterPlaylistStats } from '../data/playlistData';
import { getRosterTrackStats } from '../data/trackData';
import { generateInsights } from '../utils/insights';
import { useChat } from '../hooks/useChat';
import { useFavorites } from '../hooks/useFavorites';
import { formatNumber, formatCurrency } from '../utils/formatters';

const STORAGE_KEY = 'cadence-widgets-v3';
const DEFAULT_ACTIVE = ['top-artists', 'streaming', 'revenue', 'social'];

const WIDGET_CATALOG = [
  { id: 'top-artists',           title: 'Top Artists',           subtitle: 'by overall rank' },
  { id: 'top-tracks',             title: 'Top Tracks',            subtitle: 'across the roster' },
  { id: 'recent-releases',        title: 'Recent Releases',       subtitle: 'latest albums & singles' },
  { id: 'streaming',             title: 'Streaming Trends',      subtitle: '90-day platform streams' },
  { id: 'revenue',               title: 'Revenue Breakdown',     subtitle: 'Estimated revenue split' },
  { id: 'social',                title: 'Social Growth',         subtitle: '90-day follower trends' },
  { id: 'forecast',              title: 'Stream Forecast',       subtitle: '60d actual + 30d predicted' },
  { id: 'geography',             title: 'Audience Geography',    subtitle: 'Listener hotspots map' },
  { id: 'platform-breakdown',    title: 'Platform Breakdown',    subtitle: 'Streams by platform' },
  { id: 'benchmark',             title: 'Benchmark Radar',       subtitle: 'Artist vs roster average' },
  { id: 'trending',              title: 'Trending Artists',      subtitle: 'High popularity artists' },
  { id: 'genre-distribution',    title: 'Genre Distribution',    subtitle: 'Artists across genres' },
  { id: 'leaderboard-listeners', title: 'Top by Listeners',      subtitle: 'Spotify monthly' },
  { id: 'leaderboard-social',    title: 'Top by Social',         subtitle: 'Combined following' },
  { id: 'playlist-overview',     title: 'Playlist Intelligence', subtitle: 'Roster playlist insights' },
  { id: 'track-intelligence',    title: 'Track Intelligence',    subtitle: 'Track analytics & movers' },
];

function loadActive() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.length > 0 ? saved : DEFAULT_ACTIVE;
  } catch { return DEFAULT_ACTIVE; }
}


// Pre-compute artist options for dropdowns
const artistOptions = getTopArtists(20);

// Roster averages for static insights
const rosterAvg = {
  listeners: allArtists.reduce((s, a) => s + a.spotify.monthlyListeners, 0) / allArtists.length,
  social: allArtists.reduce((s, a) => s + a.social.instagram + a.social.tiktok + a.social.youtube, 0) / allArtists.length,
};

const leaderboardCols = [
  { key: 'pos', label: '#' },
  {
    key: 'name', label: 'Artist', align: 'left',
    format: (v, row) => (
      <Link to={`/artist/${row.slug}`} className="text-[#F4F0EA] hover:text-[#00D4FF] transition-colors">{v}</Link>
    ),
  },
  { key: 'stat', label: 'Listeners', format: (v) => formatNumber(v) },
];

const socialCols = [
  { key: 'pos', label: '#' },
  {
    key: 'name', label: 'Artist', align: 'left',
    format: (v, row) => (
      <Link to={`/artist/${row.slug}`} className="text-[#F4F0EA] hover:text-[#00D4FF] transition-colors">{v}</Link>
    ),
  },
  { key: 'stat', label: 'Social Following', format: (v) => formatNumber(v) },
];

// --- Shared small components ---

const insightDot = { success: 'bg-[#7ab87a]', warning: 'bg-[#00D4FF]', danger: 'bg-[#e85d5d]', info: 'bg-[#5b9bd5]' };

function WidgetInsight({ insight }) {
  if (!insight) return null;
  return (
    <div className="mt-3 pt-3 border-t border-[#1E1E1E] flex items-start gap-2">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${insightDot[insight.type] || insightDot.info}`} />
      <p className="text-[10px] text-[#888888] leading-relaxed line-clamp-2">{insight.text}</p>
    </div>
  );
}

function StaticInsight({ type, text }) {
  return (
    <div className="mt-3 pt-3 border-t border-[#1E1E1E] flex items-start gap-2">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${insightDot[type] || insightDot.info}`} />
      <p className="text-[10px] text-[#888888] leading-relaxed line-clamp-2">{text}</p>
    </div>
  );
}

function ArtistMultiSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isAll = value[0] === '__all__';
  const label = isAll ? 'Entire Roster'
    : value.length === 1 ? (getArtist(value[0])?.name || value[0])
    : `${value.length} artists`;

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (slug) => {
    if (slug === '__all__') {
      onChange(['__all__']);
      return;
    }
    const cur = value.filter(s => s !== '__all__');
    const next = cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug];
    onChange(next.length > 0 ? next : [artistOptions[0].slug]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-[10px] bg-[#080808] text-[#888888] border border-[#1E1E1E] rounded px-2 py-0.5 cursor-pointer hover:border-[#2A2A2A] transition-colors max-w-[130px] truncate flex items-center gap-1"
      >
        <span className="truncate">{label}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0 opacity-40"><path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[#0F0F0F] border border-[#1E1E1E] rounded shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              onClick={() => toggle('__all__')}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-[#1E1E1E]/50 transition-colors cursor-pointer ${isAll ? 'text-[#00D4FF]' : 'text-[#888888]'}`}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isAll ? 'bg-[#00D4FF] border-[#00D4FF]' : 'border-[#2A2A2A]'}`}>
                {isAll && <Check size={8} className="text-[#080808]" />}
              </div>
              <span className="font-medium">Entire Roster</span>
              <span className="ml-auto text-[#444444]">{allArtists.length}</span>
            </button>
            <div className="border-t border-[#1E1E1E] my-1" />
            {artistOptions.map(a => {
              const checked = !isAll && value.includes(a.slug);
              return (
                <button
                  key={a.slug}
                  onClick={() => toggle(a.slug)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-[#1E1E1E]/50 transition-colors cursor-pointer ${checked ? 'text-[#F4F0EA]' : 'text-[#888888]'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#00D4FF] border-[#00D4FF]' : 'border-[#2A2A2A]'}`}>
                    {checked && <Check size={8} className="text-[#080808]" />}
                  </div>
                  <span className="truncate">{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetCard({ id, title, subtitle, headerRight, children, onDragStart, onDragOver, onDrop, onRemove }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); onDragStart?.(id); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(id); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(id); }}
      className="bg-[#0F0F0F] border border-[#1E1E1E] rounded overflow-hidden hover:border-[#1E1E1E]/80 transition-colors"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <div className="cursor-grab active:cursor-grabbing text-[#2A2A2A] hover:text-[#444444] transition-colors">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-[#F4F0EA] truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-[#444444] truncate">{subtitle}</p>}
        </div>
        {headerRight}
        <button
          onClick={() => onRemove?.(id)}
          className="p-1 text-[#2A2A2A] hover:text-[#888888] transition-colors cursor-pointer shrink-0"
          title="Remove widget"
        >
          <X size={12} />
        </button>
      </div>
      <div className="px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

// --- Resolve selection to artists (cap at 20 for perf) ---
function resolveArtists(slugs) {
  if (slugs[0] === '__all__') return getTopArtists(20);
  return slugs.map(s => getArtist(s)).filter(Boolean);
}

function selectionLabel(slugs) {
  if (slugs[0] === '__all__') return 'Entire Roster';
  if (slugs.length === 1) return getArtist(slugs[0])?.name || slugs[0];
  return `${slugs.length} artists`;
}

// --- Aggregate helpers ---
function aggStreaming(artists, days = 90) {
  const all = artists.map(a => generateStreamingTrend(a, days));
  return all[0].map((_, i) => {
    const row = { date: all[0][i].date };
    ['spotify', 'apple', 'youtube', 'amazon', 'tidal'].forEach(p => {
      row[p] = all.reduce((s, d) => s + (d[i]?.[p] || 0), 0);
    });
    return row;
  });
}

function aggSocial(artists) {
  const all = artists.map(a => generateSocialTimeline(a));
  return all[0].map((_, i) => {
    const row = { date: all[0][i].date };
    ['tiktok', 'instagram', 'twitter', 'youtube'].forEach(p => {
      row[p] = all.reduce((s, d) => s + (d[i]?.[p] || 0), 0);
    });
    return row;
  });
}

function aggRevenue(artists) {
  const all = artists.map(a => generateRevenue(a));
  const totalAll = all.reduce((s, r) => s + r.reduce((ss, rr) => ss + rr.amount, 0), 0);
  return all[0].map((item, i) => {
    const amount = all.reduce((s, r) => s + r[i].amount, 0);
    return { source: item.source, amount, percentage: totalAll > 0 ? Math.round(amount / totalAll * 100) : 0 };
  });
}

function aggGeography(artists) {
  const cityMap = {};
  artists.forEach(a => {
    (a.spotify.topCities || []).forEach(c => {
      const key = `${c.city}-${c.country}`;
      if (!cityMap[key]) cityMap[key] = { city: c.city, country: c.country, listeners: 0 };
      cityMap[key].listeners += c.listeners || 0;
    });
  });
  return Object.values(cityMap).sort((a, b) => b.listeners - a.listeners).slice(0, 20);
}

function aggForecast(artists) {
  const all = artists.map(a => generateForecast(a));
  return all[0].map((_, i) => {
    const row = { date: all[0][i].date };
    ['actual', 'forecast', 'upper', 'lower'].forEach(k => {
      const vals = all.map(d => d[i]?.[k]).filter(v => v != null);
      row[k] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
    });
    return row;
  });
}

function aggBenchmark(artists) {
  const all = artists.map(a => getBenchmarkComparison(a));
  const dims = all[0].dimensions;
  const avgNorm = dims.map((_, i) =>
    all.reduce((s, d) => s + d.artist.normalized[i], 0) / all.length
  );
  return { dimensions: dims, artist: { normalized: avgNorm }, benchmark: all[0].benchmark };
}

// --- Artist-selectable widget components ---

function StreamingWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggStreaming(artists), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).streaming[0], [artists]);

  return (
    <WidgetCard id="streaming" title="Streaming Trends" subtitle={`${selectionLabel(slugs)} — 90 days`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <StreamingTrendChart data={data} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function SocialWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggSocial(artists), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).social[0], [artists]);

  return (
    <WidgetCard id="social" title="Social Growth" subtitle={`${selectionLabel(slugs)} — 90 days`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <SocialGrowthChart data={data} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function ForecastWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggForecast(artists), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).streaming[0], [artists]);

  return (
    <WidgetCard id="forecast" title="Stream Forecast" subtitle={`${selectionLabel(slugs)} — 60d + 30d predicted`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <ForecastChart data={data} todayIndex={59} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function BenchmarkWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggBenchmark(artists), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).streaming[0], [artists]);
  const name = slugs[0] === '__all__' ? 'Roster avg' : artists.length === 1 ? artists[0].name : `${artists.length} artists avg`;

  return (
    <WidgetCard id="benchmark" title="Benchmark Radar" subtitle={`${name} vs roster average`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <BenchmarkRadarChart
        artist={data.artist}
        benchmark={data.benchmark}
        dimensions={data.dimensions}
        artistName={name}
      />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function RevenueWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggRevenue(artists), [artists]);
  const total = data.reduce((s, r) => s + r.amount, 0);
  const insight = useMemo(() => generateInsights(artists[0]).revenue[0], [artists]);

  return (
    <WidgetCard id="revenue" title="Revenue Breakdown" subtitle={`${selectionLabel(slugs)} — ${formatCurrency(total)}`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <RevenueDonutChart data={data} totalRevenue={total} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function GeographyWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggGeography(artists), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).geography[0], [artists]);

  return (
    <WidgetCard id="geography" title="Audience Geography" subtitle={`${selectionLabel(slugs)} — listener hotspots`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <GeographyHeatMap data={data} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function PlatformWidget({ dragProps }) {
  const [slugs, setSlugs] = useState(['__all__']);
  const artists = useMemo(() => resolveArtists(slugs), [slugs]);
  const data = useMemo(() => aggStreaming(artists, 12), [artists]);
  const insight = useMemo(() => generateInsights(artists[0]).playlists[0], [artists]);

  return (
    <WidgetCard id="platform-breakdown" title="Platform Breakdown" subtitle={`${selectionLabel(slugs)} — streams by platform`}
      headerRight={<ArtistMultiSelect value={slugs} onChange={setSlugs} />} {...dragProps}>
      <PlatformBreakdownChart data={data} />
      <WidgetInsight insight={insight} />
    </WidgetCard>
  );
}

function PlaylistWidget({ dragProps }) {
  const plStats = useMemo(() => getRosterPlaylistStats(), []);

  return (
    <WidgetCard id="playlist-overview" title="Playlist Intelligence" subtitle={`${plStats.totalPlacements} placements · ${plStats.editorialRate}% editorial`} {...dragProps}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#080808] rounded p-2 text-center">
          <p className="text-xs font-mono text-[#F4F0EA]">{formatNumber(plStats.totalPlacements)}</p>
          <p className="text-[9px] text-[#444444]">Placements</p>
        </div>
        <div className="bg-[#080808] rounded p-2 text-center">
          <p className="text-xs font-mono text-[#F4F0EA]">{formatNumber(plStats.totalReach)}</p>
          <p className="text-[9px] text-[#444444]">Total Reach</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {plStats.topPlaylists.slice(0, 5).map((pl) => (
          <Link key={pl.id} to={`/playlist/${pl.id}`} className="block">
            <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#080808] transition-all">
              <div className="w-7 h-7 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                <ListMusic size={11} className="text-[#444444]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{pl.name}</p>
                <p className="text-[9px] text-[#444444] truncate">{pl.rosterTracks} artist{pl.rosterTracks === 1 ? '' : 's'}</p>
              </div>
              <span className="text-[10px] font-mono text-[#888888] shrink-0">{formatNumber(pl.totalStreamAttribution)}</span>
            </div>
          </Link>
        ))}
      </div>
      <StaticInsight type="success"
        text={`${plStats.editorialPlacements} editorial placements across the roster — ${plStats.editorialRate}% editorial rate with ${formatNumber(plStats.totalStreamAttribution)} total attributed streams.`} />
    </WidgetCard>
  );
}

function TrackIntelligenceWidget({ dragProps }) {
  const tStats = useMemo(() => getRosterTrackStats(), []);

  return (
    <WidgetCard id="track-intelligence" title="Track Intelligence" subtitle={`${formatNumber(tStats.totalStreams)} total streams · ${tStats.avgPopularity}/100 avg popularity`} {...dragProps}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#080808] rounded p-2 text-center">
          <p className="text-xs font-mono text-[#F4F0EA]">{formatNumber(tStats.totalStreams)}</p>
          <p className="text-[9px] text-[#444444]">Total Streams</p>
        </div>
        <div className="bg-[#080808] rounded p-2 text-center">
          <p className="text-xs font-mono text-[#F4F0EA]">{tStats.editorialRate}%</p>
          <p className="text-[9px] text-[#444444]">Editorial Rate</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {tStats.topMovers.slice(0, 5).map((t, i) => (
          <Link key={t.id} to={`/track/${t.id}`} className="block">
            <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#080808] transition-all">
              <span className="text-[10px] font-mono text-[#444444] w-4 text-right shrink-0">{i + 1}</span>
              {t.imageUrl ? (
                <img src={t.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                  <Music size={11} className="text-[#444444]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{t.name}</p>
                <p className="text-[9px] text-[#444444] truncate">{getArtist(t.artistSlug)?.name || ''}</p>
              </div>
              <span className={`text-[10px] font-mono shrink-0 ${t.perf.growthDelta >= 0 ? 'text-[#7ab87a]' : 'text-[#e85d5d]'}`}>
                {t.perf.growthDelta >= 0 ? '+' : ''}{t.perf.growthDelta}%
              </span>
            </div>
          </Link>
        ))}
      </div>
      <StaticInsight type="info"
        text={`Top mover: "${tStats.topMovers[0]?.name}" at ${tStats.topMovers[0]?.perf.growthDelta >= 0 ? '+' : ''}${tStats.topMovers[0]?.perf.growthDelta}% growth — ${formatNumber(tStats.topMovers[0]?.streams)} total streams across ${formatNumber(tStats.topMovers[0]?.spotifyPlaylists)} playlists.`} />
    </WidgetCard>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const navigate = useNavigate();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { messages, state: chatState, suggestions, sendMessage, pendingAction, clearAction } = useChat();

  const [activeWidgets, setActiveWidgets] = useState(loadActive);
  const [dragId, setDragId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Handle navigation actions from chat
  useEffect(() => {
    if (pendingAction?.type === 'navigate') {
      clearAction();
      navigate(pendingAction.url);
    }
  }, [pendingAction, clearAction, navigate]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatState, chatOpen]);

  // --- Data for non-artist-selectable widgets ---
  const stats = useMemo(() => getAggregateStats(), []);
  const top6 = useMemo(() => getTopArtists(6), []);

  const avgPopularity = useMemo(() =>
    Math.round(allArtists.reduce((s, a) => s + a.spotify.popularity, 0) / allArtists.length),
  []);

  const byListeners = useMemo(() =>
    [...allArtists].sort((a, b) => b.spotify.monthlyListeners - a.spotify.monthlyListeners)
      .slice(0, 8).map((a, i) => ({ pos: i + 1, name: a.name, slug: a.slug, stat: a.spotify.monthlyListeners })),
  []);

  const bySocial = useMemo(() =>
    [...allArtists].sort((a, b) =>
      (b.social.instagram + b.social.tiktok + b.social.youtube) -
      (a.social.instagram + a.social.tiktok + a.social.youtube))
      .slice(0, 8).map((a, i) => ({
        pos: i + 1, name: a.name, slug: a.slug,
        stat: a.social.instagram + a.social.tiktok + a.social.youtube,
      })),
  []);

  const trendingArtists = useMemo(() =>
    allArtists
      .filter(a => a.spotify.popularity >= 70)
      .sort((a, b) => b.spotify.popularity - a.spotify.popularity)
      .slice(0, 8)
      .map((a, i) => ({
        pos: i + 1, name: a.name, slug: a.slug,
        listeners: a.spotify.monthlyListeners,
      })),
  []);

  const trendingTotal = useMemo(() =>
    allArtists.filter(a => a.spotify.popularity >= 70).length,
  []);

  const genreDistribution = useMemo(() => {
    const counts = {};
    allArtists.forEach(a => {
      const genre = a.genres?.primary?.name || 'Other';
      counts[genre] = (counts[genre] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, []);
  const maxGenreCount = genreDistribution[0]?.count || 1;

  const favoriteArtists = useMemo(() =>
    favorites.map(slug => getArtist(slug)).filter(a => a && favorites.includes(a.slug)),
  [favorites]);

  // --- Drag reorder ---
  const persist = useCallback((list) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const handleDragOver = useCallback((targetId) => {
    if (!dragId || dragId === targetId) return;
    setActiveWidgets(prev => {
      const fromIdx = prev.indexOf(dragId);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragId);
      return next;
    });
  }, [dragId]);

  const handleDrop = useCallback(() => {
    setDragId(null);
    setActiveWidgets(prev => { persist(prev); return prev; });
  }, [persist]);

  const resetWidgets = useCallback(() => {
    setActiveWidgets(DEFAULT_ACTIVE);
    persist(DEFAULT_ACTIVE);
  }, [persist]);

  const removeWidget = useCallback((id) => {
    setActiveWidgets(prev => {
      const next = prev.filter(w => w !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const addWidget = useCallback((id) => {
    setActiveWidgets(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persist(next);
      return next;
    });
  }, [persist]);

  // --- Chat ---
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;
    sendMessage(chatQuery.trim());
    setChatQuery('');
  };

  const handleSuggestion = (text) => {
    setChatOpen(true);
    sendMessage(text);
    setChatQuery('');
  };

  // --- Widget definitions ---
  const dragProps = { onDragStart: setDragId, onDragOver: handleDragOver, onDrop: handleDrop, onRemove: removeWidget };

  const widgets = {
    'top-artists': (
      <WidgetCard id="top-artists" title="Top Artists" subtitle="by overall rank" {...dragProps}>
        <div className="space-y-0.5">
          {top6.map((artist) => (
            <Link key={artist.slug} to={`/artist/${artist.slug}`} className="block">
              <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#080808] transition-all">
                {artist.imageUrl ? (
                  <img src={artist.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                    <Music size={11} className="text-[#444444]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{artist.name}</p>
                  <p className="text-[9px] text-[#444444]">{artist.genres?.primary?.name || 'Artist'} · {formatNumber(artist.spotify.monthlyListeners)}</p>
                </div>
                <span className="text-[9px] font-mono text-[#444444]">#{artist.rank}</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(artist.slug); }}
                  className="p-0.5 cursor-pointer shrink-0"
                >
                  <Star size={11} className={isFavorite(artist.slug) ? 'text-[#00D4FF] fill-[#00D4FF]' : 'text-[#2A2A2A] hover:text-[#444444]'} />
                </button>
              </div>
            </Link>
          ))}
        </div>
        <StaticInsight type="info"
          text={`Top ${top6.length} artists averaging ${Math.round(top6.reduce((s, a) => s + a.spotify.popularity, 0) / top6.length)}/100 popularity — ${top6.filter(a => a.spotify.popularity >= 80).length} at 80+ indicating strong algorithmic support.`} />
      </WidgetCard>
    ),
    'top-tracks': (
      <WidgetCard id="top-tracks" title="Top Tracks" subtitle="Roster — by Spotify streams" {...dragProps}>
        <div className="space-y-0.5">
          {getTopTracksAcrossRoster(8).map((t, i) => (
            <Link key={t.id} to={`/track/${t.id}`} className="block">
              <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#080808] transition-all">
                <span className="text-[10px] font-mono text-[#444444] w-4 text-right shrink-0">{i + 1}</span>
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                    <Music size={11} className="text-[#444444]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{t.name}</p>
                  <p className="text-[9px] text-[#444444] truncate">{getArtist(t.artistSlug)?.name || ''}</p>
                </div>
                <span className="text-[10px] font-mono text-[#888888] shrink-0">{formatNumber(t.streams)}</span>
              </div>
            </Link>
          ))}
        </div>
      </WidgetCard>
    ),
    'recent-releases': (
      <WidgetCard id="recent-releases" title="Recent Releases" subtitle="Latest albums & singles" {...dragProps}>
        <div className="grid grid-cols-3 gap-2">
          {getRecentReleases(6).map((a) => (
            <Link key={a.id} to={`/album/${a.id}`} className="group block">
              <div className="aspect-square rounded overflow-hidden bg-[#1E1E1E] border border-[#1E1E1E] group-hover:border-[#00D4FF]/30 transition-colors mb-1.5">
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music size={20} className="text-[#444444]" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{a.name}</p>
              <p className="text-[9px] text-[#444444] truncate">
                {getArtist(a.artistSlug)?.name || ''}
                {a.releaseDate ? ` · ${new Date(a.releaseDate).getFullYear()}` : ''}
              </p>
            </Link>
          ))}
        </div>
      </WidgetCard>
    ),
    'streaming': <StreamingWidget dragProps={dragProps} />,
    'social': <SocialWidget dragProps={dragProps} />,
    'revenue': <RevenueWidget dragProps={dragProps} />,
    'forecast': <ForecastWidget dragProps={dragProps} />,
    'geography': <GeographyWidget dragProps={dragProps} />,
    'benchmark': <BenchmarkWidget dragProps={dragProps} />,
    'platform-breakdown': <PlatformWidget dragProps={dragProps} />,
    'leaderboard-listeners': (
      <WidgetCard id="leaderboard-listeners" title="Top by Listeners" subtitle="Spotify monthly" {...dragProps}>
        <DataTable columns={leaderboardCols} data={byListeners} />
        <StaticInsight type="info"
          text={`#1 ${byListeners[0]?.name} has ${formatNumber(byListeners[0]?.stat)} monthly listeners — ${(byListeners[0]?.stat / rosterAvg.listeners).toFixed(1)}x the roster average of ${formatNumber(Math.round(rosterAvg.listeners))}.`} />
      </WidgetCard>
    ),
    'leaderboard-social': (
      <WidgetCard id="leaderboard-social" title="Top by Social" subtitle="Combined following" {...dragProps}>
        <DataTable columns={socialCols} data={bySocial} />
        <StaticInsight type="info"
          text={`#1 ${bySocial[0]?.name} has ${formatNumber(bySocial[0]?.stat)} combined social following — ${(bySocial[0]?.stat / rosterAvg.social).toFixed(1)}x the roster average.`} />
      </WidgetCard>
    ),
    'trending': (
      <WidgetCard id="trending" title="Trending Artists" subtitle="High popularity artists" {...dragProps}>
        <div className="space-y-0.5">
          {trendingArtists.map((a) => (
            <Link key={a.slug} to={`/artist/${a.slug}`} className="block">
              <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#080808] transition-all">
                <span className="text-[10px] font-mono text-[#444444] w-4 text-right shrink-0">{a.pos}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{a.name}</p>
                  <p className="text-[9px] text-[#444444]">{formatNumber(a.listeners)} listeners</p>
                </div>
                <TrendingUp size={12} className="text-[#7ab87a] shrink-0" />
              </div>
            </Link>
          ))}
        </div>
        <StaticInsight type="success"
          text={`${trendingTotal} of ${allArtists.length} artists (${(trendingTotal / allArtists.length * 100).toFixed(0)}%) with 70+ popularity — strong algorithmic visibility across the roster.`} />
      </WidgetCard>
    ),
    'genre-distribution': (
      <WidgetCard id="genre-distribution" title="Genre Distribution" subtitle={`${allArtists.length} artists across genres`} {...dragProps}>
        <div className="space-y-1.5 pt-1">
          {genreDistribution.map((g) => (
            <div key={g.name} className="flex items-center gap-2.5">
              <span className="text-[10px] text-[#F4F0EA] w-24 truncate text-right shrink-0">{g.name}</span>
              <div className="flex-1 h-4 bg-[#1E1E1E] rounded overflow-hidden">
                <div
                  className="h-full bg-[#00D4FF] rounded"
                  style={{ width: `${(g.count / maxGenreCount) * 100}%`, opacity: 0.4 + (g.count / maxGenreCount) * 0.6 }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#888888] w-6 text-right shrink-0">{g.count}</span>
            </div>
          ))}
        </div>
        <StaticInsight type="info"
          text={`${genreDistribution[0]?.name} leads with ${genreDistribution[0]?.count} artists (${(genreDistribution[0]?.count / allArtists.length * 100).toFixed(0)}% of roster). ${genreDistribution.length >= 2 ? `${genreDistribution[1]?.name} follows with ${genreDistribution[1]?.count}.` : ''}`} />
      </WidgetCard>
    ),
    'playlist-overview': <PlaylistWidget dragProps={dragProps} />,
    'track-intelligence': <TrackIntelligenceWidget dragProps={dragProps} />,
  };

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-[#F4F0EA]">Dashboard</h1>
            <p className="text-xs text-[#888888] mt-1">{stats.total} artists tracked — {activeWidgets.length} of {WIDGET_CATALOG.length} widgets active</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-[#00D4FF] border border-[#00D4FF]/20 hover:border-[#00D4FF]/40 rounded transition-colors cursor-pointer"
            >
              <LayoutGrid size={10} />
              Manage widgets
            </button>
            <button
              onClick={resetWidgets}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-[#444444] hover:text-[#888888] transition-colors cursor-pointer"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>

        {/* Widget Picker */}
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#888888]">Available Widgets</span>
                  <button onClick={() => setPickerOpen(false)} className="p-1 text-[#444444] hover:text-[#888888] cursor-pointer">
                    <X size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {WIDGET_CATALOG.map((w) => {
                    const isActive = activeWidgets.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        onClick={() => isActive ? removeWidget(w.id) : addWidget(w.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-[#00D4FF]/30 bg-[#00D4FF]/5'
                            : 'border-[#1E1E1E] hover:border-[#2A2A2A] bg-transparent'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-[#00D4FF] text-[#080808]' : 'bg-[#1E1E1E] text-[#444444]'
                        }`}>
                          {isActive ? <Check size={10} /> : <Plus size={10} />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[11px] font-medium truncate ${isActive ? 'text-[#F4F0EA]' : 'text-[#888888]'}`}>{w.title}</p>
                          <p className="text-[9px] text-[#444444] truncate">{w.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiCard title="Total Listeners" value={stats.totalListeners} index={0} />
          <KpiCard title="Total Followers" value={stats.totalFollowers} index={1} />
          <KpiCard title="Roster Size" value={stats.total} index={2} />
          <KpiCard title="Avg Popularity" value={avgPopularity} suffix="/100" index={3} />
          <KpiCard title="Total Playlists" value={stats.totalPlaylists} index={4} />
          <KpiCard title="Playlist Reach" value={stats.totalPlaylistReach} index={5} />
        </div>

        {/* Widget Grid — CSS grid, drag to reorder */}
        {activeWidgets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeWidgets.map(id => widgets[id] ? (
              <div key={id} className={dragId === id ? 'opacity-50' : ''}>
                {widgets[id]}
              </div>
            ) : null)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid size={32} className="text-[#1E1E1E] mb-3" />
            <p className="text-sm text-[#888888] mb-1">No widgets selected</p>
            <p className="text-[11px] text-[#444444] mb-4">Add widgets to build your dashboard</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-[#00D4FF] border border-[#00D4FF]/20 hover:border-[#00D4FF]/40 rounded transition-colors cursor-pointer"
            >
              <Plus size={12} />
              Add widgets
            </button>
          </div>
        )}
      </div>

      {/* Favorites Sidebar */}
      <div className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-20">
          <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star size={13} className="text-[#00D4FF]" />
              <span className="text-xs font-medium text-[#888888]">Favorites</span>
              {favoriteArtists.length > 0 && (
                <span className="text-[10px] text-[#444444] ml-auto">{favoriteArtists.length}</span>
              )}
            </div>

            {favoriteArtists.length === 0 ? (
              <div className="text-center py-4">
                <Star size={16} className="mx-auto mb-1.5 text-[#1E1E1E]" />
                <p className="text-[10px] text-[#444444] leading-relaxed">
                  Click ★ on artist cards<br />to add favorites
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {favoriteArtists.map((artist) => (
                  <Link
                    key={artist.slug}
                    to={`/artist/${artist.slug}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#141414] transition-colors group"
                  >
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                        <Music size={11} className="text-[#444444]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{artist.name}</p>
                      <p className="text-[9px] text-[#444444]">{formatNumber(artist.spotify.monthlyListeners)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(artist.slug); }}
                      className="p-0.5 cursor-pointer shrink-0"
                    >
                      <Star size={9} className="text-[#00D4FF] fill-[#00D4FF]" />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-[#0c0c0e] border-t border-[#1E1E1E] overflow-hidden"
            >
              <div className="max-w-3xl mx-auto px-6">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-[#00D4FF]" />
                    <span className="text-[10px] font-medium text-[#888888] uppercase tracking-wider">Cadence</span>
                  </div>
                  <button onClick={() => setChatOpen(false)} className="p-1 text-[#444444] hover:text-[#888888] cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-[45vh] overflow-y-auto space-y-1 pb-2">
                  {messages.slice(1).map((msg, i) => {
                    if (msg.isStreaming && !msg.text) return null;
                    return <ChatMessage key={i} message={msg} />;
                  })}
                  {chatState === 'streaming' && !messages[messages.length - 1]?.text && <TypingIndicator />}
                  <div ref={chatEndRef} />
                </div>
                {suggestions.length > 0 && chatState === 'idle' && (
                  <div className="flex flex-wrap gap-1.5 pb-2">
                    {suggestions.filter(Boolean).slice(0, 3).map((text) => (
                      <button
                        key={text}
                        onClick={() => handleSuggestion(text)}
                        className="text-[10px] text-[#888888] border border-[#1E1E1E] rounded-full px-2.5 py-1 hover:border-[#00D4FF]/30 hover:text-[#F4F0EA] transition-colors cursor-pointer"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-[#080808] border-t border-[#1E1E1E]">
          <div className="max-w-3xl mx-auto px-6 py-2">
            <form onSubmit={handleChatSubmit} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setChatOpen(!chatOpen); setTimeout(() => chatInputRef.current?.focus(), 100); }}
                className="p-1.5 cursor-pointer"
              >
                <MessageSquare size={16} className={chatOpen ? 'text-[#00D4FF]' : 'text-[#444444]'} />
              </button>
              <input
                ref={chatInputRef}
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onFocus={() => setChatOpen(true)}
                placeholder="Ask Cadence anything..."
                className="flex-1 bg-transparent text-sm text-[#F4F0EA] placeholder-[#444444] outline-none"
                disabled={chatState !== 'idle'}
              />
              <button
                type="submit"
                disabled={!chatQuery.trim() || chatState !== 'idle'}
                className="w-7 h-7 rounded bg-[#00D4FF] disabled:bg-[#1E1E1E] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <ArrowUp size={14} className="text-[#080808]" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
