#!/usr/bin/env node
// Diagnose slow artist / playlist API requests against the real database.
//
//   npm run db:diagnose                     report only (read-only)
//   npm run db:diagnose -- --apply-indexes  also build any missing artist /
//                                           playlist indexes with CREATE INDEX CONCURRENTLY
//                                           (does not block crawler writes) and
//                                           refresh the stored artist facets
//
// Reports table sizes, which of the indexes the API depends on exist (and
// whether any are left invalid by an interrupted build), queries currently
// running or waiting on locks, then times each API handler directly against
// the database with a real followed-artist set, so DB time can be told apart
// from network / cold-start time.
import { pool } from './lib/db.js';

const APPLY = process.argv.includes('--apply-indexes');

// Mirrors the paging + playlist indexes in db/schema.sql.
const INDEXES = [
  ['artist_stats_current', 'stats_current_rank_page_idx', '(rank ASC, artist_id ASC) WHERE rank IS NOT NULL'],
  ['artist_stats_current', 'stats_current_listeners_page_idx', '(sp_monthly_listeners DESC, artist_id ASC) WHERE sp_monthly_listeners IS NOT NULL'],
  ['artist_stats_current', 'stats_current_followers_page_idx', '(sp_followers DESC, artist_id ASC) WHERE sp_followers IS NOT NULL'],
  ['artist_stats_current', 'stats_current_score_page_idx', '(score DESC, artist_id ASC) WHERE score IS NOT NULL'],
  ['artists', 'artists_name_page_idx', '(name, id)'],
  ['artists', 'artists_label_idx', '(record_label)'],
  ['playlist_entries', 'playlist_entries_artist_ids_idx', 'USING gin (artist_ids)'],
  ['playlist_entries', 'playlist_entries_current_idx', '(playlist_id, position) WHERE removed_at IS NULL'],
  ['playlist_entries', 'playlist_entries_first_seen_idx', '(playlist_id, first_seen_at)'],
  ['playlist_entries', 'playlist_entries_removed_idx', '(playlist_id, removed_at) WHERE removed_at IS NOT NULL'],
  ['playlist_entries', 'playlist_entries_track_idx', '(track_id)'],
  ['playlists', 'playlists_active_followers_idx', '(followers DESC NULLS LAST) WHERE active'],
  ['playlists', 'playlists_active_changed_idx', '(last_changed_at DESC NULLS LAST) WHERE active'],
  ['playlists', 'playlists_active_name_idx', '(name) WHERE active'],
  ['playlists', 'playlists_name_trgm_idx', 'USING gin (name gin_trgm_ops)'],
  ['playlists', 'playlists_active_platform_type_idx', '(platform, type) WHERE active'],
  ['playlist_snapshots', 'playlist_snapshots_playlist_day_idx', '(playlist_id, captured_on)'],
];
const TABLES = ['artists', 'artist_stats_current', 'playlists', 'playlist_entries', 'playlist_snapshots', 'tracked_artists'];

const q = async (sql, params) => (await pool.query(sql, params)).rows;

