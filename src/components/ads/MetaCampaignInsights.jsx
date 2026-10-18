import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { formatNumber, formatDollar } from '../../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { ListeningStats } from './SmartLinksPanel';
import DspIcon from './DspIcon';
import { SERVICE_LABELS, SERVICE_COLORS } from '../../data/smartLinks';

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
  BELOW_AVERAGE_35: ['Bottom 35%', '#C75F4F'],
  BELOW_AVERAGE_20: ['Bottom 20%', '#C75F4F'],
  BELOW_AVERAGE_10: ['Bottom 10%', '#C75F4F'],
};

/** One Meta ranking as a pill: colored dot + plain label (never color alone). */
function Rank({ title, value }) {
  const [text, color] = RANK[value] || (!value || value === 'UNKNOWN' ? ['Not ranked yet', '#6B6560'] : [value, '#9B9590']);
  return (
    <div className="flex-1 min-w-[120px] bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2">
      <p className="text-[10px] text-[#9B9590]">{title}</p>
      <p className="flex items-center gap-1.5 text-xs text-[#F5F0E8] mt-0.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />{text}
      </p>
    </div>
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

const shortDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Link taps per day; spend is in the tooltip (one measure per axis). */
function DailyTaps({ rows }) {
  if (!rows || rows.length < 2) return null;
  return (
    <div>
      <p className="text-[11px] text-[#9B9590] mb-2">Taps per day</p>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} {...GRID_STYLE} />
            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={shortDay} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              {...TOOLTIP_STYLE}
              cursor={{ fill: '#F5F0E8', opacity: 0.04 }}
              labelFormatter={shortDay}
              formatter={(v, n, item) => [`${formatNumber(v)} · ${money(item.payload.spend)} spent`, 'Link taps']}
            />
            <Bar dataKey="linkClicks" fill="#DA7756" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
        {summary && <span className="text-[10px] text-[#6B6560] truncate">{summary}</span>}
        <ChevronDown size={12} className={`ml-auto shrink-0 text-[#6B6560] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 space-y-4">{children}</div>}
    </div>
  );
}

const share = (n, of) => (of ? (n / of) * 100 : null);
const pctText = (v) => (v == null ? '' : v >= 10 ? `${Math.round(v)}%` : `${v.toFixed(1)}%`);

/** Streams gained across tracked services (only those whose gain may be shown). */
function streamGain(streams) {
  const counted = (streams?.sources || []).filter(s => s.showGain && s.gain != null);
  if (!counted.length) return null;
  return {
    gain: counted.reduce((t, s) => t + s.gain, 0),
    services: [...new Set(counted.map(s => (s.service === 'youtube' ? 'YouTube' : 'Spotify')))].join(' + '),
  };
}

/** Budget as a ring: spent of total, days left underneath. */
function BudgetRing({ spent, budget }) {
  const total = budget?.amount || 0;
  const frac = total ? Math.min(1, spent / total) : 0;
  const r = 30, c = 2 * Math.PI * r;
  const [now] = useState(() => Date.now());
  const daysLeft = budget?.end ? Math.ceil((Date.parse(budget.end) - now) / 86400000) : null;
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${money(spent)} of ${formatDollar(total)} spent`}>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#2C2B28" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="#DA7756" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 38 38)" />
        <text x="38" y="42" textAnchor="middle" fontSize="12" fill="#F5F0E8" fontFamily="'JetBrains Mono', monospace">{Math.round(frac * 100)}%</text>
      </svg>
      <div>
        <p className="text-sm font-mono text-[#F5F0E8]">{money(spent)}</p>
        <p className="text-[10px] text-[#9B9590]">of {formatDollar(total)}{budget?.period === 'daily' ? ' a day' : ''}</p>
        {daysLeft != null && <p className="text-[10px] text-[#6B6560] mt-0.5">{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'ended'}</p>}
      </div>
    </div>
  );
}

/** Funnel: each step narrower than the last, the number on the bar, the step-to-step rate between. */
function Funnel({ steps }) {
  const widths = [100, 80, 62, 46, 34];
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div
                className="h-8 rounded flex items-center px-3"
                style={{ width: `${widths[i]}%`, background: s.color || '#DA7756', opacity: s.color ? 1 : 1 - i * 0.12 }}
              >
                <span className="text-sm font-mono font-medium text-[#0D0C0B]">{s.value}</span>
              </div>
            </div>
            <div className="w-40 md:w-52 shrink-0">
              <p className="text-[11px] text-[#F5F0E8] leading-tight">{s.label}</p>
              {s.sub && <p className="text-[10px] text-[#6B6560]">{s.sub}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Where streaming taps went: one 100% bar split by service, with logos as the legend. */
function ServiceSplit({ byService, total }) {
  const rows = [...(byService || [])].filter(s => s.clicks > 0).sort((x, y) => y.clicks - x.clicks);
  if (!rows.length) return <p className="text-[11px] text-[#6B6560]">No streaming taps yet.</p>;
  return (
    <div>
      <div className="flex h-3 gap-[2px] rounded overflow-hidden">
        {rows.map(s => (
          <div key={s.service} title={`${SERVICE_LABELS[s.service] || s.service}: ${s.clicks}`}
            style={{ width: `${(s.clicks / Math.max(1, total)) * 100}%`, background: SERVICE_COLORS[s.service] || '#9B9590' }} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {rows.map(s => (
          <div key={s.service} className="flex items-center gap-2">
            <DspIcon service={s.service} size={14} />
            <span className="text-[11px] text-[#F5F0E8] flex-1 truncate">{SERVICE_LABELS[s.service] || s.service}</span>
            <span className="text-[11px] font-mono text-[#F5F0E8]">{formatNumber(s.clicks)}</span>
            <span className="text-[10px] font-mono text-[#6B6560] w-9 text-right">{pctText(share(s.clicks, total))}</span>
          </div>
        ))}
      </div>
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
            {ads.length > 1 && <p className="text-[10px] text-[#9B9590] mb-1">{a.name}</p>}
            <div className="flex flex-wrap gap-2">
              <Rank title="Quality" value={a.quality} />
              <Rank title="Engagement" value={a.engagement} />
              <Rank title="Conversion" value={a.conversion} />
            </div>
            {!ranked && (
              <p className="text-[10px] text-[#6B6560] mt-1.5">
                Meta hasn't ranked this ad{a.impressions != null ? ` (${fmtImpressions(a.impressions)})` : ''}. It ranks ads after about 500 impressions and doesn't rank every ad.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Meta campaign report (api/lib/meta-insights.js): results at a glance, the rest under "More detail". */
export default function MetaCampaignInsights({ live, link, streams, smartLink }) {
  const ins = live.insights;
  const { budget, breakdowns: br, ads } = live;
  const video = ins?.video;
  const issues = [...(live.issues || []), ...(ads || []).flatMap(a => a.issues)];
  const rejected = (ads || []).filter(a => a.rejected.length);

  const streamTaps = smartLink ? (link ? link.clicks : ins?.dspClicks ?? null) : null;
  const gained = streamGain(streams);
  const steps = ins ? [
    { value: formatNumber(ins.reach), label: 'People reached' },
    { value: formatNumber(ins.linkClicks), label: 'Clicks', sub: ins.costPerLinkClick ? `${money(ins.costPerLinkClick)} per click` : null },
    ...(streamTaps != null ? [{ value: formatNumber(streamTaps), label: 'Went to a streaming service', sub: streamTaps ? `${money(ins.spend / streamTaps)} each` : null }] : []),
    ...(gained ? [{ value: `+${formatNumber(gained.gain)}`, label: `Streams gained (${gained.services})`, color: '#7BAF73' }] : []),
  ] : [];

  return (
    <div className="space-y-5">
      {(issues.length > 0 || rejected.length > 0) && (
        <div className="p-3 rounded border border-[#C75F4F]/30 bg-[#C75F4F]/10 space-y-1">
          {rejected.flatMap(a => a.rejected.map(r => (
            <p key={`${a.id}-${r.reason}`} className="flex items-start gap-1 text-[11px] text-[#F5F0E8]">
              <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#C75F4F]" />
              Meta rejected {a.name || 'an ad'}: {r.detail || r.reason}
            </p>
          )))}
          {issues.map(i => (
            <p key={i} className="flex items-start gap-1 text-[11px] text-[#F5F0E8]">
              <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#C75F4F]" />{i}
            </p>
          ))}
        </div>
      )}

      {ins && (
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div>
            <Funnel steps={steps} />
            {!smartLink && <p className="text-[10px] text-[#6B6560] mt-2">Streams aren't measured: this ad doesn't link to a smart link.</p>}
          </div>
          <BudgetRing spent={ins.spend} budget={budget} />
        </div>
      )}

      {ins && (
        <div className={`grid gap-6 ${smartLink && link ? 'md:grid-cols-2' : ''}`}>
          {smartLink && link && (
            <div>
              <p className="text-[11px] text-[#9B9590] mb-2">Where they went to listen</p>
              <ServiceSplit byService={link.byService} total={link.clicks} />
            </div>
          )}
          <DailyTaps rows={live.daily} />
        </div>
      )}

      {ins && (
        <Expand title="More detail" summary="costs, engagement, who saw it, ad quality">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Impressions" value={formatNumber(ins.impressions)} />
            <Stat label="Frequency" value={ins.frequency ? ins.frequency.toFixed(2) : '–'} hint="Average times each person saw it" />
            <Stat label="CPM" value={money(ins.cpm)} hint="Cost per 1,000 impressions" />
            <Stat label="Link click rate" value={pct(ins.linkCtr)} />
            <Stat label="Engagements" value={formatNumber(ins.engagements)} hint="Reactions, comments, saves, shares and other taps" />
            <Stat label="Reactions" value={formatNumber(ins.reactions)} />
            <Stat label="Saves" value={formatNumber(ins.saves)} />
            <Stat label="Shares" value={formatNumber(ins.shares)} />
            {link && <Stat label="Smart link views" value={formatNumber(link.views)} />}
            {link?.fans > 0 && <Stat label="Spotify fans captured" value={formatNumber(link.fans)} />}
            {video && <Stat label="Video plays" value={formatNumber(video.plays)} />}
            {video && <Stat label="ThruPlays" value={formatNumber(video.thruplays)} hint="Watched to the end, or at least 15 seconds" />}
          </div>

          {video && (
            <Section title="How much of the video people watched">
              <Bars
                rows={[['25%', video.p25], ['50%', video.p50], ['75%', video.p75], ['100%', video.p100]]}
                total={Math.max(video.plays, video.p25)}
                name={r => `Watched ${r[0]}`}
                value={r => r[1]}
              />
            </Section>
          )}

          {br && (br.placement?.length > 0 || br.audience?.length > 0 || br.country?.length > 0) && (
            <div className="grid md:grid-cols-3 gap-x-6">
              {br.placement?.length > 0 && (
                <Section title="Where it ran">
                  <Bars rows={br.placement.slice(0, 6)} total={br.placement[0].impressions} name={placementName} />
                </Section>
              )}
              {br.audience?.length > 0 && (
                <Section title="Who saw it">
                  <Audience rows={br.audience} />
                </Section>
              )}
              {br.country?.length > 0 && (
                <Section title="Countries">
                  <Bars rows={br.country.slice(0, 6)} total={br.country[0].impressions} name={r => r.country} />
                </Section>
              )}
            </div>
          )}

          {link?.listening && (
            <Section title="Spotify listening by captured fans">
              <ListeningStats listening={link.listening} spend={ins.spend || 0} />
            </Section>
          )}

          {ads?.length > 0 && (
            <Section title="Ad quality (Meta's ranking against similar ads)">
              <Rankings ads={ads} />
            </Section>
          )}
        </Expand>
      )}
    </div>
  );
}
