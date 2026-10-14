// Who visits a smart link: breakdowns of the visitor detail each event stores
// (api/lib/visitor.js) for the Links page. Raw IPs and cookie ids never leave the
// server; the page sees counts, places, devices and sources.
import { query, queryOne } from './db.js';
import { ensureTables } from './smartlinks.js';

// Where the visit came from: UTM source, then ad click ids, then the in-app browser, then the referrer
const sourceSql = (t = '') => `COALESCE(
  NULLIF(${t}utm->>'utm_source', ''),
  CASE WHEN ${t}click_ids ? 'gclid' OR ${t}click_ids ? 'gbraid' OR ${t}click_ids ? 'wbraid' THEN 'Google ads'
       WHEN ${t}click_ids ? 'ttclid' THEN 'TikTok ads' WHEN ${t}click_ids ? 'twclid' THEN 'X ads'
       WHEN ${t}click_ids ? 'sccid' THEN 'Snapchat ads' WHEN ${t}click_ids ? 'msclkid' THEN 'Microsoft ads'
       WHEN ${t}from_ad OR ${t}click_ids ? 'fbclid' THEN 'Meta ads' END,
  ${t}in_app, ${t}referrer_host, 'Direct')`;

// key → SQL expression; rows where it is null are left out
const DIMENSIONS = {
  countries: 'country',
  cities: `CASE WHEN city IS NOT NULL THEN concat_ws(', ', city, region, country) END`,
  sources: sourceSql(),
  apps: `COALESCE(in_app, browser)`,
  devices: 'device',
  os: `CASE WHEN os IS NOT NULL THEN concat_ws(' ', os, split_part(os_version, '.', 1)) END`,
  models: 'device_model',
  languages: 'language',
};

const LIMIT = 8;

export async function linkAudience(slug) {
  await ensureTables();
  const where = `slug = $1 AND kind IN ('view', 'click')`;
  const breakdown = (expr) => query(
    `SELECT ${expr} AS key,
            count(*) FILTER (WHERE kind = 'view')::int AS views,
            count(*) FILTER (WHERE kind = 'click')::int AS clicks
     FROM smart_link_events WHERE ${where} AND (${expr}) IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT ${LIMIT}`, [slug]);

  const [totals, hours, recent, ...lists] = await Promise.all([
    queryOne(
      `SELECT count(*) FILTER (WHERE kind = 'view')::int AS views,
              count(*) FILTER (WHERE kind = 'click')::int AS clicks,
              count(DISTINCT visitor_id)::int AS visitors,
              (SELECT count(*)::int FROM (
                 SELECT visitor_id FROM smart_link_events
                 WHERE ${where} AND visitor_id IS NOT NULL
                 GROUP BY visitor_id HAVING count(DISTINCT created_at::date) > 1) r) AS returning,
              count(DISTINCT visitor_id) FILTER (WHERE kind = 'click')::int AS clicking_visitors,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY ms_on_page)
                FILTER (WHERE kind = 'click' AND ms_on_page IS NOT NULL) AS median_ms,
              count(*) FILTER (WHERE kind = 'view' AND os IS NOT NULL)::int AS detailed_views
       FROM smart_link_events WHERE ${where}`, [slug]),
    // Visitor's local hour (their IP timezone; UTC when unknown)
    query(
      `SELECT extract(hour FROM created_at AT TIME ZONE COALESCE(timezone, 'UTC'))::int AS hour,
              count(*) FILTER (WHERE kind = 'view')::int AS views,
              count(*) FILTER (WHERE kind = 'click')::int AS clicks
       FROM smart_link_events WHERE ${where} GROUP BY 1 ORDER BY 1`, [slug]),
    query(
      `SELECT e.created_at, e.kind, e.service, e.city, e.region, e.country, e.device, e.os, e.os_version,
              e.device_model, COALESCE(e.in_app, e.browser) AS app, ${sourceSql('e.')} AS source,
              e.ms_on_page, e.language, (e.visitor_id IS NOT NULL) AS tracked,
              f.display_name AS fan_name
       FROM smart_link_events e
       LEFT JOIN smart_link_fans f ON f.slug = e.slug AND f.visitor_id = e.visitor_id
       WHERE e.slug = $1 AND e.kind IN ('view', 'click')
       ORDER BY e.created_at DESC LIMIT 25`, [slug]),
    ...Object.values(DIMENSIONS).map(breakdown),
  ]);

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0, clicks: 0 }));
  for (const h of hours) if (h.hour >= 0 && h.hour < 24) byHour[h.hour] = h;

  return {
    totals: {
      views: totals.views,
      clicks: totals.clicks,
      visitors: totals.visitors,
      returning: totals.returning,
      clickingVisitors: totals.clicking_visitors,
      medianSecondsToClick: totals.median_ms == null ? null : Math.round(totals.median_ms / 100) / 10,
      detailedViews: totals.detailed_views,
    },
    ...Object.fromEntries(Object.keys(DIMENSIONS).map((k, i) => [k, lists[i]])),
    byHour,
    recent: recent.map(r => ({
      at: r.created_at, kind: r.kind, service: r.service,
      place: [r.city, r.region, r.country].filter(Boolean).join(', ') || null,
      device: r.device, os: [r.os, r.os_version].filter(Boolean).join(' ') || null, model: r.device_model,
      app: r.app, source: r.source, secondsOnPage: r.ms_on_page == null ? null : Math.round(r.ms_on_page / 100) / 10,
      language: r.language, tracked: r.tracked, fan: r.fan_name,
    })),
  };
}
