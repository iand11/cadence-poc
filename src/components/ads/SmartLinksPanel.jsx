import { useState } from 'react';
import { Link2, Plus, Copy, Check, ExternalLink, Trash2, Loader2, AlertTriangle, ChevronDown, MousePointerClick, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAsync } from '../../hooks/useAsync';
import { useFollowedArtists } from '../../context/FollowedArtistsContext';
import { useDirectives } from '../../hooks/useDirectives';
import {
  fetchSmartLinks, fetchSmartLink, fetchPixels, createSmartLink, updateSmartLink, deleteSmartLink,
  SERVICE_LABELS, SERVICE_COLORS,
} from '../../data/smartLinks';
import { AXIS_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/formatters';

const inputCls = 'w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none';
const labelCls = 'text-[9px] font-mono text-[#9B9590] mb-1 block';
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}
      className="p-1 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer"
      title="Copy link"
    >
      {copied ? <Check size={11} className="text-[#7BAF73]" /> : <Copy size={11} />}
    </button>
  );
}

function PixelSelect({ value, onChange, pixels, disabled }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)} disabled={disabled} className={inputCls}>
      <option value="">No Meta Pixel (Prelude tracking only)</option>
      {(pixels || []).map(p => <option key={p.id} value={p.id}>{p.name} · {p.adAccountId}</option>)}
    </select>
  );
}

