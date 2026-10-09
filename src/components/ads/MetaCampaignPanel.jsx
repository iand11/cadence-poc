import { useEffect, useState, useCallback } from 'react';
import { Rocket, Pause, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchMetaCampaign, setMetaCampaignStatus } from '../../data/metaAds';
import { formatNumber, formatDollar } from '../../utils/formatters';
import { useAsync } from '../../hooks/useAsync';
import { fetchCampaignLinkStats } from '../../data/smartLinks';
import { ServiceBars, ListeningStats } from './SmartLinksPanel';

const usesSmartLink = (directive) => /\/l\/[\w-]+\/?(\?|$)/.test(directive.creative?.trackUrl || '');

/** Views and streaming-service clicks this campaign drove through its smart link. */
function StreamingClicks({ directive, spend, version }) {
  const { data } = useAsync(() => fetchCampaignLinkStats(directive.id), [directive.id, version]);
  if (!data) return null;
  return (
    <div className="pt-3 border-t border-[#2C2B28]">
      <p className="text-[10px] font-mono text-[#9B9590] mb-2">Streaming clicks (smart link)</p>
      <div className={`grid grid-cols-2 ${data.fans ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-2 mb-3`}>
        <Stat label="Link views" value={formatNumber(data.views)} />
        <Stat label="Streaming clicks" value={formatNumber(data.clicks)} />
        <Stat label="Click rate" value={data.views ? `${(data.clickRate * 100).toFixed(1)}%` : '–'} />
        <Stat label="Cost / streaming click" value={data.clicks && spend ? formatDollar(spend / data.clicks) : '–'} />
        {data.fans > 0 && <Stat label="Spotify fans captured" value={formatNumber(data.fans)} />}
      </div>
      <ServiceBars byService={data.byService} total={data.clicks} />
      {data.listening && (
        <div className="mt-3">
          <p className="text-[10px] font-mono text-[#9B9590] mb-2">Spotify listening by captured fans (after their click)</p>
          <ListeningStats listening={data.listening} spend={spend} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded p-3">
      <p className="text-[9px] font-mono text-[#6B6560]">{label}</p>
      <p className="text-sm font-mono text-[#F5F0E8] mt-0.5">{value}</p>
    </div>
  );
}

/**
 * Live state of a campaign Prelude created on Meta: status, real delivery numbers,
 * and the explicit go-live / pause controls. Campaigns are always created paused.
 */
export default function MetaCampaignPanel({ directive, updateDirective }) {
  const campaignId = directive.platformCampaignId;
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  // State is only set in promise callbacks, so this is safe to run from an effect
  const sync = useCallback(() => fetchMetaCampaign(campaignId)
    .then(data => {
      setLive(data);
      setError(null);
      // Meta is the source of truth for whether money is moving
      const local = data.status === 'ACTIVE' ? 'active' : data.status === 'PAUSED' ? 'paused' : null;
      updateDirective(directive.id, {
        platformStatus: data.effectiveStatus,
        lastSyncedAt: new Date().toISOString(),
        // Always written (not compared to directive.status, which is stale in this closure)
        ...(local ? { status: local } : {}),
      });
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false)),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resync per campaign, not per directive edit
  [campaignId, directive.id]);

  useEffect(() => { sync(); }, [sync]);

  const [linkVersion, setLinkVersion] = useState(0);
  const refresh = () => {
    setLinkVersion(v => v + 1);
    setLoading(true);
    sync();
  };

  const changeStatus = async (status) => {
    setBusy(true);
    setError(null);
    try {
      await setMetaCampaignStatus(campaignId, status);
      setConfirming(false);
      await sync();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isLive = live?.status === 'ACTIVE';
  const ins = live?.insights;
  const budget = directive.budget || {};

  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono text-[#9B9590]">
            Running on Meta{directive.igUsername ? ` · @${directive.igUsername}` : ''}
          </p>
          <p className="text-[9px] font-mono text-[#6B6560] mt-0.5">
            {loading && !live ? 'Syncing…' : live ? `Status: ${live.effectiveStatus}` : 'Status unavailable'}
            {directive.adAccountId ? ` · ${directive.adAccountId}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={loading} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer" title="Refresh from Meta">
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
            {directive.schedule?.endDate ? ` until ${directive.schedule.endDate}` : ''}? Meta bills the connected ad account.
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

      {ins && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label="Spend" value={formatDollar(ins.spend)} />
          <Stat label="Impressions" value={formatNumber(ins.impressions)} />
          <Stat label="Reach" value={formatNumber(ins.reach)} />
          <Stat label="Clicks" value={formatNumber(ins.clicks)} />
          <Stat label="Engagements" value={formatNumber(ins.engagements)} />
        </div>
      )}
      {usesSmartLink(directive) && <StreamingClicks directive={directive} spend={Number(ins?.spend) || 0} version={linkVersion} />}
      {live && !ins && (
        <p className="text-[10px] text-[#6B6560]">No delivery yet. Numbers appear here once Meta starts serving the ad.</p>
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
