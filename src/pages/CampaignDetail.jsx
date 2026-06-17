import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  ArrowLeft, DollarSign, MousePointerClick, TrendingDown, Music,
  Eye, Users, Headphones, Calendar, Target, MapPin, Megaphone, History,
  MessageSquare, ChevronDown, CheckCircle, XCircle, Wifi, WifiOff,
} from 'lucide-react';
import ChatInterface from '../components/ai/ChatInterface';
import KpiCard from '../components/shared/KpiCard';
import ChartCard from '../components/shared/ChartCard';
import OptimizationBanner from '../components/ads/OptimizationBanner';
import OptimizationRow from '../components/ads/OptimizationRow';
import { useDirectives } from '../hooks/useDirectives';
import { useOptimizations } from '../hooks/useOptimizations';
import { generateCampaignMetrics } from '../data/campaignMetrics';
import { detectOptimizations } from '../utils/campaignOptimizer';
import { STATUS_CONFIG, PLATFORM_LABELS, OBJECTIVE_LABELS } from '../data/directives';
import { PLATFORM_COLORS } from '../constants/colors';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../utils/chartTheme';
import { formatNumber, formatDate, formatDollar } from '../utils/formatters';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

const RESULT_ICONS = {
  streams: Headphones,
  followers: Users,
  views: Eye,
};

