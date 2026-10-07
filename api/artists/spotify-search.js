// GET /api/artists/spotify-search?q=<name>
//
// Artist search against Spotify, for the "request a missing artist" flow:
// users pick a real Spotify artist instead of typing a free-text name, so
// requests carry a Spotify id/url and can't be spammed with made-up artists.
//
// Each result is annotated with any catalog artist it may already be:
//   catalogMatch: { slug, name, by: 'spotify' | 'name' } | null
// 'spotify' = same Spotify id (definitely in the catalog); 'name' = a catalog
// artist with the same name (possibly the same person — the UI lets the user
// add that one or still request the Spotify artist).
import { query } from '../lib/db.js';
import { withAuth } from '../lib/auth.js';
import { searchSpotifyArtists, spotifyArtistUrl } from '../lib/spotify.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return res.status(200).json({ artists: [] });

  let artists;
  try {
    artists = await searchSpotifyArtists(q, 8);
  } catch (err) {
    console.error('/api/artists/spotify-search failed:', err.message);
    return res.status(err.status || 502).json({ error: 'Spotify search is unavailable — try again shortly.' });
  }

  // Catalog annotations — best effort; a DB hiccup shouldn't break search.
  try {
    const urls = artists.map((a) => spotifyArtistUrl(a.spotifyId));
    const names = artists.map((a) => a.name.toLowerCase());
    const [bySpotify, byName, openRequests] = await Promise.all([
      query('SELECT slug, name, spotify_url FROM artists WHERE spotify_url = ANY($1)', [urls]),
      query('SELECT DISTINCT ON (lower(name)) slug, name FROM artists WHERE lower(name) = ANY($1)', [names]),
      query(
        `SELECT spotify_id FROM artist_requests
         WHERE spotify_id = ANY($1) AND status IN ('pending', 'in_progress')`,
        [artists.map((a) => a.spotifyId)]
      ).catch(() => []), // spotify_id column missing until db:schema is applied
    ]);
    const spotifyMap = new Map(bySpotify.map((r) => [r.spotify_url, r]));
    const nameMap = new Map(byName.map((r) => [r.name.toLowerCase(), r]));
    const requested = new Set(openRequests.map((r) => r.spotify_id));
    artists = artists.map((a) => {
      const s = spotifyMap.get(spotifyArtistUrl(a.spotifyId));
      const n = nameMap.get(a.name.toLowerCase());
      const catalogMatch = s ? { slug: s.slug, name: s.name, by: 'spotify' }
        : n ? { slug: n.slug, name: n.name, by: 'name' }
        : null;
      return { ...a, catalogMatch, requested: requested.has(a.spotifyId) };
    });
  } catch (err) {
    console.error('spotify-search catalog match failed:', err.message);
    artists = artists.map((a) => ({ ...a, catalogMatch: null, requested: false }));
  }

  return res.status(200).json({ artists });
}

export default withAuth(handler);
