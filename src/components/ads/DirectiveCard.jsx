import { useMemo } from 'react';
import { Music, Calendar, DollarSign, CheckCircle, XCircle, Play, Pencil, Trash2, Clock, Zap, ExternalLink } from 'lucide-react';
import { STATUS_CONFIG, PLATFORM_LABELS, OBJECTIVE_LABELS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';
import { generateCampaignMetrics } from '../../data/campaignMetrics';
import { formatDollar } from '../../utils/formatters';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

export default function DirectiveCard({
  directive,
  onEdit,
  onApprove,
  onReject,
  onExecute,
  onDelete,
  onSubmitForApproval,
  onClick,
}) {
  const statusCfg = STATUS_CONFIG[directive.status] || STATUS_CONFIG.draft;
  const platformColor = PLATFORM_COLOR_MAP[directive.platform] || '#9B9590';
  const isDraft = directive.status === 'draft';
  const isPending = directive.status === 'pending_approval';
  const isApproved = directive.status === 'approved';
  const isExecuting = directive.status === 'executing';
  const isActive = directive.status === 'active';
  const isFailed = directive.status === 'failed';
  const isClickable = !!onClick;

  const metrics = useMemo(() => {
    if (isActive || directive.status === 'completed') {
      return generateCampaignMetrics(directive);
    }
    return null;
  }, [directive, isActive]);

  const pacing = metrics?.totals;

  return (
    <div
      className={`bg-[#171614] border border-[#2C2B28] rounded overflow-hidden hover:border-[#3D3B37] transition-colors ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={isClickable ? onClick : undefined}
    >
      {/* Top bar with platform color */}
      <div className="h-1" style={{ backgroundColor: platformColor }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {directive.artistImage ? (
            <img src={directive.artistImage} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
              <Music size={14} className="text-[#6B6560]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#F5F0E8] truncate">{directive.artistName || directive.artistSlug}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: platformColor, backgroundColor: platformColor + '15', border: `1px solid ${platformColor}30` }}>
                {PLATFORM_LABELS[directive.platform]}
              </span>
              <span className="text-[9px] font-mono text-[#6B6560]">
                {OBJECTIVE_LABELS[directive.objective] || directive.objective}
              </span>
            </div>
          </div>
          {/* Status badge */}
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.color + '15', border: `1px solid ${statusCfg.color}30` }}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Budget + Schedule */}
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1 text-[10px] text-[#9B9590]">
            <DollarSign size={10} />
            <span className="font-mono">{formatDollar(directive.budget.amount)}</span>
            <span className="text-[#6B6560]">/ {directive.budget.period}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#9B9590]">
            <Calendar size={10} />
            <span className="font-mono">{directive.schedule.startDate} → {directive.schedule.endDate}</span>
          </div>
        </div>

        {/* Rationale */}
        {directive.rationale && (
          <p className="text-[10px] text-[#6B6560] leading-relaxed line-clamp-2 mb-3">
            {directive.rationale}
          </p>
        )}

        {/* Result info */}
        {(isActive || directive.status === 'completed') && directive.result?.campaignId && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#7BAF73] mb-3">
            <CheckCircle size={10} />
            Campaign ID: {directive.result.campaignId}
          </div>
        )}
        {isFailed && directive.result?.error && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#C75F4F] mb-3">
            <XCircle size={10} />
            {directive.result.error}
          </div>
        )}

        {/* Mini pacing bar for active/completed campaigns */}
        {pacing && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-[#6B6560]">
                {formatDollar(pacing.spend)} / {formatDollar(pacing.budget)}
              </span>
              <span className="text-[9px] font-mono text-[#6B6560]">
                {pacing.budgetUsedPercent}%
              </span>
            </div>
            <div className="w-full h-1 bg-[#2C2B28] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, pacing.budgetUsedPercent)}%`,
                  backgroundColor: pacing.budgetUsedPercent > 90 ? '#C75F4F' : '#7BAF73',
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#2C2B28]">
          {(isDraft || isPending || isApproved) && (
            <>
              <button
                onClick={() => onExecute?.(directive.id)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-3 py-1.5 transition-colors cursor-pointer"
              >
                <Zap size={10} />
                Execute Campaign
              </button>
              <button
                onClick={() => onEdit?.(directive)}
                className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
              >
                <Pencil size={10} />
                Edit
              </button>
              <button
                onClick={() => onDelete?.(directive.id)}
                className="flex items-center gap-1 text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer ml-auto"
              >
                <Trash2 size={10} />
              </button>
            </>
          )}
          {isExecuting && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#DA7756]">
              <Play size={10} className="animate-pulse" />
              Executing...
            </span>
          )}
          {isFailed && (
            <button
              onClick={() => onEdit?.(directive)}
              className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
            >
              <Pencil size={10} />
              Edit & Retry
            </button>
          )}
          {isClickable && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#DA7756] ml-auto">
              <ExternalLink size={10} />
              View Details
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
