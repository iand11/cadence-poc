#!/usr/bin/env node
// Take today's stream counts for every stream-goal campaign still being read, and save
// today's report for their Meta campaigns (same job as the /api/cron/stream-counts cron). Use it to run it from your own scheduler.
//
// Usage: npm run streams:snapshot
import { pool } from './lib/db.js'; // loads .env

const { snapshotDueTrackers } = await import('../api/lib/stream-counts.js');
const { snapshotMetaReports } = await import('../api/cron/stream-counts.js');
const r = await snapshotDueTrackers();
const m = await snapshotMetaReports();
console.log(`Counted ${r.counted} source(s) across ${r.trackers} campaign(s), ${r.errors} error(s); removed ${r.prunedYouTube} YouTube count(s) older than 30 days.`);
console.log(m.skipped ? `Meta reports: ${m.skipped}.` : `Saved ${m.saved} Meta report(s), ${m.errors} error(s).`);
await pool.end();
process.exit(0);
