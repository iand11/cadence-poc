// /api/artists/requests — user requests for artists missing from the catalog.
//
//   POST { name, spotifyUrl?, notes? }
//     Creates a pending artist_requests row (pg_notify('artist_requests')
//     fires on insert, waking the outside fulfillment service). If an open
//     request already exists for the same name, returns it instead of
//     creating a duplicate. If the artist already exists in the catalog,
//     returns { exists: true, artist: { slug, name } } and creates nothing.
//
//   GET  ?status=pending  — the current user's requests, newest first.
import { query, queryOne } from '../lib/db.js';
import { verifyAuth } from '../lib/auth.js';

const requestShape = (r) => ({
  id: Number(r.id),
  name: r.name,
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
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 200) {
        return res.status(400).json({ error: 'Artist name is required (2–200 characters)' });
      }
      const spotifyUrl = String(body.spotifyUrl || '').trim().slice(0, 500) || null;
      const notes = String(body.notes || '').trim().slice(0, 1000) || null;

      // Already in the catalog? Point the user at it instead of queueing work.
      const existing = await queryOne(
        'SELECT slug, name FROM artists WHERE lower(name) = lower($1) LIMIT 1',
        [name]
      );
      if (existing) {
        return res.status(200).json({ exists: true, artist: existing });
      }

      // One open request per normalized name — a duplicate submit (from this
      // or another user) returns the already-open request.
      const inserted = await queryOne(
        `INSERT INTO artist_requests (name, spotify_url, notes, requested_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lower(name)) WHERE status IN ('pending', 'in_progress')
         DO NOTHING
         RETURNING *`,
        [name, spotifyUrl, notes, uid]
      );
      const row = inserted || await queryOne(
        `SELECT * FROM artist_requests
         WHERE lower(name) = lower($1) AND status IN ('pending', 'in_progress')
         LIMIT 1`,
        [name]
      );
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
