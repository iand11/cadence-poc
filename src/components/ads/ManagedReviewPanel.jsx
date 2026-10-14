import { useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { fetchManagedReviews, setMetaCampaignStatus } from '../../data/metaAds';
import { useAsync } from '../../hooks/useAsync';
import { formatDollar } from '../../utils/formatters';

/**
 * Prelude admins: managed campaigns (in Prelude's ad account) whose owners asked to go
 * live. Only used when Stripe prepay is off; approving starts spend on Prelude's card.
 */
export default function ManagedReviewPanel() {
  const [version, setVersion] = useState(0);
  const { data, error } = useAsync(() => fetchManagedReviews(), [version]);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  const decide = async (id, status) => {
    setBusy(id);
    setActionError(null);
    try {
      await setMetaCampaignStatus(id, status);
      setVersion(v => v + 1);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const campaigns = data?.campaigns || [];
  if (!error && !campaigns.length) return null;

  return (
    <div className="bg-[#171614] border border-[#D4A574]/30 rounded p-4 mb-4">
      <p className="text-[10px] font-mono text-[#D4A574] mb-2">Prelude-managed ads waiting for review ({campaigns.length})</p>
      {error && <p className="text-[10px] text-[#C75F4F]">{error.message}</p>}
      <div className="space-y-1.5">
        {campaigns.map(c => (
          <div key={c.id} className="flex items-center gap-3 text-[11px] text-[#F5F0E8]">
            <span className="flex-1 min-w-0 truncate">
              {c.artistName || 'Artist'}{c.igUsername ? ` · @${c.igUsername}` : ''}
              <span className="font-mono text-[#9B9590]">
                {' '}· {formatDollar(c.budget)}{c.period === 'daily' ? '/day' : ' lifetime'}{c.endDate ? ` until ${String(c.endDate).slice(0, 10)}` : ''}
              </span>
            </span>
            <button
              onClick={() => decide(c.id, 'ACTIVE')}
              disabled={!!busy}
              className="flex items-center gap-1 text-[10px] font-medium text-[#0D0C0B] bg-[#7BAF73] hover:bg-[#7BAF73]/90 rounded px-2.5 py-1 cursor-pointer"
            >
              {busy === c.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Approve and go live
            </button>
            <button
              onClick={() => decide(c.id, 'DECLINED')}
              disabled={!!busy}
              className="flex items-center gap-1 text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer"
            >
              <X size={10} /> Decline
            </button>
          </div>
        ))}
      </div>
      {actionError && <p className="text-[10px] text-[#C75F4F] mt-2">{actionError}</p>}
    </div>
  );
}
