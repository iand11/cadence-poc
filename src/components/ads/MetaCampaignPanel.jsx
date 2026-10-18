import { useEffect, useState, useCallback } from 'react';
import { Rocket, Pause, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchMetaCampaign, setMetaCampaignStatus } from '../../data/metaAds';
import { formatDollar } from '../../utils/formatters';
import { useAsync } from '../../hooks/useAsync';
import { fetchCampaignLinkStats } from '../../data/smartLinks';
import { fetchStreamTracker } from '../../data/streamCounts';
import MetaCampaignInsights from './MetaCampaignInsights';

const usesSmartLink = (directive) => /\/l\/[\w-]+\/?(\?|$)/.test(directive.creative?.trackUrl || '');

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
  // Smart link taps and stream counts feed the summary's last steps
  const smartLink = usesSmartLink(directive);
  const { data: linkStats } = useAsync(() => (smartLink ? fetchCampaignLinkStats(directive.id) : null), [directive.id, smartLink, linkVersion]);
  const trackerId = directive.streamTrackerId;
  const { data: streams } = useAsync(() => (trackerId ? fetchStreamTracker(trackerId) : null), [trackerId, linkVersion]);
  const refresh = () => {
    setLinkVersion(v => v + 1);
    setLoading(true);
    sync();
  };

  const changeStatus = async (status) => {
    setBusy(true);
    setError(null);
    try {
      const result = await setMetaCampaignStatus(campaignId, status);
      // Prelude-managed with prepay: pay in Stripe Checkout, which returns here and goes live
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setConfirming(false);
      await sync();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isLive = live?.status === 'ACTIVE';
  // Prelude-managed (Prelude's ad account): paid up front, or reviewed by Prelude
  const managed = !!live?.managed;
  const mustPay = managed && live.prepay && !live.paid;
  const awaitingReview = managed && !live.prepay && live.review === 'requested';
  const goLiveLabel = mustPay ? 'Pay and go live' : managed && !live.paid && !live.prepay ? 'Request go-live' : 'Go live';
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
            {managed ? " · Prelude's ad account" : directive.adAccountId ? ` · ${directive.adAccountId}` : ''}
            {managed && live.paid ? ` · paid ${formatDollar(live.paid.cents / 100)}` : ''}
            {managed && live.review === 'declined' ? ' · declined by Prelude' : ''}
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
          ) : awaitingReview ? (
            <span className="text-[10px] font-mono text-[#D4A574]">Waiting for Prelude review</span>
          ) : !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-3 py-1.5 cursor-pointer"
            >
              <Rocket size={10} />
              {goLiveLabel}
            </button>
          ))}
        </div>
      </div>

      {confirming && (
        <div className="p-3 rounded border border-[#D4A574]/30 bg-[#D4A574]/10">
          {mustPay && live.quote ? (
            <p className="text-[11px] text-[#F5F0E8]">
              Pay <span className="font-mono">{formatDollar(live.quote.totalCents / 100)}</span> (ad budget{' '}
              <span className="font-mono">{formatDollar(live.quote.budgetCents / 100)}</span> + Prelude fee{' '}
              <span className="font-mono">{formatDollar(live.quote.feeCents / 100)}</span>) by card. The ad goes live once the payment clears.
            </p>
          ) : managed && !live.paid && !live.prepay ? (
            <p className="text-[11px] text-[#F5F0E8]">
              This ad runs in Prelude's ad account. Prelude reviews it and turns it on; you'll see the status change here.
            </p>
          ) : (
          <p className="text-[11px] text-[#F5F0E8]">
            Start spending up to <span className="font-mono">{formatDollar(budget.amount || 0)}</span>
            {budget.period === 'daily' ? ' per day' : ' over the campaign'}
            {directive.schedule?.endDate ? ` until ${directive.schedule.endDate}` : ''}? {managed ? 'It spends the budget you already paid.' : 'Meta bills the connected ad account.'}
          </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => changeStatus('ACTIVE')}
              disabled={busy}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-3 py-1.5 cursor-pointer"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
              {mustPay ? 'Continue to payment' : managed && !live.paid && !live.prepay ? 'Send for review' : 'Confirm and go live'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      {live && (
        <MetaCampaignInsights
          live={live}
          link={linkStats || null}
          streams={streams || null}
          smartLink={smartLink}
        />
      )}
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
