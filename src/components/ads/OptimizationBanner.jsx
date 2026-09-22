import { motion } from 'motion/react';
import { ArrowRight, Check, X, TrendingUp } from 'lucide-react';
import { PLATFORM_LABELS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';

const COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

function PlatformBadge({ platform }) {
  const color = COLOR_MAP[platform] || '#9B9590';
  return (
    <span
      className="text-[9px] font-mono px-1.5 py-0.5 rounded"
      style={{ color, backgroundColor: color + '15', border: `1px solid ${color}30` }}
    >
      {PLATFORM_LABELS[platform] || platform}
    </span>
  );
}

export default function OptimizationBanner({ suggestion, onApply, onDismiss }) {
  const impactColor = suggestion.impact === 'high'
    ? '#C75F4F'
    : suggestion.impact === 'medium'
      ? '#DA7756'
      : '#9B9590';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-[#171614] border-l-2 rounded-lg p-4"
      style={{ borderColor: impactColor }}
    >
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: impactColor + '15' }}>
          <TrendingUp size={13} style={{ color: impactColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-[#F5F0E8]">Optimization Opportunity</span>
            <span
              className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{ color: impactColor, backgroundColor: impactColor + '15' }}
            >
              {suggestion.impact} impact
            </span>
          </div>
          <p className="text-[11px] text-[#9B9590] mb-2.5">{suggestion.message}</p>

          {/* Platform arrow visualization */}
          <div className="flex items-center gap-2 mb-3">
            <PlatformBadge platform={suggestion.fromPlatform} />
            <div className="flex items-center gap-1 text-[#6B6560]">
              <span className="text-[9px] font-mono">${suggestion.shiftAmount}</span>
              <ArrowRight size={10} />
            </div>
            <PlatformBadge platform={suggestion.toPlatform} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onApply(suggestion)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors cursor-pointer"
            >
              <Check size={10} />
              Apply Reallocation
            </button>
            <button
              onClick={() => onDismiss(suggestion.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
            >
              <X size={10} />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
