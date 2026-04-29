import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router';
import { motion } from 'motion/react';
import { FileText, Download, Eye, Pencil, Link2, Check, X, ArrowLeft } from 'lucide-react';
import { useReports } from '../hooks/useReports';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ArtistSelector from '../components/reports/ArtistSelector';
import WidgetPicker from '../components/reports/WidgetPicker';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import DataTable from '../components/shared/DataTable';
import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import RevenueDonutChart from '../components/charts/RevenueDonutChart';
import ForecastChart from '../components/charts/ForecastChart';
import SocialGrowthChart from '../components/charts/SocialGrowthChart';
import GeographyHeatMap from '../components/charts/GeographyHeatMap';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import {
  getArtist,
  getTopArtists,
  generateStreamingTrend,
  generateSocialTimeline,
  generateForecast,
  generateRevenue,
  getBenchmarkComparison,
} from '../data/artists';
import { formatNumber, formatCurrency } from '../utils/formatters';

// --- Column definitions ---

const comparisonCols = [
  {
    key: 'name', label: 'Artist', align: 'left',
    format: (v, row) => (
      <Link to={`/artist/${row.slug}`} className="text-[#F5F0E8] hover:text-[#DA7756] transition-colors">
        <span className="flex items-center gap-2">
          {row.imageUrl && <img src={row.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />}
          {v}
        </span>
      </Link>
    ),
  },
  { key: 'listeners', label: 'Monthly Listeners', format: (v) => formatNumber(v) },
  { key: 'followers', label: 'Followers', format: (v) => formatNumber(v) },
  { key: 'popularity', label: 'Popularity' },
  { key: 'instagram', label: 'Instagram', format: (v) => formatNumber(v) },
  { key: 'tiktok', label: 'TikTok', format: (v) => formatNumber(v) },
  { key: 'youtube', label: 'YouTube', format: (v) => formatNumber(v) },
  { key: 'playlists', label: 'Playlists', format: (v) => formatNumber(v) },
];

const playlistCols = [
  {
    key: 'name', label: 'Artist', align: 'left',
    format: (v, row) => (
      <Link to={`/artist/${row.slug}`} className="text-[#F5F0E8] hover:text-[#DA7756] transition-colors">{v}</Link>
    ),
  },
  { key: 'editorial', label: 'Editorial', align: 'right', format: (v) => formatNumber(v) },
  { key: 'total', label: 'Total', align: 'right', format: (v) => formatNumber(v) },
  { key: 'reach', label: 'Reach', align: 'right', format: (v) => formatNumber(v) },
  { key: 'editorialReach', label: 'Editorial Reach', align: 'right', format: (v) => formatNumber(v) },
];

// --- Component ---

export default function ReportCenter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getReport, updateReport } = useReports();

  const existingReport = id ? getReport(id) : null;

  // Redirect if report ID was given but not found
  useEffect(() => {
    if (id && !existingReport) {
      navigate('/reports', { replace: true });
    }
  }, [id, existingReport, navigate]);

  const [reportName, setReportName] = useState(() => {
    if (existingReport) return existingReport.name;
    return 'Untitled Report';
  });

  const [selectedArtists, setSelectedArtists] = useState(() => {
    if (existingReport) return existingReport.artists.map(s => getArtist(s)).filter(Boolean);
    const paramSlugs = searchParams.get('artists');
    if (paramSlugs) return paramSlugs.split(',').map(s => getArtist(s)).filter(Boolean);
    return getTopArtists(3);
  });

  const [selected, setSelected] = useState(() => {
    if (existingReport) return existingReport.widgets;
    const paramWidgets = searchParams.get('widgets');
    if (paramWidgets) return paramWidgets.split(',');
    return ['artist-comparison', 'streaming-trends', 'revenue-breakdown', 'social-growth'];
  });

  const [viewMode, setViewMode] = useState(() => searchParams.get('view') === 'true');
  const [linkCopied, setLinkCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  // Auto-save report changes (debounced)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateReport(id, {
        name: reportName,
        artists: selectedArtists.map(a => a.slug),
        widgets: selected,
      });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [id, reportName, selectedArtists, selected, updateReport]);

  // Sync from URL params (for shared links)
  useEffect(() => {
    if (id) return; // Skip URL param sync when editing a saved report
    const paramSlugs = searchParams.get('artists');
    const paramWidgets = searchParams.get('widgets');
    if (paramSlugs) {
      setSelectedArtists(paramSlugs.split(',').map(s => getArtist(s)).filter(Boolean));
    }
    if (paramWidgets) {
      setSelected(paramWidgets.split(','));
    }
    if (searchParams.get('view') === 'true') {
      setViewMode(true);
    }
  }, [searchParams, id]);

  const toggleWidget = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- Share URL ---
  const buildShareUrl = useCallback(() => {
    if (id) {
      return `${window.location.origin}/reports/${id}?view=true`;
    }
    const url = new URL(window.location.origin + '/reports');
    url.searchParams.set('artists', selectedArtists.map(a => a.slug).join(','));
    url.searchParams.set('widgets', selected.join(','));
    url.searchParams.set('view', 'true');
    return url.toString();
  }, [id, selectedArtists, selected]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(buildShareUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [buildShareUrl]);

  // --- PDF Export (section-aware pagination) ---
  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 30;
      const footerHeight = 24;
      const contentWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2 - footerHeight;
      const sectionGap = 14;

      const fillBg = () => {
        pdf.setFillColor(8, 8, 8);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      };
      fillBg();

      // Capture each section individually to avoid mid-widget page breaks
      const sections = reportRef.current.querySelectorAll('[data-pdf-section]');
      let curY = margin;

      for (const section of sections) {
        const canvas = await html2canvas(section, {
          backgroundColor: '#0D0C0B',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const scaledH = (canvas.height * contentWidth) / canvas.width;

        // If section won't fit and we're not at top of page, start new page
        if (curY + scaledH > pageHeight - margin - footerHeight && curY > margin + 1) {
          pdf.addPage();
          fillBg();
          curY = margin;
        }

        // Oversized section: slice across pages
        if (scaledH > availableHeight) {
          let srcOffset = 0;
          const totalSrcH = canvas.height;
          while (srcOffset < totalSrcH) {
            if (srcOffset > 0) {
              pdf.addPage();
              fillBg();
              curY = margin;
            }
            const remaining = availableHeight - (curY - margin);
            const srcH = Math.min(Math.round((remaining / scaledH) * totalSrcH), totalSrcH - srcOffset);
            const destH = (srcH / totalSrcH) * scaledH;

            const slice = document.createElement('canvas');
            slice.width = canvas.width;
            slice.height = srcH;
            slice.getContext('2d').drawImage(canvas, 0, srcOffset, canvas.width, srcH, 0, 0, canvas.width, srcH);

            pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', margin, curY, contentWidth, destH);
            srcOffset += srcH;
            curY += destH + sectionGap;
          }
        } else {
          // Section fits on current page
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', margin, curY, contentWidth, scaledH);
          curY += scaledH + sectionGap;
        }
      }

      // Add footer to every page
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Cadence', margin, pageHeight - 10);
        pdf.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      const names = selectedArtists.map(a => a.name).join('-').replace(/\s+/g, '_');
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`Cadence-Report-${names}-${date}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [selectedArtists, exporting]);

  // --- Data generation from selected artists ---

  const comparisonData = useMemo(() =>
    selectedArtists.map(a => ({
      slug: a.slug,
      imageUrl: a.imageUrl,
      name: a.name,
      listeners: a.spotify.monthlyListeners,
      followers: a.spotify.followers,
      popularity: a.spotify.popularity,
      instagram: a.social.instagram,
      tiktok: a.social.tiktok,
      youtube: a.social.youtube,
      playlists: a.playlists.spotify.total,
    })),
  [selectedArtists]);

  const streamingData = useMemo(() => {
    if (selectedArtists.length === 0) return [];
    if (selectedArtists.length === 1) return generateStreamingTrend(selectedArtists[0]);
    const allData = selectedArtists.map(a => generateStreamingTrend(a));
    return allData[0].map((day, i) => ({
      date: day.date,
      spotify: allData.reduce((s, d) => s + d[i].spotify, 0),
      apple: allData.reduce((s, d) => s + d[i].apple, 0),
      youtube: allData.reduce((s, d) => s + d[i].youtube, 0),
      amazon: allData.reduce((s, d) => s + d[i].amazon, 0),
      tidal: allData.reduce((s, d) => s + d[i].tidal, 0),
    }));
  }, [selectedArtists]);

  const revenueData = useMemo(() => {
    if (selectedArtists.length === 0) return [];
    const allRevs = selectedArtists.map(a => generateRevenue(a));
    const totalAll = allRevs.reduce((s, r) => s + r.reduce((ss, rr) => ss + rr.amount, 0), 0);
    return allRevs[0].map((item, i) => {
      const amount = allRevs.reduce((s, r) => s + r[i].amount, 0);
      return {
        source: item.source,
        amount,
        percentage: totalAll > 0 ? Math.round(amount / totalAll * 100) : 0,
      };
    });
  }, [selectedArtists]);

  const totalRevenue = revenueData.reduce((s, r) => s + r.amount, 0);

  const socialData = useMemo(() => {
    if (selectedArtists.length === 0) return [];
    if (selectedArtists.length === 1) return generateSocialTimeline(selectedArtists[0]);
    const allData = selectedArtists.map(a => generateSocialTimeline(a));
    return allData[0].map((day, i) => ({
      date: day.date,
      tiktok: allData.reduce((s, d) => s + d[i].tiktok, 0),
      instagram: allData.reduce((s, d) => s + d[i].instagram, 0),
      twitter: allData.reduce((s, d) => s + d[i].twitter, 0),
      youtube: allData.reduce((s, d) => s + d[i].youtube, 0),
    }));
  }, [selectedArtists]);

  const geographyData = useMemo(() => {
    if (selectedArtists.length === 0) return [];
    const allCities = {};
    selectedArtists.forEach(a => {
      a.spotify.topCities.forEach(c => {
        const key = `${c.city}-${c.country}`;
        if (!allCities[key]) allCities[key] = { ...c, listeners: 0 };
        allCities[key].listeners += c.listeners;
      });
    });
    return Object.values(allCities).sort((a, b) => b.listeners - a.listeners);
  }, [selectedArtists]);

  const forecastData = useMemo(() => {
    if (selectedArtists.length === 0) return [];
    return generateForecast(selectedArtists[0]);
  }, [selectedArtists]);

  const benchmarkData = useMemo(() => {
    if (selectedArtists.length === 0) return null;
    return getBenchmarkComparison(selectedArtists[0]);
  }, [selectedArtists]);

  const playlistData = useMemo(() =>
    selectedArtists.map(a => ({
      slug: a.slug,
      name: a.name,
      editorial: a.playlists.spotify.editorial,
      total: a.playlists.spotify.total,
      reach: a.playlists.spotify.reach,
      editorialReach: a.playlists.spotify.editorialReach,
    })),
  [selectedArtists]);

  // Aggregate KPIs
  const totalListeners = selectedArtists.reduce((s, a) => s + a.spotify.monthlyListeners, 0);
  const totalFollowers = selectedArtists.reduce((s, a) => s + a.spotify.followers, 0);
  const totalPlaylists = selectedArtists.reduce((s, a) => s + a.playlists.spotify.total, 0);
  const totalReach = selectedArtists.reduce((s, a) => s + a.playlists.spotify.reach, 0);

  const artistNames = selectedArtists.map(a => a.name).join(', ');

  const widgetComponents = {
    'artist-comparison': () => (
      <ChartCard title="Artist Comparison" subtitle={`${selectedArtists.length} artist${selectedArtists.length !== 1 ? 's' : ''} selected`}>
        <DataTable columns={comparisonCols} data={comparisonData} />
      </ChartCard>
    ),
    'streaming-trends': () => (
      <ChartCard title="Streaming Trends" subtitle={`Combined daily streams (90 days) — ${artistNames}`}>
        <StreamingTrendChart data={streamingData} />
      </ChartCard>
    ),
    'revenue-breakdown': () => (
      <ChartCard title="Revenue Breakdown" subtitle={`Estimated annual: ${formatCurrency(totalRevenue)} — ${artistNames}`}>
        <RevenueDonutChart data={revenueData} totalRevenue={totalRevenue} />
      </ChartCard>
    ),
    'social-growth': () => (
      <ChartCard title="Social Growth" subtitle={`Combined follower trends (90 days) — ${artistNames}`}>
        <SocialGrowthChart data={socialData} />
      </ChartCard>
    ),
    'geography': () => (
      <ChartCard title="Geographic Distribution" subtitle={`Listeners by city — ${artistNames}`}>
        <GeographyHeatMap data={geographyData} />
      </ChartCard>
    ),
    'forecast': () => (
      <ChartCard title="Stream Forecast" subtitle={`${selectedArtists[0]?.name || 'Artist'} — 60-day actual + 30-day prediction`}>
        <ForecastChart data={forecastData} todayIndex={59} />
      </ChartCard>
    ),
    'playlists': () => (
      <ChartCard title="Playlist Performance" subtitle={`Spotify playlists — ${artistNames}`}>
        <DataTable columns={playlistCols} data={playlistData} />
      </ChartCard>
    ),
    'benchmarks': benchmarkData ? () => (
      <ChartCard title="Benchmark Radar" subtitle={`${selectedArtists[0]?.name || 'Artist'} vs roster average`}>
        <BenchmarkRadarChart
          artist={benchmarkData.artist}
          benchmark={benchmarkData.benchmark}
          dimensions={benchmarkData.dimensions}
          artistName={selectedArtists[0]?.name}
        />
      </ChartCard>
    ) : null,
  };

  const reportWidgets = (
    <>
      {selectedArtists.length === 0 ? (
        <div className="text-center py-20 text-[#6B6560]">
          <FileText size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select artists above to generate report data</p>
        </div>
      ) : selected.length === 0 ? (
        <div className="text-center py-20 text-[#6B6560]">
          <FileText size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select components from the left panel to build your report</p>
        </div>
      ) : (
        selected.map(id => {
          const WidgetComponent = widgetComponents[id];
          return WidgetComponent ? (
            <motion.div key={id} data-pdf-section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout>
              <WidgetComponent />
            </motion.div>
          ) : null;
        })
      )}
    </>
  );

  // ========== VIEW MODE (full-screen overlay) ==========
  if (viewMode && selectedArtists.length > 0) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div className="fixed inset-0 z-50 bg-[#0D0C0B] overflow-y-auto">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-[#0D0C0B]/90 backdrop-blur-md border-b border-[#2C2B28]">
          <div className="max-w-[1200px] mx-auto px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#DA7756] bg-[#DA7756]/10 px-2 py-0.5 rounded">Cadence</span>
              <span className="text-sm text-[#9B9590]">Report</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer
                  border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
              >
                {linkCopied ? <Check size={12} className="text-[#7BAF73]" /> : <Link2 size={12} />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer
                  border-[#DA7756]/20 bg-[#DA7756]/10 text-[#DA7756] hover:bg-[#DA7756]/20 disabled:opacity-50"
              >
                <Download size={12} />
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={() => setViewMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer
                  border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="p-1.5 text-[#6B6560] hover:text-[#9B9590] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div ref={reportRef} className="max-w-[1200px] mx-auto px-8 py-8 space-y-6">
          {/* Artist Header Banner */}
          <div data-pdf-section className="bg-[#171614] border border-[#2C2B28] rounded p-8">
            {/* Artist Images */}
            <div className="flex items-center justify-center gap-6 mb-6">
              {selectedArtists.map((a, i) => (
                <motion.div
                  key={a.slug}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt={a.name}
                      className="w-24 h-24 rounded object-cover border-2 border-[#2C2B28] mx-auto"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded bg-[#2C2B28] flex items-center justify-center mx-auto">
                      <span className="text-2xl text-[#6B6560]">{a.name[0]}</span>
                    </div>
                  )}
                  <p className="text-sm text-[#F5F0E8] mt-2 font-medium">{a.name}</p>
                  <p className="text-[10px] text-[#6B6560]">{a.genres?.primary?.name || 'Artist'}</p>
                </motion.div>
              ))}
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-light text-[#F5F0E8]">{reportName}</h1>
              <p className="text-xs text-[#6B6560] mt-1">{date} — Generated by Cadence</p>
            </div>

            {/* KPI Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Monthly Listeners', value: formatNumber(totalListeners) },
                { label: 'Spotify Followers', value: formatNumber(totalFollowers) },
                { label: 'Total Playlists', value: formatNumber(totalPlaylists) },
                { label: 'Playlist Reach', value: formatNumber(totalReach) },
              ].map((stat) => (
                <div key={stat.label} className="text-center py-3 bg-[#0D0C0B] rounded border border-[#2C2B28]">
                  <div className="text-lg font-mono text-[#F5F0E8]">{stat.value}</div>
                  <div className="text-[10px] text-[#6B6560] uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Widgets */}
          <div className="space-y-6">
            {reportWidgets}
          </div>
        </div>
      </div>
    );
  }

  // ========== EDIT MODE (default) ==========
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors mb-4">
          <ArrowLeft size={12} />
          All Reports
        </Link>
        <div className="flex items-center justify-between">
        <div>
          <input
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className="text-2xl font-light text-[#F5F0E8] bg-transparent outline-none border-b border-transparent hover:border-[#2C2B28] focus:border-[#DA7756]/30 transition-colors w-full"
            placeholder="Untitled Report"
          />
          <p className="text-xs text-[#9B9590] mt-1">Select artists and build custom reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded border transition-colors cursor-pointer
              border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]"
          >
            {linkCopied ? <Check size={14} className="text-[#7BAF73]" /> : <Link2 size={14} />}
            {linkCopied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => setViewMode(true)}
            disabled={selectedArtists.length === 0 || selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#DA7756]/10 text-[#DA7756] rounded text-sm hover:bg-[#DA7756]/20 transition-colors cursor-pointer border border-[#DA7756]/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Eye size={14} />
            Preview Report
          </button>
        </div>
        </div>
      </motion.div>

      {/* Artist Selector */}
      <div>
        <p className="text-xs text-[#9B9590] mb-2">Artists</p>
        <ArtistSelector selected={selectedArtists} onChange={setSelectedArtists} />
      </div>

      {/* KPI Summary */}
      {selectedArtists.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Monthly Listeners" value={totalListeners} index={0} />
          <KpiCard title="Spotify Followers" value={totalFollowers} index={1} />
          <KpiCard title="Total Playlists" value={totalPlaylists} index={2} />
          <KpiCard title="Playlist Reach" value={totalReach} index={3} />
        </div>
      )}

      <div className="flex gap-6">
        {/* Widget Picker */}
        <div className="w-56 shrink-0">
          <div className="sticky top-20 bg-[#171614] border border-[#2C2B28] rounded p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={14} className="text-[#9B9590]" />
              <span className="text-xs font-medium text-[#9B9590]">Components</span>
            </div>
            <WidgetPicker selected={selected} onToggle={toggleWidget} />
          </div>
        </div>

        {/* Report Canvas */}
        <div className="flex-1 space-y-6">
          {reportWidgets}
        </div>
      </div>
    </div>
  );
}
