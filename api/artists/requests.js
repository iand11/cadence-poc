// /api/artists/requests — user requests for artists missing from the catalog.
//
//   POST { spotifyId, notes? }
//     The artist must be picked from Spotify search (/api/artists/spotify-search):
//     the id is re-validated against Spotify here, and the stored name/url come
//     from Spotify, never from user input — so requests can't be spammed with
//     made-up artists. Creates a pending artist_requests row
//     (pg_notify('artist_requests') fires on insert, waking the outside
//     fulfillment service). If an open request already exists for the same
//     Spotify artist, returns it instead of creating a duplicate. If the artist
//     is already in the catalog (same Spotify url), returns
//     { exists: true, artist: { slug, name } } and creates nothing.
//
//   GET  ?status=pending  — the current user's requests, newest first.
import { query, queryOne } from '../lib/db.js';
import { verifyAuth } from '../lib/auth.js';
import { getSpotifyArtist, SPOTIFY_ID_RE } from '../lib/spotify.js';

// Cap on a user's open (pending / in-progress) requests.
const MAX_OPEN_PER_USER = 25;

const requestShape = (r) => ({
  id: Number(r.id),
  name: r.name,
  spotifyId: r.spotify_id ?? null,
  spotifyUrl: r.spotify_url,
  notes: r.notes,
  status: r.status,
  requestedAt: r.requested_at,
  artistId: r.artist_id ? Number(r.artist_id) : null,
});

async function getUid(req) {
  try {
    const decoded = await verifyAuth(req);
    if (decoded?.uid || decoded?.sub) return decoded.uid || decoded.sub;
  } catch (e) {
    if (e.status === 401) throw e;
  }
  return req.headers['x-user-id'] || 'anonymous';
}

export default async function handler(req, res) {
  let uid;
  try {
    uid = await getUid(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const status = url.searchParams.get('status')?.trim();
      const params = [uid];
      let where = 'requested_by = $1';
      if (status) {
        params.push(status);
        where += ` AND status = $${params.length}`;
      }
      const rows = await query(
        `SELECT * FROM artist_requests WHERE ${where} ORDER BY requested_at DESC LIMIT 100`,
        params
      );
      return res.status(200).json({ requests: rows.map(requestShape) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (!body || typeof body !== 'object') {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      }
      const spotifyId = String(body.spotifyId || '').trim();
      if (!SPOTIFY_ID_RE.test(spotifyId)) {
        return res.status(400).json({ error: 'Pick the artist from the Spotify search results' });
      }
      const notes = String(body.notes || '').trim().slice(0, 1000) || null;

      let artist;
      try {
        artist = await getSpotifyArtist(spotifyId);
      } catch (err) {
        console.error('Spotify lookup failed:', err.message);
        return res.status(502).json({ error: 'Couldn\'t reach Spotify — please try again.' });
      }
      if (!artist) return res.status(404).json({ error: 'That artist wasn\'t found on Spotify' });

      // Already in the catalog? Point the user at it instead of queueing work.
      const existing = await queryOne(
        'SELECT slug, name FROM artists WHERE spotify_url = $1 LIMIT 1',
        [artist.spotifyUrl]
      );
      if (existing) {
        return res.status(200).json({ exists: true, artist: existing });
      }

      const { n: openCount } = await queryOne(
        `SELECT count(*)::int AS n FROM artist_requests
         WHERE requested_by = $1 AND status IN ('pending', 'in_progress')`,
        [uid]
      );
      if (openCount >= MAX_OPEN_PER_USER) {
        return res.status(429).json({
          error: `You have ${openCount} requests in progress — please wait for some to finish.`,
        });
      }

      const spotifyData = {
        imageUrl: artist.largeImageUrl,
        followers: artist.followers,
        popularity: artist.popularity,
        genres: artist.genres,
      };

      // One open request per Spotify artist — a duplicate submit (from this
      // or another user) returns the already-open request.
      const inserted = await queryOne(
        `INSERT INTO artist_requests (name, spotify_id, spotify_url, spotify_data, notes, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (spotify_id) WHERE status IN ('pending', 'in_progress') AND spotify_id IS NOT NULL
         DO NOTHING
         RETURNING *`,
        [artist.name, artist.spotifyId, artist.spotifyUrl, JSON.stringify(spotifyData), notes, uid]
      );
      const row = inserted || await queryOne(
        `SELECT * FROM artist_requests
         WHERE spotify_id = $1 AND status IN ('pending', 'in_progress')
         LIMIT 1`,
        [artist.spotifyId]
      );
      // Subscribe this user (requester or duplicate submitter) so they get the
      // artist added to their roster + a notification on fulfillment.
      if (row) {
        await query(
          `INSERT INTO artist_request_subscribers (request_id, user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.id, uid]
        );
      }
      return res.status(inserted ? 201 : 200).json({
        request: row ? requestShape(row) : null,
        duplicate: !inserted,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/artists/requests failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
