import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, Link2, Loader2, AlertTriangle, AtSign, Clock, RefreshCw, Plus, Copy } from 'lucide-react';
import { PLATFORM_LABELS, PLATFORM_CONSTRAINTS } from '../../data/directives';
import { PLATFORM_COLORS } from '../../constants/colors';
import { useMetaConnection } from '../../hooks/useMetaConnection';
import {
  startMetaConnect, assignMetaAdAccount, allowPreludeAds, disconnectMeta, addMetaPage, addMetaAdAccount, removeMetaAsset,
} from '../../data/metaAds';

// Meta is real; the rest are still simulated in the demo.
const SIMULATED_KEYS = ['tiktok', 'youtube'];

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

function IgName({ ig }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-[#F5F0E8] w-32 shrink-0 truncate" title={ig.pageName}>
      <AtSign size={9} className="text-[#6B6560] shrink-0" />
      {ig.username}
    </span>
  );
}

/**
 * The artist's permission for Prelude to run ads as their Instagram account from
 * Prelude's own ad account (for artists without one). Allowing it shares their Page
 * and Instagram account with Prelude's business on Meta.
 */
function PreludeConsent({ ig, connection, busy, onAllow, onCancel }) {
  const [agreed, setAgreed] = useState(false);
  const available = connection.managedAvailable;
  return (
    <div className="mt-1.5 p-3 rounded border border-[#DA7756]/30 bg-[#DA7756]/5 space-y-2">
      <p className="text-[11px] text-[#F5F0E8] font-medium">Let Prelude run ads for @{ig.username}</p>
      <ul className="text-[10px] text-[#9B9590] space-y-1 list-disc pl-4">
        <li>{connection.mode === 'partner'
          ? `Prelude's ad account is authorized to run ads as @${ig.username}, using the access the ${ig.pageName} Page already shares.`
          : `Prelude's business gets advertiser access to the ${ig.pageName} Facebook Page and @${ig.username} on Meta.`}</li>
        <li>New posts you create in Prelude run from Prelude's ad account and appear as @{ig.username}. Prelude only creates ads; it doesn't publish to the profile.</li>
        <li>{connection.managedPrepay
          ? "You pay each campaign's budget plus Prelude's fee by card before it goes live."
          : 'Prelude reviews each campaign before it goes live.'}</li>
        <li>You can stop this here at any time.</li>
      </ul>
      {available ? (
        <>
          <label className="flex items-center gap-2 text-[10px] text-[#F5F0E8] cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
            I allow Prelude to run Instagram ads for @{ig.username}
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onAllow}
              disabled={!agreed || busy}
              className="flex items-center gap-1 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 disabled:opacity-40 rounded px-2.5 py-1 cursor-pointer"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
              Allow
            </button>
            <button onClick={onCancel} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
          </div>
        </>
      ) : (
        <p className="text-[9px] font-mono text-[#D4A574]">
          Not set up on the server yet (META_PRELUDE_AD_ACCOUNT_ID, META_PRELUDE_BUSINESS_ID, META_PRELUDE_TOKEN).
        </p>
      )}
    </div>
  );
}

