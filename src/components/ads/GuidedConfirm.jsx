import { useState } from 'react';
import {
  Music, Eye, Heart, AlertTriangle, Info, Calendar, MapPin, Users,
  Link2, Check, FileVideo, Sparkles, Image as ImageIcon, Pencil,
} from 'lucide-react';
import AdImagesField from './AdImagesField';
import { FileUploadField, MetaRunAsPicker } from './DirectiveBuilder';
import { createSmartLink } from '../../data/smartLinks';
import { PLATFORM_LABELS, OBJECTIVE_LABELS } from '../../data/directives';
import { postEngagement } from '../../utils/assistedCampaign';
import { PLATFORM_COLORS } from '../../constants/colors';
import { formatNumber, formatDollar } from '../../utils/formatters';

// Guided setup's last steps: what each platform's ad shows (one platform per
// screen, including where a new post sends fans), and a read-only confirmation.

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

// ─── Where a new post sends fans ───
// The artist's smart link is picked automatically. A pasted release link is used right away and
// turned into a smart link in the background, so the user never has to know what one is up front.

const isUrl = (v) => /^https?:\/\/\S+\.\S+/.test(v.trim());

function DestinationField({ artist, smartLinks, destination, onDestination, onLinkCreated }) {
  const links = smartLinks || [];
  const ownLinks = links.filter(l => l.artistSlug === artist?.slug);
  const current = links.find(l => l.url === destination);
  const [editing, setEditing] = useState(false);
  const [pasted, setPasted] = useState('');
  const open = editing || !destination;

  const applyPasted = (value) => {
    const url = value.trim();
    if (!isUrl(url)) return;
    onDestination(url);
    setPasted('');
    setEditing(false);
    createSmartLink({ sourceUrl: url, artistSlug: artist?.slug, artistName: artist?.name, imageUrl: artist?.imageUrl || undefined })
      .then(({ link }) => link && onLinkCreated(link, url))
      .catch(() => {});
  };

  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Where fans go when they tap the ad</label>
      {!open ? (
        <div className="flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-3 py-2">
          <Link2 size={12} className="text-[#DA7756] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#F5F0E8] truncate">{current ? current.title : destination}</p>
            <p className="text-[9px] text-[#6B6560] truncate">{current ? 'Every streaming service on one page' : 'Pasted link'}</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-[10px] text-[#DA7756] hover:underline cursor-pointer shrink-0">Change</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {ownLinks.map(l => (
            <button key={l.slug} onClick={() => { onDestination(l.url); setEditing(false); }} className={`${choiceCls(l.url === destination)} w-full flex items-center gap-2 py-2`}>
              <Link2 size={12} className="text-[#DA7756] shrink-0" />
              <span className="text-xs text-[#F5F0E8] truncate">{l.title}</span>
            </button>
          ))}
          <input
            value={pasted}
            onChange={e => { setPasted(e.target.value); if (isUrl(e.target.value) && e.nativeEvent.inputType === 'insertFromPaste') applyPasted(e.target.value); }}
            onBlur={() => applyPasted(pasted)}
            onKeyDown={e => { if (e.key === 'Enter') applyPasted(pasted); }}
            placeholder={ownLinks.length ? 'Or paste a link to a different release' : 'Paste the Spotify, Apple Music or YouTube link to the release'}
            className={`${inputCls} font-mono`}
          />
        </div>
      )}
    </div>
  );
}

// ─── What one platform's ad shows ───

export function GuidedContentStep({ campaign, posts, artist, recommendNew, smartLinks, destination, onDestination, onLinkCreated, onMode, onPost, onDraft, onOpenAccounts }) {
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
          <p className="text-[10px] text-[#9B9590] mt-0.5">{platform === 'meta' ? 'Upload images that link' : 'Upload a video that links'} to the release</p>
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
              A boosted post can't link anywhere. A new post can send fans straight to the release on every streaming service.
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
          <DestinationField
            artist={artist}
            smartLinks={smartLinks}
            destination={destination}
            onDestination={onDestination}
            onLinkCreated={onLinkCreated}
          />
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
