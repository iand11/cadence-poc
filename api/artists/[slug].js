// GET /api/artists/:slug — one artist with tracks, albums, and (optionally)
// metric history. Replaces getArtist() + loadArtistDetail() static data.
//
//   ?include=tracks,albums,history   (default: tracks,albums)
//   ?days=90                         history window (default 90)
//
// Response: {
//   artist:  <allArtists entry shape>,
//   tracks:  [<normalizeTrack shape>],   sorted by streams desc
//   albums:  [<normalizeAlbum shape>],   sorted by releaseDate desc
//   history: [{ capturedAt, source, metrics }]   oldest → newest
// }
import { query, queryOne } from '../lib/db.js';
import {
  artistRowToSummary,
  trackRowToUI,
  albumRowToUI,
  filterAndDedupeTracks,
} from '../lib/artist-shape.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  // Vercel provides req.query.slug; the dev middleware passes the path through
  const slug =
    req.query?.slug ||
    decodeURIComponent(url.pathname.replace(/\/$/, '').split('/').pop() || '');
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  const include = new Set(
    (url.searchParams.get('include') || 'tracks,albums').split(',').map((s) => s.trim())
  );
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 90, 1), 730);

  try {
    const row = await queryOne(
      `SELECT a.*, sc.rank, sc.score, sc.stats, sc.where_people_listen, sc.as_of AS stats_as_of
       FROM artists a
       LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id
       WHERE a.slug = $1`,
      [slug]
    );
    if (!row) return res.status(404).json({ error: 'Artist not found' });

    const result = { artist: artistRowToSummary(row) };

    if (include.has('tracks')) {
      const trackRows = await query(
        `SELECT t.*, to_char(t.release_date, 'YYYY-MM-DD') AS release_date, at.artist_type
         FROM artist_tracks at
         JOIN tracks t ON t.id = at.track_id
         WHERE at.artist_id = $1
         ORDER BY t.sp_streams DESC`,
        [row.id]
      );
      result.tracks = filterAndDedupeTracks(trackRows.map((t) => trackRowToUI(t, slug)));
    }

    if (include.has('albums')) {
      const albumRows = await query(
        `SELECT a.*, to_char(a.release_date, 'YYYY-MM-DD') AS release_date
         FROM artist_albums aa
         JOIN albums a ON a.id = aa.album_id
         WHERE aa.artist_id = $1
         ORDER BY a.release_date DESC NULLS LAST`,
        [row.id]
      );
      result.albums = albumRows
        .map((a) => albumRowToUI(a, slug))
        .filter((a) => a.name && a.releaseDate);
    }

    if (include.has('history')) {
      const snapRows = await query(
        `SELECT source, captured_at, metrics
         FROM artist_metric_snapshots
         WHERE artist_id = $1 AND captured_at > now() - ($2 || ' days')::interval
         ORDER BY captured_at ASC`,
        [row.id, days]
      );
      result.history = snapRows.map((s) => ({
        capturedAt: s.captured_at,
        source: s.source,
        metrics: s.metrics,
      }));
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    console.error(`GET /api/artists/${slug} failed:`, err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
