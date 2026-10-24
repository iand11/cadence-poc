// Data health for the admin monitoring page (GET /api/admin/health). Every number comes
// from an index range, a small table, or the planner's row estimates (pg_class) — never
// a full scan of the big tables (artists ~590k, artist_stats_current ~3 GB, playlists
// ~1.1M, playlist_entries ~9.9M). Each query runs with a statement timeout and its section
// comes back null if it's cancelled (usually a missing index — see INDEXES below and
// `npm run db:diagnose -- --apply-indexes`), so one slow part never blanks the page.
// One summary per day is kept in data_health_snapshots for the trend chart.
// The full report is built by the hourly cron (/api/cron/data-health) with long query timeouts
// and stored in catalog_facets ('data_health'); the page reads that stored copy, so a slow
// count on the big tables never holds up or blanks the page.
import { query, queryWithTimeout } from './db.js';
import { ensureJobRunsTable } from './job-runs.js';

// Per-query statement timeouts: the cron can wait; a Refresh click from the page can't
export const CRON_TIMEOUT_MS = 60_000;
export const PAGE_TIMEOUT_MS = 15_000;
const CONCURRENCY = 3;
export const ARTIST_STALE_DAYS = 7;
export const PLAYLIST_STALE_DAYS = 3;

// Jobs that should run daily (vercel.json crons); others (CLI/external) have no schedule
export const DAILY_JOBS = ['refresh-facets', 'spotify-plays', 'stream-counts', 'data-health'];

// Indexes the health queries rely on (mirrored in db/schema.sql and scripts/diagnose-perf.js)
export const INDEXES = [
  ['artist_stats_current', 'stats_current_as_of_idx', '(as_of)'],
  ['artists', 'artists_created_idx', '(created_at)'],
  ['social_posts', 'social_posts_fetched_idx', '(fetched_at)'],
  ['smart_link_events', 'smart_link_events_created_idx', '(created_at)'],
  ['playlists', 'playlists_active_crawled_idx', '(platform, last_crawled_at) WHERE active'],
  ['playlist_entries', 'playlist_entries_first_seen_at_idx', '(first_seen_at)'],
];

const TABLES = [
  'artists', 'artist_stats_current', 'artist_metric_snapshots', 'social_posts', 'tracks', 'albums',
  'playlists', 'playlist_entries', 'playlist_snapshots', 'artist_playlists_current', 'tracked_artists',
  'refresh_queue', 'smart_link_events', 'spotify_plays', 'stream_counts', 'campaign_report_snapshots',
];

let snapshotsReady;
function ensureSnapshotsTable() {
  if (!snapshotsReady) {
    snapshotsReady = query(`
      CREATE TABLE IF NOT EXISTS data_health_snapshots (
        day         date PRIMARY KEY,
        data        jsonb NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now()
      )`).catch((err) => { snapshotsReady = undefined; throw err; });
  }
  return snapshotsReady;
}

