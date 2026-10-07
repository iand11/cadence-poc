// GET /api/playlists/:id — one playlist with its current tracklist, follower
// history, recent adds/removes, and playlists that share its artists.
//
// Query params:
//   slugs   optional roster scope → rosterTracks + `roster: true` flags on tracks
//   days    window for history / changes (default 90, max 365)
import { query } from '../lib/db.js';
import { PLAYLIST_COLUMNS, playlistRowToUI, entryRowToUI, intParam, list } from '../lib/playlist-shape.js';

const ENTRY_SELECT = `
  e.id AS entry_id, e.track_id, e.platform_track_id, e.track_name, e.artist_names,
  e.position, e.peak_position, e.added_at, e.first_seen_at, e.last_seen_at, e.removed_at,
  e.artist_ids,
  (SELECT json_agg(json_build_object('slug', a.slug, 'name', a.name)) FROM artists a WHERE a.id = ANY(e.artist_ids)) AS artists`;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid playlist id' });
  const days = intParam(url.searchParams.get('days'), 90, 1, 365);
  const slugs = list(url.searchParams, 'slugs');

  try {
    const [pl] = await query(`SELECT ${PLAYLIST_COLUMNS} FROM playlists p WHERE p.id = $1`, [id]);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    const [tracks, history, changes, similar, rosterIds] = await Promise.all([
      query(`SELECT ${ENTRY_SELECT} FROM playlist_entries e WHERE e.playlist_id = $1 AND e.removed_at IS NULL ORDER BY e.position NULLS LAST`, [id]),
      query(`SELECT to_char(captured_on, 'YYYY-MM-DD') AS date, followers, track_count
             FROM playlist_snapshots WHERE playlist_id = $1 AND captured_on >= current_date - $2::int ORDER BY captured_on`, [id, days]),
      query(`SELECT ${ENTRY_SELECT},
               CASE WHEN e.removed_at IS NOT NULL AND e.removed_at >= now() - make_interval(days => $2) THEN 'removed' ELSE 'added' END AS change,
               GREATEST(e.first_seen_at, COALESCE(e.removed_at, e.first_seen_at)) AS changed_at
             FROM playlist_entries e
             WHERE e.playlist_id = $1
               AND (e.removed_at >= now() - make_interval(days => $2)
                    OR (e.first_seen_at >= now() - make_interval(days => $2)
                        AND e.first_seen_at > (SELECT min(first_seen_at) + interval '1 hour' FROM playlist_entries WHERE playlist_id = $1)))
             ORDER BY changed_at DESC LIMIT 200`, [id, days]),
      // Playlists sharing the most current catalog artists
      query(`WITH mine AS (SELECT DISTINCT unnest(artist_ids) AS aid FROM playlist_entries WHERE playlist_id = $1 AND removed_at IS NULL)
             SELECT ${PLAYLIST_COLUMNS}, count(DISTINCT x.aid)::int AS overlap
             FROM playlist_entries e2
             CROSS JOIN LATERAL unnest(e2.artist_ids) AS x(aid)
             JOIN mine ON mine.aid = x.aid
             JOIN playlists p ON p.id = e2.playlist_id AND p.active
             WHERE e2.removed_at IS NULL AND e2.playlist_id <> $1
             GROUP BY p.id ORDER BY overlap DESC, p.followers DESC NULLS LAST LIMIT 8`, [id]),
      slugs.length ? query(`SELECT id FROM artists WHERE slug = ANY($1)`, [slugs]) : Promise.resolve([]),
    ]);

    const roster = new Set(rosterIds.map((r) => Number(r.id)));
    const shapeEntry = (r) => ({ ...entryRowToUI(r), ...(roster.size ? { roster: (r.artist_ids || []).some((a) => roster.has(Number(a))) } : {}) });
    const tracklist = tracks.map(shapeEntry);
    const positions = tracklist.filter((t) => t.roster && t.position != null).map((t) => t.position);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ...playlistRowToUI(pl),
      tracks: tracklist,
      followerHistory: history.map((h) => ({ date: h.date, followers: h.followers == null ? null : Number(h.followers), trackCount: h.track_count })),
      changes: changes.map((r) => ({ ...shapeEntry(r), change: r.change, changedAt: r.changed_at })),
      similar: similar.map((r) => ({ ...playlistRowToUI(r), overlap: r.overlap })),
      ...(roster.size ? {
        rosterTracks: tracklist.filter((t) => t.roster).length,
        avgRosterPosition: positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : null,
        bestRosterPosition: positions.length ? Math.min(...positions) : null,
      } : {}),
    });
  } catch (err) {
    console.error('GET /api/playlists/:id failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
