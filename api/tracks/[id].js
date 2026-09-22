// GET /api/tracks/:id — one track by canonical id, shaped like normalizeTrack.
// Replaces the bundled trackIndex lookup (getTrackAsync in src/data/artists.js).
// artistSlug is the main artist's slug (first main credit).
import { query } from '../lib/db.js';
import { trackRowToUI } from '../lib/artist-shape.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query?.id || url.pathname.replace(/\/$/, '').split('/').pop();
  if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid track id' });

  try {
    const rows = await query(
      `SELECT t.*, to_char(t.release_date, 'YYYY-MM-DD') AS release_date,
              at.artist_type, a.slug AS artist_slug
       FROM tracks t
       JOIN artist_tracks at ON at.track_id = t.id
       JOIN artists a ON a.id = at.artist_id
       WHERE t.id = $1
       ORDER BY (at.artist_type = 'main') DESC
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Track not found' });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ track: trackRowToUI(rows[0], rows[0].artist_slug) });
  } catch (err) {
    console.error(`GET /api/tracks/${id} failed:`, err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
