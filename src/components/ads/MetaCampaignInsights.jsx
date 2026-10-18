import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ArrowRight } from 'lucide-react';
import { formatNumber, formatDollar } from '../../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { ServiceBars, ListeningStats } from './SmartLinksPanel';
import { SERVICE_LABELS } from '../../data/smartLinks';

// Meta reports money in the ad account's currency; Prelude accounts are USD.
const money = (n) => (n ? `$${n.toFixed(2)}` : '–');
const pct = (n) => (n ? `${n.toFixed(2)}%` : '–');
const label = 'text-[10px] font-mono text-[#9B9590] mb-2';

function Stat({ label: l, value, hint }) {
  return (
    <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded p-3" title={hint}>
      <p className="text-[9px] font-mono text-[#6B6560]">{l}</p>
      <p className="text-sm font-mono text-[#F5F0E8] mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="pt-3 border-t border-[#2C2B28]">
      <p className={label}>{title}</p>
      {children}
    </div>
  );
}

function Bars({ rows, total, name, value = r => r.impressions, fmt = formatNumber }) {
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={name(r)} className="flex items-center gap-2">
          <span className="text-[10px] text-[#F5F0E8] w-32 shrink-0 truncate">{name(r)}</span>
          <div className="flex-1 h-1.5 bg-[#2C2B28] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#DA7756]" style={{ width: `${(value(r) / Math.max(1, total)) * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-[#9B9590] w-14 text-right">{fmt(value(r))}</span>
        </div>
      ))}
    </div>
  );
}

const PLATFORM = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads' };
const POSITION = {
  feed: 'feed', instagram_reels: 'Reels', facebook_reels: 'Reels', instagram_stories: 'Stories', facebook_stories: 'Stories',
  instagram_explore: 'Explore', instagram_explore_grid_home: 'Explore home', instagram_profile_feed: 'profile feed',
  video_feeds: 'video feeds', marketplace: 'Marketplace', search: 'search', right_hand_column: 'right column',
};
const placementName = (r) => `${PLATFORM[r.platform] || r.platform} ${POSITION[r.position] || (r.position || '').replace(/_/g, ' ')}`;

const RANK = {
  ABOVE_AVERAGE: ['Above average', '#7BAF73'],
  AVERAGE: ['Average', '#D4A574'],
  BELOW_AVERAGE_35: ['Below avg (bottom 35%)', '#C75F4F'],
  BELOW_AVERAGE_20: ['Below avg (bottom 20%)', '#C75F4F'],
  BELOW_AVERAGE_10: ['Below avg (bottom 10%)', '#C75F4F'],
};

function Rank({ title, value }) {
  const [text, color] = RANK[value] || (!value || value === 'UNKNOWN' ? ['Not ranked', '#6B6560'] : [value, '#9B9590']);
  return (
    <span className="text-[10px] font-mono">
      <span className="text-[#6B6560]">{title}: </span><span style={{ color }}>{text}</span>
    </span>
  );
}

/** Audience by age, with women / men side by side. */
function Audience({ rows }) {
  const byAge = new Map();
  for (const r of rows) {
    const a = byAge.get(r.age) || { age: r.age, female: 0, male: 0, unknown: 0 };
    a[r.gender in a ? r.gender : 'unknown'] += r.impressions;
    byAge.set(r.age, a);
  }
  const ages = [...byAge.values()].sort((x, y) => (x.age < y.age ? -1 : 1));
  const max = Math.max(1, ...ages.map(a => a.female + a.male + a.unknown));
  return (
    <div className="space-y-1.5">
      {ages.map(a => (
        <div key={a.age} className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#F5F0E8] w-12 shrink-0">{a.age}</span>
          <div className="flex-1 h-1.5 bg-[#2C2B28] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#DA7756]" style={{ width: `${(a.female / max) * 100}%` }} />
            <div className="h-full bg-[#D4A574]" style={{ width: `${(a.male / max) * 100}%` }} />
            <div className="h-full bg-[#6B6560]" style={{ width: `${(a.unknown / max) * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-[#9B9590] w-14 text-right">{formatNumber(a.female + a.male + a.unknown)}</span>
        </div>
      ))}
      <p className="text-[9px] font-mono text-[#6B6560] flex gap-3">
        <span><span className="text-[#DA7756]">■</span> women</span>
        <span><span className="text-[#D4A574]">■</span> men</span>
        <span><span className="text-[#6B6560]">■</span> unknown</span>
        <span>· impressions</span>
      </p>
    </div>
  );
}

function Daily({ rows }) {
  if (!rows || rows.length < 2) return null;
  return (
    <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} {...GRID_STYLE} />
            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
            <YAxis yAxisId="spend" tick={AXIS_STYLE} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
            <YAxis yAxisId="clicks" orientation="right" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => (n === 'Spend' ? money(v) : formatNumber(v))} />
            <Bar yAxisId="spend" dataKey="spend" name="Spend" fill="#DA7756" opacity={0.6} radius={[2, 2, 0, 0]} />
            <Line yAxisId="clicks" dataKey="linkClicks" name="Link clicks" stroke="#7BAF73" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
    </div>
  );
}

