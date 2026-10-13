import { useState } from 'react';
import { Link } from 'react-router';
import {
  Music, Eye, Heart, AlertTriangle, Info, Calendar, MapPin, Users,
  Link2, Loader2, Plus, Check, FileVideo, Sparkles, Image as ImageIcon, Pencil,
} from 'lucide-react';
import AdImagesField from './AdImagesField';
import { FileUploadField, MetaRunAsPicker } from './DirectiveBuilder';
import { createSmartLink } from '../../data/smartLinks';
import { PLATFORM_LABELS, OBJECTIVE_LABELS } from '../../data/directives';
import { postEngagement } from '../../utils/assistedCampaign';
import { PLATFORM_COLORS } from '../../constants/colors';
import { formatNumber, formatDollar } from '../../utils/formatters';

// Guided setup's last three steps: where fans go (smart link), what each
// platform's ad shows (one platform per screen), and a read-only confirmation.

const PLATFORM_COLOR_MAP = {
  meta: PLATFORM_COLORS.instagram,
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
};

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const inputCls = 'w-full bg-[#171614] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none';

const choiceCls = (selected) => `text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
  selected ? 'border-[#DA7756]/60 bg-[#DA7756]/10' : 'border-[#2C2B28] bg-[#0D0C0B] hover:border-[#3D3B37]'
}`;

function StepTitle({ title, hint }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-[#F5F0E8] mb-1">{title}</p>
      {hint && <p className="text-[10px] text-[#6B6560]">{hint}</p>}
    </div>
  );
}

// ─── Where fans go ───

