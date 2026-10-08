#!/usr/bin/env node
// Sync smart link fans' recent Spotify plays into spotify_plays (same job as the
// /api/cron/spotify-plays cron). Use it to run the sync from your own scheduler.
//
// Usage: npm run spotify:sync -- [--all] [--limit 500]
//   --all    sync everyone now, not just fans whose last sync is older than
//            SPOTIFY_RESYNC_INTERVAL (default 2 hours)
import { pool } from './lib/db.js'; // loads .env

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const { syncDueListeners } = await import('../api/lib/spotify-sync.js');
const result = await syncDueListeners({
  force: args.includes('--all'),
  limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) : 500,
});
console.log(`Synced ${result.listeners} fan(s): ${result.plays} new play(s), ${result.errors} error(s).`);
await pool.end();
process.exit(0);
