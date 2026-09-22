// GET /api/albums — albums across a set of artists (the tracked roster).
// Replaces getRecentReleases from the bundle.
//
// Query params:
//   slugs    comma-separated artist slugs (required)
//   sort     recent | popularity   (default recent)
//   page, perPage (default 1 / 20, max 200)
//
// Response: { albums: [<normalizeAlbum shape> + artistSlug], total, page, perPage }
import { query } from '../lib/db.js';
import { albumRowToUI } from '../lib/artist-shape.js';

const SORTS = {
  recent: 'release_date DESC NULLS LAST',
  popularity: 'spotify_popularity DESC',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.searchParams;

  const slugs = (p.get('slugs') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!slugs.length) return res.status(400).json({ error: 'Missing slugs' });

  const orderBy = SORTS[p.get('sort')] || SORTS.recent;
  const perPage = Math.min(Math.max(Number(p.get('perPage')) || 20, 1), 200);
  const page = Math.max(Number(p.get('page')) || 1, 1);

  try {
    const countRows = await query(
      `SELECT count(*)::bigint AS n
       FROM artist_albums aa JOIN artists a ON a.id = aa.artist_id
       WHERE a.slug = ANY($1)`,
      [slugs]
    );
    const rows = await query(
      `SELECT al.*, to_char(al.release_date, 'YYYY-MM-DD') AS release_date,
              a.slug AS artist_slug
       FROM artist_albums aa
       JOIN artists a ON a.id = aa.artist_id
       JOIN albums al ON al.id = aa.album_id
       WHERE a.slug = ANY($1)
       ORDER BY al.${orderBy}, al.id
       LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      [slugs]
    );
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      albums: rows.map((r) => albumRowToUI(r, r.artist_slug)),
      total: Number(countRows[0]?.n || 0),
      page,
      perPage,
    });
  } catch (err) {
    console.error('GET /api/albums failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
