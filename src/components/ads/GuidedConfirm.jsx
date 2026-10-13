import { useState } from 'react';
import { Link } from 'react-router';
import {
  Music, Eye, Heart, Shuffle, Trash2, AlertTriangle, Info, Calendar, MapPin, Users,
  Link2, Loader2, Plus, Check, FileVideo, Sparkles,
} from 'lucide-react';
import AdImagesField from './AdImagesField';
import { FileUploadField, MetaRunAsPicker } from './DirectiveBuilder';
import { createSmartLink } from '../../data/smartLinks';
import { PLATFORM_LABELS, OBJECTIVE_LABELS, PLATFORM_CONSTRAINTS } from '../../data/directives';
import { postEngagement, campaignIssue } from '../../utils/assistedCampaign';
import { PLATFORM_COLORS } from '../../constants/colors';
import { formatNumber, formatDollar } from '../../utils/formatters';

const PLATFORM_COLOR_MAP = {
  meta: PLATFORM_COLORS.instagram,
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
};

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const inputCls = 'w-full bg-[#171614] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none';

/**
 * Guided setup's last step: everything Prelude set up, editable in place, and
 * where the ads send people (a smart link, pushed as the default).
 */
export default function GuidedConfirm({
  plan, artist, campaigns, posts, errors, smartLinks, destination, onDestination, onLinkCreated,
  onBudget, onSwap, onRemove, onMode, onDraft, onOpenAccounts,
}) {
  const total = campaigns.reduce((sum, c) => sum + (c.directive.budget?.amount || 0), 0);
  const { schedule, audience } = plan;
  const streamsGoal = plan.goal === 'streams' || plan.answers?.promoting === 'release';

  return (
    <div className="space-y-3">
      {/* Summary */}
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
        </div>
        {plan.releaseNote && <p className="text-[10px] text-[#9B9590] mt-2">{plan.releaseNote}</p>}
        {plan.notes.map(n => (
          <p key={n} className="flex items-start gap-1.5 text-[10px] text-[#D4A574] mt-2">
            <Info size={10} className="mt-0.5 shrink-0" />{n}
          </p>
        ))}
      </div>

      <DestinationCard
        artist={artist}
        smartLinks={smartLinks}
        destination={destination}
        onDestination={onDestination}
        onLinkCreated={onLinkCreated}
        newPosts={campaigns.filter(c => c.mode === 'new').length}
      />

      {campaigns.length === 0 && (
        <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-6 text-center">
          <p className="text-xs text-[#F5F0E8] mb-1">No platforms left</p>
          <p className="text-[10px] text-[#6B6560]">Go back and pick at least one platform.</p>
        </div>
      )}

      {/* One card per campaign */}
      {campaigns.map(c => {
        const d = c.directive;
        const options = posts[c.platform] || [];
        const post = options[c.postIndex];
        const color = PLATFORM_COLOR_MAP[c.platform] || '#9B9590';
        const amount = d.budget?.amount || 0;
        const error = errors[c.platform];
        const issue = campaignIssue(c, destination);
        return (
          <div key={c.platform} className={`bg-[#0D0C0B] border rounded-lg p-3 ${error ? 'border-[#C75F4F]/40' : 'border-[#2C2B28]'}`}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-medium text-[#F5F0E8]">{PLATFORM_LABELS[c.platform]}</span>
              <span className="text-[9px] font-mono text-[#6B6560]">
                {OBJECTIVE_LABELS[d.objective] || d.objective} · {d.creative?.callToAction || 'Learn More'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex rounded border border-[#2C2B28] overflow-hidden">
                  {[
                    { key: 'boost', label: 'Boost a post', disabled: !options.length },
                    { key: 'new', label: 'New post' },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={() => !m.disabled && onMode(c.platform, m.key)}
                      disabled={m.disabled}
                      title={m.disabled ? `No ${PLATFORM_LABELS[c.platform]} posts to boost` : undefined}
                      className={`px-2 py-0.5 text-[9px] font-mono transition-colors ${
                        c.mode === m.key ? 'bg-[#DA7756]/15 text-[#F5F0E8]' : 'text-[#6B6560] hover:text-[#9B9590] cursor-pointer'
                      } disabled:opacity-40 disabled:cursor-default`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onRemove(c.platform)}
                  className="p-1 text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer"
                  title={`Remove ${PLATFORM_LABELS[c.platform]}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {c.mode === 'boost' ? (
                  <div className="flex items-center gap-3">
                    {post?.thumbnailUrl ? (
                      <img src={post.thumbnailUrl} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                        <Music size={14} className="text-[#6B6560]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#F5F0E8] line-clamp-2">{post?.title || 'Untitled post'}</p>
                      <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-[#6B6560]">
                        {post?.views > 0 && <span className="inline-flex items-center gap-1"><Eye size={9} />{formatNumber(post.views)}</span>}
                        <span className="inline-flex items-center gap-1"><Heart size={9} />{formatNumber(postEngagement(post))}</span>
                        {options.length > 1 && (
                          <button onClick={() => onSwap(c.platform)} className="inline-flex items-center gap-1 text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                            <Shuffle size={9} />Use another post ({c.postIndex + 1}/{options.length})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <NewPostFields campaign={c} artist={artist} onDraft={onDraft} onOpenAccounts={onOpenAccounts} />
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-0.5 bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/50 rounded px-2 py-1">
                  <span className="text-[10px] text-[#6B6560]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount ? amount.toLocaleString('en-US') : ''}
                    onChange={e => onBudget(c.platform, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                    className="bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-16 text-right"
                  />
                </div>
                <p className="text-[9px] font-mono text-[#6B6560] mt-1">{total > 0 ? Math.round((amount / total) * 100) : 0}% · lifetime</p>
              </div>
            </div>

            {c.mode === 'boost' && streamsGoal && destination && (
              <p className="flex items-start gap-1 text-[9px] text-[#9B9590] mt-2">
                <Sparkles size={9} className="mt-0.5 shrink-0 text-[#DA7756]" />
                A boost keeps the post's own link, so streaming clicks aren't tracked.{' '}
                <button onClick={() => onMode(c.platform, 'new')} className="text-[#DA7756] hover:underline cursor-pointer">Make it a new post</button>
                {' '}to send fans to your smart link.
              </p>
            )}
            {c.mode === 'new' && issue && (
              <p className="flex items-center gap-1 text-[9px] text-[#D4A574] mt-2"><AlertTriangle size={9} />{issue}</p>
            )}
            {c.platform === 'tiktok' && amount > 0 && amount < PLATFORM_CONSTRAINTS.tiktok.minBudget && (
              <p className="flex items-center gap-1 text-[9px] text-[#D4A574] mt-2">
                <AlertTriangle size={9} />TikTok requires at least {formatDollar(PLATFORM_CONSTRAINTS.tiktok.minBudget)} per campaign.
              </p>
            )}
            {error && (
              <p className="flex items-start gap-1 text-[10px] text-[#C75F4F] mt-2">
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}
              </p>
            )}
          </div>
        );
      })}

      {campaigns.length > 0 && (
        <p className="text-[10px] text-[#6B6560]">
          Confirming submits {campaigns.length === 1 ? 'this campaign' : `these ${campaigns.length} campaigns`} for approval. Nothing goes live or spends until you launch it from Campaigns.
        </p>
      )}
    </div>
  );
}

// ─── New post fields (Instagram: images; TikTok/YouTube: video) ───

function NewPostFields({ campaign, artist, onDraft, onOpenAccounts }) {
  const { platform, draft } = campaign;
  const set = (patch) => onDraft(platform, patch);
  return (
    <div className="space-y-2.5">
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
    </div>
  );
}

// ─── Destination: push the artist's smart link ───

function DestinationCard({ artist, smartLinks, destination, onDestination, onLinkCreated, newPosts }) {
  const [creating, setCreating] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [plainUrl, setPlainUrl] = useState(false);

  const links = smartLinks || [];
  const sorted = [...links].sort((a, b) => (b.artistSlug === artist?.slug) - (a.artistSlug === artist?.slug));
  const selected = links.find(l => l.url === destination);
  const showCreate = creating || (smartLinks && !links.length && !plainUrl);

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
      setCreating(false);
      setSourceUrl('');
    } catch (e) {
      setError(e.message || 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-[#0D0C0B] border rounded-lg p-4 ${selected ? 'border-[#7BAF73]/30' : 'border-[#DA7756]/30'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#F5F0E8]">
            <Link2 size={12} className="text-[#DA7756]" />Send fans to a smart link
          </p>
          <p className="text-[10px] text-[#9B9590] mt-0.5">
            One page with every streaming service. Prelude tracks clicks to each service per campaign{newPosts ? '' : ' (new posts link to it; boosts keep the post\'s own link)'}.
          </p>
        </div>
        <Link to="/app/links" className="text-[9px] font-mono text-[#6B6560] hover:text-[#F5F0E8] shrink-0">Manage links</Link>
      </div>

      {smartLinks === null ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[#6B6560]"><Loader2 size={10} className="animate-spin" />Loading your links…</p>
      ) : plainUrl ? (
        <div className="space-y-1.5">
          <input value={destination || ''} onChange={e => onDestination(e.target.value)} placeholder="https://open.spotify.com/track/…" className={`${inputCls} font-mono`} />
          <p className="text-[9px] text-[#6B6560]">
            Clicks to a plain URL aren't tracked per service.{' '}
            <button onClick={() => { setPlainUrl(false); onDestination(selected?.url || sorted[0]?.url || ''); }} className="text-[#DA7756] hover:underline cursor-pointer">Use a smart link instead</button>
          </p>
        </div>
      ) : showCreate ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#F5F0E8]">{links.length ? 'New smart link' : `${artist?.name || 'This artist'} has no smart link yet. Create one from the release:`}</p>
          <div className="flex gap-2">
            <input
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="Paste a Spotify, Apple Music or YouTube link to the release"
              className={`${inputCls} font-mono`}
            />
            <button
              onClick={create}
              disabled={busy || !sourceUrl.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] cursor-pointer disabled:cursor-default shrink-0"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}Create link
            </button>
          </div>
          {error && <p className="text-[9px] text-[#C75F4F]">{error}</p>}
          <p className="text-[9px] text-[#6B6560]">
            {links.length > 0 && <><button onClick={() => setCreating(false)} className="text-[#DA7756] hover:underline cursor-pointer">Pick an existing link</button>{' · '}</>}
            <button onClick={() => { setPlainUrl(true); setCreating(false); onDestination(''); }} className="hover:text-[#9B9590] hover:underline cursor-pointer">Use a plain URL instead</button>
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <select
            value={selected?.slug || ''}
            onChange={e => onDestination(links.find(l => l.slug === e.target.value)?.url || '')}
            className={inputCls}
          >
            <option value="">Choose a smart link…</option>
            {sorted.map(l => <option key={l.slug} value={l.slug}>{l.title}{l.artistName ? ` · ${l.artistName}` : ''}</option>)}
          </select>
          <div className="flex items-center justify-between">
            {selected ? (
              <p className="flex items-center gap-1 text-[9px] text-[#7BAF73]"><Check size={9} />Streaming-service clicks will be tracked per campaign.</p>
            ) : <span />}
            <p className="text-[9px] text-[#6B6560]">
              <button onClick={() => setCreating(true)} className="text-[#DA7756] hover:underline cursor-pointer">New smart link</button>
              {' · '}
              <button onClick={() => { setPlainUrl(true); onDestination(''); }} className="hover:text-[#9B9590] hover:underline cursor-pointer">Plain URL</button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