const n = (v) => (v == null ? null : Number(v));
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/** Collect everything the page shows. `timedOut` lists the parts that were cancelled. */
export async function collectHealth({ timeoutMs = CRON_TIMEOUT_MS } = {}) {
  await Promise.all([ensureJobRunsTable(), ensureSnapshotsTable()]);
  const timedOut = [];
  const timings = {};
  // At most CONCURRENCY queries at once: the pool has 5 connections and gives up on a
  // checkout after 5 s, so firing every query together would fail the queued ones.
  const slots = [];
  let active = 0;
  const acquire = () => (active < CONCURRENCY ? (active++, Promise.resolve()) : new Promise((r) => slots.push(r)));
  const release = () => { const next = slots.shift(); if (next) next(); else active--; };
  // rows, or null when the query timed out / its table doesn't exist yet
  const run = (name, sql, params) => acquire()
    .then(() => {
      const t = Date.now();
      return queryWithTimeout(sql, params, timeoutMs).finally(() => { timings[name] = Date.now() - t; });
    })
    .finally(release)
    .then((rows) => { if (rows === null) timedOut.push(name); return rows; })
    .catch((err) => {
      if (err.code !== '42P01') { console.warn(`[data-health] ${name}:`, err.message); timedOut.push(name); }
      return null;
    });
  const one = async (...a) => (await run(...a))?.[0] || null;

  const [
    tables, indexes,
    artistTotals, artistFresh, artistDays, artistOldest, artistsAdded, followed, stalest,
    posts, queue, queue24, queueErrors, requests,
    playlistPlatforms, playlistDays, playlistTypes, playlistChanged, entries, stored,
    jobsLast, jobsRecent,
    streamServices, streamErrors, streamTrackers, streamSources7d,
    reportsDue, reports, managedReview,
    fans, linkDays, links,
    connections, notifications,
  ] = await Promise.all([
    run('tables', `SELECT c.relname AS name, greatest(c.reltuples, 0)::bigint AS rows, pg_total_relation_size(c.oid) AS bytes
                   FROM pg_class c WHERE c.relkind IN ('r', 'p') AND c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1)`, [TABLES]),
    run('indexes', `SELECT c.relname AS name, i.indisvalid AS valid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                    WHERE c.relname = ANY($1)`, [INDEXES.map((x) => x[1])]),

    // Artists — counts walk primary keys; freshness walks the as_of index
    one('artists', `SELECT (SELECT count(*) FROM artists)::int AS artists, (SELECT count(*) FROM artist_stats_current)::int AS with_stats`),
    one('artist freshness', `SELECT count(*) FILTER (WHERE as_of >= now() - interval '1 day')::int AS d1,
                                    count(*) FILTER (WHERE as_of >= now() - interval '7 days')::int AS d7,
                                    count(*)::int AS d30, max(as_of) AS newest
                             FROM artist_stats_current WHERE as_of >= now() - interval '30 days'`),
    run('artist days', `SELECT (as_of AT TIME ZONE 'UTC')::date AS day, count(*)::int AS n FROM artist_stats_current
                        WHERE as_of >= current_date - 29 GROUP BY 1 ORDER BY 1`),
    one('artist oldest', 'SELECT min(as_of) AS oldest FROM artist_stats_current'),
    one('artists added', `SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 day')::int AS d1,
                                 count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS d7,
                                 max(created_at) AS newest
                          FROM artists WHERE created_at >= now() - interval '30 days'`),
    one('followed', `SELECT count(*)::int AS artists,
                            (SELECT count(DISTINCT user_id) FROM tracked_artists)::int AS users,
                            count(*) FILTER (WHERE sc.as_of IS NULL)::int AS never,
                            count(*) FILTER (WHERE sc.as_of < now() - $1::int * interval '1 day')::int AS stale,
                            count(*) FILTER (WHERE sc.as_of >= now() - interval '1 day')::int AS d1
                     FROM (SELECT DISTINCT artist_id FROM tracked_artists) t
                     LEFT JOIN artist_stats_current sc USING (artist_id)`, [ARTIST_STALE_DAYS]),
    run('stalest followed', `SELECT a.slug, a.name, sc.as_of, count(*)::int AS followers
                             FROM tracked_artists t JOIN artists a ON a.id = t.artist_id
                             LEFT JOIN artist_stats_current sc ON sc.artist_id = t.artist_id
                             GROUP BY a.slug, a.name, sc.as_of ORDER BY sc.as_of ASC NULLS FIRST LIMIT 8`),
    one('social posts', `SELECT count(*)::int AS d1, max(fetched_at) AS newest FROM social_posts WHERE fetched_at >= now() - interval '1 day'`),
    run('refresh queue', 'SELECT status, count(*)::int AS n, min(requested_at) AS oldest FROM refresh_queue GROUP BY status'),
    one('refresh queue 24h', `SELECT count(*) FILTER (WHERE status = 'done')::int AS done, count(*) FILTER (WHERE status = 'failed')::int AS failed,
                                     (SELECT count(*) FROM refresh_queue WHERE status = 'in_progress' AND claimed_at < now() - interval '1 hour')::int AS stuck
                              FROM refresh_queue WHERE status IN ('done', 'failed') AND completed_at >= now() - interval '1 day'`),
    run('refresh errors', `SELECT left(last_error, 160) AS error, count(*)::int AS n, max(completed_at) AS last
                           FROM refresh_queue WHERE status = 'failed' GROUP BY 1 ORDER BY n DESC LIMIT 5`),
    run('artist requests', 'SELECT status, count(*)::int AS n, min(requested_at) AS oldest FROM artist_requests GROUP BY status'),

    // Playlists (music-scrapers crawl) — the active-crawled index covers both queries
    run('playlist platforms', `SELECT platform, count(*)::int AS active,
                                      count(*) FILTER (WHERE last_crawled_at >= now() - interval '1 day')::int AS d1,
                                      count(*) FILTER (WHERE last_crawled_at >= now() - $1::int * interval '1 day')::int AS fresh,
                                      count(*) FILTER (WHERE last_crawled_at >= now() - interval '30 days')::int AS d30,
                                      count(*) FILTER (WHERE last_crawled_at IS NULL)::int AS never,
                                      max(last_crawled_at) AS newest, min(last_crawled_at) AS oldest
                               FROM playlists WHERE active GROUP BY platform ORDER BY active DESC`, [PLAYLIST_STALE_DAYS]),
    run('playlist days', `SELECT (last_crawled_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS n FROM playlists
                          WHERE active AND last_crawled_at >= current_date - 29 GROUP BY 1 ORDER BY 1`),
    run('playlist types', 'SELECT type, count(*)::int AS n FROM playlists WHERE active GROUP BY type ORDER BY n DESC'),
    one('playlist changes', `SELECT count(*)::int AS d1 FROM playlists WHERE active AND last_changed_at >= now() - interval '1 day'`),
    one('playlist entries', `SELECT count(*) FILTER (WHERE first_seen_at >= now() - interval '1 day')::int AS d1, count(*)::int AS d7
                             FROM playlist_entries WHERE first_seen_at >= now() - interval '7 days'`),
    run('stored rollups', `SELECT key, refreshed_at, data->'rows' AS rows FROM catalog_facets WHERE key <> 'data_health'`),

    // Jobs
    run('jobs', `SELECT DISTINCT ON (job) job, started_at, finished_at, ok, result, error
                 FROM job_runs ORDER BY job, started_at DESC`),
    run('job history', `SELECT job, started_at, ok FROM (
                          SELECT job, started_at, ok, row_number() OVER (PARTITION BY job ORDER BY started_at DESC) AS rn
                          FROM job_runs WHERE started_at >= now() - interval '30 days') x
                        WHERE rn <= 14 ORDER BY job, started_at`),

    // Stream + follower counts (campaigns still being read: not ended, or ended ≤ 30 days ago)
    run('stream sources', `SELECT s.service, count(*)::int AS sources,
                                  count(*) FILTER (WHERE s.last_error IS NOT NULL)::int AS failing,
                                  count(*) FILTER (WHERE c.last_day >= current_date - 1)::int AS current,
                                  max(c.last_day) AS last_day
                           FROM stream_tracker_sources s JOIN stream_trackers t ON t.id = s.tracker_id
                           LEFT JOIN LATERAL (SELECT max(day) AS last_day FROM stream_counts c
                             WHERE c.tracker_id = s.tracker_id AND c.service = s.service AND c.external_id = s.external_id) c ON true
                           WHERE s.removed_at IS NULL AND t.end_date >= current_date - 30
                           GROUP BY s.service ORDER BY sources DESC`),
    run('stream errors', `SELECT s.service, coalesce(s.label, s.url) AS label, s.url, left(s.last_error, 200) AS error, t.title
                          FROM stream_tracker_sources s JOIN stream_trackers t ON t.id = s.tracker_id
                          WHERE s.removed_at IS NULL AND s.last_error IS NOT NULL AND t.end_date >= current_date - 30
                          ORDER BY t.last_run_at DESC NULLS LAST LIMIT 6`),
    one('stream trackers', `SELECT count(*)::int AS active, max(last_run_at) AS last_run, min(last_run_at) AS oldest_run,
                                   count(*) FILTER (WHERE last_run_at IS NULL OR last_run_at < now() - interval '26 hours')::int AS overdue
                            FROM stream_trackers WHERE end_date >= current_date - 30`),
    run('stream sources 7d', 'SELECT source, count(*)::int AS n FROM stream_counts WHERE day >= current_date - 6 GROUP BY source'),

    // Campaign report copies
    one('reports due', `SELECT count(DISTINCT c.meta_campaign_id)::int AS n FROM stream_tracker_campaigns c
                        JOIN stream_trackers t ON t.id = c.tracker_id
                        WHERE c.meta_campaign_id IS NOT NULL AND t.end_date >= current_date - 31`),
    one('reports', `SELECT count(*) FILTER (WHERE day = current_date)::int AS today,
                           count(*) FILTER (WHERE day = current_date - 1)::int AS yesterday, max(recorded_at) AS newest
                    FROM campaign_report_snapshots WHERE day >= current_date - 1`),
    one('managed review', `SELECT count(*)::int AS n FROM meta_managed_campaigns WHERE review_status = 'requested'`),

    // Fans + smart links
    one('fan sync', `SELECT count(*)::int AS total, count(*) FILTER (WHERE revoked)::int AS revoked,
                            count(*) FILTER (WHERE NOT revoked AND sync_error IS NOT NULL)::int AS failing,
                            count(*) FILTER (WHERE NOT revoked AND (last_synced_at IS NULL OR last_synced_at < now() - interval '1 day'))::int AS stale,
                            max(last_synced_at) AS last_sync, max(last_played_at) AS last_play
                     FROM spotify_listeners`),
    run('link days', `SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
                             count(*) FILTER (WHERE kind = 'view')::int AS views, count(*) FILTER (WHERE kind = 'click')::int AS clicks
                      FROM smart_link_events WHERE created_at >= current_date - 29 GROUP BY 1 ORDER BY 1`),
    one('links', `SELECT (SELECT count(*) FROM smart_links)::int AS links, (SELECT count(*) FROM smart_link_fans)::int AS fans,
                         (SELECT max(created_at) FROM smart_link_events) AS last_event`),

    // Connections + notifications
    run('connections', `SELECT platform, count(*)::int AS n, count(*) FILTER (WHERE expires_at <= now())::int AS expired,
                               count(*) FILTER (WHERE expires_at > now() AND expires_at <= now() + interval '7 days')::int AS expiring
                        FROM ad_platform_connections GROUP BY platform`),
    one('notifications', `SELECT count(*) FILTER (WHERE delivered_at IS NULL AND created_at < now() - interval '1 day')::int AS undelivered
                          FROM notifications WHERE delivered_at IS NULL`),
  ]);

  const byStatus = (rows) => rows && Object.fromEntries(rows.map((r) => [r.status, { n: r.n, oldest: r.oldest }]));
  const est = Object.fromEntries((tables || []).map((t) => [t.name, n(t.rows)]));
  const present = new Map((indexes || []).map((r) => [r.name, r.valid]));
  const tableSet = new Set((tables || []).map((t) => t.name));
  const missingIndexes = INDEXES.filter(([t, name]) => tableSet.has(t) && present.get(name) !== true).map(([, name]) => name);

  const platforms = playlistPlatforms;
  const sum = (rows, k) => rows?.reduce((a, r) => a + (r[k] || 0), 0) ?? null;
  const playlistsActive = sum(platforms, 'active');
  const stats = artistTotals?.with_stats ?? null;

  const jobRecent = {};
  for (const r of jobsRecent || []) (jobRecent[r.job] ||= []).push({ at: r.started_at, ok: r.ok });
  const jobs = jobsLast && [...new Set([...DAILY_JOBS, ...jobsLast.map((j) => j.job)])].map((job) => {
    const last = jobsLast.find((j) => j.job === job);
    return {
      job, daily: DAILY_JOBS.includes(job),
      lastRun: last?.started_at || null, finishedAt: last?.finished_at || null,
      ok: last ? last.ok : null, error: last?.error || null, result: last?.result || null,
      recent: jobRecent[job] || [],
    };
  });

  const health = {
    generatedAt: new Date().toISOString(),
    thresholds: { artistStaleDays: ARTIST_STALE_DAYS, playlistStaleDays: PLAYLIST_STALE_DAYS },
    timedOut, missingIndexes, timeoutMs,
    slowest: Object.entries(timings).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([name, ms]) => ({ name, ms })),
    artists: {
      total: artistTotals?.artists ?? null,
      withStats: stats,
      never: artistTotals ? artistTotals.artists - artistTotals.with_stats : null,
      fresh: artistFresh && stats != null ? {
        d1: artistFresh.d1, d7: artistFresh.d7, d30: artistFresh.d30, older: Math.max(0, stats - artistFresh.d30),
      } : null,
      newest: artistFresh?.newest || null,
      oldest: artistOldest?.oldest || null,
      days: artistDays?.map((r) => ({ day: day(r.day), n: r.n })) || null,
      added: artistsAdded,
      followed, stalest,
      posts,
      queue: queue && { byStatus: byStatus(queue), last24h: queue24, errors: queueErrors || [] },
      requests: byStatus(requests),
    },
    playlists: {
      estimated: est.playlists ?? null,
      active: playlistsActive,
      inactive: playlistsActive != null && est.playlists != null ? Math.max(0, est.playlists - playlistsActive) : null,
      fresh: platforms ? {
        d1: sum(platforms, 'd1'), recent: sum(platforms, 'fresh'),
        stale: playlistsActive - sum(platforms, 'fresh') - sum(platforms, 'never'),
        d30: sum(platforms, 'd30'), never: sum(platforms, 'never'),
      } : null,
      platforms: platforms || null,
      types: playlistTypes,
      days: playlistDays?.map((r) => ({ day: day(r.day), n: r.n })) || null,
      changed24h: playlistChanged?.d1 ?? null,
      entries: { estimated: est.playlist_entries ?? null, added24h: entries?.d1 ?? null, added7d: entries?.d7 ?? null },
      snapshotsEstimated: est.playlist_snapshots ?? null,
    },
    rollups: stored?.map((r) => ({ key: r.key, refreshedAt: r.refreshed_at, rows: n(r.rows) })) || null,
    jobs,
    streams: {
      followerTracking: process.env.FOLLOWER_TRACKING === '1',
      trackers: streamTrackers, services: streamServices, errors: streamErrors,
      sources7d: streamSources7d && Object.fromEntries(streamSources7d.map((r) => [r.source, r.n])),
    },
    reports: { due: reportsDue?.n ?? null, ...(reports || {}), managedReview: managedReview?.n ?? null },
    fans,
    links: links && { ...links, days: linkDays?.map((r) => ({ day: day(r.day), views: r.views, clicks: r.clicks })) || [] },
    connections,
    notifications,
    tables: (tables || []).map((t) => ({ name: t.name, rows: n(t.rows), bytes: n(t.bytes) })).sort((a, b) => b.bytes - a.bytes),
  };
  health.alerts = alertsFor(health);
  return health;
}

