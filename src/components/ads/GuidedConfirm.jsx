import { useEffect, useState } from 'react';
import {
  Music, Eye, Heart, AlertTriangle, Info, Calendar, MapPin, Users,
  Link2, Loader2, Plus, Check, Search, FileVideo, Sparkles, Image as ImageIcon, Pencil, Headphones,
} from 'lucide-react';
import DspIcon from './DspIcon';
import { previewStreamSources } from '../../data/streamCounts';
import AdImagesField from './AdImagesField';
import LyricVideoMaker from './LyricVideoMaker';
import AdVideoField from './AdVideoField';
import { FileUploadField, MetaRunAsPicker } from './DirectiveBuilder';
import { createSmartLink, lookupSmartLinks, artistPageSmartLinks, linksList, linksMap, foundSummary, linkTitle, SERVICE_LABELS } from '../../data/smartLinks';
import ServiceLinksEditor from './ServiceLinksEditor';
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
// The artist's smart link is filled in automatically. Without one, creating a smart link is the
// main action (it gives the campaign per-service click data); a plain link is a small fallback.

const isUrl = (v) => /^https?:\/\/\S+\.\S+/.test(v.trim());

function CreateSmartLink({ artist, onCreated, prominent }) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [release, setRelease] = useState(null); // lookup result: { title, artistName, imageUrl }
  const [links, setLinks] = useState(null); // { service: url } to review before creating
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const chosen = links ? linksList(links) : [];

  const find = async (artistPage) => {
    setBusy(true);
    setError(null);
    try {
      const r = artistPage ? await artistPageSmartLinks(artist.slug) : await lookupSmartLinks(sourceUrl.trim());
      if (artistPage) setSourceUrl('');
      setRelease(r);
      setLinks(linksMap(r.links));
      setFound(new Set(r.links.map(l => l.service)));
    } catch (e) {
      setError(e.message || 'Could not look up that link.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { link } = await createSmartLink({
        sourceUrl: sourceUrl.trim() || null, links: chosen, title: release?.title || undefined,
        artistSlug: artist?.slug, artistName: artist?.name || release?.artistName,
        imageUrl: release?.imageUrl || artist?.imageUrl || undefined,
      });
      onCreated(link);
    } catch (e) {
      setError(e.message || 'Could not create the smart link.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setLinks(null); setFound(null); setRelease(null); };
  const btnCls = 'flex items-center gap-1 px-3 py-2 text-[10px] font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] cursor-pointer disabled:cursor-default shrink-0';

  return (
    <div className={`rounded-lg border p-3 ${prominent ? 'border-[#DA7756]/50 bg-[#DA7756]/[0.07]' : 'border-[#2C2B28] bg-[#0D0C0B]'}`}>
      <p className="flex items-center gap-1.5 text-xs text-[#F5F0E8] font-medium">
        <Link2 size={12} className="text-[#DA7756]" />Create a smart link{artist?.name ? ` for ${artist.name}` : ''}
      </p>
      <p className="text-[10px] text-[#9B9590] mt-1 mb-2.5">
        One page with every streaming service. Fans pick theirs, and you see clicks to each service from this campaign.
      </p>
      <div className="flex gap-2">
        <input
          value={sourceUrl}
          onChange={e => { setSourceUrl(e.target.value); if (links) reset(); }}
          onKeyDown={e => { if (e.key === 'Enter' && isUrl(sourceUrl) && !busy && !links) find(false); }}
          placeholder="Spotify, Apple Music, Deezer or YouTube link to a release or artist"
          className={`${inputCls} font-mono`}
        />
        {!links && (
          <button onClick={() => find(false)} disabled={busy || !isUrl(sourceUrl)} className={btnCls}>
            {busy ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}{busy ? 'Finding…' : 'Find links'}
          </button>
        )}
      </div>
      {!links && artist?.slug && (
        <button onClick={() => find(true)} disabled={busy} className="mt-1.5 text-[10px] text-[#DA7756] hover:underline cursor-pointer disabled:opacity-40">
          Or link to {artist.name ? `${artist.name}'s` : 'the'} artist page instead
        </button>
      )}
      {links && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[10px] text-[#9B9590]">
            {found.size
              ? foundSummary(release, found.size)
              : 'No services found. Add the links yourself.'}
          </p>
          <ServiceLinksEditor links={links} found={found} onChange={setLinks} />
          <div className="flex justify-end">
            <button onClick={create} disabled={busy || !chosen.length} className={btnCls}>
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              {busy ? 'Creating…' : `Create smart link (${chosen.length} service${chosen.length === 1 ? '' : 's'})`}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-[9px] text-[#C75F4F] mt-1.5">
          {error}{!links && <> <button onClick={() => { setLinks({ spotify: '', appleMusic: '' }); setFound(new Set()); setError(null); }} className="text-[#DA7756] hover:underline cursor-pointer">Add links yourself</button></>}
        </p>
      )}
    </div>
  );
}

function DestinationField({ artist, smartLinks, destination, onDestination, onLinkCreated }) {
  const links = smartLinks || [];
  const ownLinks = links.filter(l => l.artistSlug === artist?.slug);
  const current = links.find(l => l.url === destination);
  const [editing, setEditing] = useState(false);
  const [plain, setPlain] = useState(false);
  const [creating, setCreating] = useState(false);
  const open = editing || !destination;

  const choose = (url) => { onDestination(url); setEditing(false); setPlain(false); setCreating(false); };
  const created = (link) => { onLinkCreated(link); choose(link.url); };

  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Where fans go when they tap the ad</label>
      {!open ? (
        <div className="flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-3 py-2">
          <Link2 size={12} className="text-[#DA7756] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#F5F0E8] truncate">{current ? linkTitle(current) : destination}</p>
            <p className="text-[9px] text-[#6B6560] truncate">{current ? 'Smart link · every streaming service on one page' : "Plain link · clicks per streaming service aren't tracked"}</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-[10px] text-[#DA7756] hover:underline cursor-pointer shrink-0">Change</button>
        </div>
      ) : plain ? (
        <div className="space-y-1.5">
          <input
            defaultValue={current ? '' : destination}
            onBlur={e => { if (isUrl(e.target.value)) choose(e.target.value.trim()); }}
            onKeyDown={e => { if (e.key === 'Enter' && isUrl(e.target.value)) choose(e.target.value.trim()); }}
            placeholder="https://…"
            className={`${inputCls} font-mono`}
            autoFocus
          />
          <button onClick={() => setPlain(false)} className="text-[10px] text-[#DA7756] hover:underline cursor-pointer">Create a smart link instead</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {ownLinks.map(l => (
            <button key={l.slug} onClick={() => choose(l.url)} className={`${choiceCls(l.url === destination)} w-full flex items-center gap-2 py-2`}>
              <Link2 size={12} className="text-[#DA7756] shrink-0" />
              <span className="text-xs text-[#F5F0E8] truncate">{linkTitle(l)}</span>
              <span className="text-[9px] text-[#6B6560] ml-auto shrink-0">Smart link</span>
            </button>
          ))}
          {!ownLinks.length || creating ? (
            <CreateSmartLink artist={artist} onCreated={created} prominent={!ownLinks.length} />
          ) : (
            <button onClick={() => setCreating(true)} className={`${choiceCls(false)} w-full flex items-center gap-2 py-2`}>
              <Plus size={12} className="text-[#DA7756] shrink-0" />
              <span className="text-xs text-[#F5F0E8]">Create a new smart link</span>
            </button>
          )}
          <button onClick={() => setPlain(true)} className="text-[10px] text-[#6B6560] hover:text-[#9B9590] cursor-pointer">Use a plain link instead</button>
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
  const [makingVideo, setMakingVideo] = useState(false);

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
          <p className="text-[10px] text-[#9B9590] mt-0.5">{platform === 'meta' ? 'Images or a video that link' : 'Upload a video that links'} to the release</p>
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
            <>
              <div className="flex gap-1">
                {[['images', 'Images'], ['video', 'Video']].map(([key, text]) => (
                  <button
                    key={key}
                    onClick={() => set({ metaMedia: key })}
                    className={`flex items-center gap-1 text-[9px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      (draft.metaMedia || 'images') === key ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]' : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                    }`}
                  >
                    {key === 'video' ? <FileVideo size={9} /> : <ImageIcon size={9} />}{text}
                  </button>
                ))}
              </div>
              {draft.metaMedia === 'video' ? (
                <AdVideoField value={draft.metaVideo} onChange={(metaVideo) => set({ metaVideo })} artist={artist} />
              ) : (
                <AdImagesField images={draft.images} onChange={(images) => set({ images })} fallbackImage={artist?.imageUrl} />
              )}
            </>
          ) : (
            <div>
              <FileUploadField
                label="Video (.mp4, .mov, .webm)"
                accept=".mp4,.webm,.mov,video/*"
                file={draft.videoFile}
                onChange={(videoFile) => set({ videoFile })}
                onClear={() => set({ videoFile: null })}
                icon={FileVideo}
                required
              />
              {!draft.videoFile && (
                <button onClick={() => setMakingVideo(true)} className="mt-2 w-full flex items-center gap-2 rounded-lg border border-[#DA7756]/40 bg-[#DA7756]/[0.07] hover:border-[#DA7756]/70 px-3 py-2.5 text-left cursor-pointer transition-colors">
                  <Sparkles size={12} className="text-[#DA7756] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-[#F5F0E8] font-medium">No video? Make a lyric video</span>
                    <span className="block text-[10px] text-[#9B9590]">Upload the song, paste the lyrics and tap along. Ready in about a minute.</span>
                  </span>
                </button>
              )}
              {makingVideo && (
                <LyricVideoMaker
                  artist={artist}
                  onClose={() => setMakingVideo(false)}
                  onDone={(videoFile) => { set({ videoFile }); setMakingVideo(false); }}
                />
              )}
            </div>
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

export default function GuidedConfirm({ plan, artist, campaigns, posts, errors, destinationLabel, onEditContent, onEditLink, streamTracking }) {
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
          const newVideo = c.mode === 'new' && (c.platform !== 'meta' || c.draft.metaMedia === 'video');
          const thumb = c.mode === 'boost' ? post?.thumbnailUrl : c.platform === 'meta' && !newVideo ? c.draft.images[0] : null;
          return (
            <div key={c.platform} className="p-3">
              <div className="flex items-center gap-3">
                {thumb ? (
                  <img src={thumb} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                    {newVideo ? <FileVideo size={13} className="text-[#6B6560]" /> : c.mode === 'new' ? <ImageIcon size={13} className="text-[#6B6560]" /> : <Music size={13} className="text-[#6B6560]" />}
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

      {plan.goal === 'streams' && streamTracking && <StreamTrackingSetup artist={artist} {...streamTracking} />}

      <p className="text-[10px] text-[#6B6560]">
        Building submits {campaigns.length === 1 ? 'this campaign' : `these ${campaigns.length} campaigns`} for approval. Nothing goes live or spends until you launch it from Campaigns.
      </p>
    </div>
  );
}

// Stream-goal campaigns: which of the release's links get a daily count. The links come
// from the release's smart link; YouTube is read from its API, Spotify is entered by hand.
function StreamTrackingSetup({ artist, smartLinks, linkSlug, onLinkSlug, youtubeUrl, onYoutubeUrl }) {
  const links = (smartLinks || []).filter(l => !artist?.slug || l.artistSlug === artist.slug);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!linkSlug) return;
    let cancelled = false;
    previewStreamSources(linkSlug)
      .then(r => { if (!cancelled) { setPreview({ slug: linkSlug, ...r }); setError(null); } })
      .catch(e => { if (!cancelled) { setPreview(null); setError(e.message); } });
    return () => { cancelled = true; };
  }, [linkSlug]);

  const current = preview?.slug === linkSlug ? preview : null;
  const hasYouTube = current?.tracked.some(t => t.service === 'youtube');

  return (
    <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#F5F0E8]">
        <Headphones size={11} className="text-[#DA7756]" />Stream tracking
      </p>
      <p className="text-[10px] text-[#6B6560] mt-0.5">
        Prelude records the release's streams on each service from today until the campaign ends, and shows them on the campaign page.
      </p>
      {links.length === 0 ? (
        <p className="text-[10px] text-[#D4A574] mt-2">No smart link for this artist yet, so streams can't be tracked. Add one on a new-post step, or start tracking from the campaign page later.</p>
      ) : (
        <>
          <select value={linkSlug || ''} onChange={e => onLinkSlug(e.target.value || null)} className={`${inputCls} mt-2`}>
            <option value="">Don't track streams</option>
            {links.map(l => <option key={l.slug} value={l.slug}>{linkTitle(l)}</option>)}
          </select>
          {linkSlug && !current && !error && <Loader2 size={11} className="animate-spin text-[#6B6560] mt-2" />}
          {error && <p className="text-[10px] text-[#C75F4F] mt-2">{error}</p>}
          {current && (
            <div className="mt-2 space-y-1">
              {current.tracked.map(t => (
                <p key={`${t.service}:${t.externalId}`} className="flex items-center gap-1.5 text-[10px] text-[#9B9590]">
                  <DspIcon service={t.service} size={10} />
                  <span className="text-[#F5F0E8]">{SERVICE_LABELS[t.service]}</span>
                  {t.service === 'youtube' ? 'views read daily' : 'plays entered by hand (Spotify has no API for them)'}
                </p>
              ))}
              {current.skipped.map(s => (
                <p key={s.service} className="flex items-center gap-1.5 text-[10px] text-[#6B6560]">
                  <DspIcon service={s.service} size={10} color="#6B6560" />{s.reason}
                </p>
              ))}
              {!hasYouTube && (
                <input
                  value={youtubeUrl}
                  onChange={e => onYoutubeUrl(e.target.value)}
                  placeholder="YouTube video link (optional; Prelude searches for it if left empty)"
                  className={`${inputCls} mt-1`}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
