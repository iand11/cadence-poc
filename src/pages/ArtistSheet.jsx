import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, Eye, Link2, Check, X, ArrowLeft,
  Music, TrendingUp, Users, DollarSign, Radio, Globe, Disc3, ListMusic,
  MapPin, Tag, Palette, Pipette, Headphones, BarChart3, Sheet, Plus, GripVertical,
  Trash2, RefreshCw, ExternalLink, EyeOff, ChevronDown, Settings, Lock, PanelLeftClose, PanelLeftOpen, Image as ImageIcon,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

import ChartCard from '../components/shared/ChartCard';
import Badge from '../components/shared/Badge';
import EditableText from '../components/shared/EditableText';
import SocialPostModal from '../components/shared/SocialPostModal';
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
import { useArtistCustomData } from '../hooks/useArtistCustomData';

// ─── Block definitions ─────────────────────────────────────────────────────────

const BLOCK_DEFS = [
  { id: 'overview',       label: 'Overview',              icon: Music },
  { id: 'spotify',        label: 'Listen',                icon: Headphones },
  { id: 'streaming',      label: 'Streaming Performance', icon: TrendingUp },
  { id: 'tracks',         label: 'Top Tracks',            icon: ListMusic },
  { id: 'discography',    label: 'Discography',           icon: Disc3 },
  { id: 'social',         label: 'Social & Engagement',   icon: Users },
  { id: 'custom_fields',  label: 'Custom Fields',         icon: BarChart3 },
  { id: 'live_metrics',   label: 'Live Metrics',          icon: Sheet },
  { id: 'platform',       label: 'Platform Analytics',    icon: Radio },
  { id: 'geography',      label: 'Audience & Geography',  icon: Globe },
  { id: 'forecast',       label: 'AI Forecasting',        icon: Disc3 },
  { id: 'revenue',        label: 'Revenue Estimate',      icon: DollarSign },
];

const DEFAULT_BLOCKS = [
  { id: 'overview', visible: true },
  { id: 'spotify', visible: true },
  { id: 'streaming', visible: true },
  { id: 'tracks', visible: true },
  { id: 'social', visible: true },
  { id: 'geography', visible: true },
  { id: 'forecast', visible: true },
  { id: 'revenue', visible: true },
];

const DEFAULT_ACCENT = 'DA7756';
const DEFAULT_BG = '0D0C0B';

const ACCENT_PRESETS = [
  { hex: 'DA7756', label: 'Cadence' }, { hex: '4A90D9', label: 'Ocean' },
  { hex: '7BAF73', label: 'Sage' },    { hex: 'D4A574', label: 'Sand' },
  { hex: 'C75F4F', label: 'Coral' },   { hex: '9B7ED8', label: 'Violet' },
  { hex: 'E8B960', label: 'Gold' },    { hex: '4ECDC4', label: 'Teal' },
];

