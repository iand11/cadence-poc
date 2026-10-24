#!/usr/bin/env node
// Rebuild the admin data health report with no query timeouts (same job as the hourly
// /api/cron/data-health cron): npm run db:data-health
import { pool } from './lib/db.js'; // loads .env

try {
  const { buildHealth } = await import('../api/lib/data-health.js');
  const { trackRun } = await import('../api/lib/job-runs.js');
  const t = Date.now();
  let h;
  await trackRun('data-health', async () => {
    h = await buildHealth({ timeoutMs: 0 });
    return { alerts: h.alerts.length, timedOut: h.timedOut, slowest: h.slowest };
  });
  console.log(`Built in ${((Date.now() - t) / 1000).toFixed(1)}s, ${h.alerts.length} alert(s).`);
  for (const s of h.slowest) console.log(`  ${s.name.padEnd(22)} ${(s.ms / 1000).toFixed(1)}s`);
  if (h.timedOut.length) console.log(`Failed: ${h.timedOut.join(', ')}`);
} catch (err) {
  console.error(`\ndata-health failed: ${err.message}${err.code ? ` (code ${err.code})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
  process.exit(process.exitCode ?? 0);
}