export default function CampaignDetail() {
  const { id } = useParams();
  const { directives, updateDirective } = useDirectives();
  const { applied, dismissedIds, applyOptimization, dismissOptimization } = useOptimizations();

  const directive = useMemo(() => directives.find(d => d.id === id), [directives, id]);

  // Live metrics from API for active campaigns, mock fallback otherwise
  const [metrics, setMetrics] = useState(null);
  const [platformStatus, setPlatformStatus] = useState(null);
  const [metricsSource, setMetricsSource] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!directive) { setMetrics(null); return; }

    // For demo: use mock metrics for any campaign with a start date in the past
    const started = directive.schedule?.startDate && directive.schedule.startDate <= new Date().toISOString().split('T')[0];
    if (started || ['active', 'executing', 'completed'].includes(directive.status)) {
      setMetrics(generateCampaignMetrics({ ...directive, status: directive.status === 'draft' ? 'active' : directive.status }));
      setMetricsSource('simulated');
      setPlatformStatus({ exists: true, status: 'ENABLED', effectiveStatus: 'ELIGIBLE' });
      setMetricsLoading(false);
    } else {
      setMetrics(generateCampaignMetrics(directive));
      setMetricsSource(null);
      setPlatformStatus(null);
    }
  }, [directive?.status, directive?.id, id]);

  // Optimizations for this campaign's artist (same-artist cross-platform)
  const optimizations = useMemo(() => {
    if (!directive || !['active', 'executing'].includes(directive.status)) return [];
    const sameArtist = directives.filter(d =>
      d.artistSlug === directive.artistSlug && ['active', 'executing'].includes(d.status)
    );
    if (sameArtist.length < 2) return [];
    const withMetrics = sameArtist.map(d => ({
      directive: d,
      metrics: { totals: generateCampaignMetrics(d)?.totals },
    }));
    return detectOptimizations(withMetrics).filter(o => !dismissedIds.has(o.id));
  }, [directive, directives, dismissedIds]);

  // Optimization history for this campaign
  const optimizationHistory = useMemo(() => {
    if (!directive) return [];
    return applied.filter(a =>
      a.fromCampaign?.id === directive.id || a.toCampaign?.id === directive.id
    );
  }, [applied, directive]);

  const [chatOpen, setChatOpen] = useState(false);

  const totals = metrics?.totals || null;

  // Build campaign context for chat
  const campaignContext = useMemo(() => {
    if (!directive) return '';
    const lines = [
      `Campaign: ${PLATFORM_LABELS[directive.platform] || directive.platform} ${OBJECTIVE_LABELS[directive.objective] || directive.objective}`,
      `Artist: ${directive.artistName || directive.artistSlug}`,
      `Status: ${STATUS_CONFIG[directive.status]?.label || directive.status}`,
      `Budget: ${formatDollar(directive.budget?.amount || 0)} / ${directive.budget?.period || 'campaign'}`,
      `Schedule: ${directive.schedule?.startDate || '?'} → ${directive.schedule?.endDate || '?'}`,
    ];
    if (directive.rationale) lines.push(`Rationale: ${directive.rationale}`);
    if (totals) {
      lines.push('', 'Performance:');
      lines.push(`  Spend: ${formatDollar(totals.spend)} of ${formatDollar(totals.budget)} (${totals.budgetUsedPercent}%)`);
      lines.push(`  Days: ${totals.daysElapsed} elapsed, ${totals.daysRemaining} remaining of ${totals.daysTotal}`);
      lines.push(`  Impressions: ${formatNumber(totals.impressions)}`);
      lines.push(`  Clicks: ${formatNumber(totals.clicks)}`);
      lines.push(`  ${metrics?.resultLabel || 'Results'}: ${formatNumber(totals.results)}`);
      lines.push(`  Cost per result: $${totals.costPerResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      lines.push(`  CTR: ${totals.avgCTR}%`);
    }
    if (directive.audience) {
      const aud = directive.audience;
      if (aud.locations?.length) lines.push(`Locations: ${aud.locations.join(', ')}`);
      if (aud.ageRange) lines.push(`Age: ${aud.ageRange[0]}–${aud.ageRange[1]}`);
    }
    if (optimizationHistory.length > 0) {
      lines.push('', `Optimization history: ${optimizationHistory.length} applied`);
    }
    return lines.join('\n');
  }, [directive, totals, metrics, optimizationHistory]);

  if (!directive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Megaphone size={24} className="text-[#6B6560] mb-3" />
        <p className="text-sm text-[#F5F0E8] mb-1">Campaign not found</p>
        <Link to="/app/ads" className="text-[10px] font-mono text-[#DA7756] hover:underline mt-2">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[directive.status] || STATUS_CONFIG.draft;
  const platformColor = PLATFORM_COLOR_MAP[directive.platform] || '#9B9590';
  const ResultIcon = RESULT_ICONS[metrics?.resultType] || Target;
  const hasData = metrics?.daily?.length > 0;

  // Daily budget target for reference line
  const dailyBudgetTarget = totals ? totals.budget / totals.daysTotal : 0;

  // Funnel data
  const funnelData = totals ? [
    { name: 'Impressions', value: totals.impressions, fill: CHART_COLORS[0] },
    { name: 'Clicks', value: totals.clicks, fill: CHART_COLORS[2] },
    { name: metrics?.resultLabel || 'Results', value: totals.results, fill: CHART_COLORS[3] },
  ] : [];

  const chatWelcome = `I'm Cadence. I have full context on this ${PLATFORM_LABELS[directive.platform] || directive.platform} ${OBJECTIVE_LABELS[directive.objective] || directive.objective} campaign for ${directive.artistName || directive.artistSlug}. Ask me anything about performance, optimization, or next steps.`;

  const chatSuggestions = [
    'How is this campaign performing?',
    'Should I adjust the budget?',
    "What's driving the cost per result?",
    'Suggest optimizations for this campaign',
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Back link */}
      <Link
        to="/app/ads"
        className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#9B9590] transition-colors mb-4"
      >
        <ArrowLeft size={11} />
        Back to campaigns
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {directive.artistImage ? (
          <img src={directive.artistImage} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
            <Music size={18} className="text-[#6B6560]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium text-[#F5F0E8] truncate">
            {directive.artistName || directive.artistSlug}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: platformColor, backgroundColor: platformColor + '15', border: `1px solid ${platformColor}30` }}
            >
              {PLATFORM_LABELS[directive.platform]}
            </span>
            <span className="text-[9px] font-mono text-[#6B6560]">
              {OBJECTIVE_LABELS[directive.objective] || directive.objective}
            </span>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded-full"
              style={{ color: statusCfg.color, backgroundColor: statusCfg.color + '15', border: `1px solid ${statusCfg.color}30` }}
            >
              {statusCfg.label}
            </span>
          </div>
          {directive.rationale && (
            <p className="text-[10px] text-[#6B6560] mt-1.5 line-clamp-2">{directive.rationale}</p>
          )}
        </div>
      </div>


      {/* Budget Pacing Bar */}
      {hasData && totals && (
        <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-[#9B9590]">Budget Pacing</span>
            <span className="text-[10px] font-mono text-[#6B6560]">
              {totals.daysElapsed} of {totals.daysTotal} days · {totals.daysRemaining} remaining
            </span>
          </div>
          <div className="w-full h-2 bg-[#2C2B28] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, totals.budgetUsedPercent)}%`,
                backgroundColor: totals.budgetUsedPercent > 90 ? '#C75F4F' : totals.budgetUsedPercent > 70 ? '#D4A574' : '#7BAF73',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-[#F5F0E8]">
              {formatDollar(totals.spend)} spent
            </span>
            <span className="text-[10px] font-mono text-[#6B6560]">
              {formatDollar(totals.budget)} budget · {totals.budgetUsedPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Optimization Banners */}
      {optimizations.length > 0 && (
        <div className="space-y-2 mb-4">
          <AnimatePresence>
            {optimizations.map(opt => (
              <OptimizationBanner
                key={opt.id}
                suggestion={opt}
                onApply={(s) => applyOptimization(s, updateDirective)}
                onDismiss={dismissOptimization}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* KPI Row */}
      {hasData && totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            title="Total Spend"
            value={totals.spend}
            prefix="$"
            icon={DollarSign}
            index={0}
            delta={`${totals.budgetUsedPercent}% of budget`}
          />
          <KpiCard
            title={metrics.resultLabel}
            value={totals.results}
            icon={ResultIcon}
            index={1}
          />
          <KpiCard
            title={`Cost / ${metrics.resultLabel.replace(/s$/, '')}`}
            value={totals.costPerResult}
            prefix="$"
            icon={TrendingDown}
            index={2}
          />
          <KpiCard
            title="Avg. CTR"
            value={totals.avgCTR}
            suffix="%"
            icon={MousePointerClick}
            index={3}
          />
        </div>
      )}

      {/* Daily Spend Chart */}
      {hasData && (
        <ChartCard title="Daily Spend" subtitle="Budget pacing over campaign duration" className="mb-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={metrics.daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DA7756" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#DA7756" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} interval={Math.max(0, Math.floor(metrics.daily.length / 7))} />
              <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${v}`} width={50} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, '']}
                labelFormatter={formatDate}
              />
              <ReferenceLine
                y={dailyBudgetTarget}
                stroke="#6B6560"
                strokeDasharray="4 4"
                label={{ value: 'Target', position: 'right', fill: '#6B6560', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                name="Daily Spend"
                stroke="#DA7756"
                fill="url(#spendGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Daily Results Chart */}
      {hasData && (
        <ChartCard title={`Daily ${metrics.resultLabel}`} subtitle={`${metrics.resultLabel} driven by this campaign`} className="mb-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={metrics.daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="resultsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={platformColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={platformColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} interval={Math.max(0, Math.floor(metrics.daily.length / 7))} />
              <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value) => [formatNumber(value), '']}
                labelFormatter={formatDate}
              />
              <Area
                type="monotone"
                dataKey="results"
                name={metrics.resultLabel}
                stroke={platformColor}
                fill="url(#resultsGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Performance Funnel */}
      {hasData && funnelData.length > 0 && (
        <ChartCard title="Performance Funnel" subtitle="Impressions → Clicks → Conversions" className="mb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
              <CartesianGrid {...GRID_STYLE} horizontal={false} />
              <XAxis type="number" {...AXIS_STYLE} tickFormatter={formatNumber} />
              <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={90} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value) => [formatNumber(value), '']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                {funnelData.map((entry, i) => (
                  <motion.rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Campaign Details */}
      <div className="bg-[#171614] border border-[#2C2B28] rounded p-4">
        <h3 className="text-xs font-medium text-[#F5F0E8] mb-3">Campaign Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <DetailRow icon={DollarSign} label="Budget" value={`${formatDollar(directive.budget.amount)} / ${directive.budget.period}`} />
          <DetailRow icon={Calendar} label="Schedule" value={`${directive.schedule.startDate} → ${directive.schedule.endDate}`} />
          <DetailRow icon={Target} label="Objective" value={OBJECTIVE_LABELS[directive.objective] || directive.objective} />
          {directive.creative?.type && (
            <DetailRow icon={Eye} label="Creative" value={`${directive.creative.type}${directive.creative.headline ? ` — "${directive.creative.headline}"` : ''}`} />
          )}
          {directive.audience?.locations?.length > 0 && (
            <DetailRow icon={MapPin} label="Locations" value={directive.audience.locations.join(', ')} />
          )}
          {directive.audience?.ageRange && (
            <DetailRow icon={Users} label="Age Range" value={`${directive.audience.ageRange[0]}–${directive.audience.ageRange[1]}`} />
          )}
          {directive.result?.campaignId && (
            <DetailRow icon={Megaphone} label="Campaign ID" value={directive.result.campaignId} />
          )}
        </div>
      </div>

      {/* Optimization History */}
      {optimizationHistory.length > 0 && (
        <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <History size={12} className="text-[#6B6560]" />
            <h3 className="text-xs font-medium text-[#F5F0E8]">Optimization History</h3>
          </div>
          {optimizationHistory.map((record, i) => (
            <OptimizationRow key={i} record={record} />
          ))}
        </div>
      )}

      {/* No data state for non-active campaigns */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-12 text-center mt-4">
          <div className="w-10 h-10 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center mb-3">
            <Megaphone size={16} className="text-[#DA7756]" />
          </div>
          <p className="text-xs text-[#9B9590]">
            {directive.status === 'draft' || directive.status === 'pending_approval'
              ? 'Campaign has not been launched yet. Tracking data will appear once the campaign is active.'
              : 'No tracking data available for this campaign.'}
          </p>
        </div>
      )}

      {/* Campaign Chat */}
      <div className="mt-4">
        <button
          onClick={() => setChatOpen(o => !o)}
          className="w-full flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-4 py-3 hover:border-[#3D3B37] transition-colors cursor-pointer"
        >
          <MessageSquare size={14} className="text-[#DA7756]" />
          <span className="text-xs font-medium text-[#F5F0E8]">Campaign Assistant</span>
          <span className="text-[9px] font-mono text-[#6B6560] ml-1">Ask questions about this campaign</span>
          <ChevronDown
            size={12}
            className={`text-[#6B6560] ml-auto transition-transform ${chatOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 500, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <ChatInterface
                campaignContext={campaignContext}
                welcomeMessage={chatWelcome}
                suggestions={chatSuggestions}
                placeholder="ask about this campaign > "
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={11} className="text-[#6B6560] shrink-0" />
      <span className="text-[10px] font-mono text-[#6B6560] w-20 shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-[#9B9590] truncate">{value}</span>
    </div>
  );
}