const ageHours = (t) => (t ? (Date.now() - new Date(t).getTime()) / 3_600_000 : Infinity);

/** Short problem list, worst first: [{ level: 'bad' | 'warn', area, text }]. */
export function alertsFor(h) {
  const out = [];
  const add = (level, area, text) => out.push({ level, area, text });
  const a = h.artists, p = h.playlists;

  if (h.missingIndexes.length) add('warn', 'Database', `${h.missingIndexes.length} index${h.missingIndexes.length > 1 ? 'es' : ''} missing`);
  if (h.timedOut.length) add('warn', 'Database', `Timed out: ${h.timedOut.join(', ')}`);

  if (a.newest && ageHours(a.newest) > 48) add('bad', 'Artists', 'No artist stats refreshed in 48h');
  if (a.followed?.never) add('bad', 'Artists', `${a.followed.never} followed never refreshed`);
  if (a.followed?.stale) add('warn', 'Artists', `${a.followed.stale} followed stale (> ${h.thresholds.artistStaleDays}d)`);
  const q = a.queue;
  if (q?.byStatus?.pending && ageHours(q.byStatus.pending.oldest) > 24) add('bad', 'Refresh queue', `Oldest pending ${Math.round(ageHours(q.byStatus.pending.oldest) / 24)}d`);
  if (q?.last24h?.stuck) add('warn', 'Refresh queue', `${q.last24h.stuck} stuck in progress`);
  if (q?.last24h?.failed) add('warn', 'Refresh queue', `${q.last24h.failed} failed in 24h`);
  if (a.requests?.pending && ageHours(a.requests.pending.oldest) > 72) add('warn', 'Requests', `Oldest request ${Math.round(ageHours(a.requests.pending.oldest) / 24)}d`);

  for (const pl of p.platforms || []) {
    if (ageHours(pl.newest) > 48) add('bad', 'Playlists', `${pl.platform}: no crawl in 48h`);
  }
  if (p.active && p.fresh && p.fresh.stale / p.active > 0.2) add('warn', 'Playlists', `${Math.round((p.fresh.stale / p.active) * 100)}% stale (> ${h.thresholds.playlistStaleDays}d)`);

  for (const j of h.jobs || []) {
    if (j.ok === false) add('bad', 'Jobs', `${j.job} failed`);
    else if (j.daily && ageHours(j.lastRun) > 26) add(j.lastRun ? 'bad' : 'warn', 'Jobs', j.lastRun ? `${j.job} overdue` : `${j.job} never ran`);
  }
  for (const r of h.rollups || []) {
    if (ageHours(r.refreshedAt) > 48 && r.key === 'artists') add('warn', 'Rollups', 'Artist facets > 2d old');
  }

  const followerServices = ['instagram', 'tiktok', 'youtubeChannel'];
  for (const s of h.streams.services || []) {
    // With follower tracking off nothing reads those sources, so their old errors aren't news
    if (!h.streams.followerTracking && followerServices.includes(s.service)) continue;
    if (s.failing) add('warn', 'Streams', `${s.service}: ${s.failing}/${s.sources} failing`);
  }
  if (h.streams.trackers?.overdue) add('warn', 'Streams', `${h.streams.trackers.overdue} campaign${h.streams.trackers.overdue > 1 ? 's' : ''} not counted today`);
  if (h.reports.due && h.reports.today === 0 && new Date().getUTCHours() >= 10) add('warn', 'Reports', 'No Meta reports saved today');
  if (h.reports.managedReview) add('warn', 'Reports', `${h.reports.managedReview} managed ad${h.reports.managedReview > 1 ? 's' : ''} awaiting review`);
  if (h.fans?.failing) add('warn', 'Fans', `${h.fans.failing} fan sync${h.fans.failing > 1 ? 's' : ''} failing`);
  for (const c of h.connections || []) {
    if (c.expired) add('warn', 'Connections', `${c.expired} ${c.platform} expired`);
  }
  if (h.notifications?.undelivered) add('warn', 'Notifications', `${h.notifications.undelivered} undelivered > 1d`);

  return out.sort((x, y) => (x.level === y.level ? 0 : x.level === 'bad' ? -1 : 1));
}

