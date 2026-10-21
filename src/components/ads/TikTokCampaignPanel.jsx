import { useEffect, useState, useCallback } from 'react';
import { Rocket, Pause, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { fetchTikTokCampaign, setTikTokCampaignStatus } from '../../data/tiktokAds';
import { fetchCampaignLinkStats } from '../../data/smartLinks';
import { useAsync } from '../../hooks/useAsync';
import { formatDollar, formatNumber } from '../../utils/formatters';
import { AXIS_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { PLATFORM_COLORS } from '../../constants/colors';

const usesSmartLink = (directive) => /\/l\/[\w-]+\/?(\?|$)/.test(directive.creative?.trackUrl || '');

// TikTok's secondary status, e.g. CAMPAIGN_STATUS_DISABLE → "Off", CAMPAIGN_STATUS_NOT_DELIVERY → "Not delivery"
function statusLabel(raw) {
  const s = String(raw || '').replace(/^(CAMPAIGN|ADGROUP|AD)_STATUS_/, '');
  if (s === 'ENABLE' || s === 'DELIVERY_OK') return 'On';
  if (s === 'DISABLE') return 'Off';
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : 'Unknown';
}

function Tile({ label, value }) {
  return (
    <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2">
      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560]">{label}</p>
      <p className="text-sm font-mono text-[#F5F0E8] mt-0.5">{value}</p>
    </div>
  );
}

/**
 * Live state of a campaign Prelude created on TikTok: status, delivery numbers, and the
 * go-live / pause controls. Campaigns are created disabled (paused).
 */
export default function TikTokCampaignPanel({ directive, updateDirective }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const sync = useCallback(() => fetchTikTokCampaign(directive)
    .then(data => {
      setLive(data);
      setError(null);
      // TikTok is the source of truth for whether money is moving
      const local = data.status === 'ACTIVE' ? 'active' : data.status === 'PAUSED' ? 'paused' : null;
      updateDirective(directive.id, {
        platformStatus: data.effectiveStatus,
        lastSyncedAt: new Date().toISOString(),
        ...(local ? { status: local } : {}),
      });
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false)),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resync per campaign, not per directive edit
  [directive.platformCampaignId, directive.advertiserId, directive.id]);

  useEffect(() => { sync(); }, [sync]);

  const [version, setVersion] = useState(0);
  const smartLink = usesSmartLink(directive);
  const { data: linkStats } = useAsync(() => (smartLink ? fetchCampaignLinkStats(directive.id) : null), [directive.id, smartLink, version]);
  const refresh = () => {
    setVersion(v => v + 1);
    setLoading(true);
    sync();
  };

  const changeStatus = async (status) => {
    setBusy(true);
    setError(null);
    try {
      await setTikTokCampaignStatus(directive, status);
      setConfirming(false);
      await sync();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isLive = live?.status === 'ACTIVE';
  const t = live?.totals;
  const budget = directive.budget || {};
  const money = (v) => (live?.currency && live.currency !== 'USD' ? `${formatNumber(v)} ${live.currency}` : formatDollar(v));
  const streamingTaps = linkStats ? linkStats.clicks ?? null : null;

  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono text-[#9B9590]">
            Running on TikTok{directive.identityName ? ` · ${directive.identityName}` : ''}
          </p>
          <p className="text-[9px] font-mono text-[#6B6560] mt-0.5">
            {loading && !live ? 'Syncing…' : live ? `Status: ${statusLabel(live.effectiveStatus)}` : 'Status unavailable'}
            {directive.advertiserName ? ` · ${directive.advertiserName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={loading} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer" title="Refresh from TikTok">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          {live && (isLive ? (
            <button
              onClick={() => changeStatus('PAUSED')}
              disabled={busy}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[#F5F0E8] border border-[#2C2B28] hover:border-[#3D3B37] rounded px-3 py-1.5 cursor-pointer"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Pause size={10} />}
              Pause
            </button>
          ) : !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-3 py-1.5 cursor-pointer"
            >
              <Rocket size={10} />
              Go live
            </button>
          ))}
        </div>
      </div>

      {confirming && (
        <div className="p-3 rounded border border-[#D4A574]/30 bg-[#D4A574]/10">
          <p className="text-[11px] text-[#F5F0E8]">
            Start spending up to <span className="font-mono">{formatDollar(budget.amount || 0)}</span>
            {budget.period === 'daily' ? ' per day' : ' over the campaign'}
            {directive.schedule?.endDate ? ` until ${directive.schedule.endDate}` : ''}? TikTok bills the connected ad account.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => changeStatus('ACTIVE')}
              disabled={busy}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-3 py-1.5 cursor-pointer"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
              Confirm and go live
            </button>
            <button onClick={() => setConfirming(false)} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      {t && t.impressions > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Spent" value={money(t.spend)} />
            <Tile label="Reached" value={formatNumber(t.reach || t.impressions)} />
            <Tile label="Link taps" value={formatNumber(t.clicks)} />
            {streamingTaps != null
              ? <Tile label="Streaming taps" value={formatNumber(streamingTaps)} />
              : <Tile label="Video views" value={formatNumber(t.videoViews)} />}
          </div>
          {live.daily?.length > 1 && (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={live.daily}>
                  <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatNumber(v), 'Link taps']} />
                  <Bar dataKey="clicks" maxBarSize={48} fill={PLATFORM_COLORS.tiktok} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : live && (
        <p className="text-[10px] text-[#6B6560]">No delivery yet. Numbers appear here once TikTok starts serving the ad.</p>
      )}

      {error && (
        <p className="flex items-start gap-1 text-[10px] text-[#C75F4F]">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
