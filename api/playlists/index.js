// GET /api/playlists — the tracked playlist universe.
//
// Query params:
//   q          name search (ILIKE)
//   platform   spotify | apple | deezer (comma list ok)
//   type       editorial | chart | label | brand | user (comma list ok)
//   editorial  1 → editorial + chart only
//   platformIds  comma list of platform playlist ids (e.g. Spotify ids) to look up
//   slugs      roster scope: only playlists currently featuring these artists,
//              each with rosterTracks / rosterArtists counts
//   sort       followers (default) | roster | changed | name
//   page, perPage (default 1 / 50, max 200)
//
// Response: { playlists: [playlistRowToUI], total, page, perPage }
import { query } from '../lib/db.js';
import { PLAYLIST_COLUMNS, playlistRowToUI, intParam, list } from '../lib/playlist-shape.js';

const SORTS = {
  followers: 'followers DESC NULLS LAST, name',
  roster: 'roster_tracks DESC NULLS LAST, followers DESC NULLS LAST',
  changed: 'last_changed_at DESC NULLS LAST',
  name: 'name',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const p = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const where = ['p.active'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };

  if (p.get('q')) add('p.name ILIKE ?', `%${p.get('q').trim()}%`);
  if (list(p, 'platform').length) add('p.platform = ANY(?)', list(p, 'platform'));
  if (list(p, 'type').length) add('p.type = ANY(?)', list(p, 'type'));
  if (list(p, 'platformIds').length) add('p.platform_id = ANY(?)', list(p, 'platformIds'));
  if (p.get('editorial') === '1') where.push('p.is_editorial');

  const slugs = list(p, 'slugs');
  let rosterJoin = '';
  if (slugs.length) {
    params.push(slugs);
    rosterJoin = `
      JOIN (
        SELECT e.playlist_id, count(DISTINCT e.id) AS roster_tracks, count(DISTINCT a.id) AS roster_artists
        FROM playlist_entries e
        JOIN artists a ON a.id = ANY(e.artist_ids) AND a.slug = ANY($${params.length})
        WHERE e.removed_at IS NULL
        GROUP BY e.playlist_id
      ) r ON r.playlist_id = p.id`;
  }

  const perPage = intParam(p.get('perPage'), 50, 1, 200);
  const page = intParam(p.get('page'), 1, 1, 100000);
  const sort = SORTS[p.get('sort')] || (slugs.length ? SORTS.roster : SORTS.followers);

  try {
    const base = `
      SELECT ${PLAYLIST_COLUMNS}${slugs.length ? ', r.roster_tracks, r.roster_artists' : ''}
      FROM playlists p ${rosterJoin}
      WHERE ${where.join(' AND ')}`;
    const [rows, count] = await Promise.all([
      query(`SELECT * FROM (${base}) x ORDER BY ${sort} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, params),
      query(`SELECT count(*)::int AS n FROM (${base}) x`, params),
    ]);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ playlists: rows.map(playlistRowToUI), total: count[0].n, page, perPage });
  } catch (err) {
    console.error('GET /api/playlists failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
