// Reads a Meta campaign's delivery report and shapes it for the campaign panel.
//
// Graph calls (all on the campaign id, lifetime window via date_preset=maximum):
//   /insights                                  → totals (TOTAL_FIELDS)
//   /insights?time_increment=1                 → one row per day
//   /insights?breakdowns=age,gender            → audience
//   /insights?breakdowns=country               → where it was seen
//   /insights?breakdowns=publisher_platform,platform_position → placement (IG feed, Reels, Stories…)
//   /insights?level=ad                         → per-ad quality / engagement / conversion rankings
//   /adsets, /ads                              → budget, schedule, review feedback
// Meta returns metric values as strings and "action" metrics as [{ action_type, value }] lists.
// Only the totals call is required; every other part is null if Meta refuses it.
import { graph, graphList } from './meta.js';

const TOTAL_FIELDS = [
  'spend', 'impressions', 'reach', 'frequency', 'cpm', 'cpc', 'ctr', 'clicks',
  'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click', 'outbound_clicks',
  'actions', 'cost_per_action_type',
  'video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  'video_thruplay_watched_actions', 'video_avg_time_watched_actions',
].join(',');
const ROW_FIELDS = 'spend,impressions,reach,inline_link_clicks';
const DAILY_FIELDS = `${ROW_FIELDS},actions`;
const RANK_FIELDS = 'ad_id,ad_name,quality_ranking,engagement_rate_ranking,conversion_rate_ranking';

// Our smart links send DSPClick as a custom Pixel/CAPI event; Meta reports custom
// events under this action type (all custom events together, and DSPClick is our only one).
export const DSP_CLICK_ACTION = 'offsite_conversion.fb_pixel_custom';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Value of one action_type in a Meta action list (actions, cost_per_action_type, video_*). */
export function actionValue(list, type) {
  if (!Array.isArray(list)) return 0;
  const hit = type ? list.find(a => a.action_type === type) : list[0];
  return num(hit?.value);
}

/** Lifetime totals from one /insights row (null when Meta has nothing yet). */
export function shapeTotals(row) {
  if (!row) return null;
  const a = row.actions;
  const cost = row.cost_per_action_type;
  const plays = actionValue(row.video_play_actions, 'video_view');
  const watched = (field) => actionValue(row[field], 'video_view');
  return {
    spend: num(row.spend),
    impressions: num(row.impressions),
    reach: num(row.reach),
    frequency: num(row.frequency),
    cpm: num(row.cpm),
    cpc: num(row.cpc),
    ctr: num(row.ctr), // percent, as Meta reports it
    clicks: num(row.clicks), // all clicks: likes, profile taps, "see more"…
    linkClicks: num(row.inline_link_clicks),
    linkCtr: num(row.inline_link_click_ctr),
    costPerLinkClick: num(row.cost_per_inline_link_click),
    outboundClicks: actionValue(row.outbound_clicks, 'outbound_click'),
    landingPageViews: actionValue(a, 'landing_page_view'),
    costPerLandingPageView: actionValue(cost, 'landing_page_view'),
    dspClicks: actionValue(a, DSP_CLICK_ACTION),
    costPerDspClick: actionValue(cost, DSP_CLICK_ACTION),
    engagements: actionValue(a, 'post_engagement'),
    reactions: actionValue(a, 'post_reaction'),
    comments: actionValue(a, 'comment'),
    saves: actionValue(a, 'onsite_conversion.post_save'),
    shares: actionValue(a, 'post'),
    video: plays || watched('video_thruplay_watched_actions') ? {
      plays,
      p25: watched('video_p25_watched_actions'),
      p50: watched('video_p50_watched_actions'),
      p75: watched('video_p75_watched_actions'),
      p100: watched('video_p100_watched_actions'),
      thruplays: watched('video_thruplay_watched_actions'),
      avgWatchSeconds: watched('video_avg_time_watched_actions'),
    } : null,
  };
}

