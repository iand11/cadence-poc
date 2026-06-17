import { motion } from 'motion/react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { PLATFORM_LABELS, PLATFORM_CONSTRAINTS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';

const PLATFORM_KEYS = ['spotify', 'meta', 'google', 'tiktok', 'x'];

const ENV_VAR_NAMES = {
  spotify: 'SPOTIFY_CLIENT_ID + SPOTIFY_REFRESH_TOKEN',
  meta: 'META_ADS_TOKEN + META_AD_ACCOUNT_ID',
  google: 'GOOGLE_ADS_CUSTOMER_ID + GOOGLE_ADS_DEVELOPER_TOKEN',
  tiktok: 'TIKTOK_ADS_TOKEN + TIKTOK_ADVERTISER_ID',
  x: 'X_API_KEY + X_ACCOUNT_ID',
};

const PLATFORM_ICON_COLORS = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

export default function AccountConnector({ isOpen, onClose, connectedPlatforms }) {
  if (!isOpen) return null;

  const connectedSet = new Set(connectedPlatforms);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28]">
          <div>
            <h3 className="text-sm font-medium text-[#F5F0E8]">Agency Ad Accounts</h3>
            <p className="text-[10px] text-[#6B6560] mt-0.5">
              Credentials are configured via environment variables on the server
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Platform status cards */}
        <div className="p-5 space-y-3">
          {PLATFORM_KEYS.map(platform => {
            const connected = connectedSet.has(platform);
            const constraint = PLATFORM_CONSTRAINTS[platform];
            const iconColor = PLATFORM_ICON_COLORS[platform];

            return (
              <div key={platform} className="flex items-center gap-3 p-3 rounded border border-[#2C2B28] bg-[#0D0C0B]">
                <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: iconColor + '20' }}>
                  <span className="text-xs font-bold" style={{ color: iconColor }}>
                    {platform[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F5F0E8] font-medium">{PLATFORM_LABELS[platform]}</p>
                  <p className="text-[9px] text-[#6B6560] line-clamp-1">{constraint.notes}</p>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#7BAF73] shrink-0">
                    <CheckCircle size={11} />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-[#6B6560] shrink-0">
                    <XCircle size={11} />
                    Not configured
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer with env var instructions */}
        <div className="px-5 py-3 border-t border-[#2C2B28]">
          <p className="text-[9px] font-mono text-[#6B6560] leading-relaxed">
            Set these environment variables to connect platforms:{' '}
            {PLATFORM_KEYS.map(p => ENV_VAR_NAMES[p]).join(', ')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