const BG_PRESETS = [
  { hex: '0D0C0B', label: 'Default' }, { hex: '111827', label: 'Slate' },
  { hex: '1A1A2E', label: 'Navy' },    { hex: '1B1B1B', label: 'Charcoal' },
  { hex: '0F172A', label: 'Midnight' },{ hex: '1C1917', label: 'Stone' },
  { hex: '0C1222', label: 'Deep Blue' },{ hex: 'FFFFFF', label: 'White' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function deriveColors(bgHex) {
  const r = parseInt(bgHex.slice(0, 2), 16);
  const g = parseInt(bgHex.slice(2, 4), 16);
  const b = parseInt(bgHex.slice(4, 6), 16);
  const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 128;
  if (isLight) {
    return {
      surface: '#F5F0E8', surfaceAlt: '#E8E3DB', border: '#D5D0C8',
      textPrimary: '#1C1B18', textSecondary: '#6B6560', textMuted: '#9B9590',
    };
  }
  const lighten = (v, amt) => Math.min(255, v + amt);
  const sr = lighten(r, 16), sg = lighten(g, 16), sb = lighten(b, 16);
  const br = lighten(r, 32), bg2 = lighten(g, 32), bb = lighten(b, 32);
  return {
    surface: `#${sr.toString(16).padStart(2,'0')}${sg.toString(16).padStart(2,'0')}${sb.toString(16).padStart(2,'0')}`,
    surfaceAlt: `#${bgHex}`, border: `#${br.toString(16).padStart(2,'0')}${bg2.toString(16).padStart(2,'0')}${bb.toString(16).padStart(2,'0')}`,
    textPrimary: '#F5F0E8', textSecondary: '#9B9590', textMuted: '#6B6560',
  };
}

function parseSpotifyUrl(url) {
  if (!url) return null;
  const m = url.match(/open\.spotify\.com\/(artist|album|track|playlist)\/([\w]+)/) ||
            url.match(/spotify:(artist|album|track|playlist):([\w]+)/);
  return m ? { type: m[1], id: m[2] } : null;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

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

  // Custom data
  const {
    data: customData, updateField,
    addCustomField, removeCustomField, updateCustomField, syncSheets,
  } = useArtistCustomData(artist?.slug || '');

  // Block list
  const [blocks, setBlocks] = useState(() => {
    const param = searchParams.get('sections');
    if (param) return param.split(',').map(id => ({ id, visible: true }));
    return DEFAULT_BLOCKS;
  });

  const [accent, setAccent] = useState(() => searchParams.get('accent') || DEFAULT_ACCENT);
  const [bg, setBg] = useState(() => searchParams.get('bg') || DEFAULT_BG);
  const isSharedView = searchParams.get('view') === 'true';

  // Debounced setters for color pickers (avoids re-rendering entire page on every drag pixel)
  const accentTimer = useRef(null);
  const bgTimer = useRef(null);
  const setAccentDebounced = useCallback((val) => { clearTimeout(accentTimer.current); accentTimer.current = setTimeout(() => setAccent(val), 40); }, []);
  const setBgDebounced = useCallback((val) => { clearTimeout(bgTimer.current); bgTimer.current = setTimeout(() => setBg(val), 40); }, []);
  const [exporting, setExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [socialPostOpen, setSocialPostOpen] = useState(false);
  const [sampling, setSampling] = useState(false);

  // Extract prominent color from artist image and set as background
  const sampleColorFromImage = useCallback(async () => {
    if (!artist?.imageUrl) return;
    setSampling(true);
    try {
      const color = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const size = 40;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const weight = 1 + sat * 3;
            totalR += r * weight;
            totalG += g * weight;
            totalB += b * weight;
            totalWeight += weight;
          }
          const darken = 0.25;
          const rr = Math.round((totalR / totalWeight) * darken);
          const gg = Math.round((totalG / totalWeight) * darken);
          const bb = Math.round((totalB / totalWeight) * darken);
          resolve([rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join(''));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = artist.imageUrl;
      });
      setBg(color);
    } catch {
      // silently ignore CORS or load failures
    } finally {
      setSampling(false);
    }
  }, [artist?.imageUrl]);

  // Block settings — per-block overrides for all text content
  const [blockSettings, setBlockSettings] = useState(() => customData.blockSettings || {});

  const updateBlockSetting = useCallback((blockId, key, value) => {
    setBlockSettings(prev => {
      const next = { ...prev, [blockId]: { ...prev[blockId], [key]: value } };
      updateField('blockSettings', next);
      return next;
    });
  }, [updateField]);

  // getVal: returns user override or default. Clears to default on empty.
  const getVal = (blockId, key, defaultVal) => {
    const v = blockSettings[blockId]?.[key];
    return (v !== undefined && v !== '') ? v : defaultVal;
  };

  // getOverride: for sidebar inputs, returns raw override (empty if none)
  const getRaw = (blockId, key) => blockSettings[blockId]?.[key] || '';

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(!isSharedView);

  const editing = sidebarOpen;
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const previewRef = useRef(null);

  const selectBlock = useCallback((blockId) => {
    setSelectedBlockId(prev => {
      const next = prev === blockId ? null : blockId;
      if (next && previewRef.current) {
        requestAnimationFrame(() => {
          const el = previewRef.current?.querySelector(`[data-block-id="${next}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      return next;
    });
  }, []);

  // Drag
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Sheets sync
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsError, setSheetsError] = useState(null);

  useEffect(() => {
    if (!artist) navigate('/artists', { replace: true });
  }, [artist, navigate]);

  if (!artist) return null;

  const accentColor = `#${accent}`;
  const bgColor = `#${bg}`;
  const colors = deriveColors(bg);

  // Data
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
  const visibleBlocks = blocks.filter(b => b.visible);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const locationStr = [artist.city, getCountryName(artist.country)].filter(Boolean).join(', ');

  // Block settings shortcuts
  const maxTracks = blockSettings.tracks?.maxItems || 12;
  const maxAlbums = blockSettings.discography?.maxItems || 24;
  const maxPlaylists = blockSettings.platform?.maxItems || 15;
  const maxCities = blockSettings.geography?.maxItems || 0;
  const extraMetrics = blockSettings.overview?.extraMetrics || [];

  // ─── Block actions ──────────────────────────────────────────────────────────

  const toggleVisibility = (blockId) => setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, visible: !b.visible } : b));
  const removeBlock = (blockId) => { setBlocks(prev => prev.filter(b => b.id !== blockId)); if (selectedBlockId === blockId) setSelectedBlockId(null); };
  const addBlock = (defId) => { if (blocks.some(b => b.id === defId)) return; setBlocks(prev => [...prev, { id: defId, visible: true }]); setAddMenuOpen(false); };

  const handleListDragStart = (idx) => setDragIdx(idx);
  const handleListDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleListDrop = (targetIdx) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    setBlocks(prev => { const next = [...prev]; const [moved] = next.splice(dragIdx, 1); next.splice(targetIdx, 0, moved); return next; });
    setDragIdx(null); setDragOverIdx(null);
  };
  const handleListDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleSheetsSync = async () => {
    setSheetsSyncing(true); setSheetsError(null);
    try { await syncSheets(); } catch (err) { setSheetsError(err.message || 'Sync failed'); }
    finally { setSheetsSyncing(false); }
  };

  // Extra overview metrics
  const addExtraMetric = () => {
    const id = 'em-' + Date.now();
    updateBlockSetting('overview', 'extraMetrics', [...extraMetrics, { id, label: 'Label', value: '0' }]);
  };
  const removeExtraMetric = (metricId) => {
    updateBlockSetting('overview', 'extraMetrics', extraMetrics.filter(m => m.id !== metricId));
  };
  const updateExtraMetric = (metricId, field, value) => {
    updateBlockSetting('overview', 'extraMetrics', extraMetrics.map(m => m.id === metricId ? { ...m, [field]: value } : m));
  };

  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.origin + `/artist/${artist.slug}/sheet`);
    url.searchParams.set('sections', visibleBlocks.map(b => b.id).join(','));
    if (accent !== DEFAULT_ACCENT) url.searchParams.set('accent', accent);
    if (bg !== DEFAULT_BG) url.searchParams.set('bg', bg);
    url.searchParams.set('view', 'true');
    return url.toString();
  }, [artist.slug, visibleBlocks, accent, bg]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(buildShareUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [buildShareUrl]);

  // ─── PDF Export ────────────────────────────────────────────────────────────

  const handleExportPDF = useCallback(async () => {
    if (!sheetRef.current || exporting) return;
    setExporting(true);
    const container = sheetRef.current;
    const imgs = container.querySelectorAll('img');
    const imgSaved = [];
    for (const imgEl of imgs) {
      if (!imgEl.src || imgEl.src.startsWith('data:')) continue;
      const origSrc = imgEl.src;
      try {
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth || 100; c.height = imgEl.naturalHeight || 100;
        c.getContext('2d').drawImage(imgEl, 0, 0);
        imgEl.src = c.toDataURL('image/png');
        imgSaved.push({ el: imgEl, origSrc });
      } catch {
        imgEl.dataset.pdfHidden = imgEl.style.visibility;
        imgEl.style.visibility = 'hidden';
        imgSaved.push({ el: imgEl, origSrc, hidden: true });
      }
    }
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pw = 841.89, ph = 595.28, m = 30, fh = 20;
      const cw = pw - m * 2, uh = ph - m * 2 - fh, gap = 10;
      const bgR = parseInt(bg.slice(0, 2), 16), bgG = parseInt(bg.slice(2, 4), 16), bgB = parseInt(bg.slice(4, 6), 16);
      const fillBg = () => { pdf.setFillColor(bgR, bgG, bgB); pdf.rect(0, 0, pw, ph, 'F'); };
      fillBg();
      const opts = { backgroundColor: bgColor, pixelRatio: 2, skipFonts: true, imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' };
      const sectionEls = container.querySelectorAll('[data-pdf-section]');
      let curY = m;
      for (const section of sectionEls) {
        const dataUrl = await toPng(section, opts);
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
        const sh = (img.height * cw) / img.width;
        if (curY + sh > m + uh && curY > m + 1) { pdf.addPage(); fillBg(); curY = m; }
        if (sh > uh) {
          const sc = cw / img.width; let off = 0;
          while (off < img.height) {
            if (off > 0) { pdf.addPage(); fillBg(); curY = m; }
            const rem = uh - (curY - m), srcH = Math.min(Math.round(rem / sc), img.height - off), dh = srcH * sc;
            const sl = document.createElement('canvas'); sl.width = img.width; sl.height = srcH;
            sl.getContext('2d').drawImage(img, 0, off, img.width, srcH, 0, 0, img.width, srcH);
            pdf.addImage(sl.toDataURL('image/jpeg', 0.92), 'JPEG', m, curY, cw, dh);
            off += srcH; curY += dh + gap;
          }
        } else { pdf.addImage(dataUrl, 'PNG', m, curY, cw, sh); curY += sh + gap; }
      }
      const np = pdf.getNumberOfPages();
      for (let i = 1; i <= np; i++) { pdf.setPage(i); pdf.setFontSize(7); pdf.setTextColor(100,100,100); pdf.text('Cadence', m, ph - 10); pdf.text(`${i} / ${np}`, pw - m, ph - 10, { align: 'right' }); }
      pdf.save(`Cadence-${artist.name.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error('PDF export failed:', err); }
    finally {
      for (const { el, origSrc, hidden } of imgSaved) { if (hidden) { el.style.visibility = el.dataset.pdfHidden || ''; delete el.dataset.pdfHidden; } el.src = origSrc; }
      setExporting(false);
    }
  }, [artist, exporting, bg, bgColor]);

  // ─── EditableKpi — inline-editable KPI card ───────────────────────────────

  const EditableKpi = ({ blockId, idx, defaultLabel, defaultValue, defaultDelta }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.4, ease: 'easeOut' }}
      className="rounded p-5 transition-colors"
      style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <div className="mb-3">
        <EditableText value={getVal(blockId, `kpi${idx}Label`, defaultLabel)} onSave={v => updateBlockSetting(blockId, `kpi${idx}Label`, v)} editing={editing} className="text-xs" style={{ color: colors.textSecondary }} placeholder={defaultLabel} />
      </div>
      <div>
        <EditableText value={getVal(blockId, `kpi${idx}Value`, defaultValue)} onSave={v => updateBlockSetting(blockId, `kpi${idx}Value`, v)} editing={editing} className="font-mono text-2xl font-light tracking-tight" style={{ color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }} placeholder={defaultValue} />
      </div>
      {defaultDelta && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7BAF73]" />
          <EditableText value={getVal(blockId, `kpi${idx}Delta`, defaultDelta)} onSave={v => updateBlockSetting(blockId, `kpi${idx}Delta`, v)} editing={editing} className="font-mono text-xs text-[#7BAF73]" placeholder={defaultDelta} />
        </div>
      )}
    </motion.div>
  );

  // ─── Editable chart title helper ──────────────────────────────────────────

  const editableTitle = (blockId, key, defaultVal) => (
    <EditableText value={getVal(blockId, key, defaultVal)} onSave={v => updateBlockSetting(blockId, key, v)} editing={editing} placeholder={defaultVal} />
  );

  // ─── Block renderers ──────────────────────────────────────────────────────

  const blockRenderers = {
    overview: () => {
      const customBio = getRaw('overview', 'bio');
      const customNotes = getRaw('overview', 'notes');
      return (
        <div className="space-y-6">
          {/* Hero banner with artist image */}
          {artist.imageUrl && (
            <div className="relative overflow-hidden -mx-6 -mt-6" style={{ height: 420 }}>
              <img src={artist.imageUrl} alt={artist.name} className="absolute inset-0 w-full h-full object-cover object-[center_20%]" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bgColor} 0%, ${bgColor}dd 35%, ${bgColor}66 65%, transparent 100%)` }} />
              <div className="absolute bottom-0 left-0 right-0 p-10 text-center">
                <EditableText value={getVal('overview', 'artistName', artist.name)} onSave={v => updateBlockSetting('overview', 'artistName', v)} editing={editing} as="h1" className="text-5xl font-light tracking-tight" style={{ color: colors.textPrimary }} placeholder={artist.name} />
                <div className="mt-3">
                  <EditableText value={getVal('overview', 'subtitle', '')} onSave={v => updateBlockSetting('overview', 'subtitle', v)} editing={editing} className="text-sm tracking-wide" style={{ color: colors.textSecondary }} placeholder="Add subtitle..." />
                </div>
              </div>
            </div>
          )}
          <div className="rounded-lg p-8" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
            {/* Fallback name/subtitle when no image */}
            {!artist.imageUrl && (
              <>
                <div className="text-center mb-4">
                  <EditableText value={getVal('overview', 'artistName', artist.name)} onSave={v => updateBlockSetting('overview', 'artistName', v)} editing={editing} as="h1" className="text-2xl font-light" style={{ color: colors.textPrimary }} placeholder={artist.name} />
                </div>
                <div className="text-center mb-6">
                  <EditableText value={getVal('overview', 'subtitle', '')} onSave={v => updateBlockSetting('overview', 'subtitle', v)} editing={editing} className="text-xs" style={{ color: colors.textMuted }} placeholder="Add subtitle..." />
                </div>
              </>
            )}
            {/* Bio */}
            <div className="text-center max-w-2xl mx-auto mb-6">
              <EditableText value={getVal('overview', 'bio', aiSummary.text)} onSave={v => updateBlockSetting('overview', 'bio', v)} editing={editing} as="p" multiline className="text-sm leading-relaxed" style={{ color: colors.textSecondary }} placeholder={aiSummary.text} />
            </div>
            {/* Key metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {aiSummary.keyMetrics.map((m, i) => (
                <div key={i} className="text-center py-3 rounded-lg" style={{ backgroundColor: bgColor, border: `1px solid ${colors.border}` }}>
                  <div>
                    <EditableText value={getVal('overview', `metric${i}Value`, m.value)} onSave={v => updateBlockSetting('overview', `metric${i}Value`, v)} editing={editing} className="text-lg font-mono" style={{ color: colors.textPrimary }} placeholder={m.value} />
                  </div>
                  <div className="mt-0.5">
                    <EditableText value={getVal('overview', `metric${i}Label`, m.label)} onSave={v => updateBlockSetting('overview', `metric${i}Label`, v)} editing={editing} className="text-[10px] uppercase tracking-wider" style={{ color: colors.textMuted }} placeholder={m.label} />
                  </div>
                </div>
              ))}
              {/* Extra user-added metrics */}
              {extraMetrics.map(em => (
                <div key={em.id} className="relative text-center py-3 rounded-lg group/metric" style={{ backgroundColor: bgColor, border: `1px solid ${colors.border}` }}>
                  {editing && (
                    <button onClick={(e) => { e.stopPropagation(); removeExtraMetric(em.id); }} className="absolute top-1 right-1 p-0.5 opacity-0 group-hover/metric:opacity-100 transition-opacity cursor-pointer" style={{ color: colors.textMuted }}>
                      <X size={10} />
                    </button>
                  )}
                  <div>
                    <EditableText value={em.value} onSave={v => updateExtraMetric(em.id, 'value', v)} editing={editing} className="text-lg font-mono" style={{ color: colors.textPrimary }} placeholder="Value" />
                  </div>
                  <div className="mt-0.5">
                    <EditableText value={em.label} onSave={v => updateExtraMetric(em.id, 'label', v)} editing={editing} className="text-[10px] uppercase tracking-wider" style={{ color: colors.textMuted }} placeholder="Label" />
                  </div>
                </div>
              ))}
              {/* Add metric button */}
              {editing && (
                <button onClick={(e) => { e.stopPropagation(); addExtraMetric(); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs cursor-pointer transition-colors"
                  style={{ border: `1px dashed ${colors.border}`, color: colors.textMuted }}>
                  <Plus size={12} /> Add Metric
                </button>
              )}
            </div>
            {/* Details */}
            <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2" style={{ color: colors.textSecondary }}>
                  <Tag size={13} style={{ color: colors.textMuted }} /><span>Label:</span>
                  <EditableText value={getVal('overview', 'label', artist.label || '—')} onSave={v => updateBlockSetting('overview', 'label', v)} editing={editing} style={{ color: colors.textPrimary }} placeholder={artist.label || 'Label'} />
                </div>
                <div className="flex items-center gap-2" style={{ color: colors.textSecondary }}>
                  <MapPin size={13} style={{ color: colors.textMuted }} /><span>Location:</span>
                  <EditableText value={getVal('overview', 'location', locationStr || '—')} onSave={v => updateBlockSetting('overview', 'location', v)} editing={editing} style={{ color: colors.textPrimary }} placeholder={locationStr || 'Location'} />
                </div>
              </div>
              {allGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allGenres.slice(0, 5).map(g => (
                    <span key={g} className="text-[10px] font-mono uppercase tracking-wider rounded px-2 py-0.5" style={{ backgroundColor: colors.surfaceAlt, color: colors.textSecondary, border: `1px solid ${colors.border}` }}>{g}</span>
                  ))}
                </div>
              )}
              {artist.collaborators?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: colors.textSecondary }}>Top Collaborators</span>
                  <div className="flex flex-wrap gap-1.5">
                    {artist.collaborators.slice(0, 8).map(c => (
                      <span key={c} className="text-[10px] font-mono rounded px-2 py-0.5" style={{ backgroundColor: `${accentColor}08`, color: `${accentColor}aa`, border: `1px solid ${accentColor}15` }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Notes */}
            {(customNotes || editing) && (
              <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                <h4 className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Notes</h4>
                <EditableText value={getVal('overview', 'notes', '')} onSave={v => updateBlockSetting('overview', 'notes', v)} editing={editing} as="p" multiline placeholder="Add notes..." className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: `${colors.textPrimary}cc` }} />
              </div>
            )}
          </div>
        </div>
      );
    },

    spotify: () => {
      const parsed = parseSpotifyUrl(customData.spotifyEmbedUrl || artist.spotifyUrl);
      return parsed ? (
        <iframe src={`https://open.spotify.com/embed/${parsed.type}/${parsed.id}?utm_source=generator&theme=0`}
          width="100%" height={parsed.type === 'track' ? 152 : 352} frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"
          style={{ maxWidth: '100%', backgroundColor: 'transparent', borderRadius: 13 }} />
      ) : (
        <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: colors.textMuted }}>
          <Music size={16} /><span>No Spotify link — click to configure</span>
        </div>
      );
    },

    streaming: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <EditableKpi blockId="streaming" idx={0} defaultLabel="Monthly Listeners" defaultValue={formatNumber(artist.spotify.monthlyListeners)} defaultDelta={artist.spotify.listenersRank ? `Rank #${formatNumber(artist.spotify.listenersRank)}` : ''} />
          <EditableKpi blockId="streaming" idx={1} defaultLabel="Spotify Followers" defaultValue={formatNumber(artist.spotify.followers)} defaultDelta={artist.spotify.followersRank ? `Rank #${formatNumber(artist.spotify.followersRank)}` : ''} />
          <EditableKpi blockId="streaming" idx={2} defaultLabel="Popularity Score" defaultValue={`${artist.spotify.popularity}/100`} defaultDelta="" />
          <EditableKpi blockId="streaming" idx={3} defaultLabel="Shazam Count" defaultValue={formatNumber(artist.engagement.shazam)} defaultDelta="" />
        </div>
        <ChartCard
          title={editableTitle('streaming', 'chartTitle', 'Streaming Trends')}
          subtitle={editableTitle('streaming', 'chartSubtitle', 'Daily streams by platform (90 days)')}
          colors={colors}
        >
          <StreamingTrendChart data={streamingData} />
        </ChartCard>
      </div>
    ),

    tracks: () => tracks.length > 0 ? (
      <ChartCard title={editableTitle('tracks', 'chartTitle', `${tracks.length} tracked song${tracks.length === 1 ? '' : 's'} — sorted by Spotify streams`)} colors={colors}>
        <div className="space-y-1">
          {tracks.slice(0, maxTracks).map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded transition-colors"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.surface}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <span className="text-[10px] font-mono w-6 text-right shrink-0" style={{ color: colors.textMuted }}>{i + 1}</span>
              {t.imageUrl ? <img src={t.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" /> : <div className="w-10 h-10 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: colors.border }}><Music size={12} style={{ color: colors.textMuted }} /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm truncate" style={{ color: colors.textPrimary }}>{t.name}</p>{t.isFeature && <Badge variant="info">feat</Badge>}</div>
                <p className="text-[10px] truncate" style={{ color: colors.textMuted }}>{t.albumName || '—'}{t.releaseDate ? ` · ${new Date(t.releaseDate).getFullYear()}` : ''}</p>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0 mr-2"><span className="text-[10px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Playlists</span><span className="text-xs font-mono" style={{ color: colors.textSecondary }}>{formatNumber(t.spotifyPlaylists)}</span></div>
              <div className="flex flex-col items-end shrink-0 w-20"><span className="text-[10px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Streams</span><span className="text-xs font-mono" style={{ color: colors.textPrimary }}>{formatNumber(t.streams)}</span></div>
            </div>
          ))}
        </div>
        {tracks.length > maxTracks && <p className="text-[10px] mt-3 text-center" style={{ color: colors.textMuted }}>Showing {maxTracks} of {tracks.length} tracks</p>}
      </ChartCard>
    ) : null,

    discography: () => albums.length > 0 ? (
      <ChartCard title={editableTitle('discography', 'chartTitle', `${albums.length} release${albums.length === 1 ? '' : 's'}`)} colors={colors}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 pt-2">
          {albums.slice(0, maxAlbums).map(a => (
            <div key={a.id}>
              <div className="aspect-square rounded overflow-hidden mb-2" style={{ backgroundColor: colors.border, border: `1px solid ${colors.border}` }}>
                {a.imageUrl ? <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Disc3 size={24} style={{ color: colors.textMuted }} /></div>}
              </div>
              <p className="text-xs truncate" style={{ color: colors.textPrimary }}>{a.name}</p>
              <p className="text-[10px] truncate" style={{ color: colors.textMuted }}>{a.releaseDate ? new Date(a.releaseDate).getFullYear() : '—'}{a.type ? ` · ${a.type}` : ''}{a.numTracks ? ` · ${a.numTracks} tracks` : ''}</p>
            </div>
          ))}
        </div>
      </ChartCard>
    ) : null,

    social: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <EditableKpi blockId="social" idx={0} defaultLabel="TikTok" defaultValue={formatNumber(artist.social.tiktok)} defaultDelta={artist.social.tiktokRank ? `Rank #${formatNumber(artist.social.tiktokRank)}` : ''} />
          <EditableKpi blockId="social" idx={1} defaultLabel="Instagram" defaultValue={formatNumber(artist.social.instagram)} defaultDelta={artist.social.instagramRank ? `Rank #${formatNumber(artist.social.instagramRank)}` : ''} />
          <EditableKpi blockId="social" idx={2} defaultLabel="Twitter / X" defaultValue={formatNumber(artist.social.twitter)} defaultDelta="" />
          <EditableKpi blockId="social" idx={3} defaultLabel="YouTube" defaultValue={formatNumber(artist.social.youtube)} defaultDelta={artist.social.youtubeRank ? `Rank #${formatNumber(artist.social.youtubeRank)}` : ''} />
        </div>
        <ChartCard
          title={editableTitle('social', 'chartTitle', 'Social Growth')}
          subtitle={editableTitle('social', 'chartSubtitle', 'Follower trends over time (90 days)')}
          colors={colors}
        >
          <SocialGrowthChart data={socialData} />
        </ChartCard>
      </div>
    ),

    custom_fields: () => {
      const fields = customData.customFields;
      if (!fields.length) return <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: colors.textMuted }}><BarChart3 size={16} /><span>Click to add custom fields</span></div>;
      return (
        <div className="flex flex-wrap gap-2">
          {fields.map(f => (
            <span key={f.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
              <EditableText value={f.label} onSave={v => updateCustomField(f.id, 'label', v)} editing={editing} placeholder="Label" className="text-xs" style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.textMuted }}>:</span>
              <EditableText value={f.value} onSave={v => updateCustomField(f.id, 'value', v)} editing={editing} placeholder="Value" className="text-xs font-medium" style={{ color: colors.textPrimary }} />
            </span>
          ))}
        </div>
      );
    },

    live_metrics: () => {
      const rows = customData.sheetsData || [];
      if (!rows.length) return <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: colors.textMuted }}><ExternalLink size={14} /><span>Click to connect a Google Sheet</span></div>;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((row, i) => (
              <div key={i} className="text-center p-3 rounded-lg" style={{ backgroundColor: `${accentColor}08`, border: `1px solid ${accentColor}15` }}>
                <p className="text-sm font-mono font-medium" style={{ color: accentColor }}>{row.value}</p>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: colors.textMuted }}>{row.label}</p>
              </div>
            ))}
          </div>
          {customData.sheetsSyncedAt && <p className="text-[10px] text-right" style={{ color: colors.textMuted }}>Synced {new Date(customData.sheetsSyncedAt).toLocaleString()}</p>}
        </div>
      );
    },

    platform: () => {
      const pl = getArtistPlaylists(artist.slug);
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <EditableKpi blockId="platform" idx={0} defaultLabel="Spotify Playlists" defaultValue={formatNumber(artist.playlists.spotify.total)} defaultDelta={`${artist.playlists.spotify.editorial} editorial`} />
            <EditableKpi blockId="platform" idx={1} defaultLabel="Playlist Reach" defaultValue={formatNumber(artist.playlists.spotify.reach)} defaultDelta="" />
            <EditableKpi blockId="platform" idx={2} defaultLabel="Editorial Reach" defaultValue={formatNumber(artist.playlists.spotify.editorialReach)} defaultDelta="" />
            <EditableKpi blockId="platform" idx={3} defaultLabel="Total Cross-Platform" defaultValue={formatNumber(artist.playlists.spotify.total + artist.playlists.apple.total + artist.playlists.deezer.total + artist.playlists.amazon.total + artist.playlists.youtube.total)} defaultDelta="" />
          </div>
          <ChartCard
            title={editableTitle('platform', 'chartTitle', 'Playlist Distribution')}
            subtitle={editableTitle('platform', 'chartSubtitle', 'Editorial vs user/algorithmic')}
            colors={colors}
          >
            <PlaylistDistributionChart playlists={artist.playlists} />
          </ChartCard>
          {pl.length > 0 && (
            <ChartCard
              title={editableTitle('platform', 'listTitle', 'Active Playlists')}
              subtitle={editableTitle('platform', 'listSubtitle', `${pl.length} placement${pl.length === 1 ? '' : 's'}`)}
              colors={colors}
            >
              <div className="space-y-1">
                {pl.slice(0, maxPlaylists).map((p, i) => (
                  <div key={`${p.playlistId}-${i}`} className="flex items-center gap-3 px-2 py-2 rounded transition-colors"
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.surface}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <span className="text-[10px] font-mono w-5 text-right shrink-0" style={{ color: colors.textMuted }}>{i + 1}</span>
                    <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: colors.border }}><ListMusic size={11} style={{ color: colors.textMuted }} /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm truncate" style={{ color: colors.textPrimary }}>{p.playlistName}</p><p className="text-[10px] truncate" style={{ color: colors.textMuted }}>{p.curator}</p></div>
                    <Badge variant={p.type === 'editorial' ? 'success' : p.type === 'algorithmic' ? 'info' : 'warning'}>{p.type}</Badge>
                    <div className="flex flex-col items-end shrink-0 w-16"><span className="text-xs font-mono" style={{ color: colors.textPrimary }}>{formatNumber(p.streamsFromPlaylist)}</span></div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      );
    },

    geography: () => {
      const cities = maxCities > 0 ? geographyData.slice(0, maxCities) : geographyData;
      return (
        <div className="space-y-6">
          {cities.length > 0 && (
            <ChartCard
              title={editableTitle('geography', 'chartTitle', 'Geographic Distribution')}
              subtitle={editableTitle('geography', 'chartSubtitle', 'Listeners by city')}
              colors={colors}
            >
              <GeographyHeatMap data={cities} />
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {cities.map((c, i) => {
                    const pct = cities[0]?.listeners > 0 ? (c.listeners / cities[0].listeners) * 100 : 0;
                    return (
                      <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 py-2 last:border-0" style={{ borderBottom: `1px solid ${colors.border}50` }}>
                        <span className="text-[10px] font-mono w-5 text-right shrink-0" style={{ color: colors.textMuted }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5"><span className="text-sm truncate" style={{ color: colors.textPrimary }}>{c.city}</span><span className="text-[10px]" style={{ color: colors.textMuted }}>{getCountryName(c.country)}</span></div>
                          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}><div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: accentColor, opacity: 0.4 + (pct / 100) * 0.6 }} /></div>
                        </div>
                        <span className="text-xs font-mono shrink-0" style={{ color: colors.textSecondary }}>{formatNumber(c.listeners)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ChartCard>
          )}
          <ChartCard
            title={editableTitle('geography', 'benchTitle', 'Benchmark Comparison')}
            subtitle={editableTitle('geography', 'benchSubtitle', 'vs average across all artists')}
            colors={colors}
          >
            <BenchmarkRadarChart artist={benchmarkData.artist} benchmark={benchmarkData.benchmark} dimensions={benchmarkData.dimensions} artistName={artist.name} />
          </ChartCard>
        </div>
      );
    },

    forecast: () => (
      <ChartCard
        title={editableTitle('forecast', 'chartTitle', 'Stream Forecast')}
        subtitle={editableTitle('forecast', 'chartSubtitle', '60-day actual + 30-day prediction')}
        colors={colors}
      >
        <ForecastChart data={forecastData} todayIndex={59} />
      </ChartCard>
    ),

    revenue: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {revenueData.map((r, i) => (
            <EditableKpi key={r.source} blockId="revenue" idx={i} defaultLabel={r.source} defaultValue={formatCurrency(r.amount)} defaultDelta={`${r.percentage}%`} />
          ))}
        </div>
        <ChartCard
          title={editableTitle('revenue', 'chartTitle', 'Revenue Breakdown')}
          subtitle={editableTitle('revenue', 'chartSubtitle', `Estimated annual: ${formatCurrency(totalRevenue)}`)}
          colors={colors}
        >
          <RevenueDonutChart data={revenueData} totalRevenue={totalRevenue} />
        </ChartCard>
      </div>
    ),
  };

  // ─── Sidebar helpers ──────────────────────────────────────────────────────

  const SInput = ({ label, value, onChange, placeholder, type = 'text' }) => (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[#6B6560] mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#3D3B37]" />
    </div>
  );

  const STextarea = ({ label, value, onChange, placeholder, rows = 3 }) => (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[#6B6560] mb-1.5">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] resize-none outline-none focus:border-[#3D3B37]" />
    </div>
  );

  const SSelect = ({ label, value, onChange, options }) => (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[#6B6560] mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] outline-none focus:border-[#3D3B37] cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const SDivider = () => <div className="border-t border-[#2C2B28]" />;

  const SKpiFields = ({ blockId, idx, defaultLabel, defaultValue }) => (
    <div className="grid grid-cols-2 gap-2">
      <SInput label={`Stat ${idx + 1} Label`} value={getRaw(blockId, `kpi${idx}Label`)} onChange={v => updateBlockSetting(blockId, `kpi${idx}Label`, v)} placeholder={defaultLabel} />
      <SInput label="Value" value={getRaw(blockId, `kpi${idx}Value`)} onChange={v => updateBlockSetting(blockId, `kpi${idx}Value`, v)} placeholder={defaultValue} />
    </div>
  );

  // ─── Block editors (sidebar) ──────────────────────────────────────────────

  const blockEditors = {
    overview: () => (
      <>
        <SInput label="Section Title" value={getRaw('overview', 'title')} onChange={v => updateBlockSetting('overview', 'title', v)} placeholder="Overview" />
        <SDivider />
        <SInput label="Artist Name" value={getRaw('overview', 'artistName')} onChange={v => updateBlockSetting('overview', 'artistName', v)} placeholder={artist.name} />
        <SInput label="Subtitle" value={getRaw('overview', 'subtitle')} onChange={v => updateBlockSetting('overview', 'subtitle', v)} placeholder={`${primaryGenre} — ${date}`} />
        <STextarea label="Bio" value={getRaw('overview', 'bio')} onChange={v => updateBlockSetting('overview', 'bio', v)} placeholder={aiSummary.text} rows={4} />
        <STextarea label="Notes" value={getRaw('overview', 'notes')} onChange={v => updateBlockSetting('overview', 'notes', v)} placeholder="Visible on the page..." rows={3} />
        <SDivider />
        <SInput label="Label" value={getRaw('overview', 'label')} onChange={v => updateBlockSetting('overview', 'label', v)} placeholder={artist.label || 'Label'} />
        <SInput label="Location" value={getRaw('overview', 'location')} onChange={v => updateBlockSetting('overview', 'location', v)} placeholder={locationStr || 'Location'} />
        <SDivider />
        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Key Metrics</span>
        {aiSummary.keyMetrics.map((m, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <SInput label={`Metric ${i + 1} Label`} value={getRaw('overview', `metric${i}Label`)} onChange={v => updateBlockSetting('overview', `metric${i}Label`, v)} placeholder={m.label} />
            <SInput label="Value" value={getRaw('overview', `metric${i}Value`)} onChange={v => updateBlockSetting('overview', `metric${i}Value`, v)} placeholder={m.value} />
          </div>
        ))}
        {extraMetrics.map((em, i) => (
          <div key={em.id} className="flex items-end gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <SInput label={`Extra ${i + 1} Label`} value={em.label} onChange={v => updateExtraMetric(em.id, 'label', v)} placeholder="Label" />
              <SInput label="Value" value={em.value} onChange={v => updateExtraMetric(em.id, 'value', v)} placeholder="Value" />
            </div>
            <button onClick={() => removeExtraMetric(em.id)} className="pb-2 text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={addExtraMetric} className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#9B9590] cursor-pointer"><Plus size={12} /> Add metric</button>
      </>
    ),

    spotify: () => (
      <>
        <SInput label="Section Title" value={getRaw('spotify', 'title')} onChange={v => updateBlockSetting('spotify', 'title', v)} placeholder="Listen" />
        <SDivider />
        <SInput label="Spotify URL" value={customData.spotifyEmbedUrl} onChange={v => updateField('spotifyEmbedUrl', v)} placeholder={artist.spotifyUrl || 'https://open.spotify.com/...'} />
        <p className="text-[10px] text-[#6B6560]">Paste an artist, album, track, or playlist URL. Leave empty for default.</p>
        {customData.spotifyEmbedUrl && <button onClick={() => updateField('spotifyEmbedUrl', '')} className="text-[10px] text-[#C75F4F] hover:text-[#F5F0E8] cursor-pointer">Reset to default</button>}
      </>
    ),

    streaming: () => (
      <>
        <SInput label="Section Title" value={getRaw('streaming', 'title')} onChange={v => updateBlockSetting('streaming', 'title', v)} placeholder="Streaming Performance" />
        <SDivider />
        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Stats</span>
        <SKpiFields blockId="streaming" idx={0} defaultLabel="Monthly Listeners" defaultValue={formatNumber(artist.spotify.monthlyListeners)} />
        <SKpiFields blockId="streaming" idx={1} defaultLabel="Spotify Followers" defaultValue={formatNumber(artist.spotify.followers)} />
        <SKpiFields blockId="streaming" idx={2} defaultLabel="Popularity Score" defaultValue={`${artist.spotify.popularity}/100`} />
        <SKpiFields blockId="streaming" idx={3} defaultLabel="Shazam Count" defaultValue={formatNumber(artist.engagement.shazam)} />
        <SDivider />
        <SInput label="Chart Title" value={getRaw('streaming', 'chartTitle')} onChange={v => updateBlockSetting('streaming', 'chartTitle', v)} placeholder="Streaming Trends" />
        <SInput label="Chart Subtitle" value={getRaw('streaming', 'chartSubtitle')} onChange={v => updateBlockSetting('streaming', 'chartSubtitle', v)} placeholder="Daily streams by platform (90 days)" />
      </>
    ),

    tracks: () => (
      <>
        <SInput label="Section Title" value={getRaw('tracks', 'title')} onChange={v => updateBlockSetting('tracks', 'title', v)} placeholder="Top Tracks" />
        <SInput label="Chart Title" value={getRaw('tracks', 'chartTitle')} onChange={v => updateBlockSetting('tracks', 'chartTitle', v)} placeholder={`${tracks.length} tracked songs`} />
        <SSelect label="Tracks to Show" value={blockSettings.tracks?.maxItems || 12} onChange={v => updateBlockSetting('tracks', 'maxItems', Number(v))}
          options={[{ value: 6, label: '6 tracks' }, { value: 12, label: '12 tracks' }, { value: 24, label: '24 tracks' }, { value: 50, label: 'All tracks' }]} />
      </>
    ),

    discography: () => (
      <>
        <SInput label="Section Title" value={getRaw('discography', 'title')} onChange={v => updateBlockSetting('discography', 'title', v)} placeholder="Discography" />
        <SInput label="Chart Title" value={getRaw('discography', 'chartTitle')} onChange={v => updateBlockSetting('discography', 'chartTitle', v)} placeholder={`${albums.length} releases`} />
        <SSelect label="Releases to Show" value={blockSettings.discography?.maxItems || 24} onChange={v => updateBlockSetting('discography', 'maxItems', Number(v))}
          options={[{ value: 12, label: '12 releases' }, { value: 24, label: '24 releases' }, { value: 100, label: 'All releases' }]} />
      </>
    ),

    social: () => (
      <>
        <SInput label="Section Title" value={getRaw('social', 'title')} onChange={v => updateBlockSetting('social', 'title', v)} placeholder="Social & Engagement" />
        <SDivider />
        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Stats</span>
        <SKpiFields blockId="social" idx={0} defaultLabel="TikTok" defaultValue={formatNumber(artist.social.tiktok)} />
        <SKpiFields blockId="social" idx={1} defaultLabel="Instagram" defaultValue={formatNumber(artist.social.instagram)} />
        <SKpiFields blockId="social" idx={2} defaultLabel="Twitter / X" defaultValue={formatNumber(artist.social.twitter)} />
        <SKpiFields blockId="social" idx={3} defaultLabel="YouTube" defaultValue={formatNumber(artist.social.youtube)} />
        <SDivider />
        <SInput label="Chart Title" value={getRaw('social', 'chartTitle')} onChange={v => updateBlockSetting('social', 'chartTitle', v)} placeholder="Social Growth" />
        <SInput label="Chart Subtitle" value={getRaw('social', 'chartSubtitle')} onChange={v => updateBlockSetting('social', 'chartSubtitle', v)} placeholder="Follower trends over time (90 days)" />
      </>
    ),

    custom_fields: () => (
      <>
        <SInput label="Section Title" value={getRaw('custom_fields', 'title')} onChange={v => updateBlockSetting('custom_fields', 'title', v)} placeholder="Custom Fields" />
        <SDivider />
        {customData.customFields.map(f => (
          <div key={f.id} className="flex items-center gap-2">
            <input type="text" value={f.label} onChange={e => updateCustomField(f.id, 'label', e.target.value)} placeholder="Label"
              className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#3D3B37]" />
            <input type="text" value={f.value} onChange={e => updateCustomField(f.id, 'value', e.target.value)} placeholder="Value"
              className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#3D3B37]" />
            <button onClick={() => removeCustomField(f.id)} className="text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={addCustomField} className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#9B9590] cursor-pointer"><Plus size={12} /> Add field</button>
      </>
    ),

    live_metrics: () => (
      <>
        <SInput label="Section Title" value={getRaw('live_metrics', 'title')} onChange={v => updateBlockSetting('live_metrics', 'title', v)} placeholder="Live Metrics" />
        <SDivider />
        <div className="rounded-lg border border-[#2C2B28] bg-[#0D0C0B] p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-[#9B9590] font-medium">How to connect</p>
          <p className="text-xs text-[#6B6560]">In Google Sheets: <span className="text-[#9B9590]">File &rarr; Share &rarr; Publish to web &rarr; CSV</span>. Column A = label, Column B = value.</p>
        </div>
        <SInput label="Google Sheets URL" value={customData.sheetsUrl} onChange={v => updateField('sheetsUrl', v)} placeholder="https://docs.google.com/spreadsheets/d/..." />
        <button onClick={handleSheetsSync} disabled={!customData.sheetsUrl?.trim() || sheetsSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer disabled:opacity-40"
          style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}15`, color: accentColor }}>
          <RefreshCw size={12} className={sheetsSyncing ? 'animate-spin' : ''} />{sheetsSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
        {sheetsError && <p className="text-xs text-[#C75F4F] bg-[#C75F4F]/10 border border-[#C75F4F]/20 rounded p-2">{sheetsError}</p>}
        {customData.sheetsData?.length > 0 && <p className="text-[10px] text-[#6B6560]">{customData.sheetsData.length} rows{customData.sheetsSyncedAt && ` · synced ${new Date(customData.sheetsSyncedAt).toLocaleString()}`}</p>}
      </>
    ),

    platform: () => (
      <>
        <SInput label="Section Title" value={getRaw('platform', 'title')} onChange={v => updateBlockSetting('platform', 'title', v)} placeholder="Platform Analytics" />
        <SDivider />
        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Stats</span>
        <SKpiFields blockId="platform" idx={0} defaultLabel="Spotify Playlists" defaultValue={formatNumber(artist.playlists.spotify.total)} />
        <SKpiFields blockId="platform" idx={1} defaultLabel="Playlist Reach" defaultValue={formatNumber(artist.playlists.spotify.reach)} />
        <SKpiFields blockId="platform" idx={2} defaultLabel="Editorial Reach" defaultValue={formatNumber(artist.playlists.spotify.editorialReach)} />
        <SKpiFields blockId="platform" idx={3} defaultLabel="Total Cross-Platform" defaultValue={formatNumber(artist.playlists.spotify.total + artist.playlists.apple.total + artist.playlists.deezer.total + artist.playlists.amazon.total + artist.playlists.youtube.total)} />
        <SDivider />
        <SInput label="Chart Title" value={getRaw('platform', 'chartTitle')} onChange={v => updateBlockSetting('platform', 'chartTitle', v)} placeholder="Playlist Distribution" />
        <SInput label="Chart Subtitle" value={getRaw('platform', 'chartSubtitle')} onChange={v => updateBlockSetting('platform', 'chartSubtitle', v)} placeholder="Editorial vs user/algorithmic" />
        <SInput label="List Title" value={getRaw('platform', 'listTitle')} onChange={v => updateBlockSetting('platform', 'listTitle', v)} placeholder="Active Playlists" />
        <SSelect label="Playlists to Show" value={blockSettings.platform?.maxItems || 15} onChange={v => updateBlockSetting('platform', 'maxItems', Number(v))}
          options={[{ value: 10, label: '10 playlists' }, { value: 15, label: '15 playlists' }, { value: 25, label: '25 playlists' }, { value: 50, label: 'All playlists' }]} />
      </>
    ),

    geography: () => (
      <>
        <SInput label="Section Title" value={getRaw('geography', 'title')} onChange={v => updateBlockSetting('geography', 'title', v)} placeholder="Audience & Geography" />
        <SDivider />
        <SInput label="Map Title" value={getRaw('geography', 'chartTitle')} onChange={v => updateBlockSetting('geography', 'chartTitle', v)} placeholder="Geographic Distribution" />
        <SInput label="Map Subtitle" value={getRaw('geography', 'chartSubtitle')} onChange={v => updateBlockSetting('geography', 'chartSubtitle', v)} placeholder="Listeners by city" />
        <SInput label="Benchmark Title" value={getRaw('geography', 'benchTitle')} onChange={v => updateBlockSetting('geography', 'benchTitle', v)} placeholder="Benchmark Comparison" />
        <SInput label="Benchmark Subtitle" value={getRaw('geography', 'benchSubtitle')} onChange={v => updateBlockSetting('geography', 'benchSubtitle', v)} placeholder="vs average across all artists" />
        <SSelect label="Cities to Show" value={blockSettings.geography?.maxItems || 0} onChange={v => updateBlockSetting('geography', 'maxItems', Number(v))}
          options={[{ value: 0, label: 'All cities' }, { value: 5, label: '5 cities' }, { value: 10, label: '10 cities' }, { value: 20, label: '20 cities' }]} />
      </>
    ),

    forecast: () => (
      <>
        <SInput label="Section Title" value={getRaw('forecast', 'title')} onChange={v => updateBlockSetting('forecast', 'title', v)} placeholder="AI Forecasting" />
        <SInput label="Chart Title" value={getRaw('forecast', 'chartTitle')} onChange={v => updateBlockSetting('forecast', 'chartTitle', v)} placeholder="Stream Forecast" />
        <SInput label="Chart Subtitle" value={getRaw('forecast', 'chartSubtitle')} onChange={v => updateBlockSetting('forecast', 'chartSubtitle', v)} placeholder="60-day actual + 30-day prediction" />
      </>
    ),

    revenue: () => (
      <>
        <SInput label="Section Title" value={getRaw('revenue', 'title')} onChange={v => updateBlockSetting('revenue', 'title', v)} placeholder="Revenue Estimate" />
        <SDivider />
        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Stats</span>
        {revenueData.map((r, i) => (
          <SKpiFields key={r.source} blockId="revenue" idx={i} defaultLabel={r.source} defaultValue={formatCurrency(r.amount)} />
        ))}
        <SDivider />
        <SInput label="Chart Title" value={getRaw('revenue', 'chartTitle')} onChange={v => updateBlockSetting('revenue', 'chartTitle', v)} placeholder="Revenue Breakdown" />
        <SInput label="Chart Subtitle" value={getRaw('revenue', 'chartSubtitle')} onChange={v => updateBlockSetting('revenue', 'chartSubtitle', v)} placeholder={`Estimated annual: ${formatCurrency(totalRevenue)}`} />
      </>
    ),
  };

  // ─── Sidebar block editor panel ───────────────────────────────────────────

  const renderBlockEditor = () => {
    const def = BLOCK_DEFS.find(d => d.id === selectedBlockId);
    if (!def) return null;
    const Icon = def.icon;
    const editor = blockEditors[selectedBlockId];

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2C2B28] shrink-0">
          <button onClick={() => setSelectedBlockId(null)} className="text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"><ArrowLeft size={14} /></button>
          <Icon size={14} style={{ color: accentColor }} />
          <span className="text-sm font-medium text-[#F5F0E8]">{def.label}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {editor ? editor() : <p className="text-xs text-[#6B6560]">No settings available.</p>}
        </div>
      </div>
    );
  };

  // ─── Sidebar block list panel ──────────────────────────────────────────────

  const renderBlockList = () => (
    <div className="flex flex-col h-full">
      {/* Settings toggle */}
      <button onClick={() => setSettingsOpen(!settingsOpen)}
        className="flex items-center justify-between px-4 py-3 border-b border-[#2C2B28] hover:bg-[#0D0C0B]/50 transition-colors cursor-pointer shrink-0">
        <div className="flex items-center gap-2">
          <Settings size={13} className="text-[#6B6560]" />
          <span className="text-xs font-medium text-[#9B9590]">Sheet Settings</span>
        </div>
        <motion.div animate={{ rotate: settingsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className="text-[#6B6560]" />
        </motion.div>
      </button>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-b border-[#2C2B28]">
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B6560] mb-2 block">Accent Color</span>
                <div className="flex gap-1.5 mb-2">
                  {ACCENT_PRESETS.map(p => (
                    <button key={p.hex} onClick={() => setAccent(p.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${accent === p.hex ? 'scale-110 border-[#F5F0E8]' : 'border-transparent hover:border-[#3D3B37]'}`}
                      style={{ backgroundColor: `#${p.hex}` }} title={p.label} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={e => setAccentDebounced(e.target.value.slice(1))}
                    className="w-7 h-7 rounded border border-[#2C2B28] cursor-pointer shrink-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded" />
                  <input type="text" value={accent} onChange={e => setAccent(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                    className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1 text-[11px] font-mono text-[#F5F0E8] outline-none focus:border-[#3D3B37]" placeholder="DA7756" maxLength={6} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B6560] mb-2 block">Background</span>
                <div className="flex gap-1.5 mb-2">
                  {BG_PRESETS.map(p => (
                    <button key={p.hex} onClick={() => setBg(p.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${bg === p.hex ? 'scale-110 border-[#F5F0E8]' : 'border-transparent hover:border-[#3D3B37]'}`}
                      style={{ backgroundColor: `#${p.hex}`, boxShadow: p.hex === 'FFFFFF' ? 'inset 0 0 0 1px #3D3B37' : undefined }} title={p.label} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={bgColor} onChange={e => setBgDebounced(e.target.value.slice(1))}
                    className="w-7 h-7 rounded border border-[#2C2B28] cursor-pointer shrink-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded" />
                  <input type="text" value={bg} onChange={e => setBg(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                    className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1 text-[11px] font-mono text-[#F5F0E8] outline-none focus:border-[#3D3B37]" placeholder="0D0C0B" maxLength={6} />
                  {artist?.imageUrl && (
                    <button onClick={sampleColorFromImage} disabled={sampling}
                      className="w-7 h-7 rounded border border-[#2C2B28] flex items-center justify-center shrink-0 hover:border-[#DA7756] transition-colors disabled:opacity-50"
                      title="Sample color from artist image">
                      <Pipette size={13} className={sampling ? 'animate-pulse text-[#DA7756]' : 'text-[#9B9590]'} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block list header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2B28] shrink-0">
        <span className="text-xs font-medium text-[#9B9590]">Page Blocks</span>
        <div className="relative">
          <button onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="p-1 rounded transition-colors cursor-pointer" style={{ backgroundColor: accentColor, color: '#fff' }}>
            <Plus size={14} />
          </button>
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute right-0 top-8 bg-[#171614] border border-[#2C2B28] rounded-lg shadow-xl py-1 z-20 w-52">
                {BLOCK_DEFS.filter(d => !blocks.some(b => b.id === d.id)).map(d => (
                  <button key={d.id} onClick={() => addBlock(d.id)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#0D0C0B] cursor-pointer text-[#9B9590] hover:text-[#F5F0E8] transition-colors flex items-center gap-2">
                    <d.icon size={12} className="text-[#6B6560]" />{d.label}
                  </button>
                ))}
                {blocks.length === BLOCK_DEFS.length && <p className="px-3 py-2 text-[10px] text-[#6B6560]">All blocks added</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto p-2">
        {blocks.map((block, idx) => {
          const def = BLOCK_DEFS.find(d => d.id === block.id);
          if (!def) return null;
          const isSelected = selectedBlockId === block.id;
          return (
            <div key={block.id} draggable onDragStart={() => handleListDragStart(idx)} onDragOver={(e) => handleListDragOver(e, idx)} onDrop={() => handleListDrop(idx)} onDragEnd={handleListDragEnd}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer ${isSelected ? 'bg-[#DA7756]/10' : 'hover:bg-[#0D0C0B]/70'} ${dragIdx === idx ? 'opacity-40' : ''} ${dragOverIdx === idx ? 'border-t-2' : 'border-t-2 border-transparent'}`}
              style={dragOverIdx === idx ? { borderTopColor: accentColor } : {}}
              onClick={() => selectBlock(block.id)}>
              <GripVertical size={13} className="text-[#3D3B37] cursor-grab shrink-0" />
              <def.icon size={13} className={block.visible ? '' : 'text-[#3D3B37]'} style={block.visible ? { color: accentColor } : {}} />
              <span className={`flex-1 text-xs truncate ${block.visible ? 'text-[#F5F0E8]' : 'text-[#6B6560]'}`}>{def.label}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleVisibility(block.id); }} className="p-1 text-[#6B6560] hover:text-[#9B9590] cursor-pointer shrink-0" title={block.visible ? 'Hide' : 'Show'}>
                {block.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="p-1 text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0" title="Remove">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {blocks.length === 0 && <p className="text-[10px] text-[#6B6560] text-center py-6">No blocks — click + to add</p>}
      </div>
    </div>
  );

  // ─── Preview block wrapper ─────────────────────────────────────────────────

  const renderPreviewBlock = (block) => {
    const def = BLOCK_DEFS.find(d => d.id === block.id);
    const content = blockRenderers[block.id]?.();
    if (!content || !def) return null;
    const isSelected = sidebarOpen && selectedBlockId === block.id;
    const Icon = def.icon;
    const title = getVal(block.id, 'title', def.label);

    // Overview renders its own container
    if (block.id === 'overview') {
      return (
        <motion.div key={block.id} data-block-id={block.id} data-pdf-section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
          onClick={sidebarOpen ? () => selectBlock(block.id) : undefined}
          className={`group relative transition-all ${sidebarOpen ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-inset rounded-lg' : ''}`}
          style={isSelected ? { ringColor: accentColor } : {}}>
          {sidebarOpen && (
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">Click to edit</span>
            </div>
          )}
          {content}
        </motion.div>
      );
    }

    return (
      <motion.div key={block.id} data-block-id={block.id} data-pdf-section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
        onClick={sidebarOpen ? () => selectBlock(block.id) : undefined}
        className={`group relative transition-all ${sidebarOpen ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-inset rounded-lg' : ''}`}
        style={isSelected ? { ringColor: accentColor } : {}}>
        {sidebarOpen && (
          <>
            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/50 backdrop-blur-sm rounded p-0.5"><GripVertical size={14} className="text-white/70" /></div>
            </div>
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">Click to edit</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2 mb-3">
          <Icon size={14} style={{ color: accentColor }} />
          <EditableText value={title} onSave={v => updateBlockSetting(block.id, 'title', v)} editing={editing} className="text-sm font-medium" style={{ color: colors.textPrimary }} placeholder={def.label} />
        </div>
        {content}
      </motion.div>
    );
  };

  // ─── Private gate — block shared URL access when sheet is private ─────────

  if (isSharedView && customData.visibility !== 'public') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
            <Lock size={24} style={{ color: accentColor }} />
          </div>
          <h2 className="text-xl font-light mb-2" style={{ color: colors.textPrimary }}>This sheet is private</h2>
          <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>The owner hasn't made this artist sheet public yet.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 text-sm rounded border cursor-pointer transition-colors" style={{ borderColor: colors.border, color: colors.textSecondary }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col transition-colors duration-300" style={{ backgroundColor: sidebarOpen ? '#0D0C0B' : bgColor }}>
      <div
        className="h-12 flex items-center justify-between px-4 shrink-0 transition-all duration-300 backdrop-blur-md"
        style={{
          backgroundColor: sidebarOpen ? '#171614' : `${bgColor}e6`,
          borderBottom: `1px solid ${sidebarOpen ? '#2C2B28' : colors.border}`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="hover:text-[#F5F0E8] transition-colors cursor-pointer shrink-0" style={{ color: sidebarOpen ? '#6B6560' : colors.textMuted }}><ArrowLeft size={16} /></button>
          <div className="h-5 w-px" style={{ backgroundColor: sidebarOpen ? '#2C2B28' : colors.border }} />
          <button onClick={() => setSidebarOpen(s => !s)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border cursor-pointer transition-colors"
            style={{
              color: sidebarOpen ? '#9B9590' : accentColor,
              borderColor: sidebarOpen ? '#2C2B28' : colors.border,
            }}>
            {sidebarOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
            {sidebarOpen ? 'Hide Panel' : 'Show Panel'}
          </button>
          <div className="h-5 w-px" style={{ backgroundColor: sidebarOpen ? '#2C2B28' : colors.border }} />
          <span className="text-sm font-medium truncate" style={{ color: sidebarOpen ? '#F5F0E8' : colors.textPrimary }}>{artist.name}</span>
          <span className="text-[10px]" style={{ color: sidebarOpen ? '#6B6560' : colors.textMuted }}>Artist Page</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateField('visibility', customData.visibility === 'public' ? 'private' : 'public')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors"
            style={{ color: customData.visibility === 'public' ? '#7BAF73' : (sidebarOpen ? '#9B9590' : colors.textSecondary), borderColor: sidebarOpen ? '#2C2B28' : colors.border }}
            title={customData.visibility === 'public' ? 'Sheet is public — click to make private' : 'Sheet is private — click to make public'}
          >
            {customData.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
            {customData.visibility === 'public' ? 'Public' : 'Private'}
          </button>
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors"
            style={{ color: sidebarOpen ? '#9B9590' : colors.textSecondary, borderColor: sidebarOpen ? '#2C2B28' : colors.border }}>
            {linkCopied ? <Check size={12} className="text-[#7BAF73]" /> : <Link2 size={12} />}{linkCopied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={() => setSocialPostOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors"
            style={{ color: sidebarOpen ? '#9B9590' : colors.textSecondary, borderColor: sidebarOpen ? '#2C2B28' : colors.border }}>
            <ImageIcon size={12} />Post
          </button>
          <button onClick={handleExportPDF} disabled={exporting} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors disabled:opacity-50"
            style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}15`, color: accentColor }}>
            <Download size={12} />{exporting ? 'Exporting...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="shrink-0 border-r border-[#2C2B28] bg-[#171614] flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarOpen ? 288 : 0, borderRightWidth: sidebarOpen ? 1 : 0 }}
        >
          <div className="w-72 h-full flex flex-col overflow-hidden">
            {selectedBlockId ? renderBlockEditor() : renderBlockList()}
          </div>
        </div>
        <div ref={previewRef} className="flex-1 overflow-y-auto" style={{ backgroundColor: bgColor }}>
          <div className="max-w-[960px] mx-auto px-8 py-8 space-y-5">
            {visibleBlocks.length === 0 ? (
              <div className="text-center py-24" style={{ color: colors.textMuted }}>
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Add blocks from the sidebar</p>
              </div>
            ) : (
              <div className="space-y-5">
                {visibleBlocks.map(block => renderPreviewBlock(block))}
              </div>
            )}
          </div>
        </div>
      </div>

      {socialPostOpen && (
        <SocialPostModal
          artistSlug={id}
          accentColor={accentColor}
          onClose={() => setSocialPostOpen(false)}
        />
      )}
    </div>
  );
}
