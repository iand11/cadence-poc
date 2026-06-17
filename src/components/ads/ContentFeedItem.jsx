import { Eye, Heart, MessageCircle, Share2, Clock, Zap, CheckCircle } from 'lucide-react';
import { PLATFORM_COLORS } from '../../constants/colors';

const PLATFORM_MAP = {
  instagram: { label: 'Instagram', color: PLATFORM_COLORS.instagram },
  tiktok: { label: 'TikTok', color: PLATFORM_COLORS.tiktok },
  youtube: { label: 'YouTube', color: PLATFORM_COLORS.youtube },
  twitter: { label: 'X', color: PLATFORM_COLORS.twitter },
};

// Map content platform → ads platform
const ADS_PLATFORM_MAP = {
  instagram: 'meta',
  youtube: 'youtube',
  tiktok: 'tiktok',
  twitter: 'x',
};

function formatCompact(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ContentFeedItem({ item, boostAnalysis, onBoost, selected }) {
  const plat = PLATFORM_MAP[item.platform] || { label: item.platform, color: '#9B9590' };
  const isBoost = boostAnalysis?.isBoostCandidate;

  return (
    <div className={`bg-[#171614] rounded-lg border relative ${
      selected ? 'border-[#DA7756] ring-1 ring-[#DA7756]/30' : isBoost ? 'border-[#7BAF73]/40' : 'border-[#2C2B28]'
    }`}>
      {/* Thumbnail */}
      {item.thumbnailUrl && (
        <div className="relative aspect-video bg-[#0D0C0B] overflow-hidden rounded-t-lg">
          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          {item.duration && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-mono text-white bg-black/70 px-1.5 py-0.5 rounded">
              <Clock size={8} />
              {formatDuration(item.duration)}
            </span>
          )}
          {/* Platform badge */}
          <span
            className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: plat.color, backgroundColor: plat.color + '20', border: `1px solid ${plat.color}40` }}
          >
            {plat.label}
          </span>
          {/* Boost badge */}
          {isBoost && (
            <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-mono text-[#7BAF73] bg-[#7BAF73]/15 border border-[#7BAF73]/30 px-1.5 py-0.5 rounded">
              <Zap size={8} />
              {boostAnalysis.viewsMultiplier > 1 ? `${boostAnalysis.viewsMultiplier}x views` : `${boostAnalysis.engagementMultiplier}x engagement`}
            </span>
          )}
        </div>
      )}

      {/* No thumbnail fallback with platform badge */}
      {!item.thumbnailUrl && (
        <div className="px-3 pt-3 flex items-center gap-1.5">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: plat.color, backgroundColor: plat.color + '20', border: `1px solid ${plat.color}40` }}
          >
            {plat.label}
          </span>
          {isBoost && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-[#7BAF73] bg-[#7BAF73]/15 border border-[#7BAF73]/30 px-1.5 py-0.5 rounded">
              <Zap size={8} />
              {boostAnalysis.viewsMultiplier > 1 ? `${boostAnalysis.viewsMultiplier}x` : `${boostAnalysis.engagementMultiplier}x`}
            </span>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Artist */}
        <div className="flex items-center gap-2">
          {item.artistImage && (
            <img src={item.artistImage} alt="" className="w-5 h-5 rounded-full object-cover" />
          )}
          <span className="text-[10px] font-medium text-[#9B9590]">{item.artistName}</span>
          <span className="text-[9px] font-mono text-[#6B6560] ml-auto">{timeAgo(item.publishedAt)}</span>
        </div>

        {/* Title/Caption */}
        <p className="text-[11px] text-[#F5F0E8] line-clamp-2 leading-relaxed">
          {item.title || 'Untitled'}
        </p>

        {/* Metrics row */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#6B6560]">
          {item.views > 0 && (
            <span className="flex items-center gap-0.5"><Eye size={9} /> {formatCompact(item.views)}</span>
          )}
          {item.likes > 0 && (
            <span className="flex items-center gap-0.5"><Heart size={9} /> {formatCompact(item.likes)}</span>
          )}
          {item.comments > 0 && (
            <span className="flex items-center gap-0.5"><MessageCircle size={9} /> {formatCompact(item.comments)}</span>
          )}
          {item.shares > 0 && (
            <span className="flex items-center gap-0.5"><Share2 size={9} /> {formatCompact(item.shares)}</span>
          )}
        </div>

        {/* Boost button */}
        {onBoost && ADS_PLATFORM_MAP[item.platform] && (
          <button
            onClick={() => onBoost(item)}
            className={`w-full flex items-center justify-center gap-1 text-[10px] font-medium py-1.5 rounded transition-colors cursor-pointer ${
              selected
                ? 'text-[#DA7756] border border-[#DA7756]/40 bg-[#DA7756]/10'
                : isBoost
                  ? 'text-[#7BAF73] border border-[#7BAF73]/30 hover:bg-[#7BAF73]/10'
                  : 'text-[#9B9590] border border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8]'
            }`}
          >
            {selected ? <><CheckCircle size={10} /> Selected</> : isBoost ? 'Boost This' : 'Boost'}
          </button>
        )}
      </div>
    </div>
  );
}