/** One point per day, oldest first. */
export function shapeDaily(rows) {
  return (rows || [])
    .map(r => ({
      date: r.date_start,
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      linkClicks: num(r.inline_link_clicks),
      dspClicks: actionValue(r.actions, DSP_CLICK_ACTION),
    }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** Breakdown rows: `dims(row)` picks the breakdown values; most impressions first. */
export function shapeBreakdown(rows, dims) {
  return (rows || [])
    .map(r => ({
      ...dims(r),
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      linkClicks: num(r.inline_link_clicks),
    }))
    .sort((x, y) => y.impressions - x.impressions);
}

/** Per-ad status, review feedback and rankings ("UNKNOWN" until ~500 impressions). */
export function shapeAds(ads, rankRows) {
  const ranks = new Map((rankRows || []).map(r => [r.ad_id, r]));
  return (ads || []).map(ad => {
    const r = ranks.get(ad.id) || {};
    const feedback = ad.ad_review_feedback?.global || {};
    return {
      id: ad.id,
      name: ad.name,
      effectiveStatus: ad.effective_status,
      rejected: Object.entries(feedback).map(([reason, detail]) => ({ reason, detail })),
      issues: (ad.issues_info || []).map(i => i.error_summary || i.error_message).filter(Boolean),
      quality: r.quality_ranking || null,
      engagement: r.engagement_rate_ranking || null,
      conversion: r.conversion_rate_ranking || null,
    };
  });
}

/** Budget and schedule live on the ad sets (Prelude campaigns use ad-set budgets). Meta money fields are minor units. */
export function shapeBudget(adSets) {
  if (!adSets?.length) return null;
  const sum = (f) => adSets.reduce((s, a) => s + num(a[f]), 0) / 100;
  const daily = sum('daily_budget');
  return {
    period: daily > 0 ? 'daily' : 'lifetime',
    amount: daily > 0 ? daily : sum('lifetime_budget'),
    remaining: sum('budget_remaining'),
    start: adSets.map(a => a.start_time).filter(Boolean).sort()[0] || null,
    end: adSets.map(a => a.end_time).filter(Boolean).sort().at(-1) || null,
  };
}

const optional = (p) => p.catch(() => null);

/** Full report for a campaign. `campaign` is the object already read with CAMPAIGN_FIELDS. */
export async function campaignReport(id, token, campaign) {
  const insights = (params) => graph('GET', `${id}/insights`, token, { date_preset: 'maximum', ...params });
  const list = (params) => graphList(`${id}/insights`, token, { date_preset: 'maximum', ...params });
  const [totals, daily, audience, country, placement, ranks, ads, adSets] = await Promise.all([
    insights({ fields: TOTAL_FIELDS }),
    optional(list({ fields: DAILY_FIELDS, time_increment: 1 })),
    optional(list({ fields: ROW_FIELDS, breakdowns: 'age,gender' })),
    optional(list({ fields: ROW_FIELDS, breakdowns: 'country' })),
    optional(list({ fields: ROW_FIELDS, breakdowns: 'publisher_platform,platform_position' })),
    optional(list({ fields: RANK_FIELDS, level: 'ad' })),
    optional(graphList(`${id}/ads`, token, { fields: 'id,name,effective_status,ad_review_feedback,issues_info' })),
    optional(graphList(`${id}/adsets`, token, { fields: 'daily_budget,lifetime_budget,budget_remaining,start_time,end_time' })),
  ]);
  const totalsRow = totals.data?.[0] || null;
  return {
    objective: campaign.objective || null,
    issues: (campaign.issues_info || []).map(i => i.error_summary || i.error_message).filter(Boolean),
    budget: shapeBudget(adSets),
    insights: shapeTotals(totalsRow),
    // Breakdowns only mean something once there is delivery
    daily: totalsRow && daily ? shapeDaily(daily) : null,
    breakdowns: totalsRow ? {
      audience: audience && shapeBreakdown(audience, r => ({ gender: r.gender, age: r.age })),
      country: country && shapeBreakdown(country, r => ({ country: r.country })),
      placement: placement && shapeBreakdown(placement, r => ({ platform: r.publisher_platform, position: r.platform_position })),
    } : null,
    ads: ads ? shapeAds(ads, ranks) : null,
  };
}

export const CAMPAIGN_FIELDS = 'id,name,account_id,status,effective_status,objective,issues_info';
