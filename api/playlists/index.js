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
import { artistIdArrayType, artistIdsForSlugs } from '../lib/artist-ids.js';
import { cached } from '../lib/cache.js';
import { rollupReady } from '../lib/artist-playlists.js';

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
  const perPage = intParam(p.get('perPage'), 50, 1, 200);
  const page = intParam(p.get('page'), 1, 1, 100000);
  const sort = (!slugs.length && p.get('sort') === 'roster' ? null : SORTS[p.get('sort')])
    || (slugs.length ? SORTS.roster : SORTS.followers);

  try {
    let base;
    if (slugs.length) {
      const ids = await artistIdsForSlugs(slugs);
      if (!ids.length) return send(res, { playlists: [], total: 0, page, perPage });
      params.push(ids);
      if (sort === SORTS.roster && !p.get('q') && !list(p, 'platformIds').length && await rollupReady()) {
        // Roster counts per playlist from the artist → playlist rollup
        // (api/lib/artist-playlists.js), which also carries the playlist
        // columns these filters and this sort need, so the page is picked and
        // counted from an index range per followed artist and only the page's
        // playlists are read. An entry featuring two followed artists counts
        // once for each.
        const scoped = `
          SELECT r.playlist_id, sum(r.tracks)::int AS roster_tracks, count(*)::int AS roster_artists,
                 max(r.followers) AS followers
          FROM artist_playlists_current r
          WHERE r.artist_id = ANY($${params.length}::bigint[]) AND ${where.map((w) => w.replace(/\bp\./g, 'r.')).join(' AND ')}
          GROUP BY r.playlist_id`;
        const order = 'roster_tracks DESC NULLS LAST, followers DESC NULLS LAST';
        const rows = await query(
          `WITH pg AS (
             SELECT g.*, count(*) OVER ()::int AS total_count FROM (${scoped}) g
             ORDER BY ${order} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
           )
           SELECT ${PLAYLIST_COLUMNS}, pg.roster_tracks, pg.roster_artists, pg.total_count
           FROM pg JOIN playlists p ON p.id = pg.playlist_id
           ORDER BY ${order.replace(/\b(roster_tracks|followers)\b/g, 'pg.$1')}`,
          params
        );
        const total = rows.length
          ? rows[0].total_count
          : page > 1
            ? (await query(`SELECT count(*)::int AS n FROM (${scoped}) g`, params))[0].n
            : 0;
        return send(res, { playlists: rows.map(playlistRowToUI), total, page, perPage });
      } else {
        const idsParam = `$${params.length}::${await artistIdArrayType()}`;
        // Roster counts per playlist, found through the artist_ids GIN index.
        base = `
          WITH r AS (
            SELECT e.playlist_id, count(DISTINCT e.id) AS roster_tracks, count(DISTINCT x.aid) AS roster_artists
            FROM playlist_entries e
            CROSS JOIN LATERAL unnest(e.artist_ids) AS x(aid)
            WHERE e.removed_at IS NULL AND e.artist_ids && ${idsParam} AND x.aid = ANY(${idsParam})
            GROUP BY e.playlist_id
          )
          SELECT ${PLAYLIST_COLUMNS}, r.roster_tracks, r.roster_artists
          FROM playlists p JOIN r ON r.playlist_id = p.id
          WHERE ${where.join(' AND ')}`;
      }
    } else {
      // Catalog-wide (1M+ playlists): read just this page in index order and
      // count separately, cached — a window count would scan and sort every
      // active playlist on each request.
      const whereSql = where.join(' AND ');
      const [rows, count] = await Promise.all([
        query(
          `SELECT ${PLAYLIST_COLUMNS} FROM playlists p WHERE ${whereSql}
           ORDER BY ${sort.replace(/\b(followers|name|last_changed_at)\b/g, 'p.$1')}
           LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
          params
        ),
        cached(`playlists:count:${whereSql}:${JSON.stringify(params)}`, 10 * 60_000,
          () => query(`SELECT count(*)::int AS n FROM playlists p WHERE ${whereSql}`, params)),
      ]);
      return send(res, { playlists: rows.map(playlistRowToUI), total: count[0].n, page, perPage });
    }
    // Roster scope is small: one pass returns the page and the total; only an
    // out-of-range page (no rows to carry the total) needs a separate count.
    const rows = await query(
      `SELECT x.*, count(*) OVER ()::int AS total_count FROM (${base}) x
       ORDER BY ${sort} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      params
    );
    const total = rows.length
      ? rows[0].total_count
      : page > 1
        ? (await query(`SELECT count(*)::int AS n FROM (${base}) x`, params))[0].n
        : 0;
    return send(res, { playlists: rows.map(playlistRowToUI), total, page, perPage });
  } catch (err) {
    console.error('GET /api/playlists failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}

function send(res, body) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(body);
}
