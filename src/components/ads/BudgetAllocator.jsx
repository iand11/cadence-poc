import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Check } from 'lucide-react';
import { recommendBudgetAllocation } from '../../utils/budgetAllocation';
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

function formatCurrency(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BudgetAllocator({ artist, objective, totalBudget, connectedPlatforms, onAccept }) {
  const [customizing, setCustomizing] = useState(false);
  const [customPcts, setCustomPcts] = useState(null);

  const recommendation = useMemo(() => {
    return recommendBudgetAllocation(artist, objective, totalBudget, connectedPlatforms);
  }, [artist, objective, totalBudget, connectedPlatforms]);

  if (!recommendation.allocations.length || connectedPlatforms.length < 2) return null;

  const allocations = customPcts
    ? recommendation.allocations.map(a => ({
        ...a,
        percentage: customPcts[a.platform] ?? a.percentage,
        amount: Math.round(((customPcts[a.platform] ?? a.percentage) / 100) * totalBudget * 100) / 100,
      }))
    : recommendation.allocations;

  const handleCustomChange = (platform, value) => {
    const pct = Math.max(0, Math.min(100, parseInt(value) || 0));
    setCustomPcts(prev => ({ ...(prev || {}), [platform]: pct }));
  };

  const totalPct = allocations.reduce((s, a) => s + a.percentage, 0);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="border border-[#DA7756]/20 rounded-lg overflow-hidden"
    >
      <div className="p-3 bg-[#DA7756]/5 border-b border-[#DA7756]/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={12} className="text-[#DA7756]" />
          <span className="text-[10px] font-medium text-[#DA7756]">AI Budget Allocation</span>
        </div>
        <p className="text-[10px] text-[#9B9590]">{recommendation.summary}</p>
      </div>

      <div className="p-3 space-y-2.5">
        {allocations.map(a => {
          const color = COLOR_MAP[a.platform] || '#9B9590';
          return (
            <div key={a.platform} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#F5F0E8]">
                  {PLATFORM_LABELS[a.platform] || a.platform}
                </span>
                <div className="flex items-center gap-2">
                  {customizing ? (
                    <input
                      type="number"
                      value={customPcts?.[a.platform] ?? a.percentage}
                      onChange={e => handleCustomChange(a.platform, e.target.value)}
                      className="w-12 text-right text-[10px] font-mono bg-[#0D0C0B] border border-[#2C2B28] rounded px-1 py-0.5 text-[#F5F0E8]"
                      min={0}
                      max={100}
                    />
                  ) : (
                    <span className="text-[10px] font-mono" style={{ color }}>{a.percentage}%</span>
                  )}
                  <span className="text-[10px] font-mono text-[#6B6560]">{formatCurrency(a.amount)}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#0D0C0B] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${a.percentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <p className="text-[9px] text-[#6B6560]">{a.reason}</p>
            </div>
          );
        })}

        {/* Total check for custom mode */}
        {customizing && totalPct !== 100 && (
          <p className="text-[9px] text-[#C75F4F]">
            Total: {totalPct}% — must equal 100%
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onAccept(allocations)}
            disabled={customizing && totalPct !== 100}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            <Check size={10} />
            Accept Allocation
          </button>
          <button
            onClick={() => {
              if (customizing) {
                setCustomPcts(null);
              }
              setCustomizing(!customizing);
            }}
            className="text-[10px] font-medium text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
          >
            {customizing ? 'Reset' : 'Customize'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
