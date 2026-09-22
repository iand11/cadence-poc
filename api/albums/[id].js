// GET /api/albums/:id — one album by canonical id (+ its tracks).
// Replaces the bundled albumIndex lookup (getAlbumAsync / getAlbumTracksAsync).
//
//   ?include=tracks   also return the album's tracks (deduped, streams desc)
import { query } from '../lib/db.js';
import { albumRowToUI, trackRowToUI } from '../lib/artist-shape.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query?.id || url.pathname.replace(/\/$/, '').split('/').pop();
  if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid album id' });

  const includeTracks = (url.searchParams.get('include') || '').includes('tracks');

  try {
    const rows = await query(
      `SELECT al.*, to_char(al.release_date, 'YYYY-MM-DD') AS release_date,
              a.slug AS artist_slug
       FROM albums al
       JOIN artist_albums aa ON aa.album_id = al.id
       JOIN artists a ON a.id = aa.artist_id
       WHERE al.id = $1
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Album not found' });
    const result = { album: albumRowToUI(rows[0], rows[0].artist_slug) };

    if (includeTracks) {
      const trackRows = await query(
        `SELECT DISTINCT ON (t.id)
                t.*, to_char(t.release_date, 'YYYY-MM-DD') AS release_date,
                at.artist_type, a.slug AS artist_slug
         FROM tracks t
         JOIN artist_tracks at ON at.track_id = t.id
         JOIN artists a ON a.id = at.artist_id
         WHERE t.album_ids @> ARRAY[$1::bigint]
         ORDER BY t.id, (at.artist_type = 'main') DESC`,
        [id]
      );
      // Dedupe by (name, artist) keeping highest streams — same rule as
      // getAlbumTracksAsync in src/data/artists.js
      const byKey = new Map();
      for (const r of trackRows) {
        const t = trackRowToUI(r, r.artist_slug);
        const key = `${t.name.toLowerCase().trim()}|${t.artistSlug}`;
        const prev = byKey.get(key);
        if (!prev || t.streams > prev.streams) byKey.set(key, t);
      }
      result.tracks = [...byKey.values()].sort((a, b) => b.streams - a.streams);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    console.error(`GET /api/albums/${id} failed:`, err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
