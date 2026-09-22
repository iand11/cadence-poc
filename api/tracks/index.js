// GET /api/tracks — tracks across a set of artists (the tracked roster).
// Replaces getTopTracksAcrossRoster / loadAllRosterTracks from the bundle.
//
// Query params:
//   slugs    comma-separated artist slugs (required — roster scope)
//   q        search track name (ILIKE)
//   sort     streams | recent | popularity   (default streams)
//   dedupe   1 to dedupe by normalized name across the roster (top-tracks style)
//   page, perPage (default 1 / 50, max 200)
//
// Response: { tracks: [<normalizeTrack shape> + artistSlug], total, page, perPage }
import { query } from '../lib/db.js';
import { trackRowToUI, normalizeTrackName } from '../lib/artist-shape.js';

const SORTS = {
  streams: 't.sp_streams DESC',
  recent: 't.release_date DESC NULLS LAST',
  popularity: 't.sp_popularity DESC',
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

  const params = [slugs];
  let whereSql = 'WHERE a.slug = ANY($1)';
  const q = p.get('q')?.trim();
  if (q) {
    params.push(`%${q}%`);
    whereSql += ` AND t.name ILIKE $${params.length}`;
  }
  const orderBy = SORTS[p.get('sort')] || SORTS.streams;
  const dedupe = p.get('dedupe') === '1';
  const perPage = Math.min(Math.max(Number(p.get('perPage')) || 50, 1), 200);
  const page = Math.max(Number(p.get('page')) || 1, 1);

  try {
    // One row per track: prefer the main-credit artist among the requested slugs
    const baseSql = `
      SELECT DISTINCT ON (t.id)
             t.*, to_char(t.release_date, 'YYYY-MM-DD') AS release_date,
             at.artist_type, a.slug AS artist_slug
      FROM artist_tracks at
      JOIN artists a ON a.id = at.artist_id
      JOIN tracks t ON t.id = at.track_id
      ${whereSql}
      ORDER BY t.id, (at.artist_type = 'main') DESC`;

    if (dedupe) {
      // Top-tracks mode: fetch a generous window, dedupe by normalized name in
      // JS (same rule the bundle used), then page. Roster-scoped so the window
      // stays small.
      const rows = await query(
        `SELECT * FROM (${baseSql}) x ORDER BY ${orderBy.replace('t.', '')} LIMIT 1000`,
        params
      );
      const seen = new Set();
      const deduped = [];
      for (const r of rows) {
        const key = normalizeTrackName(r.name);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(trackRowToUI(r, r.artist_slug));
      }
      const start = (page - 1) * perPage;
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({
        tracks: deduped.slice(start, start + perPage),
        total: deduped.length,
        page,
        perPage,
      });
    }

    const countRows = await query(
      `SELECT count(DISTINCT t.id)::bigint AS n
       FROM artist_tracks at JOIN artists a ON a.id = at.artist_id JOIN tracks t ON t.id = at.track_id
       ${whereSql}`,
      params
    );
    const rows = await query(
      `SELECT * FROM (${baseSql}) x
       ORDER BY ${orderBy.replace('t.', '')}
       LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      params
    );
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      tracks: rows.map((r) => trackRowToUI(r, r.artist_slug)),
      total: Number(countRows[0]?.n || 0),
      page,
      perPage,
    });
  } catch (err) {
    console.error('GET /api/tracks failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
