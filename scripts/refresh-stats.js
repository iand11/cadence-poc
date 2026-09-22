#!/usr/bin/env node
// Persist a fresh batch of artist social/streaming stats.
//
// This is the write path for the recurring "fetch current data from social
// media" job: whatever fetcher you run (Chartmetric API, platform APIs, a
// scraper) produces a JSON payload, and this script persists it — upserting
// the live values in artist_stats_current AND appending an immutable row to
// artist_metric_snapshots so history accumulates for trend charts.
// Partial payloads are fine: stats merge into the current blob (jsonb ||),
// so a TikTok-only fetch won't wipe Spotify values.
//
// Usage:
//   node scripts/refresh-stats.js --file fresh-stats.json [--source chartmetric]
//   node scripts/refresh-stats.js --dir ~/Downloads/artist2/artists   (re-read full dumps)
//
// --file payload format: an array of { artist_id, stats } or an object map
//   { "<artist_id>": { ...cm_statistics-shaped metrics... } }
// Unknown metric keys are fine — they land in jsonb untouched.

import fs from 'node:fs';
import path from 'node:path';
import { pool } from './lib/db.js';

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const FILE = flag('file');
const DIR = flag('dir');
const SOURCE = flag('source', 'import');

// Update live values + append snapshot, in one transaction per batch
export async function persistStatsBatch(client, entries, source = 'import') {
  const payload = JSON.stringify(
    entries.map((e) => ({ artist_id: e.artist_id, stats: e.stats }))
  );
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO artist_stats_current (
         artist_id, rank, score, sp_monthly_listeners, sp_followers, sp_popularity,
         ins_followers, tiktok_followers, ycs_subscribers, stats, as_of
       )
       SELECT
         r.artist_id,
         (r.stats->>'cm_artist_rank')::integer,
         (r.stats->>'cm_artist_score')::double precision,
         (r.stats->>'sp_monthly_listeners')::bigint,
         (r.stats->>'sp_followers')::bigint,
         (r.stats->>'sp_popularity')::integer,
         (r.stats->>'ins_followers')::bigint,
         (r.stats->>'tiktok_followers')::bigint,
         (r.stats->>'ycs_subscribers')::bigint,
         r.stats, now()
       FROM jsonb_to_recordset($1::jsonb) AS r(artist_id bigint, stats jsonb)
       WHERE EXISTS (SELECT 1 FROM artists a WHERE a.id = r.artist_id)
       ON CONFLICT (artist_id) DO UPDATE SET
         rank                 = COALESCE(EXCLUDED.rank, artist_stats_current.rank),
         score                = COALESCE(EXCLUDED.score, artist_stats_current.score),
         sp_monthly_listeners = COALESCE(EXCLUDED.sp_monthly_listeners, artist_stats_current.sp_monthly_listeners),
         sp_followers         = COALESCE(EXCLUDED.sp_followers, artist_stats_current.sp_followers),
         sp_popularity        = COALESCE(EXCLUDED.sp_popularity, artist_stats_current.sp_popularity),
         ins_followers        = COALESCE(EXCLUDED.ins_followers, artist_stats_current.ins_followers),
         tiktok_followers     = COALESCE(EXCLUDED.tiktok_followers, artist_stats_current.tiktok_followers),
         ycs_subscribers      = COALESCE(EXCLUDED.ycs_subscribers, artist_stats_current.ycs_subscribers),
         stats                = artist_stats_current.stats || EXCLUDED.stats,
         as_of                = now()`,
      [payload]
    );
    await client.query(
      `INSERT INTO artist_metric_snapshots (artist_id, source, captured_at, metrics)
       SELECT r.artist_id, $2, now(), r.stats
       FROM jsonb_to_recordset($1::jsonb) AS r(artist_id bigint, stats jsonb)
       WHERE EXISTS (SELECT 1 FROM artists a WHERE a.id = r.artist_id)
       ON CONFLICT DO NOTHING`,
      [payload, source]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

function loadEntries() {
  if (FILE) {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(raw)) return raw.filter((e) => e?.artist_id && e?.stats);
    return Object.entries(raw).map(([id, stats]) => ({ artist_id: Number(id), stats }));
  }
  // --dir mode: pull cm_statistics back out of full artist dumps
  const dir = path.resolve(DIR.replace(/^~/, process.env.HOME || '~'));
  const entries = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (d?.id && d?.cm_statistics) entries.push({ artist_id: d.id, stats: d.cm_statistics });
    } catch { /* skip unparsable */ }
  }
  return entries;
}

async function main() {
  const entries = loadEntries();
  console.log(`${entries.length} stat payloads to persist (source: ${SOURCE})`);
  const client = await pool.connect();
  try {
    const BATCH = 500;
    for (let i = 0; i < entries.length; i += BATCH) {
      await persistStatsBatch(client, entries.slice(i, i + BATCH), SOURCE);
      process.stdout.write(`  ${Math.min(i + BATCH, entries.length)}/${entries.length}\r`);
    }
  } finally {
    client.release();
  }
  console.log('\nDone.');
  await pool.end();
}

// Only run main when invoked directly (persistStatsBatch is importable)
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  if (!FILE && !DIR) {
    console.error('Usage: refresh-stats.js --file <stats.json> | --dir <artist-json-dir> [--source name]');
    process.exit(1);
  }
  main().catch((err) => { console.error(err); process.exit(1); });
}
