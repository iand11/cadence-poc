// GET /api/cron/stream-counts — daily count for every stream-goal campaign that hasn't
// ended (vercel.json "crons"). Vercel sends `Authorization: Bearer $CRON_SECRET`; when
// CRON_SECRET is set, anything else is refused. Also runnable as `npm run streams:snapshot`.
import { snapshotDueTrackers } from '../lib/stream-counts.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    return res.status(200).json(await snapshotDueTrackers());
  } catch (err) {
    console.error('[stream-counts] snapshot failed', err.message);
    return res.status(500).json({ error: err.message });
  }
}
