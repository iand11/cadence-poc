import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatNumber, formatDollar } from '../../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';

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
  const [text, color] = RANK[value] || ['Not enough data', '#6B6560'];
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
    <Section title="By day: spend (bars) and link clicks (line)">
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
    </Section>
  );
}

/** Everything Meta reports for a campaign (see api/lib/meta-insights.js). */
export default function MetaCampaignInsights({ live }) {
  const ins = live.insights;
  const { budget, breakdowns: br, ads } = live;
  const video = ins?.video;
  const issues = [...(live.issues || []), ...(ads || []).flatMap(a => a.issues)];
  const rejected = (ads || []).filter(a => a.rejected.length);

  return (
    <div className="space-y-3">
      {budget && (
        <p className="text-[9px] font-mono text-[#6B6560]">
          Budget {formatDollar(budget.amount)}{budget.period === 'daily' ? '/day' : ' total'}
          {budget.remaining ? ` · ${money(budget.remaining)} left` : ''}
          {budget.start ? ` · from ${budget.start.slice(0, 10)}` : ''}
          {budget.end ? ` to ${budget.end.slice(0, 10)}` : ''}
          {live.objective ? ` · ${live.objective.replace('OUTCOME_', '').toLowerCase()} objective` : ''}
        </p>
      )}

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

      {ins && (
        <>
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
            {ins.dspClicks > 0 && <Stat label="Streaming clicks (Meta)" value={formatNumber(ins.dspClicks)} hint="DSPClick events Meta attributes to this ad" />}
            {ins.dspClicks > 0 && <Stat label="Cost / streaming click (Meta)" value={money(ins.costPerDspClick)} />}
            <Stat label="All clicks" value={formatNumber(ins.clicks)} hint="Every click, including likes and profile taps" />
          </div>

          <Section title="Engagement">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Total" value={formatNumber(ins.engagements)} />
              <Stat label="Reactions" value={formatNumber(ins.reactions)} />
              <Stat label="Comments" value={formatNumber(ins.comments)} />
              <Stat label="Saves" value={formatNumber(ins.saves)} />
              <Stat label="Shares" value={formatNumber(ins.shares)} />
            </div>
          </Section>

          {video && (
            <Section title="Video">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
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
            </Section>
          )}
        </>
      )}

      <Daily rows={live.daily} />

      {br && (
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
      )}

      {ads?.some(a => a.quality || a.engagement || a.conversion) && (
        <Section title="Ad rankings vs. ads competing for the same audience">
          <div className="space-y-1.5">
            {ads.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {ads.length > 1 && <span className="text-[10px] text-[#F5F0E8]">{a.name}</span>}
                <Rank title="Quality" value={a.quality} />
                <Rank title="Engagement" value={a.engagement} />
                <Rank title="Conversion" value={a.conversion} />
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-[#6B6560] mt-1">Meta ranks an ad once it has about 500 impressions.</p>
        </Section>
      )}
    </div>
  );
}
