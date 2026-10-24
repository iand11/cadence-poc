// GET /api/cron/data-health — hourly rebuild of the admin data health report and the day's
// trend summary (api/lib/data-health.js), and pruning of the job run log (vercel.json "crons").
// Vercel sends `Authorization: Bearer $CRON_SECRET`; when CRON_SECRET is set, anything
// else is refused.
import { buildHealth } from '../lib/data-health.js';
import { trackRun, pruneJobRuns } from '../lib/job-runs.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await trackRun('data-health', async () => {
      await pruneJobRuns();
      const h = await buildHealth();
      return { alerts: h.alerts.length, timedOut: h.timedOut, slowest: h.slowest };
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[data-health] failed', err.message);
    return res.status(500).json({ error: err.message });
  }
}
