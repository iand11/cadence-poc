// GET /api/cron/spotify-plays — scheduled sync of fans' recent Spotify plays
// (vercel.json "crons"). Vercel sends `Authorization: Bearer $CRON_SECRET`; when
// CRON_SECRET is set, anything else is refused. Also runnable as
// `npm run spotify:sync` (scripts/sync-spotify-plays.js).
import { syncDueListeners } from '../lib/spotify-sync.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.status(200).json({ skipped: 'Spotify is not configured' });
  }
  try {
    return res.status(200).json(await syncDueListeners());
  } catch (err) {
    console.error('[spotify-plays] sync failed', err.message);
    return res.status(500).json({ error: err.message });
  }
}
