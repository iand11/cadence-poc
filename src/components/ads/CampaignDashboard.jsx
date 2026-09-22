import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AnimatePresence } from 'motion/react';
import { DollarSign, Megaphone, TrendingDown, Award, TrendingUp } from 'lucide-react';
import KpiCard from '../shared/KpiCard';
import ChartCard from '../shared/ChartCard';
import OptimizationBanner from './OptimizationBanner';
import { aggregateCampaignMetrics } from '../../data/campaignMetrics';
import { detectOptimizations } from '../../utils/campaignOptimizer';
import { useOptimizations } from '../../hooks/useOptimizations';
import { PLATFORM_LABELS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber, formatCurrency, formatDate, formatDollar } from '../../utils/formatters';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

export default function CampaignDashboard({ directives, updateDirective }) {
  const agg = useMemo(() => aggregateCampaignMetrics(directives), [directives]);
  const { dismissedIds, applyOptimization, dismissOptimization } = useOptimizations();
  const [alignByDay, setAlignByDay] = useState(true);

  // Detect optimization opportunities
  const optimizations = useMemo(() => {
    const campaignsWithMetrics = agg.campaigns.map(c => ({
      directive: c.directive,
      metrics: c,
    }));
    return detectOptimizations(campaignsWithMetrics).filter(o => !dismissedIds.has(o.id));
  }, [agg.campaigns, dismissedIds]);

  if (!agg.totals || agg.campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-10 h-10 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center mb-3">
          <Megaphone size={16} className="text-[#DA7756]" />
        </div>
        <p className="text-xs text-[#9B9590]">
          No active or completed campaigns to display. Launch a campaign to see tracking data here.
        </p>
      </div>
    );
  }

  const { totals, dailyTotal, dayAlignedTotal, platformBreakdown, campaigns } = agg;

  // Timeline data: either by calendar date or aligned to each campaign's Day 1.
  const timelineData = alignByDay ? dayAlignedTotal : dailyTotal;
  const timelineKey = alignByDay ? 'day' : 'date';
  const timelineTickFormatter = alignByDay ? (v) => `Day ${v}` : formatDate;
  const timelineLabelFormatter = alignByDay ? (v) => `Day ${v}` : formatDate;

  // Budget allocation donut data
  const budgetAllocation = platformBreakdown.map(p => ({
    name: PLATFORM_LABELS[p.platform] || p.platform,
    value: p.budget,
    platform: p.platform,
  }));

  // Campaign legend for spend timeline
  const campaignEntries = campaigns.map((c, i) => ({
    id: c.directive.id,
    name: `${c.directive.artistName || c.directive.artistSlug} · ${PLATFORM_LABELS[c.directive.platform]}`,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Total Spend"
          value={totals.spend}
          prefix="$"
          icon={DollarSign}
          index={0}
        />
        <KpiCard
          title="Active Campaigns"
          value={totals.activeCampaigns}
          icon={Megaphone}
          index={1}
        />
        <KpiCard
          title="Avg. Cost / Result"
          value={totals.avgCostPerResult}
          prefix="$"
          icon={TrendingDown}
          index={2}
        />
        <KpiCard
          title="Best Platform"
          value={totals.bestPlatform ? (PLATFORM_LABELS[totals.bestPlatform] || totals.bestPlatform) : '—'}
          icon={Award}
          index={3}
          delta={totals.bestPlatform ? `$${Number(platformBreakdown.find(p => p.platform === totals.bestPlatform)?.costPerResult || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CPR` : undefined}
        />
      </div>

      {/* Optimization Banners */}
      {optimizations.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-[#DA7756]" />
            <span className="text-[10px] font-medium text-[#DA7756]">
              {optimizations.length} optimization{optimizations.length !== 1 ? 's' : ''} available
            </span>
          </div>
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

      {/* Spend Timeline */}
      {timelineData.length > 0 && (
        <ChartCard
          title="Spend Timeline"
          subtitle={alignByDay ? 'Daily spend aligned to each campaign’s Day 1' : 'Daily spend across all campaigns'}
          className="mb-4"
          action={
            <div className="flex items-center gap-0.5 rounded-md border border-[#2A2724] bg-[#0D0C0B] p-0.5">
              <button
                type="button"
                onClick={() => setAlignByDay(false)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${!alignByDay ? 'bg-[#DA7756] text-[#0D0C0B] font-medium' : 'text-[#9B9590] hover:text-[#F5F0E8]'}`}
              >
                Calendar date
              </button>
              <button
                type="button"
                onClick={() => setAlignByDay(true)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${alignByDay ? 'bg-[#DA7756] text-[#0D0C0B] font-medium' : 'text-[#9B9590] hover:text-[#F5F0E8]'}`}
              >
                Day 1 aligned
              </button>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                {campaignEntries.map(c => (
                  <linearGradient key={c.id} id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.color} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey={timelineKey} {...AXIS_STYLE} tickFormatter={timelineTickFormatter} interval={Math.max(0, Math.floor(timelineData.length / 7))} />
              <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${v}`} width={50} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name) => {
                  const entry = campaignEntries.find(c => c.id === name);
                  return [`$${Number(value).toFixed(2)}`, entry?.name || 'Total'];
                }}
                labelFormatter={timelineLabelFormatter}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: '#9B9590' }}
                formatter={(value) => {
                  const entry = campaignEntries.find(c => c.id === value);
                  return entry?.name || value;
                }}
              />
              {campaignEntries.map(c => (
                <Area
                  key={c.id}
                  type="monotone"
                  dataKey={c.id}
                  name={c.id}
                  stroke={c.color}
                  fill={`url(#grad-${c.id})`}
                  strokeWidth={2}
                  stackId="1"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Platform ROI Comparison */}
        {platformBreakdown.length > 0 && (
          <ChartCard title="Platform ROI" subtitle="Cost per result by platform">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformBreakdown} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  dataKey="platform"
                  {...AXIS_STYLE}
                  tickFormatter={(p) => PLATFORM_LABELS[p] || p}
                />
                <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${v}`} width={45} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost / Result']}
                  labelFormatter={(p) => PLATFORM_LABELS[p] || p}
                />
                <Bar dataKey="costPerResult" radius={[4, 4, 0, 0]} barSize={36}>
                  {platformBreakdown.map((entry) => (
                    <Cell key={entry.platform} fill={PLATFORM_COLOR_MAP[entry.platform] || CHART_COLORS[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Budget Allocation Donut */}
        {budgetAllocation.length > 0 && (
          <ChartCard title="Budget Allocation" subtitle="Spend distribution by platform">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={budgetAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {budgetAllocation.map((entry) => (
                    <Cell key={entry.platform} fill={PLATFORM_COLOR_MAP[entry.platform] || CHART_COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(value) => [formatCurrency(value), '']}
                />
                <text x="50%" y="46%" textAnchor="middle" fill="#F5F0E8" fontSize={20} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
                  {formatCurrency(totals.budget)}
                </text>
                <text x="50%" y="57%" textAnchor="middle" fill="#9B9590" fontSize={10} fontFamily="'JetBrains Mono', monospace">
                  Total Budget
                </text>
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Per-platform summary table */}
      {platformBreakdown.length > 0 && (
        <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mt-4">
          <h3 className="text-xs font-medium text-[#F5F0E8] mb-3">Platform Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-[#6B6560] border-b border-[#2C2B28]">
                  <th className="text-left py-2 pr-4">Platform</th>
                  <th className="text-right py-2 px-3">Campaigns</th>
                  <th className="text-right py-2 px-3">Spend</th>
                  <th className="text-right py-2 px-3">Impressions</th>
                  <th className="text-right py-2 px-3">Clicks</th>
                  <th className="text-right py-2 px-3">CTR</th>
                  <th className="text-right py-2 px-3">Results</th>
                  <th className="text-right py-2 pl-3">CPR</th>
                </tr>
              </thead>
              <tbody>
                {platformBreakdown.map(p => (
                  <tr key={p.platform} className="text-[#9B9590] border-b border-[#2C2B28]/50">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLOR_MAP[p.platform] }} />
                        {PLATFORM_LABELS[p.platform]}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">{p.campaigns}</td>
                    <td className="text-right py-2 px-3 text-[#F5F0E8]">{formatDollar(p.spend)}</td>
                    <td className="text-right py-2 px-3">{formatNumber(p.impressions)}</td>
                    <td className="text-right py-2 px-3">{formatNumber(p.clicks)}</td>
                    <td className="text-right py-2 px-3">{p.ctr.toFixed(1)}%</td>
                    <td className="text-right py-2 px-3 text-[#F5F0E8]">{formatNumber(p.results)}</td>
                    <td className="text-right py-2 pl-3 text-[#DA7756]">${p.costPerResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