/** Which ad account each shared Instagram account runs ads in, or "Let Prelude run ads". */
function InstagramAssignments({ connection, busy, run, refresh, emptyHint, noAdAccountsHint }) {
  const [consentFor, setConsentFor] = useState(null);
  const accountMap = connection?.selection?.accountMap || {};
  const adAccounts = (connection?.adAccounts || []).filter(a => a.status !== 'pending');

  return (
    !connection.instagramAccounts ? (
      <p className="flex items-center gap-1.5 text-[10px] text-[#6B6560]">
        <Loader2 size={10} className="animate-spin" /> Loading shared accounts…
      </p>
    ) : connection.instagramAccounts.length === 0 ? (
      <p className="text-[10px] text-[#D4A574]">{emptyHint}</p>
    ) : (
      <div>
        <p className="text-[9px] font-mono text-[#6B6560] mb-1.5">
          Ad account for each artist's Instagram ({adAccounts.filter(a => a.active).length} ad account{adAccounts.filter(a => a.active).length === 1 ? '' : 's'} available)
        </p>
        <div className="space-y-1.5">
          {connection.instagramAccounts.map(ig => {
            const entry = accountMap[ig.igUserId];
            if (entry?.managed) {
              return (
                <div key={ig.igUserId} className="flex items-center gap-2">
                  <IgName ig={ig} />
                  <span className="flex-1 min-w-0 flex items-center gap-1 text-[10px] text-[#7BAF73]">
                    <CheckCircle size={10} /> Prelude runs ads for this account
                  </span>
                  <button
                    onClick={() => run(async () => { await assignMetaAdAccount(ig.igUserId, null); await refresh(true); })}
                    disabled={busy}
                    className="text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"
                  >
                    Stop
                  </button>
                </div>
              );
            }
            const assigned = entry?.adAccountId || '';
            return (
              <div key={ig.igUserId}>
                <div className="flex items-center gap-2">
                  <IgName ig={ig} />
                  <select
                    value={assigned}
                    disabled={busy}
                    onChange={e => run(async () => {
                      await assignMetaAdAccount(ig.igUserId, e.target.value || null);
                      await refresh(true);
                    })}
                    className={`flex-1 min-w-0 bg-[#171614] border rounded px-2 py-1 text-[10px] ${
                      assigned ? 'border-[#2C2B28] text-[#F5F0E8]' : 'border-[#D4A574]/40 text-[#D4A574]'
                    }`}
                  >
                    <option value="">Not assigned (can't run ads)</option>
                    {adAccounts.map(a => (
                      <option key={a.id} value={a.id} disabled={!a.active}>
                        {a.name} ({a.currency}){a.business ? ` · ${a.business}` : ''}{a.active ? '' : ' · inactive'}
                      </option>
                    ))}
                  </select>
                </div>
                {!assigned && (consentFor === ig.igUserId ? (
                  <PreludeConsent
                    ig={ig}
                    connection={connection}
                    busy={busy}
                    onCancel={() => setConsentFor(null)}
                    onAllow={() => run(async () => {
                      await allowPreludeAds(ig.igUserId);
                      setConsentFor(null);
                      await refresh(true);
                    })}
                  />
                ) : (
                  <button
                    onClick={() => setConsentFor(ig.igUserId)}
                    className="ml-[8.5rem] mt-1 text-[10px] text-[#DA7756] hover:underline cursor-pointer"
                  >
                    No ad account? Let Prelude run ads for @{ig.username}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {adAccounts.length === 0 && (
          <p className="text-[10px] text-[#D4A574] mt-1.5">{noAdAccountsHint}</p>
        )}
      </div>
    )
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

  return (
    <div className="p-3 rounded border border-[#2C2B28] bg-[#0D0C0B] space-y-3">
      <div className="flex items-center gap-3">
        <PlatformIcon platform="meta" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#F5F0E8] font-medium">{PLATFORM_LABELS.meta}</p>
          <p className="text-[9px] text-[#6B6560] line-clamp-1">
            Boost posts and run new ads as artists' Instagram accounts. Meta bills each ad account for its spend.
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

      {connection && !connected && (
        <div className="p-3 rounded border border-[#2C2B28] bg-[#171614] space-y-1.5">
          <p className="text-[11px] text-[#F5F0E8] font-medium">Two ways to run Instagram ads</p>
          <p className="text-[10px] text-[#9B9590]">
            With a Meta ad account: connect it with the artist's Instagram account and Facebook Page, and ads run (and bill) there.
          </p>
          <p className="text-[10px] text-[#9B9590]">
            No ad account? Connect just the artist's Instagram account and Facebook Page, then choose "Let Prelude run ads" for it.
            New posts run from Prelude's ad account as the artist
            {connection.managedPrepay ? ", and the budget plus Prelude's fee is paid by card before each ad goes live." : ', and Prelude reviews each ad before it goes live.'}
          </p>
          {!connection.managedAvailable && (
            <p className="text-[9px] font-mono text-[#D4A574]">
              Prelude-run ads aren't set up on the server yet (META_PRELUDE_AD_ACCOUNT_ID, META_PRELUDE_BUSINESS_ID, META_PRELUDE_TOKEN).
            </p>
          )}
        </div>
      )}

      {connected && (
        <>
          <InstagramAssignments
            connection={connection}
            busy={busy}
            run={run}
            refresh={refresh}
            emptyHint={'No Instagram accounts shared. Use "Add or change accounts" and include each artist\'s Instagram account and Facebook Page.'}
            noAdAccountsHint={'No ad accounts shared. Use "Add or change accounts" to include the ad accounts you run campaigns from, or let Prelude run ads for artists without one.'}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => run(startMetaConnect)}
              disabled={busy}
              className="text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer"
            >
              Add or change accounts
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

const statusBadge = (status, error) => (status === 'active'
  ? <span className="flex items-center gap-1 text-[10px] text-[#7BAF73] shrink-0"><CheckCircle size={10} /> Shared</span>
  : <span className="flex items-center gap-1 text-[10px] text-[#D4A574] shrink-0" title={error || undefined}><Clock size={10} /> Waiting for approval</span>);

/**
 * Partner access (Facebook Login off): the user adds the artist's Page (and their ad account,
 * if they have one); the owner approves Prelude's request on Meta, or shares it themselves.
 */
function PartnerMetaCard() {
  const { loading, connection, error, refresh } = useMetaConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [pageInput, setPageInput] = useState('');
  const [adAccountInput, setAdAccountInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Opening the dialog also picks up any approvals made on Meta since
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

  const configured = connection?.configured !== false;
  const businessId = connection?.businessId;
  const pages = connection?.pages || [];
  const adAccountRequests = connection?.adAccountRequests || [];
  const inputCls = 'flex-1 min-w-0 bg-[#171614] border border-[#2C2B28] rounded px-2 py-1 text-[10px] text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#DA7756]/50';
  const addBtn = 'flex items-center gap-1 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 disabled:opacity-40 rounded px-2.5 py-1 shrink-0 cursor-pointer';

  const copyId = () => {
    navigator.clipboard?.writeText(businessId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    <div className="p-3 rounded border border-[#2C2B28] bg-[#0D0C0B] space-y-3">
      <div className="flex items-center gap-3">
        <PlatformIcon platform="meta" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#F5F0E8] font-medium">{PLATFORM_LABELS.meta}</p>
          <p className="text-[9px] text-[#6B6560] line-clamp-1">
            Artists share their Facebook Page and Instagram with Prelude. No Meta login needed.
          </p>
        </div>
        {loading ? (
          <Loader2 size={12} className="text-[#6B6560] animate-spin shrink-0" />
        ) : connection?.connected ? (
          <span className="flex items-center gap-1 text-[10px] text-[#7BAF73] shrink-0"><CheckCircle size={11} /> Connected</span>
        ) : null}
      </div>

      {!configured ? (
        <p className="text-[9px] font-mono text-[#D4A574]">
          Meta partner access isn't configured on the server yet (META_APP_SECRET, META_PRELUDE_BUSINESS_ID, META_PRELUDE_TOKEN).
        </p>
      ) : (
        <>
          <div className="p-3 rounded border border-[#2C2B28] bg-[#171614] space-y-1.5">
            <p className="text-[11px] text-[#F5F0E8] font-medium">How it works</p>
            <ol className="text-[10px] text-[#9B9590] space-y-1 list-decimal pl-4">
              <li>Add the artist's Facebook Page (its Instagram professional account must be linked to it). Prelude sends the Page an access request.</li>
              <li>
                The Page owner approves it in Facebook or Meta Business Suite. They can also share it themselves: Business settings → Partners → Add,
                with Prelude's business ID{businessId ? (
                  <button onClick={copyId} className="inline-flex items-center gap-0.5 mx-1 font-mono text-[#F5F0E8] hover:text-[#DA7756] cursor-pointer" title="Copy">
                    {businessId} <Copy size={9} />{copied && <span className="text-[#7BAF73]">copied</span>}
                  </button>
                ) : ' '}
                and the Page and Instagram account.
              </li>
              <li>
                Have an ad account? Add it too and approve the same way; ads run and bill there.
                No ad account? Choose "Let Prelude run ads" once the Page is shared
                {connection?.managedPrepay ? ", and the budget plus Prelude's fee is paid by card before each ad goes live." : ', and Prelude reviews each ad before it goes live.'}
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <form
              onSubmit={e => { e.preventDefault(); run(async () => { await addMetaPage(pageInput); setPageInput(''); await refresh(true); }); }}
              className="flex items-center gap-2"
            >
              <input value={pageInput} onChange={e => setPageInput(e.target.value)} placeholder="Facebook Page link or ID" className={inputCls} />
              <button type="submit" disabled={busy || !pageInput.trim()} className={addBtn}>
                {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Add Page
              </button>
            </form>
            <form
              onSubmit={e => { e.preventDefault(); run(async () => { await addMetaAdAccount(adAccountInput); setAdAccountInput(''); await refresh(true); }); }}
              className="flex items-center gap-2"
            >
              <input value={adAccountInput} onChange={e => setAdAccountInput(e.target.value)} placeholder="Ad account ID (optional, e.g. 1234567890)" className={inputCls} />
              <button type="submit" disabled={busy || !adAccountInput.trim()} className={addBtn}>
                {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Add ad account
              </button>
            </form>
          </div>

          {(pages.length > 0 || adAccountRequests.length > 0) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-mono text-[#6B6560]">Shared with Prelude</p>
                <button
                  onClick={() => run(() => refresh(true))}
                  disabled={busy}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer"
                >
                  <RefreshCw size={9} /> Check for approvals
                </button>
              </div>
              {pages.map(p => (
                <div key={p.pageId}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-[10px] text-[#F5F0E8] truncate">
                      {p.pageName || `Page ${p.pageId}`}
                      {p.igUsername && <span className="text-[#9B9590]"> · @{p.igUsername}</span>}
                    </span>
                    {statusBadge(p.status, p.error)}
                    <button
                      onClick={() => run(async () => { await removeMetaAsset({ pageId: p.pageId }); await refresh(true); })}
                      disabled={busy}
                      className="text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                  {p.error && <p className="text-[9px] text-[#D4A574] mt-0.5">{p.error}</p>}
                </div>
              ))}
              {adAccountRequests.map(a => (
                <div key={a.id}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-[10px] text-[#F5F0E8] truncate">
                      {a.name || 'Ad account'} <span className="text-[#6B6560] font-mono">{a.id.replace(/^act_/, '')}</span>
                    </span>
                    {statusBadge(a.status, a.error)}
                    <button
                      onClick={() => run(async () => { await removeMetaAsset({ adAccountId: a.id }); await refresh(true); })}
                      disabled={busy}
                      className="text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                  {a.error && <p className="text-[9px] text-[#D4A574] mt-0.5">{a.error}</p>}
                </div>
              ))}
            </div>
          )}

          {pages.some(p => p.status === 'active') && (
            <InstagramAssignments
              connection={connection}
              busy={busy}
              run={run}
              refresh={refresh}
              emptyHint="None of the shared Pages has an Instagram professional account linked yet."
              noAdAccountsHint="No ad accounts shared yet. Add one above, or let Prelude run ads for artists without one."
            />
          )}
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

/** `notice`: why the modal was opened (e.g. a boost that can't launch yet). */
export default function AccountConnector({ isOpen, onClose, notice }) {
  const { connection, error } = useMetaConnection();
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
          {notice && (
            <div className="p-3 rounded border border-[#DA7756]/30 bg-[#DA7756]/10">
              <p className="text-[11px] text-[#F5F0E8]">{notice}</p>
            </div>
          )}
          {connection?.mode === 'partner' ? <PartnerMetaCard />
            : connection ? <MetaAccountCard />
            : (
              <div className="flex items-center gap-2 p-3 rounded border border-[#2C2B28] bg-[#0D0C0B] text-[10px] text-[#6B6560]">
                {error ? <><AlertTriangle size={10} className="text-[#C75F4F]" /> {error.message}</> : <><Loader2 size={10} className="animate-spin" /> Loading…</>}
              </div>
            )}

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
