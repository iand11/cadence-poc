// GET /api/playlists/placements — where artists / a track are (and were) playlisted.
//
// Query params (one scope required):
//   slugs     comma artist slugs (artist profile: one slug; roster: many)
//   track     catalog track id
// Filters:
//   status    current (default) | past | all
//   platform  spotify | apple | deezer (comma ok)
//   editorial 1 → editorial + chart only
//   limit     default 200, max 1000
//
// Response: { placements: [{ playlist, ...entry, artistSlug }],
//             summary: { playlists, placements, editorialPlaylists, reach, editorialReach,
//                        added30d, removed30d, byPlatform: { [platform]: {...} } } }
// The summary always describes *current* placements in scope; "added" uses the
// platform's own added date where it has one (so a first crawl isn't "new").
import { query } from '../lib/db.js';
import { PLAYLIST_COLUMNS, playlistRowToUI, entryRowToUI, intParam, list } from '../lib/playlist-shape.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const p = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const slugs = list(p, 'slugs');
  const track = p.get('track');
  if (!slugs.length && !/^\d+$/.test(track || '')) return res.status(400).json({ error: 'Pass slugs or track' });

  const params = [];
  const base = ['p.active'];
  let scopeJoin = '';
  if (slugs.length) {
    params.push(slugs);
    scopeJoin = `JOIN artists sa ON sa.id = ANY(e.artist_ids) AND sa.slug = ANY($${params.length})`;
  } else {
    params.push(track);
    base.push(`e.track_id = $${params.length}`);
  }
  if (list(p, 'platform').length) { params.push(list(p, 'platform')); base.push(`p.platform = ANY($${params.length})`); }
  if (p.get('editorial') === '1') base.push('p.is_editorial');

  const status = p.get('status') || 'current';
  const statusSql = status === 'past' ? 'e.removed_at IS NOT NULL' : status === 'all' ? 'true' : 'e.removed_at IS NULL';
  const limit = intParam(p.get('limit'), 200, 1, 1000);
  const from = `FROM playlist_entries e JOIN playlists p ON p.id = e.playlist_id ${scopeJoin}`;
  const slugSql = slugs.length ? 'sa.slug' : 'NULL::text';

  try {
    const [rows, summary, removed] = await Promise.all([
      query(`SELECT DISTINCT ON (p.followers, e.id) ${PLAYLIST_COLUMNS},
                    e.id AS entry_id, e.track_id, e.platform_track_id, e.track_name, e.artist_names,
                    e.position, e.peak_position, e.added_at, e.first_seen_at, e.last_seen_at, e.removed_at,
                    (SELECT json_agg(json_build_object('slug', a.slug, 'name', a.name)) FROM artists a WHERE a.id = ANY(e.artist_ids)) AS artists,
                    ${slugSql} AS artist_slug
             ${from} WHERE ${base.join(' AND ')} AND ${statusSql}
             ORDER BY p.followers DESC NULLS LAST, e.id
             LIMIT ${limit}`, params),
      query(`WITH cur AS (
               SELECT DISTINCT ON (e.id) e.id, COALESCE(e.added_at, e.first_seen_at) AS since,
                      p.id AS pid, p.platform, p.is_editorial, p.followers
               ${from} WHERE ${base.join(' AND ')} AND e.removed_at IS NULL
             ), pl AS (SELECT DISTINCT pid, platform, is_editorial, followers FROM cur),
             a AS (SELECT platform, count(*)::int AS placements,
                          count(*) FILTER (WHERE since >= now() - interval '30 days')::int AS added30d
                   FROM cur GROUP BY platform),
             b AS (SELECT platform, count(*)::int AS playlists,
                          count(*) FILTER (WHERE is_editorial)::int AS editorial_playlists,
                          COALESCE(sum(followers), 0)::bigint AS reach,
                          COALESCE(sum(followers) FILTER (WHERE is_editorial), 0)::bigint AS editorial_reach
                   FROM pl GROUP BY platform)
             SELECT * FROM a JOIN b USING (platform)`, params),
      query(`SELECT count(DISTINCT e.id)::int AS n ${from}
             WHERE ${base.join(' AND ')} AND e.removed_at >= now() - interval '30 days'`, params),
    ]);

    const byPlatform = {};
    const total = { playlists: 0, placements: 0, editorialPlaylists: 0, reach: 0, editorialReach: 0, added30d: 0 };
    for (const s of summary) {
      const b = {
        playlists: s.playlists, placements: s.placements, editorialPlaylists: s.editorial_playlists,
        reach: Number(s.reach), editorialReach: Number(s.editorial_reach), added30d: s.added30d,
      };
      byPlatform[s.platform] = b;
      for (const k of Object.keys(total)) total[k] += b[k];
    }

    // current first, then biggest playlists, then best position
    const placements = rows
      .map((r) => ({ playlist: playlistRowToUI(r), ...entryRowToUI(r), artistSlug: r.artist_slug || null }))
      .sort((x, y) => (y.current - x.current) || ((y.playlist.followers ?? -1) - (x.playlist.followers ?? -1)) || ((x.position ?? 9999) - (y.position ?? 9999)));

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ placements, summary: { ...total, removed30d: removed[0].n, byPlatform } });
  } catch (err) {
    console.error('GET /api/playlists/placements failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
