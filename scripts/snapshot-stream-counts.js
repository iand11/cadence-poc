#!/usr/bin/env node
// Take today's stream counts for every stream-goal campaign that hasn't ended (same
// job as the /api/cron/stream-counts cron). Use it to run it from your own scheduler.
//
// Usage: npm run streams:snapshot
import { pool } from './lib/db.js'; // loads .env

const { snapshotDueTrackers } = await import('../api/lib/stream-counts.js');
const r = await snapshotDueTrackers();
console.log(`Counted ${r.counted} source(s) across ${r.trackers} campaign(s), ${r.errors} error(s); removed ${r.prunedYouTube} YouTube count(s) older than 30 days.`);
await pool.end();
process.exit(0);
