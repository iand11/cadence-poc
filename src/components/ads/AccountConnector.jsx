import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, Link2, Loader2, AlertTriangle, AtSign } from 'lucide-react';
import { PLATFORM_LABELS, PLATFORM_CONSTRAINTS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';
import { useMetaConnection } from '../../hooks/useMetaConnection';
import { startMetaConnect, selectMetaAdAccount, disconnectMeta } from '../../data/metaAds';

// Meta is real; the rest are still simulated in the demo.
const SIMULATED_KEYS = ['spotify', 'google', 'tiktok', 'x'];

const PLATFORM_ICON_COLORS = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

function PlatformIcon({ platform }) {
  const color = PLATFORM_ICON_COLORS[platform];
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
      <span className="text-xs font-bold" style={{ color }}>{platform[0].toUpperCase()}</span>
    </div>
  );
}

function MetaAccountCard() {
  const { loading, connection, error, refresh } = useMetaConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Load ad accounts + Instagram accounts whenever the dialog opens
  useEffect(() => { refresh(true); }, [refresh]);

  const run = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const connected = !!connection?.connected;
  const selected = connection?.selection?.adAccountId || '';

  return (
    <div className="p-3 rounded border border-[#2C2B28] bg-[#0D0C0B] space-y-3">
      <div className="flex items-center gap-3">
        <PlatformIcon platform="meta" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#F5F0E8] font-medium">{PLATFORM_LABELS.meta}</p>
          <p className="text-[9px] text-[#6B6560] line-clamp-1">
            Boost Instagram posts from your own ad account. Meta bills your card for ad spend.
          </p>
        </div>
        {loading ? (
          <Loader2 size={12} className="text-[#6B6560] animate-spin shrink-0" />
        ) : connected ? (
          <span className="flex items-center gap-1 text-[10px] text-[#7BAF73] shrink-0">
            <CheckCircle size={11} />
            Connected
          </span>
        ) : (
          <button
            onClick={() => run(startMetaConnect)}
            disabled={busy || connection?.configured === false}
            className="flex items-center gap-1 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 disabled:opacity-40 rounded px-2.5 py-1 shrink-0 cursor-pointer"
          >
            <Link2 size={10} />
            {connection?.expired ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>

      {connection?.configured === false && (
        <p className="text-[9px] font-mono text-[#D4A574]">
          Meta isn't configured on the server yet (META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID).
        </p>
      )}

      {connected && (
        <>
          <label className="block">
            <span className="text-[9px] font-mono text-[#6B6560]">Ad account boosts run in</span>
            <select
              value={selected}
              disabled={busy || !connection.adAccounts}
              onChange={e => run(async () => { await selectMetaAdAccount(e.target.value); await refresh(true); })}
              className="mt-1 w-full bg-[#171614] border border-[#2C2B28] rounded px-2 py-1.5 text-[11px] text-[#F5F0E8]"
            >
              <option value="" disabled>{connection.adAccounts ? 'Choose an ad account' : 'Loading…'}</option>
              {(connection.adAccounts || []).map(a => (
                <option key={a.id} value={a.id} disabled={!a.active}>
                  {a.name} ({a.currency}){a.business ? ` · ${a.business}` : ''}{a.active ? '' : ' · inactive'}
                </option>
              ))}
            </select>
          </label>

          {connection.instagramAccounts && (
            <div>
              <p className="text-[9px] font-mono text-[#6B6560] mb-1">
                Instagram accounts you can boost ({connection.instagramAccounts.length})
              </p>
              {connection.instagramAccounts.length === 0 ? (
                <p className="text-[10px] text-[#D4A574]">
                  None shared. Reconnect and include the artists' Facebook Pages and Instagram accounts.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {connection.instagramAccounts.map(ig => (
                    <span key={ig.igUserId} className="flex items-center gap-1 text-[10px] text-[#9B9590] bg-[#171614] border border-[#2C2B28] rounded px-1.5 py-0.5">
                      <AtSign size={9} />
                      {ig.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => run(startMetaConnect)}
              disabled={busy}
              className="text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer"
            >
              Change shared accounts
            </button>
            <button
              onClick={() => run(async () => { await disconnectMeta(); await refresh(); })}
              disabled={busy}
              className="text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer ml-auto"
            >
              Disconnect
            </button>
          </div>
        </>
      )}

      {(actionError || error) && (
        <p className="flex items-start gap-1 text-[10px] text-[#C75F4F]">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          {actionError || error.message}
        </p>
      )}
    </div>
  );
}

export default function AccountConnector({ isOpen, onClose, pendingLaunch, onSimulate }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28]">
          <div>
            <h3 className="text-sm font-medium text-[#F5F0E8]">Ad Accounts</h3>
            <p className="text-[10px] text-[#6B6560] mt-0.5">
              Connect the ad accounts Prelude launches campaigns in
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {pendingLaunch && (
            <div className="p-3 rounded border border-[#DA7756]/30 bg-[#DA7756]/10">
              <p className="text-[11px] text-[#F5F0E8]">
                Connect Meta and choose an ad account to launch this boost, then click Execute again.
              </p>
              {onSimulate && (
                <button onClick={onSimulate} className="mt-1.5 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer">
                  Run it as a simulation instead
                </button>
              )}
            </div>
          )}
          <MetaAccountCard />

          {SIMULATED_KEYS.map(platform => (
            <div key={platform} className="flex items-center gap-3 p-3 rounded border border-[#2C2B28] bg-[#0D0C0B] opacity-70">
              <PlatformIcon platform={platform} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F5F0E8] font-medium">{PLATFORM_LABELS[platform]}</p>
                <p className="text-[9px] text-[#6B6560] line-clamp-1">{PLATFORM_CONSTRAINTS[platform].notes}</p>
              </div>
              <span className="text-[10px] font-mono text-[#6B6560] shrink-0">Simulated · coming soon</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