try {
  console.log('\n== Tables ==');
  for (const r of await q(
    `SELECT c.relname, c.reltuples::bigint AS est_rows, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
     FROM pg_class c WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1)
     ORDER BY pg_total_relation_size(c.oid) DESC`, [TABLES])) {
    console.log(`  ${r.relname.padEnd(22)} ~${String(r.est_rows).padStart(12)} rows  ${r.size}`);
  }

  console.log('\n== Indexes the API needs ==');
  const existing = new Map((await q(
    `SELECT c.relname, i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = ANY($1)`, [INDEXES.map((x) => x[1])])).map((r) => [r.relname, r.indisvalid]));
  const missing = [];
  for (const [table, name, def] of INDEXES) {
    const state = !existing.has(name) ? 'MISSING' : existing.get(name) ? 'ok' : 'INVALID (interrupted build)';
    console.log(`  ${name.padEnd(40)} ${state}`);
    if (state !== 'ok') missing.push([table, name, def, state]);
  }

  console.log('\n== Active / waiting queries (> 2s) ==');
  const active = await q(
    `SELECT pid, now() - query_start AS running, wait_event_type, left(regexp_replace(query, '\\s+', ' ', 'g'), 120) AS query
     FROM pg_stat_activity
     WHERE state <> 'idle' AND pid <> pg_backend_pid() AND now() - query_start > interval '2 seconds'
     ORDER BY query_start`);
  if (!active.length) console.log('  none');
  for (const r of active) console.log(`  pid ${r.pid}  ${r.running}  ${r.wait_event_type || ''}  ${r.query}`);

  if (APPLY && missing.length) {
    console.log('\n== Building missing indexes (CONCURRENTLY) ==');
    for (const [table, name, def, state] of missing) {
      if (state.startsWith('INVALID')) await q(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`);
      const t = Date.now();
      process.stdout.write(`  ${name} … `);
      await q(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} ${def}`);
      console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`);
    }
    await q('ANALYZE artists, artist_stats_current, playlists, playlist_entries');
  } else if (missing.length) {
    console.log('\n  → re-run with --apply-indexes to build the missing indexes without blocking writes');
  }

  // Stored facets (catalog_facets) — the artists page reads these.
  if (APPLY) {
    await q(`CREATE TABLE IF NOT EXISTS catalog_facets (
               key text PRIMARY KEY, data jsonb NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now())`);
  }
  const [facets] = (await q(`SELECT to_regclass('catalog_facets') IS NOT NULL AS ok`))[0].ok
    ? await q(`SELECT refreshed_at FROM catalog_facets WHERE key = 'artists'`)
    : [];
  console.log(`\n== Stored facets ==\n  ${facets ? `refreshed ${facets.refreshed_at.toISOString()}` : 'MISSING'}`);
  if (APPLY) {
    const { refreshFacets } = await import('../api/lib/facets.js');
    const t = Date.now();
    process.stdout.write('  refreshing (reads the whole catalog, can take a few minutes) … ');
    await refreshFacets();
    console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`);
  }

  // Largest followed-artist set, the worst case a user sees.
  const [roster] = await q(
    `SELECT t.user_id, array_agg(a.slug) AS slugs FROM tracked_artists t JOIN artists a ON a.id = t.artist_id
     GROUP BY t.user_id ORDER BY count(*) DESC LIMIT 1`);
  const slugs = (roster?.slugs || []).join(',');
  const one = roster?.slugs?.[0];
  const [pl] = await q('SELECT id FROM playlists WHERE active ORDER BY followers DESC NULLS LAST LIMIT 1');

  console.log(`\n== API handlers, timed against the DB (${roster?.slugs?.length || 0} followed artists) ==`);
  const cases = [
    ['artists list', 'artists/index.js', '/api/artists?sort=rank&order=asc&page=1&perPage=25'],
    ['artists facets', 'artists/facets.js', '/api/artists/facets'],
    ['followed artists', 'artists/index.js', `/api/artists?slugs=${slugs}&perPage=200`],
    ['playlists (all)', 'playlists/index.js', '/api/playlists?sort=followers&page=1&perPage=25'],
    ['playlists (followed)', 'playlists/index.js', `/api/playlists?slugs=${slugs}&sort=roster&page=1&perPage=25`],
    ['placements summary', 'playlists/placements.js', `/api/playlists/placements?slugs=${slugs}&limit=0`],
    ['placements one artist', 'playlists/placements.js', `/api/playlists/placements?slugs=${one}&limit=200`],
    ['playlists (all, search)', 'playlists/index.js', '/api/playlists?q=summer&sort=followers&page=1&perPage=25'],
    ['playlist detail', 'playlists/[id].js', `/api/playlists/${pl?.id}?slugs=${slugs}`],
    ['playlist similar', 'playlists/[id].js', `/api/playlists/${pl?.id}?part=similar`],
  ];
  for (const [name, file, url] of cases) {
    if (url.includes('slugs=&') || url.endsWith('slugs=') || url.includes('undefined')) { console.log(`  ${name.padEnd(24)} skipped (no data)`); continue; }
    const handler = (await import(`../api/${file}`)).default;
    const times = [];
    let status;
    let size = 0;
    for (let i = 0; i < 2; i++) {
      const res = {
        setHeader() {}, status(c) { status = c; return this; },
        json(b) { size = JSON.stringify(b).length; return this; },
      };
      const t = performance.now();
      await handler({ method: 'GET', url, headers: { host: 'localhost' }, query: {} }, res);
      times.push(Math.round(performance.now() - t));
    }
    console.log(`  ${name.padEnd(24)} ${String(status).padEnd(4)} ${times.map((x) => `${x}ms`).join(' / ').padEnd(20)} ${(size / 1024).toFixed(0)} KB`);
  }
  console.log('\n(first number includes connection setup; second is warm)\n');
} catch (err) {
  // Without this the process.exit below would swallow the error.
  console.error(`\ndiagnose failed: ${err.message}${err.code ? ` (code ${err.code})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
  process.exit(process.exitCode ?? 0);
}
