import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { motion } from 'motion/react';
import {
  FileText, Download, Eye, Pencil, Link2, Check, X, ArrowLeft,
  Music, TrendingUp, Users, DollarSign, Radio, Globe, Disc3, ListMusic,
  MapPin, Tag, Palette,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import Badge from '../components/shared/Badge';
import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import SocialGrowthChart from '../components/charts/SocialGrowthChart';
import RevenueDonutChart from '../components/charts/RevenueDonutChart';
import GeographyHeatMap from '../components/charts/GeographyHeatMap';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import ForecastChart from '../components/charts/ForecastChart';
import PlaylistDistributionChart from '../components/charts/PlaylistDistributionChart';

import {
  getArtist, loadArtistDetail,
  generateStreamingTrend, generateSocialTimeline,
  generateForecast, generateRevenue, getBenchmarkComparison,
} from '../data/artists';
import { getArtistPlaylists } from '../data/playlistData';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { buildAISummary } from '../utils/buildAISummary';
import { getCountryName } from '../utils/countryNames';

// --- Section definitions ---

const SHEET_SECTIONS = [
  { id: 'overview',    label: 'Overview',              icon: Music,      defaultOn: true },
  { id: 'streaming',   label: 'Streaming Performance', icon: TrendingUp, defaultOn: true },
  { id: 'tracks',      label: 'Top Tracks',            icon: ListMusic,  defaultOn: true },
  { id: 'discography', label: 'Discography',           icon: Disc3,      defaultOn: false },
  { id: 'social',      label: 'Social & Engagement',   icon: Users,      defaultOn: true },
  { id: 'platform',    label: 'Platform Analytics',    icon: Radio,      defaultOn: false },
  { id: 'geography',   label: 'Audience & Geography',  icon: Globe,      defaultOn: true },
  { id: 'forecast',    label: 'AI Forecasting',        icon: Disc3,      defaultOn: true },
  { id: 'revenue',     label: 'Revenue Estimate',      icon: DollarSign, defaultOn: true },
];

const DEFAULT_SECTIONS = SHEET_SECTIONS.filter(s => s.defaultOn).map(s => s.id);
const DEFAULT_ACCENT = 'DA7756';
const DEFAULT_BG = '0D0C0B';

const ACCENT_PRESETS = [
  { hex: 'DA7756', label: 'Cadence' },
  { hex: '4A90D9', label: 'Ocean' },
  { hex: '7BAF73', label: 'Sage' },
  { hex: 'D4A574', label: 'Sand' },
  { hex: 'C75F4F', label: 'Coral' },
  { hex: '9B7ED8', label: 'Violet' },
  { hex: 'E8B960', label: 'Gold' },
  { hex: '4ECDC4', label: 'Teal' },
];

const BG_PRESETS = [
  { hex: '0D0C0B', label: 'Default' },
  { hex: '111827', label: 'Slate' },
  { hex: '1A1A2E', label: 'Navy' },
  { hex: '1B1B1B', label: 'Charcoal' },
  { hex: '0F172A', label: 'Midnight' },
  { hex: '1C1917', label: 'Stone' },
  { hex: '0C1222', label: 'Deep Blue' },
  { hex: 'FFFFFF', label: 'White' },
];

// Derive surface and border colors from the background
function deriveColors(bgHex) {
  const r = parseInt(bgHex.slice(0, 2), 16);
  const g = parseInt(bgHex.slice(2, 4), 16);
  const b = parseInt(bgHex.slice(4, 6), 16);
  const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 128;
  if (isLight) {
    return {
      surface: '#F5F0E8',
      surfaceAlt: '#E8E3DB',
      border: '#D5D0C8',
      textPrimary: '#1C1B18',
      textSecondary: '#6B6560',
      textMuted: '#9B9590',
    };
  }
  // For dark backgrounds, lighten slightly for surface
  const lighten = (v, amt) => Math.min(255, v + amt);
  const sr = lighten(r, 16);
  const sg = lighten(g, 16);
  const sb = lighten(b, 16);
  const br = lighten(r, 32);
  const bg2 = lighten(g, 32);
  const bb = lighten(b, 32);
  return {
    surface: `#${sr.toString(16).padStart(2,'0')}${sg.toString(16).padStart(2,'0')}${sb.toString(16).padStart(2,'0')}`,
    surfaceAlt: `#${bgHex}`,
    border: `#${br.toString(16).padStart(2,'0')}${bg2.toString(16).padStart(2,'0')}${bb.toString(16).padStart(2,'0')}`,
    textPrimary: '#F5F0E8',
    textSecondary: '#9B9590',
    textMuted: '#6B6560',
  };
}

// --- Component ---

export default function ArtistSheet() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const artist = getArtist(id);
  const sheetRef = useRef(null);

  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!artist) return;
    setDetail(null);
    loadArtistDetail(artist.slug).then(setDetail);
  }, [artist?.slug]);

  // State from URL params
  const [sections, setSections] = useState(() => {
    const param = searchParams.get('sections');
    return param ? param.split(',') : DEFAULT_SECTIONS;
  });
  const [accent, setAccent] = useState(() => searchParams.get('accent') || DEFAULT_ACCENT);
  const [bg, setBg] = useState(() => searchParams.get('bg') || DEFAULT_BG);
  const [customBio, setCustomBio] = useState(() => searchParams.get('bio') || '');
  const [customNotes, setCustomNotes] = useState(() => searchParams.get('notes') || '');
  const [viewMode, setViewMode] = useState(() => searchParams.get('view') === 'true');
  const [exporting, setExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Redirect if artist not found
  useEffect(() => {
    if (!artist) navigate('/artists', { replace: true });
  }, [artist, navigate]);

  if (!artist) return null;

  const accentColor = `#${accent}`;
  const bgColor = `#${bg}`;
  const colors = deriveColors(bg);

  // --- Data generation ---
  const tracks = detail?.tracks || [];
  const albums = detail?.albums || [];
  const streamingData = generateStreamingTrend(artist);
  const socialData = generateSocialTimeline(artist);
  const forecastData = generateForecast(artist);
  const revenueData = generateRevenue(artist);
  const benchmarkData = getBenchmarkComparison(artist);
  const geographyData = artist.spotify.topCities;
  const totalRevenue = revenueData.reduce((sum, r) => sum + r.amount, 0);
  const aiSummary = buildAISummary(artist);

  const primaryGenre = artist.genres?.primary?.name || 'Artist';
  const secondaryGenres = artist.genres?.secondary || [];
  const allGenres = [primaryGenre, ...secondaryGenres.map(g => typeof g === 'string' ? g : g.name)].filter(Boolean);

  // --- Handlers ---

  const toggleSection = (sectionId) => {
    setSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.origin + `/artist/${artist.slug}/sheet`);
    url.searchParams.set('sections', sections.join(','));
    if (accent !== DEFAULT_ACCENT) url.searchParams.set('accent', accent);
    if (bg !== DEFAULT_BG) url.searchParams.set('bg', bg);
    if (customBio) url.searchParams.set('bio', customBio);
    if (customNotes) url.searchParams.set('notes', customNotes);
    url.searchParams.set('view', 'true');
    return url.toString();
  }, [artist.slug, sections, accent, bg, customBio, customNotes]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(buildShareUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [buildShareUrl]);

  const handleExportPDF = useCallback(async () => {
    if (!sheetRef.current || exporting) return;
    setExporting(true);

    // html2canvas can't parse oklab() from Tailwind v4.
    // 1) Bake computed rgb values inline (browser resolves oklab → rgb)
    // 2) Then replace oklab in stylesheets with transparent (inline wins)
    const container = sheetRef.current;
    const allEls = [container, ...container.querySelectorAll('*')];
    const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
    const inlineSaved = [];
    for (const el of allEls) {
      const cs = getComputedStyle(el);
      const orig = {};
      for (const prop of colorProps) {
        orig[prop] = el.style[prop];
        el.style[prop] = cs[prop];
      }
      inlineSaved.push({ el, orig });
    }
    const savedStyles = [];
    for (const style of document.querySelectorAll('style')) {
      const orig = style.textContent;
      if (orig.includes('oklab')) {
        savedStyles.push({ el: style, orig });
        style.textContent = orig
          .replace(/oklab\([^)]*\)/g, 'transparent')
          .replace(/color-mix\([^)]*oklab[^)]*\)/g, 'transparent');
      }
    }

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 30;
      const footerHeight = 20;
      const contentWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2 - footerHeight;

      const bgR = parseInt(bg.slice(0, 2), 16);
      const bgG = parseInt(bg.slice(2, 4), 16);
      const bgB = parseInt(bg.slice(4, 6), 16);
      const fillBg = () => {
        pdf.setFillColor(bgR, bgG, bgB);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      };

      // Capture entire sheet as one canvas
      const fullCanvas = await html2canvas(container, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
      });

      // Scale to fit page width, then slice into pages
      const scale = contentWidth / fullCanvas.width;
      const totalPdfHeight = fullCanvas.height * scale;
      const totalPages = Math.max(1, Math.ceil(totalPdfHeight / usableHeight));

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        fillBg();

        const srcY = Math.round((page * usableHeight) / scale);
        const srcH = Math.min(Math.round(usableHeight / scale), fullCanvas.height - srcY);
        if (srcH <= 0) break;
        const destH = srcH * scale;

        const slice = document.createElement('canvas');
        slice.width = fullCanvas.width;
        slice.height = srcH;
        slice.getContext('2d').drawImage(fullCanvas, 0, srcY, fullCanvas.width, srcH, 0, 0, fullCanvas.width, srcH);

        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentWidth, destH);
      }

      // Footer on each page
      const numPages = pdf.getNumberOfPages();
      for (let i = 1; i <= numPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Cadence', margin, pageHeight - 10);
        pdf.text(`${i} / ${numPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      const date = new Date().toISOString().split('T')[0];
      pdf.save(`Cadence-Sheet-${artist.name.replace(/\s+/g, '_')}-${date}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      for (const { el, orig } of inlineSaved) {
        for (const prop of colorProps) {
          el.style[prop] = orig[prop];
        }
      }
      for (const { el, orig } of savedStyles) {
        el.textContent = orig;
      }
      setExporting(false);
    }
  }, [artist, exporting]);

  // --- Section renderers ---

  const sectionRenderers = {
    overview: () => (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {artist.imageUrl && (
            <div className="flex-shrink-0">
              <img src={artist.imageUrl} alt={artist.name} className="w-48 h-48 rounded object-cover border border-[#2C2B28]" />
            </div>
          )}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {artist.label && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Tag size={13} className="text-[#6B6560]" />
                  <span>Label:</span>
                  <span className="text-[#F5F0E8]">{artist.label}</span>
                </div>
              )}
              {(artist.city || artist.country) && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <MapPin size={13} className="text-[#6B6560]" />
                  <span>Location:</span>
                  <span className="text-[#F5F0E8]">
                    {[artist.city, getCountryName(artist.country)].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
            {allGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allGenres.slice(0, 3).map((g) => (
                  <span key={g} className="text-[10px] font-mono uppercase tracking-wider bg-[#2C2B28] text-[#9B9590] rounded px-2 py-0.5 border border-[#3D3B37]">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {artist.collaborators?.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1 block">Top Collaborators</span>
                <div className="flex flex-wrap gap-1.5">
                  {artist.collaborators.slice(0, 8).map((c) => (
                    <span key={c} className="text-[10px] font-mono bg-[#D4A574]/5 text-[#D4A574]/70 rounded px-2 py-0.5 border border-[#D4A574]/10">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),

    streaming: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Monthly Listeners" value={artist.spotify.monthlyListeners} delta={artist.spotify.listenersRank ? `Rank #${formatNumber(artist.spotify.listenersRank)}` : undefined} index={0} />
          <KpiCard title="Spotify Followers" value={artist.spotify.followers} delta={artist.spotify.followersRank ? `Rank #${formatNumber(artist.spotify.followersRank)}` : undefined} index={1} />
          <KpiCard title="Popularity Score" value={artist.spotify.popularity} suffix="/100" index={2} />
          <KpiCard title="Shazam Count" value={artist.engagement.shazam} index={3} />
        </div>
        <ChartCard title="Streaming Trends" subtitle="Daily streams by platform (90 days)">
          <StreamingTrendChart data={streamingData} />

        </ChartCard>
      </div>
    ),

    tracks: () => tracks.length > 0 ? (
      <ChartCard title={`${tracks.length} tracked song${tracks.length === 1 ? '' : 's'} — sorted by Spotify streams`}>
        <div className="space-y-1">
          {tracks.slice(0, 12).map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
              <span className="text-[10px] font-mono text-[#6B6560] w-6 text-right shrink-0">{i + 1}</span>
              {t.imageUrl ? (
                <img src={t.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                  <Music size={12} className="text-[#6B6560]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[#F5F0E8] truncate">{t.name}</p>
                  {t.isFeature && <Badge variant="info">feat</Badge>}
                </div>
                <p className="text-[10px] text-[#6B6560] truncate">
                  {t.albumName || '—'}{t.releaseDate ? ` · ${new Date(t.releaseDate).getFullYear()}` : ''}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
                <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Playlists</span>
                <span className="text-xs font-mono text-[#9B9590]">{formatNumber(t.spotifyPlaylists)}</span>
              </div>
              <div className="flex flex-col items-end shrink-0 w-20">
                <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Streams</span>
                <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(t.streams)}</span>
              </div>
            </div>
          ))}
        </div>
        {tracks.length > 12 && (
          <p className="text-[10px] text-[#6B6560] mt-3 text-center">Showing 12 of {tracks.length} tracks</p>
        )}
      </ChartCard>
    ) : null,

    discography: () => albums.length > 0 ? (
      <ChartCard title={`${albums.length} release${albums.length === 1 ? '' : 's'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 pt-2">
          {albums.slice(0, 24).map(a => (
            <div key={a.id} className="group block">
              <div className="aspect-square rounded overflow-hidden bg-[#2C2B28] border border-[#2C2B28] mb-2">
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc3 size={24} className="text-[#6B6560]" />
                  </div>
                )}
              </div>
              <p className="text-xs text-[#F5F0E8] truncate">{a.name}</p>
              <p className="text-[10px] text-[#6B6560] truncate">
                {a.releaseDate ? new Date(a.releaseDate).getFullYear() : '—'}
                {a.type ? ` · ${a.type}` : ''}
                {a.numTracks ? ` · ${a.numTracks} tracks` : ''}
              </p>
            </div>
          ))}
        </div>
        {albums.length > 24 && (
          <p className="text-[10px] text-[#6B6560] mt-4 text-center">Showing 24 of {albums.length} releases</p>
        )}
      </ChartCard>
    ) : null,

    social: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="TikTok" value={artist.social.tiktok} delta={artist.social.tiktokRank ? `Rank #${formatNumber(artist.social.tiktokRank)}` : undefined} index={0} />
          <KpiCard title="Instagram" value={artist.social.instagram} delta={artist.social.instagramRank ? `Rank #${formatNumber(artist.social.instagramRank)}` : undefined} index={1} />
          <KpiCard title="Twitter / X" value={artist.social.twitter} index={2} />
          <KpiCard title="YouTube" value={artist.social.youtube} delta={artist.social.youtubeRank ? `Rank #${formatNumber(artist.social.youtubeRank)}` : undefined} index={3} />
        </div>
        <ChartCard title="Social Growth" subtitle="Follower trends over time (90 days)">
          <SocialGrowthChart data={socialData} />

        </ChartCard>
      </div>
    ),

    platform: () => {
      const activePlaylists = getArtistPlaylists(artist.slug);
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Spotify Playlists" value={artist.playlists.spotify.total} delta={`${artist.playlists.spotify.editorial} editorial`} index={0} />
            <KpiCard title="Playlist Reach" value={artist.playlists.spotify.reach} index={1} />
            <KpiCard title="Editorial Reach" value={artist.playlists.spotify.editorialReach} index={2} />
            <KpiCard title="Total Cross-Platform" value={
              artist.playlists.spotify.total + artist.playlists.apple.total +
              artist.playlists.deezer.total + artist.playlists.amazon.total +
              artist.playlists.youtube.total
            } index={3} />
          </div>
          <ChartCard title="Playlist Distribution by Platform" subtitle="Editorial vs user/algorithmic across platforms">
            <PlaylistDistributionChart playlists={artist.playlists} />

          </ChartCard>
          {activePlaylists.length > 0 && (
            <ChartCard title="Active Playlists" subtitle={`${activePlaylists.length} playlist placement${activePlaylists.length === 1 ? '' : 's'}`}>
              <div className="space-y-1">
                {activePlaylists.slice(0, 15).map((p, i) => (
                  <div key={`${p.playlistId}-${i}`} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                    <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                      <ListMusic size={11} className="text-[#6B6560]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F5F0E8] truncate">{p.playlistName}</p>
                      <p className="text-[10px] text-[#6B6560] truncate">{p.curator}</p>
                    </div>
                    <Badge variant={p.type === 'editorial' ? 'success' : p.type === 'algorithmic' ? 'info' : 'warning'}>{p.type}</Badge>
                    {p.position && (
                      <span className="hidden sm:inline text-[10px] font-mono text-[#9B9590] w-8 text-right shrink-0">#{p.position}</span>
                    )}
                    <div className="flex flex-col items-end shrink-0 w-16">
                      <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(p.streamsFromPlaylist)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {activePlaylists.length > 15 && (
                <p className="text-[10px] text-[#6B6560] mt-3 text-center">Showing 15 of {activePlaylists.length} playlists</p>
              )}
            </ChartCard>
          )}
        </div>
      );
    },

    geography: () => (
      <div className="space-y-6">
        {geographyData.length > 0 && (
          <ChartCard title="Geographic Distribution" subtitle="Listeners by city">
            <GeographyHeatMap data={geographyData} />
            <div className="mt-4 pt-4 border-t border-[#2C2B28]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {geographyData.map((c, i) => {
                  const pct = geographyData[0]?.listeners > 0
                    ? (c.listeners / geographyData[0].listeners) * 100 : 0;
                  return (
                    <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 py-2 border-b border-[#2C2B28]/50 last:border-0">
                      <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm text-[#F5F0E8] truncate">{c.city}</span>
                          <span className="text-[10px] text-[#6B6560]">{getCountryName(c.country)}</span>
                        </div>
                        <div className="mt-1 h-1 bg-[#2C2B28] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: accentColor, opacity: 0.4 + (pct / 100) * 0.6 }} />
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#9B9590] shrink-0">{formatNumber(c.listeners)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        )}
        <ChartCard title="Benchmark Comparison" subtitle="vs average across all artists">
          <BenchmarkRadarChart
            artist={benchmarkData.artist}
            benchmark={benchmarkData.benchmark}
            dimensions={benchmarkData.dimensions}
            artistName={artist.name}
          />

        </ChartCard>
      </div>
    ),

    forecast: () => (
      <ChartCard title="Stream Forecast" subtitle="60-day actual + 30-day prediction">
        <ForecastChart data={forecastData} todayIndex={59} />
      </ChartCard>
    ),

    revenue: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {revenueData.map((r, i) => (
            <KpiCard key={r.source} title={r.source} value={r.amount} prefix="$" delta={`${r.percentage}%`} index={i} />
          ))}
        </div>
        <ChartCard title="Revenue Breakdown" subtitle={`Estimated annual: ${formatCurrency(totalRevenue)}`}>
          <RevenueDonutChart data={revenueData} totalRevenue={totalRevenue} />

        </ChartCard>
      </div>
    ),
  };

  // --- Shared section rendering ---

  const renderSections = () => (
    sections.map(sectionId => {
      const def = SHEET_SECTIONS.find(s => s.id === sectionId);
      const renderer = sectionRenderers[sectionId];
      const content = renderer?.();
      if (!content) return null;
      return (
        <motion.div key={sectionId} data-pdf-section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout>
          <div className="mb-3">
            <div className="flex items-center gap-2">
              {def && <def.icon size={14} style={{ color: accentColor }} />}
              <h3 className="text-sm font-medium text-[#F5F0E8]">{def?.label}</h3>
            </div>
          </div>
          {content}
        </motion.div>
      );
    })
  );

  // --- Shared header banner ---

  const renderHeaderBanner = (date) => (
    <div data-pdf-section className="rounded p-8" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
      {artist.imageUrl && (
        <div className="flex justify-center mb-6">
          <img src={artist.imageUrl} alt={artist.name}
            className="w-28 h-28 rounded object-cover"
            style={{ borderColor: `${accentColor}40`, borderWidth: '2px' }}
          />
        </div>
      )}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-light" style={{ color: colors.textPrimary }}>{artist.name}</h1>
        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>{primaryGenre} — {date}</p>
      </div>
      <p className="text-sm text-center max-w-2xl mx-auto leading-relaxed" style={{ color: colors.textSecondary }}>
        {customBio || aiSummary.text}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {aiSummary.keyMetrics.map(m => (
          <div key={m.label} className="text-center py-3 rounded" style={{ backgroundColor: bgColor, borderColor: colors.border, borderWidth: 1 }}>
            <div className="text-lg font-mono" style={{ color: colors.textPrimary }}>{m.value}</div>
            <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: colors.textMuted }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ========== VIEW MODE ==========

  if (viewMode) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: bgColor }}>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: `${bgColor}e6`, borderBottom: `1px solid ${colors.border}` }}>
          <div className="max-w-[1200px] mx-auto px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ color: accentColor, backgroundColor: `${accentColor}15` }}>
                Cadence
              </span>
              <span className="text-sm text-[#9B9590]">Artist Sheet</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
              >
                {linkCopied ? <Check size={12} className="text-[#7BAF73]" /> : <Link2 size={12} />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer disabled:opacity-50"
                style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <Download size={12} />
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={() => setViewMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                onClick={() => navigate(`/artist/${artist.slug}`)}
                className="p-1.5 text-[#6B6560] hover:text-[#9B9590] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={sheetRef} className="max-w-[1200px] mx-auto px-8 py-8 space-y-6">
          {renderHeaderBanner(date)}

          {customNotes && (
            <div data-pdf-section className="rounded p-5" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Notes</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: `${colors.textPrimary}cc` }}>{customNotes}</p>
            </div>
          )}

          <div className="space-y-6">
            {renderSections()}
          </div>
        </div>
      </div>
    );
  }

  // ========== EDIT MODE ==========

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link to={`/artist/${artist.slug}`} className="inline-flex items-center gap-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors mb-4">
          <ArrowLeft size={12} />
          Back to {artist.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-[#F5F0E8]">{artist.name} — Artist Sheet</h1>
            <p className="text-xs text-[#9B9590] mt-1">Customize and share a one-page artist profile</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded border transition-colors cursor-pointer border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
            >
              {linkCopied ? <Check size={14} className="text-[#7BAF73]" /> : <Link2 size={14} />}
              {linkCopied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={() => setViewMode(true)}
              disabled={sections.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors cursor-pointer border disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              <Eye size={14} />
              Preview Sheet
            </button>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar controls */}
        <div className="w-64 shrink-0">
          <div className="sticky top-20 space-y-4">
            {/* Section toggles */}
            <div className="bg-[#171614] border border-[#2C2B28] rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-[#9B9590]" />
                <span className="text-xs font-medium text-[#9B9590]">Sections</span>
              </div>
              <div className="space-y-1">
                {SHEET_SECTIONS.map(section => {
                  const isOn = sections.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => toggleSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors cursor-pointer ${
                        isOn ? 'bg-[#0D0C0B]' : 'hover:bg-[#0D0C0B]/50'
                      }`}
                      style={isOn ? { borderLeft: `2px solid ${accentColor}` } : { borderLeft: '2px solid transparent' }}
                    >
                      <section.icon size={13} className={isOn ? '' : 'text-[#6B6560]'} style={isOn ? { color: accentColor } : {}} />
                      <span className={`text-xs ${isOn ? 'text-[#F5F0E8]' : 'text-[#6B6560]'}`}>{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent color picker */}
            <div className="bg-[#171614] border border-[#2C2B28] rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={14} className="text-[#9B9590]" />
                <span className="text-xs font-medium text-[#9B9590]">Accent Color</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    onClick={() => setAccent(preset.hex)}
                    className={`w-full aspect-square rounded-full border-2 transition-all cursor-pointer ${
                      accent === preset.hex ? 'scale-110 border-[#F5F0E8]' : 'border-transparent hover:border-[#3D3B37]'
                    }`}
                    style={{ backgroundColor: `#${preset.hex}` }}
                    title={preset.label}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-[#2C2B28] shrink-0" style={{ backgroundColor: accentColor }} />
                <input
                  type="text"
                  value={accent}
                  onChange={e => setAccent(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                  className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2.5 py-1.5 text-xs font-mono text-[#F5F0E8] outline-none focus:border-[#3D3B37]"
                  placeholder="DA7756"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Background color picker */}
            <div className="bg-[#171614] border border-[#2C2B28] rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={14} className="text-[#9B9590]" />
                <span className="text-xs font-medium text-[#9B9590]">Background</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BG_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    onClick={() => setBg(preset.hex)}
                    className={`w-full aspect-square rounded-full border-2 transition-all cursor-pointer ${
                      bg === preset.hex ? 'scale-110 border-[#F5F0E8]' : 'border-transparent hover:border-[#3D3B37]'
                    }`}
                    style={{ backgroundColor: `#${preset.hex}`, boxShadow: preset.hex === 'FFFFFF' ? 'inset 0 0 0 1px #3D3B37' : undefined }}
                    title={preset.label}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-[#2C2B28] shrink-0" style={{ backgroundColor: bgColor }} />
                <input
                  type="text"
                  value={bg}
                  onChange={e => setBg(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                  className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2.5 py-1.5 text-xs font-mono text-[#F5F0E8] outline-none focus:border-[#3D3B37]"
                  placeholder="0D0C0B"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Custom text */}
            <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 space-y-4">
              <div>
                <span className="text-xs font-medium text-[#9B9590] mb-2 block">Custom Bio</span>
                <textarea
                  value={customBio}
                  onChange={e => setCustomBio(e.target.value)}
                  placeholder="Leave empty to use AI-generated summary..."
                  className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] h-24 resize-none outline-none focus:border-[#3D3B37]"
                />
              </div>
              <div>
                <span className="text-xs font-medium text-[#9B9590] mb-2 block">Notes</span>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="Add notes visible on the sheet..."
                  className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] h-20 resize-none outline-none focus:border-[#3D3B37]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="flex-1 space-y-6">
          {renderHeaderBanner(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}

          {customNotes && (
            <div className="rounded p-5" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Notes</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: `${colors.textPrimary}cc` }}>{customNotes}</p>
            </div>
          )}

          {sections.length === 0 ? (
            <div className="text-center py-20 text-[#6B6560]">
              <FileText size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select sections from the left panel</p>
            </div>
          ) : (
            <div className="space-y-6">
              {renderSections()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
