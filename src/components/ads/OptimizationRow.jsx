import { ArrowRight, Check } from 'lucide-react';
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OptimizationRow({ record }) {
  const fromColor = COLOR_MAP[record.fromPlatform] || '#9B9590';
  const toColor = COLOR_MAP[record.toPlatform] || '#9B9590';

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#2C2B28] last:border-0">
      <div className="w-5 h-5 rounded-full bg-[#7BAF73]/15 flex items-center justify-center shrink-0">
        <Check size={10} className="text-[#7BAF73]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="font-mono" style={{ color: fromColor }}>{PLATFORM_LABELS[record.fromPlatform] || record.fromPlatform}</span>
          <ArrowRight size={9} className="text-[#6B6560]" />
          <span className="font-mono" style={{ color: toColor }}>{PLATFORM_LABELS[record.toPlatform] || record.toPlatform}</span>
          <span className="text-[#6B6560] font-mono ml-1">${record.shiftAmount}</span>
        </div>
        <p className="text-[9px] text-[#6B6560] truncate">{record.message}</p>
      </div>
      <span className="text-[9px] font-mono text-[#6B6560] shrink-0">{formatDate(record.appliedAt)}</span>
    </div>
  );
}