function NewLinkForm({ pixels, onCreated, onCancel }) {
  const { followedArtists } = useFollowedArtists();
  const [sourceUrl, setSourceUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artistSlug, setArtistSlug] = useState('');
  const [pixelId, setPixelId] = useState(null);
  const [manual, setManual] = useState(false);
  const [manualLinks, setManualLinks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const artist = (followedArtists || []).find(a => a.slug === artistSlug);
    try {
      const { link } = await createSmartLink({
        sourceUrl: sourceUrl || null,
        title: title || null,
        artistSlug: artistSlug || null,
        artistName: artist?.name || null,
        imageUrl: manual ? artist?.imageUrl || null : null,
        pixelId,
        links: manual ? Object.entries(manualLinks).filter(([, url]) => url).map(([service, url]) => ({ service, url })) : undefined,
      });
      onCreated(link);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded border border-[#2C2B28] bg-[#0D0C0B] space-y-3 mb-4">
      <div>
        <label className={labelCls}>Release link (Spotify, Apple Music, YouTube…)</label>
        <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://open.spotify.com/track/..." className={`${inputCls} font-mono`} />
        <p className="text-[9px] text-[#6B6560] mt-1">
          Prelude finds the release on every service.{' '}
          <button onClick={() => setManual(m => !m)} className="text-[#DA7756] hover:underline cursor-pointer">
            {manual ? 'Find links automatically' : 'Add service links yourself'}
          </button>
        </p>
      </div>
      {manual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(SERVICE_LABELS).map(([service, label]) => (
            <div key={service}>
              <label className={labelCls}>{label}</label>
              <input
                value={manualLinks[service] || ''}
                onChange={e => setManualLinks(m => ({ ...m, [service]: e.target.value }))}
                placeholder="https://..."
                className={`${inputCls} font-mono`}
              />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Title {manual ? '' : '(optional, defaults to the release title)'}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="EMBERS" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Artist</label>
          <select value={artistSlug} onChange={e => setArtistSlug(e.target.value)} className={inputCls}>
            <option value="">Choose an artist you follow…</option>
            {(followedArtists || []).map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Meta Pixel (sends streaming clicks to Meta)</label>
        <PixelSelect value={pixelId} onChange={setPixelId} pixels={pixels} />
      </div>
      {error && (
        <p className="flex items-start gap-1 text-[10px] text-[#C75F4F]"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] px-3 py-1.5 cursor-pointer">Cancel</button>
        <button
          onClick={submit}
          disabled={busy || (!sourceUrl && !manual)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 disabled:opacity-40 rounded px-3 py-1.5 cursor-pointer"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          {busy ? 'Finding links…' : 'Create link'}
        </button>
      </div>
    </div>
  );
}

function ServiceBars({ byService, total }) {
  if (!byService?.length) return <p className="text-[10px] text-[#6B6560]">No streaming clicks yet.</p>;
  return (
    <div className="space-y-1.5">
      {byService.map(s => (
        <div key={s.service} className="flex items-center gap-2">
          <span className="text-[10px] text-[#F5F0E8] w-24 shrink-0">{SERVICE_LABELS[s.service] || s.service}</span>
          <div className="flex-1 h-1.5 bg-[#2C2B28] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(s.clicks / Math.max(1, total)) * 100}%`, backgroundColor: SERVICE_COLORS[s.service] || '#DA7756' }} />
          </div>
          <span className="text-[10px] font-mono text-[#9B9590] w-14 text-right">{formatNumber(s.clicks)}</span>
        </div>
      ))}
    </div>
  );
}

export { ServiceBars };

function LinkDetail({ slug, pixels, onChanged, onDeleted }) {
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useAsync(() => fetchSmartLink(slug), [slug, version]);
  const { directives } = useDirectives();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <p className="flex items-center gap-1.5 text-[10px] text-[#6B6560] p-4"><Loader2 size={10} className="animate-spin" /> Loading…</p>;
  if (error) return <p className="text-[10px] text-[#C75F4F] p-4">{error.message}</p>;
  const { link, stats, daily, byCampaign } = data;
  const campaignName = (id) => {
    const d = directives.find(x => x.id === id);
    return d ? `${d.artistName || d.artistSlug} · ${d.creative?.headline || d.objective || d.platform}` : id;
  };

  const run = async (fn) => {
    setBusy(true);
    setActionError(null);
    try { await fn(); } catch (e) { setActionError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-4 border-t border-[#2C2B28] grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div>
        <p className={labelCls}>Clicks by service</p>
        <ServiceBars byService={stats.byService} total={stats.clicks} />
        <p className="text-[9px] text-[#6B6560] mt-2">{formatNumber(stats.adClicks)} of {formatNumber(stats.clicks)} clicks came from Meta ads.</p>
      </div>
      <div>
        <p className={labelCls}>Last 30 days</p>
        {daily.length ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <XAxis dataKey="day" {...AXIS_STYLE} tickFormatter={d => d.slice(5)} />
                <YAxis {...AXIS_STYLE} width={28} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="views" fill="#6B6560" name="Views" />
                <Bar dataKey="clicks" fill="#DA7756" name="Streaming clicks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-[10px] text-[#6B6560]">No visits yet.</p>}
      </div>
      <div className="space-y-3">
        <div>
          <p className={labelCls}>By campaign</p>
          {byCampaign.length ? byCampaign.map(c => (
            <div key={c.campaign} className="flex items-center justify-between text-[10px] py-0.5">
              <span className="text-[#F5F0E8] truncate mr-2">{campaignName(c.campaign)}</span>
              <span className="font-mono text-[#9B9590] shrink-0">{formatNumber(c.clicks)} / {formatNumber(c.views)}</span>
            </div>
          )) : <p className="text-[10px] text-[#6B6560]">Use this link as an ad's destination to see clicks per campaign.</p>}
        </div>
        <div>
          <p className={labelCls}>Meta Pixel</p>
          <PixelSelect
            value={link.pixelId}
            pixels={pixels}
            disabled={busy}
            onChange={(pixelId) => run(async () => { await updateSmartLink(slug, { pixelId }); setVersion(v => v + 1); onChanged(); })}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {link.links.map(l => (
            <a key={l.service} href={l.url} target="_blank" rel="noreferrer" className="text-[9px] font-mono px-2 py-0.5 rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8]">
              {SERVICE_LABELS[l.service] || l.service}
            </a>
          ))}
        </div>
        <button
          onClick={() => window.confirm('Delete this link? Ads pointing at it will stop working.') && run(async () => { await deleteSmartLink(slug); onDeleted(); })}
          disabled={busy}
          className="flex items-center gap-1 text-[10px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer"
        >
          <Trash2 size={10} /> Delete link
        </button>
        {actionError && <p className="text-[10px] text-[#C75F4F]">{actionError}</p>}
      </div>
    </div>
  );
}

/** Campaigns → Links: smart links with views and streaming-service clicks. */
export default function SmartLinksPanel() {
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useAsync(fetchSmartLinks, [version]);
  const pixelsState = useAsync(() => fetchPixels().catch(() => ({ pixels: [] })), []);
  const pixels = pixelsState.data?.pixels || [];
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const reload = () => setVersion(v => v + 1);
  const links = data?.links || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-[#F5F0E8] font-medium">Smart links</p>
          <p className="text-[10px] text-[#6B6560]">One page with every streaming service. Use it as an ad's destination to track clicks through to Spotify, Apple Music and the rest.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded cursor-pointer shrink-0"
          >
            <Plus size={11} /> New link
          </button>
        )}
      </div>

      {creating && (
        <NewLinkForm
          pixels={pixels}
          onCancel={() => setCreating(false)}
          onCreated={(link) => { setCreating(false); setOpen(link.slug); reload(); }}
        />
      )}

      {loading && !data ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[#6B6560]"><Loader2 size={10} className="animate-spin" /> Loading links…</p>
      ) : error ? (
        <p className="text-[10px] text-[#C75F4F]">{error.message}</p>
      ) : links.length === 0 && !creating ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Link2 size={20} className="text-[#DA7756] mb-3" />
          <p className="text-sm text-[#F5F0E8] mb-1">No smart links yet</p>
          <p className="text-[11px] text-[#6B6560] max-w-xs">Create one from a Spotify or Apple Music link, then pick it as the destination when you create a Meta ad.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map(l => (
            <div key={l.slug} className="rounded border border-[#2C2B28] bg-[#171614]">
              <div
                onClick={() => setOpen(o => (o === l.slug ? null : l.slug))}
                className="flex items-center gap-3 p-3 cursor-pointer"
              >
                {l.imageUrl ? <img src={l.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" /> : <div className="w-9 h-9 rounded bg-[#2C2B28] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F5F0E8] truncate">{l.title}{l.artistName ? <span className="text-[#6B6560]"> · {l.artistName}</span> : null}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-[#6B6560] truncate">{l.url}</span>
                    <CopyButton text={l.url} />
                    <a href={l.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1 text-[#6B6560] hover:text-[#F5F0E8]" title="Open link"><ExternalLink size={11} /></a>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div><p className="flex items-center gap-1 text-[9px] font-mono text-[#6B6560]"><Eye size={9} /> Views</p><p className="text-xs font-mono text-[#F5F0E8]">{formatNumber(l.views)}</p></div>
                  <div><p className="flex items-center gap-1 text-[9px] font-mono text-[#6B6560]"><MousePointerClick size={9} /> Streaming clicks</p><p className="text-xs font-mono text-[#F5F0E8]">{formatNumber(l.clicks)}</p></div>
                  <div><p className="text-[9px] font-mono text-[#6B6560]">Click rate</p><p className="text-xs font-mono text-[#F5F0E8]">{l.views ? pct(l.clicks / l.views) : '–'}</p></div>
                  <ChevronDown size={12} className={`text-[#6B6560] transition-transform ${open === l.slug ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {open === l.slug && (
                <LinkDetail slug={l.slug} pixels={pixels} onChanged={reload} onDeleted={() => { setOpen(null); reload(); }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