/** The day's headline numbers, kept for the trend chart. */
function summaryOf(h) {
  return {
    artists: h.artists.total, artistsFresh24h: h.artists.fresh?.d1 ?? null, artistsFresh7d: h.artists.fresh?.d7 ?? null,
    followedStale: h.artists.followed ? h.artists.followed.stale + h.artists.followed.never : null,
    playlistsActive: h.playlists.active, playlistsCrawled24h: h.playlists.fresh?.d1 ?? null,
    entriesAdded24h: h.playlists.entries.added24h,
    queueFailed24h: h.artists.queue?.last24h?.failed ?? null,
    clicks: h.links?.days?.at(-1)?.clicks ?? null,
    alerts: h.alerts.filter((a) => a.level === 'bad').length,
  };
}

export async function saveSnapshot(h) {
  await ensureSnapshotsTable();
  await query(
    `INSERT INTO data_health_snapshots (day, data) VALUES (current_date, $1)
     ON CONFLICT (day) DO UPDATE SET data = EXCLUDED.data, recorded_at = now()`,
    [JSON.stringify(summaryOf(h))]);
}

export async function loadHistory(days = 60) {
  await ensureSnapshotsTable();
  const rows = await query(
    'SELECT day, data FROM data_health_snapshots WHERE day >= current_date - $1::int ORDER BY day', [days]);
  return rows.map((r) => ({ day: day(r.day), ...r.data }));
}

