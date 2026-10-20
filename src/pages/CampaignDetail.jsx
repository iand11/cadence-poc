import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, DollarSign, Music, Eye, Users, Calendar, Target, MapPin,
  Megaphone, History, MessageSquare, ChevronDown,
} from 'lucide-react';
import ChatInterface from '../components/ai/ChatInterface';
import OptimizationRow from '../components/ads/OptimizationRow';
import MetaCampaignPanel from '../components/ads/MetaCampaignPanel';
import StreamCountsPanel from '../components/ads/StreamCountsPanel';
import FollowersPanel from '../components/ads/FollowersPanel';
import { smartLinkSlug, FOLLOWER_TRACKING } from '../data/streamCounts';
import { useDirectives } from '../hooks/useDirectives';
import { useOptimizations } from '../hooks/useOptimizations';
import { useCampaignReports } from '../hooks/useCampaignReports';
import { STATUS_CONFIG, PLATFORM_LABELS, OBJECTIVE_LABELS } from '../data/directives';
import { PLATFORM_COLORS } from '../constants/colors';
import { formatNumber, formatDollar } from '../utils/formatters';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

export default function CampaignDetail() {
  const { id } = useParams();
  const { directives, updateDirective, loading: directivesLoading } = useDirectives();
  const { applied } = useOptimizations();

  const directive = useMemo(() => directives.find(d => d.id === id), [directives, id]);

  // Real delivery metrics (Meta reports them); other platforms have none
  const single = useMemo(() => (directive ? [directive] : []), [directive]);
  const { metricsById } = useCampaignReports(single);
  const metrics = directive ? metricsById[directive.id] || null : null;

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
      if (totals.daysTotal) lines.push(`  Days: ${totals.daysElapsed} elapsed, ${totals.daysRemaining} remaining of ${totals.daysTotal}`);
      lines.push(`  Impressions: ${formatNumber(totals.impressions)}`);
      lines.push(`  ${metrics?.resultLabel || 'Results'}: ${formatNumber(totals.results)}`);
      lines.push(`  Cost per link click: $${totals.costPerResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      lines.push(`  Link CTR: ${totals.avgCTR}%`);
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

  if (!directive && directivesLoading) {
    return <p className="py-20 text-center text-[10px] font-mono text-[#6B6560]">Loading campaign…</p>;
  }

  if (!directive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Megaphone size={24} className="text-[#6B6560] mb-3" />
        <p className="text-sm text-[#F5F0E8] mb-1">Campaign not found</p>
        <Link to="/app/campaigns" className="text-[10px] font-mono text-[#DA7756] hover:underline mt-2">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[directive.status] || STATUS_CONFIG.draft;
  const platformColor = PLATFORM_COLOR_MAP[directive.platform] || '#9B9590';
  const chatWelcome = `I'm Prelude. I have full context on this ${PLATFORM_LABELS[directive.platform] || directive.platform} ${OBJECTIVE_LABELS[directive.objective] || directive.objective} campaign for ${directive.artistName || directive.artistSlug}. Ask me anything about performance, optimization, or next steps.`;

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
        to="/app/campaigns"
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


      {/* Results summary first; details expand underneath */}
      {directive.platformCampaignId && directive.platform === 'meta' && (
        <MetaCampaignPanel directive={directive} updateDirective={updateDirective} />
      )}

      {/* Streams per service, before the campaign and each day of it */}
      {(directive.streamTrackerId || directive.goal === 'streams' || smartLinkSlug(directive.creative?.trackUrl)) && (
        <StreamCountsPanel directive={directive} updateDirective={updateDirective} />
      )}

      {/* Instagram / TikTok followers and YouTube subscribers, before the campaign and each day of it */}
      {FOLLOWER_TRACKING && <FollowersPanel directive={directive} updateDirective={updateDirective} />}

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

      {/* Only campaigns running on Meta have delivery reporting */}
      {!directive.platformCampaignId && (
        <div className="flex flex-col items-center justify-center py-12 text-center mt-4">
          <div className="w-10 h-10 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center mb-3">
            <Megaphone size={16} className="text-[#DA7756]" />
          </div>
          <p className="text-xs text-[#9B9590]">
            {directive.status === 'draft' || directive.status === 'pending_approval'
              ? 'Campaign has not been launched yet. Delivery data will appear once it is running.'
              : directive.platform === 'meta'
                ? 'This campaign was not launched on Meta, so there is no delivery data.'
                : `Prelude doesn't report ${PLATFORM_LABELS[directive.platform] || directive.platform} delivery yet, so there is no data for this campaign.`}
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
