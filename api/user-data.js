import { query, queryOne, exec } from './lib/db.js';
import { withAuth, verifyAuth } from './lib/auth.js';

// Key the TrackedArtistsProvider persists its roster under. Writes to it are
// mirrored into the tracked_artists table and newly tracked artists get a
// refresh_queue job, so outside fetcher services learn about them instantly
// (pg_notify fires on queue insert).
const TRACKED_KEY = 'musicspace-tracked-artists-v1';

async function syncTrackedArtists(uid, slugs) {
  const list = Array.isArray(slugs) ? slugs.filter((s) => typeof s === 'string') : [];
  const rows = list.length
    ? await query('SELECT id FROM artists WHERE slug = ANY($1)', [list])
    : [];
  const ids = rows.map((r) => r.id);

  // Drop untracked, add newly tracked (RETURNING gives us only the new ones)
  await exec(
    'DELETE FROM tracked_artists WHERE user_id = $1 AND NOT (artist_id = ANY($2::bigint[]))',
    [uid, ids]
  );
  const inserted = ids.length
    ? await query(
        `INSERT INTO tracked_artists (user_id, artist_id)
         SELECT $1, x FROM unnest($2::bigint[]) x
         ON CONFLICT DO NOTHING
         RETURNING artist_id`,
        [uid, ids]
      )
    : [];

  if (inserted.length) {
    await exec(
      `INSERT INTO refresh_queue (artist_id, job_type, reason, priority, requested_by)
       SELECT x, 'full', 'tracked', 1, $2 FROM unnest($1::bigint[]) x
       ON CONFLICT (artist_id, job_type) WHERE status IN ('pending', 'in_progress')
       DO NOTHING`,
      [inserted.map((r) => r.artist_id), uid]
    );
  }
}

async function handler(req, res) {
  // Extract user ID from verified token
  let uid;
  try {
    const decoded = await verifyAuth(req);
    uid = decoded?.uid || decoded?.sub;
  } catch {
    // withAuth already handles 401, but if called directly in dev without firebase:
  }

  // In dev without Firebase service account, use a fallback header
  if (!uid) {
    uid = req.headers['x-user-id'] || 'anonymous';
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');

    if (key) {
      try {
        const row = await queryOne(
          'SELECT data FROM user_data WHERE user_id = $1 AND key = $2',
          [uid, key]
        );
        return res.status(200).json({ key, data: row?.data || null });
      } catch {
        // DB unreachable — return null so client falls back to localStorage
        return res.status(200).json({ key, data: null });
      }
    }

    try {
      const rows = await query(
        'SELECT key, data, updated_at FROM user_data WHERE user_id = $1 ORDER BY key',
        [uid]
      );
      const result = {};
      for (const row of rows) {
        result[row.key] = row.data;
      }
      return res.status(200).json(result);
    } catch {
      return res.status(200).json({});
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const { key, data } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Missing key' });

    try {
      await exec(
        `INSERT INTO user_data (user_id, key, data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, key)
         DO UPDATE SET data = $3, updated_at = NOW()`,
        [uid, key, JSON.stringify(data)]
      );

      if (key === TRACKED_KEY) {
        // Mirror the roster into tracked_artists + enqueue refresh jobs.
        // Never fail the user's save over this — log and move on.
        try {
          await syncTrackedArtists(uid, data);
        } catch (err) {
          console.error('tracked_artists sync failed:', err.message);
        }
      }
    } catch {
      // DB unreachable — silently fail, localStorage has the data
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const key = url.searchParams.get('key');
    if (!key) return res.status(400).json({ error: 'Missing key' });

    try {
      await exec(
        'DELETE FROM user_data WHERE user_id = $1 AND key = $2',
        [uid, key]
      );
    } catch {
      // DB unreachable — silently fail
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