export function GuidedLinkStep({ artist, smartLinks, destination, onDestination, onLinkCreated }) {
  const links = smartLinks || [];
  const sorted = [...links].sort((a, b) => (b.artistSlug === artist?.slug) - (a.artistSlug === artist?.slug));
  const isSmart = links.some(l => l.url === destination);
  const [mode, setMode] = useState(() => (destination && !isSmart ? 'url' : links.length ? 'pick' : 'create'));
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const effectiveMode = smartLinks && !links.length && mode === 'pick' ? 'create' : mode;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { link } = await createSmartLink({
        sourceUrl: sourceUrl.trim(),
        artistSlug: artist?.slug,
        artistName: artist?.name,
        imageUrl: artist?.imageUrl || undefined,
      });
      onLinkCreated(link);
      setMode('pick');
      setSourceUrl('');
    } catch (e) {
      setError(e.message || 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <StepTitle
        title="Where should fans go?"
        hint="A smart link is one page with every streaming service. Prelude tracks clicks to each service per campaign."
      />
      {smartLinks !== null && (
        <div className="space-y-2">
          {links.length > 0 && (
            <div role="button" tabIndex={0} onClick={() => setMode('pick')} className={`${choiceCls(effectiveMode === 'pick')} w-full`}>
              <p className="flex items-center gap-1.5 text-xs text-[#F5F0E8] font-medium">
                <Link2 size={12} className="text-[#DA7756]" />Use a smart link
                <span className="text-[8px] font-mono uppercase tracking-wider text-[#DA7756] border border-[#DA7756]/30 rounded px-1">Recommended</span>
              </p>
              {effectiveMode === 'pick' && (
                <div className="mt-2.5" onClick={e => e.stopPropagation()}>
                  <select value={sorted.find(l => l.url === destination)?.slug || ''} onChange={e => onDestination(links.find(l => l.slug === e.target.value)?.url || '')} className={inputCls}>
                    <option value="">Choose a smart link…</option>
                    {sorted.map(l => <option key={l.slug} value={l.slug}>{l.title}{l.artistName ? ` · ${l.artistName}` : ''}</option>)}
                  </select>
                  {isSmart && <p className="flex items-center gap-1 text-[9px] text-[#7BAF73] mt-1.5"><Check size={9} />Streaming-service clicks will be tracked per campaign.</p>}
                </div>
              )}
            </div>
          )}

          <div role="button" tabIndex={0} onClick={() => setMode('create')} className={`${choiceCls(effectiveMode === 'create')} w-full`}>
            <p className="flex items-center gap-1.5 text-xs text-[#F5F0E8] font-medium">
              <Plus size={12} className="text-[#DA7756]" />Create a smart link
              {!links.length && <span className="text-[8px] font-mono uppercase tracking-wider text-[#DA7756] border border-[#DA7756]/30 rounded px-1">Recommended</span>}
            </p>
            {!links.length && effectiveMode !== 'create' && (
              <p className="text-[10px] text-[#9B9590] mt-0.5">{artist?.name || 'This artist'} doesn't have one yet.</p>
            )}
            {effectiveMode === 'create' && (
              <div className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2">
                  <input
                    value={sourceUrl}
                    onChange={e => setSourceUrl(e.target.value)}
                    placeholder="Paste a Spotify, Apple Music or YouTube link to the release"
                    className={`${inputCls} font-mono`}
                    autoFocus
                  />
                  <button
                    onClick={create}
                    disabled={busy || !sourceUrl.trim()}
                    className="flex items-center gap-1 px-3 py-2 text-[10px] font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] cursor-pointer disabled:cursor-default shrink-0"
                  >
                    {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}Create
                  </button>
                </div>
                {error && <p className="text-[9px] text-[#C75F4F]">{error}</p>}
                <p className="text-[9px] text-[#6B6560]">Prelude finds the release on every service. Edit it later on the <Link to="/app/links" className="text-[#DA7756] hover:underline">Links</Link> page.</p>
              </div>
            )}
          </div>

          <div role="button" tabIndex={0} onClick={() => { if (effectiveMode !== 'url') { setMode('url'); if (isSmart) onDestination(''); } }} className={`${choiceCls(effectiveMode === 'url')} w-full`}>
            <p className="text-xs text-[#9B9590]">Use a plain URL</p>
            {effectiveMode === 'url' && (
              <div className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
                <input value={destination || ''} onChange={e => onDestination(e.target.value)} placeholder="https://open.spotify.com/track/…" className={`${inputCls} font-mono`} autoFocus />
                <p className="text-[9px] text-[#6B6560]">Clicks to a plain URL aren't tracked per streaming service.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── What one platform's ad shows ───

export function GuidedContentStep({ campaign, posts, artist, destinationLabel, recommendNew, onMode, onPost, onDraft, onOpenAccounts, onEditLink }) {
  const { platform, mode, draft } = campaign;
  const label = PLATFORM_LABELS[platform];
  const set = (patch) => onDraft(platform, patch);

  return (
    <div>
      <StepTitle title={`What should the ${label} ad show?`} hint={`${formatDollar(campaign.directive.budget?.amount || 0)} of the budget goes to ${label}.`} />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => posts.length && onMode(platform, 'boost')} disabled={!posts.length} className={`${choiceCls(mode === 'boost')} disabled:opacity-40 disabled:cursor-default`}>
          <p className="text-xs text-[#F5F0E8] font-medium">Boost a post</p>
          <p className="text-[10px] text-[#9B9590] mt-0.5">{posts.length ? 'Promote one that is already doing well' : `No ${label} posts found`}</p>
        </button>
        <button onClick={() => onMode(platform, 'new')} className={choiceCls(mode === 'new')}>
          <p className="flex items-center gap-1.5 text-xs text-[#F5F0E8] font-medium">
            New post
            {recommendNew && <span className="text-[8px] font-mono uppercase tracking-wider text-[#DA7756] border border-[#DA7756]/30 rounded px-1">Recommended</span>}
          </p>
          <p className="text-[10px] text-[#9B9590] mt-0.5">{platform === 'meta' ? 'Upload images that send' : 'Upload a video that sends'} fans to your link</p>
        </button>
      </div>

      {mode === 'boost' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {posts.map((p, i) => {
              const selected = campaign.postIndex === i;
              return (
                <button key={p.id} onClick={() => onPost(platform, i)} className={`relative rounded-lg border p-1.5 text-left transition-colors cursor-pointer ${selected ? 'border-[#DA7756]/60 bg-[#DA7756]/10' : 'border-[#2C2B28] bg-[#0D0C0B] hover:border-[#3D3B37]'}`}>
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="" className="w-full aspect-square object-cover rounded" />
                  ) : (
                    <div className="w-full aspect-square rounded bg-[#1C1B18] flex items-center justify-center"><Music size={16} className="text-[#6B6560]" /></div>
                  )}
                  <p className="text-[10px] text-[#F5F0E8] mt-1.5 line-clamp-2">{p.title || 'Untitled post'}</p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-[#6B6560]">
                    {p.views > 0 && <span className="inline-flex items-center gap-0.5"><Eye size={8} />{formatNumber(p.views)}</span>}
                    <span className="inline-flex items-center gap-0.5"><Heart size={8} />{formatNumber(postEngagement(p))}</span>
                    {i === 0 && <span className="text-[#7BAF73]">Top post</span>}
                  </div>
                  {selected && <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#DA7756] flex items-center justify-center"><Check size={10} className="text-[#0D0C0B]" /></span>}
                </button>
              );
            })}
          </div>
          {recommendNew && (
            <p className="flex items-start gap-1.5 text-[10px] text-[#9B9590] mt-3">
              <Sparkles size={10} className="mt-0.5 shrink-0 text-[#DA7756]" />
              A boost keeps the post's own link, so streaming clicks aren't tracked. A new post sends fans to your smart link.
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {platform === 'meta' && (
            <MetaRunAsPicker value={draft.runAsIgUserId} onChange={(v) => set({ runAsIgUserId: v })} onOpenAccounts={onOpenAccounts} />
          )}
          <div>
            <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Headline</label>
            <input value={draft.headline} onChange={e => set({ headline: e.target.value })} placeholder={`New music from ${artist?.name || 'the artist'}`} className={inputCls} />
          </div>
          {platform === 'meta' ? (
            <AdImagesField images={draft.images} onChange={(images) => set({ images })} fallbackImage={artist?.imageUrl} />
          ) : (
            <FileUploadField
              label="Video (.mp4, .mov, .webm)"
              accept=".mp4,.webm,.mov,video/*"
              file={draft.videoFile}
              onChange={(videoFile) => set({ videoFile })}
              onClear={() => set({ videoFile: null })}
              icon={FileVideo}
              required
            />
          )}
          <p className="flex items-center gap-1.5 text-[10px] text-[#9B9590]">
            <Link2 size={10} className="text-[#DA7756]" />
            {destinationLabel ? <>Sends fans to {destinationLabel}.</> : <span className="text-[#D4A574]">No destination chosen.</span>}
            <button onClick={onEditLink} className="text-[#DA7756] hover:underline cursor-pointer">Change</button>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Read-only confirmation ───

export default function GuidedConfirm({ plan, artist, campaigns, posts, errors, destinationLabel, onEditContent, onEditLink }) {
  const total = campaigns.reduce((sum, c) => sum + (c.directive.budget?.amount || 0), 0);
  const { schedule, audience } = plan;
  const anyNew = campaigns.some(c => c.mode === 'new');

  return (
    <div className="space-y-3">
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4" style={{ borderLeftWidth: 3, borderLeftColor: '#DA7756' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#F5F0E8]">{plan.title}</p>
            <p className="text-[10px] text-[#9B9590] mt-0.5">{artist?.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-mono text-[#F5F0E8]">{formatDollar(total)}</p>
            <p className="text-[9px] font-mono text-[#6B6560]">total budget</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] font-mono text-[#9B9590]">
          <span className="inline-flex items-center gap-1"><Calendar size={10} />{shortDate(schedule.startDate)} – {shortDate(schedule.endDate)} · {plan.days} days</span>
          <span className="inline-flex items-center gap-1"><MapPin size={10} />{audience.locations.join(', ')}</span>
          <span className="inline-flex items-center gap-1"><Users size={10} />Ages {audience.ageRange[0]}–{audience.ageRange[1]}</span>
          {anyNew && (
            <span className="inline-flex items-center gap-1">
              <Link2 size={10} />{destinationLabel || 'No destination'}
              <button onClick={onEditLink} className="text-[#6B6560] hover:text-[#DA7756] cursor-pointer" title="Change destination"><Pencil size={9} /></button>
            </span>
          )}
        </div>
        {plan.notes.map(n => (
          <p key={n} className="flex items-start gap-1.5 text-[10px] text-[#D4A574] mt-2">
            <Info size={10} className="mt-0.5 shrink-0" />{n}
          </p>
        ))}
      </div>

      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg divide-y divide-[#2C2B28]">
        {campaigns.map((c, i) => {
          const d = c.directive;
          const post = (posts[c.platform] || [])[c.postIndex];
          const amount = d.budget?.amount || 0;
          const error = errors[c.platform];
          const thumb = c.mode === 'boost' ? post?.thumbnailUrl : c.platform === 'meta' ? c.draft.images[0] : null;
          return (
            <div key={c.platform} className="p-3">
              <div className="flex items-center gap-3">
                {thumb ? (
                  <img src={thumb} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                    {c.mode === 'new' && c.platform !== 'meta' ? <FileVideo size={13} className="text-[#6B6560]" /> : c.mode === 'new' ? <ImageIcon size={13} className="text-[#6B6560]" /> : <Music size={13} className="text-[#6B6560]" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] text-[#F5F0E8] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLOR_MAP[c.platform] }} />
                    {PLATFORM_LABELS[c.platform]}
                    <span className="text-[9px] font-mono font-normal text-[#6B6560]">{c.mode === 'boost' ? 'Boost' : 'New post'} · {OBJECTIVE_LABELS[d.objective] || d.objective}</span>
                  </p>
                  <p className="text-[10px] text-[#9B9590] truncate mt-0.5">
                    {c.mode === 'boost' ? (post?.title || 'Untitled post') : (c.draft.headline || 'New post')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-[#F5F0E8]">{formatDollar(amount)}</p>
                  <p className="text-[9px] font-mono text-[#6B6560]">{total > 0 ? Math.round((amount / total) * 100) : 0}%</p>
                </div>
                <button onClick={() => onEditContent(i)} className="p-1 text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer" title={`Edit ${PLATFORM_LABELS[c.platform]}`}>
                  <Pencil size={11} />
                </button>
              </div>
              {error && (
                <p className="flex items-start gap-1 text-[10px] text-[#C75F4F] mt-2 pl-[52px]">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[#6B6560]">
        Building submits {campaigns.length === 1 ? 'this campaign' : `these ${campaigns.length} campaigns`} for approval. Nothing goes live or spends until you launch it from Campaigns.
      </p>
    </div>
  );
}
