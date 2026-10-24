// GET /api/cron/refresh-facets — daily recompute of the stored artist facets
// (vercel.json "crons"; see api/lib/facets.js). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; when CRON_SECRET is set, anything else
// is refused. Also runnable as `npm run db:refresh-facets`.
import { refreshFacets } from '../lib/facets.js';
import { trackRun } from '../lib/job-runs.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { stats } = await trackRun('refresh-facets', refreshFacets);
    return res.status(200).json({ ok: true, stats });
  } catch (err) {
    console.error('[refresh-facets] failed', err.message);
    return res.status(500).json({ error: err.message });
  }
}