const REPORT_KEY = 'data_health';

async function storeReport(h) {
  await query(
    `INSERT INTO catalog_facets (key, data, refreshed_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, refreshed_at = now()`,
    [REPORT_KEY, JSON.stringify(h)]);
}

async function storedReport() {
  const rows = await query('SELECT data FROM catalog_facets WHERE key = $1', [REPORT_KEY]).catch(() => []);
  return rows[0]?.data || null;
}

/** Build a new report, store it, and save the day's summary. */
export async function buildHealth({ timeoutMs = CRON_TIMEOUT_MS } = {}) {
  const health = await collectHealth({ timeoutMs });
  // A partial report (some parts timed out) never replaces a complete stored one
  const stored = health.timedOut.length ? await storedReport() : null;
  if (!stored || stored.timedOut?.length) {
    await Promise.all([
      saveSnapshot(health).catch((err) => console.warn('[data-health] snapshot not saved', err.message)),
      storeReport(health).catch((err) => console.warn('[data-health] report not stored', err.message)),
    ]);
  }
  return health;
}

// One rebuild at a time per instance
let building = null;

/**
 * The page's report: the stored one (cron-built), or a new one when asked (fresh) or none
 * is stored yet. History is always read live (one small table).
 */
export async function getHealth({ fresh = false } = {}) {
  let health = fresh ? null : await storedReport();
  if (!health) {
    building ||= buildHealth({ timeoutMs: PAGE_TIMEOUT_MS }).finally(() => { building = null; });
    health = await building;
  }
  return { ...health, history: await loadHistory().catch(() => []) };
}