/** A collapsed section: title + one-line summary, opens to the detail. */
function Expand({ title, summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#2C2B28]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 py-2.5 text-left cursor-pointer group">
        <span className="text-[11px] text-[#F5F0E8] group-hover:text-[#DA7756] shrink-0">{title}</span>
        {summary && <span className="text-[10px] font-mono text-[#6B6560] truncate">{summary}</span>}
        <ChevronDown size={12} className={`ml-auto shrink-0 text-[#6B6560] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

/** One step of the funnel: the number, what it means, and how it relates to the step before. */
function Step({ value, label, sub, last }) {
  return (
    <>
      <div className="min-w-0 flex-1 bg-[#0D0C0B] border border-[#2C2B28] rounded p-3">
        <p className="text-lg font-mono text-[#F5F0E8] leading-tight">{value}</p>
        <p className="text-[10px] text-[#9B9590] mt-0.5">{label}</p>
        {sub && <p className="text-[9px] font-mono text-[#6B6560] mt-0.5">{sub}</p>}
      </div>
      {!last && <ArrowRight size={12} className="hidden md:block shrink-0 self-center text-[#3D3B37]" />}
    </>
  );
}

const share = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : null);

/** Streams gained across tracked services (only those whose gain may be shown). */
function streamGain(streams) {
  const counted = (streams?.sources || []).filter(s => s.showGain && s.gain != null);
  if (!counted.length) return null;
  return {
    gain: counted.reduce((t, s) => t + s.gain, 0),
    services: [...new Set(counted.map(s => (s.service === 'youtube' ? 'YouTube' : 'Spotify')))].join(' + '),
  };
}

/**
 * Spend → people reached → link taps → streaming-service taps → streams gained, with
 * a plain explanation of how the ad leads to streams. Steps without data are left out.
 */
function Summary({ ins, budget, link, streams, smartLink, destination }) {
  const streamClicks = link ? link.clicks : ins.dspClicks;
  const gained = streamGain(streams);
  const steps = [
    { value: money(ins.spend), label: 'spent', sub: budget ? `of ${formatDollar(budget.amount)}${budget.period === 'daily' ? '/day' : ''}` : null },
    { value: formatNumber(ins.reach), label: 'people saw the ad', sub: ins.spend && ins.reach ? `${money((ins.spend / ins.reach) * 1000)} per 1,000 people` : null },
    { value: formatNumber(ins.linkClicks), label: smartLink ? 'tapped through to the song' : 'tapped the link', sub: [share(ins.linkClicks, ins.reach), ins.costPerLinkClick ? `${money(ins.costPerLinkClick)} each` : null].filter(Boolean).join(' · ') },
  ];
  if (smartLink && streamClicks != null) {
    steps.push({
      value: formatNumber(streamClicks),
      label: 'opened a streaming service',
      sub: [share(streamClicks, ins.linkClicks), streamClicks && ins.spend ? `${money(ins.spend / streamClicks)} each` : null].filter(Boolean).join(' · '),
    });
  }
  if (gained) {
    steps.push({ value: `${gained.gain >= 0 ? '+' : ''}${formatNumber(gained.gain)}`, label: 'streams gained', sub: `${gained.services}, all listeners` });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:flex gap-2">
        {steps.map((s, i) => <Step key={s.label} {...s} last={i === steps.length - 1} />)}
      </div>
      <p className="text-[10px] text-[#9B9590] leading-relaxed">
        {smartLink ? (
          <>
            How this drives streams: the ad sends people to the song's smart link, where they pick a streaming service. Each service tap is
            someone heading to play the song.{' '}
            {gained
              ? 'Streams gained counts every listener, not only people from the ad, so compare it with the days before launch (Streams panel).'
              : 'Track the release\'s streams to see the lift during the campaign.'}
          </>
        ) : destination ? (
          <>The ad sends people to {destination}. Prelude can't see what they do there, so streams from this ad aren't measured. A smart link as the destination counts streaming taps.</>
        ) : (
          <>This ad is optimized for reach and engagement on Instagram, so it doesn't send people to the song directly.</>
        )}
      </p>
    </div>
  );
}

const fmtImpressions = (n) => (n == null ? null : `${Number(n).toLocaleString('en-US')} impressions`);

/** Meta's quality / engagement / conversion rankings per ad. */
function Rankings({ ads }) {
  return (
    <div className="space-y-2">
      {ads.map(a => {
        const ranked = [a.quality, a.engagement, a.conversion].some(v => v && v !== 'UNKNOWN');
        return (
          <div key={a.id}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {ads.length > 1 && <span className="text-[10px] text-[#F5F0E8]">{a.name}</span>}
              <Rank title="Quality" value={a.quality} />
              <Rank title="Engagement" value={a.engagement} />
              <Rank title="Conversion" value={a.conversion} />
            </div>
            {!ranked && (
              <p className="text-[9px] font-mono text-[#6B6560] mt-1">
                {a.quality == null && a.engagement == null && a.conversion == null
                  ? 'Meta sent no rankings for this ad.'
                  : `Meta hasn't ranked this ad yet (it returned UNKNOWN${a.impressions != null ? ` at ${fmtImpressions(a.impressions)}` : ''}).`}
                {a.impressions != null && a.impressions < 500 ? ' Meta ranks an ad after about 500 impressions.' : ' Meta ranks ads after about 500 impressions, compares them with ads competing for the same audience, and doesn\'t rank every ad.'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Everything Meta reports for a campaign (see api/lib/meta-insights.js): a short summary, details on demand. */
export default function MetaCampaignInsights({ live, link, streams, smartLink, destination }) {
  const ins = live.insights;
  const { budget, breakdowns: br, ads } = live;
  const video = ins?.video;
  const issues = [...(live.issues || []), ...(ads || []).flatMap(a => a.issues)];
  const rejected = (ads || []).filter(a => a.rejected.length);
  const topPlacement = br?.placement?.[0];
  const topService = [...(link?.byService || [])].sort((x, y) => y.clicks - x.clicks)[0];

  return (
    <div className="space-y-3">
      {(issues.length > 0 || rejected.length > 0) && (
        <div className="p-3 rounded border border-[#C75F4F]/30 bg-[#C75F4F]/10 space-y-1">
          {rejected.flatMap(a => a.rejected.map(r => (
            <p key={`${a.id}-${r.reason}`} className="flex items-start gap-1 text-[10px] text-[#F5F0E8]">
              <AlertTriangle size={10} className="mt-0.5 shrink-0 text-[#C75F4F]" />
              Meta rejected {a.name || 'an ad'}: {r.detail || r.reason}
            </p>
          )))}
          {issues.map(i => (
            <p key={i} className="flex items-start gap-1 text-[10px] text-[#F5F0E8]">
              <AlertTriangle size={10} className="mt-0.5 shrink-0 text-[#C75F4F]" />{i}
            </p>
          ))}
        </div>
      )}

      {ins && <Summary ins={ins} budget={budget} link={link} streams={streams} smartLink={smartLink} destination={destination} />}

      <div>
        {smartLink && link && (
          <Expand title="Streaming services" summary={link.clicks ? `${formatNumber(link.clicks)} taps${topService ? ` · most on ${SERVICE_LABELS[topService.service] || topService.service}` : ''}` : 'no taps yet'}>
            <div className={`grid grid-cols-2 ${link.fans ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-2`}>
              <Stat label="Smart link views" value={formatNumber(link.views)} />
              <Stat label="Streaming taps" value={formatNumber(link.clicks)} />
              <Stat label="Tap rate" value={link.views ? `${(link.clickRate * 100).toFixed(1)}%` : '–'} hint="Share of smart link visitors who picked a service" />
              <Stat label="Cost / streaming tap" value={link.clicks && ins?.spend ? money(ins.spend / link.clicks) : '–'} />
              {link.fans > 0 && <Stat label="Spotify fans captured" value={formatNumber(link.fans)} />}
            </div>
            <ServiceBars byService={link.byService} total={link.clicks} />
            {ins?.dspClicks > 0 && (
              <p className="text-[9px] font-mono text-[#6B6560]">Meta attributes {formatNumber(ins.dspClicks)} of them to this ad ({money(ins.costPerDspClick)} each).</p>
            )}
            {link.listening && (
              <div>
                <p className={label}>Spotify listening by captured fans (after their tap)</p>
                <ListeningStats listening={link.listening} spend={ins?.spend || 0} />
              </div>
            )}
          </Expand>
        )}

        {ins && (
          <Expand title="Cost and delivery" summary={`${formatNumber(ins.impressions)} impressions · ${money(ins.cpm)} per 1,000`}>
            {budget && (
              <p className="text-[9px] font-mono text-[#6B6560]">
                Budget {formatDollar(budget.amount)}{budget.period === 'daily' ? '/day' : ' total'}
                {budget.remaining ? ` · ${money(budget.remaining)} left` : ''}
                {budget.start ? ` · from ${budget.start.slice(0, 10)}` : ''}
                {budget.end ? ` to ${budget.end.slice(0, 10)}` : ''}
                {live.objective ? ` · ${live.objective.replace('OUTCOME_', '').toLowerCase()} objective` : ''}
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Spend" value={money(ins.spend)} />
              <Stat label="Reach" value={formatNumber(ins.reach)} hint="People who saw the ad at least once" />
              <Stat label="Impressions" value={formatNumber(ins.impressions)} />
              <Stat label="Frequency" value={ins.frequency ? ins.frequency.toFixed(2) : '–'} hint="Average times each person saw it" />
              <Stat label="Link clicks" value={formatNumber(ins.linkClicks)} hint="Clicks to the destination link (not likes or profile taps)" />
              <Stat label="Cost / link click" value={money(ins.costPerLinkClick)} />
              <Stat label="Link click rate" value={pct(ins.linkCtr)} />
              <Stat label="CPM" value={money(ins.cpm)} hint="Cost per 1,000 impressions" />
              {ins.landingPageViews > 0 && <Stat label="Landing page views" value={formatNumber(ins.landingPageViews)} />}
              <Stat label="All clicks" value={formatNumber(ins.clicks)} hint="Every click, including likes and profile taps" />
            </div>
          </Expand>
        )}

        {live.daily?.length > 1 && (
          <Expand title="Day by day" summary="spend (bars) and link clicks (line)">
            <Daily rows={live.daily} />
          </Expand>
        )}

        {ins && (
          <Expand title="Engagement" summary={`${formatNumber(ins.engagements)} total`}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Total" value={formatNumber(ins.engagements)} />
              <Stat label="Reactions" value={formatNumber(ins.reactions)} />
              <Stat label="Comments" value={formatNumber(ins.comments)} />
              <Stat label="Saves" value={formatNumber(ins.saves)} />
              <Stat label="Shares" value={formatNumber(ins.shares)} />
            </div>
          </Expand>
        )}

        {video && (
          <Expand title="Video" summary={`${formatNumber(video.plays)} plays · ${formatNumber(video.thruplays)} ThruPlays`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Stat label="Plays" value={formatNumber(video.plays)} />
              <Stat label="ThruPlays" value={formatNumber(video.thruplays)} hint="Watched to the end, or at least 15 seconds" />
              <Stat label="Avg watch time" value={video.avgWatchSeconds ? `${video.avgWatchSeconds}s` : '–'} />
            </div>
            <Bars
              rows={[['25%', video.p25], ['50%', video.p50], ['75%', video.p75], ['100%', video.p100]]}
              total={Math.max(video.plays, video.p25)}
              name={r => `Watched ${r[0]}`}
              value={r => r[1]}
            />
          </Expand>
        )}

        {br && (br.placement?.length > 0 || br.audience?.length > 0 || br.country?.length > 0) && (
          <Expand title="Where it ran and who saw it" summary={topPlacement ? `mostly ${placementName(topPlacement)}` : null}>
            <div className="grid md:grid-cols-3 gap-x-6">
              {br.placement?.length > 0 && (
                <Section title="Where it ran (impressions)">
                  <Bars rows={br.placement.slice(0, 6)} total={br.placement[0].impressions} name={placementName} />
                </Section>
              )}
              {br.audience?.length > 0 && (
                <Section title="Who saw it">
                  <Audience rows={br.audience} />
                </Section>
              )}
              {br.country?.length > 0 && (
                <Section title="Top countries (impressions)">
                  <Bars rows={br.country.slice(0, 6)} total={br.country[0].impressions} name={r => r.country} />
                </Section>
              )}
            </div>
          </Expand>
        )}

        {ads?.length > 0 && (
          <Expand title="Ad quality" summary="Meta's rankings vs. ads competing for the same audience">
            <Rankings ads={ads} />
          </Expand>
        )}
      </div>
    </div>
  );
}
