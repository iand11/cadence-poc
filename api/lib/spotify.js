// Minimal Spotify Web API client (client-credentials flow) for artist lookup.
// Needs SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET. The app token is cached
// per process until shortly before it expires.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

let cached = { token: null, expiresAt: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    const err = new Error('Spotify is not configured');
    err.status = 503;
    throw err;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = new Error(`Spotify auth failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.token;
}

async function spotifyGet(path) {
  const doFetch = async () => fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  let res = await doFetch();
  if (res.status === 401) { // token revoked early — refresh once
    cached = { token: null, expiresAt: 0 };
    res = await doFetch();
  }
  return res;
}

export const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

export const spotifyArtistUrl = (id) => `https://open.spotify.com/artist/${id}`;

/** Normalized artist object used by the search + request endpoints. */
export function shapeSpotifyArtist(a) {
  const images = [...(a.images || [])].sort((x, y) => (x.width || 0) - (y.width || 0));
  // Smallest image that's still >= 64px for list thumbnails; largest for storage.
  const thumb = images.find((i) => (i.width || 0) >= 64) || images[images.length - 1];
  return {
    spotifyId: a.id,
    name: a.name,
    spotifyUrl: a.external_urls?.spotify || spotifyArtistUrl(a.id),
    imageUrl: thumb?.url || null,
    largeImageUrl: images[images.length - 1]?.url || null,
    followers: a.followers?.total ?? null,
    popularity: a.popularity ?? null,
    genres: a.genres || [],
  };
}

export async function searchSpotifyArtists(q, limit = 8) {
  const params = new URLSearchParams({ q, type: 'artist', limit: String(limit) });
  const res = await spotifyGet(`/search?${params}`);
  if (!res.ok) {
    const err = new Error(`Spotify search failed (${res.status})`);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }
  const body = await res.json();
  return (body.artists?.items || []).map(shapeSpotifyArtist);
}

/** One artist by Spotify id, or null if it doesn't exist. */
export async function getSpotifyArtist(id) {
  if (!SPOTIFY_ID_RE.test(id)) return null;
  const res = await spotifyGet(`/artists/${id}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    const err = new Error(`Spotify lookup failed (${res.status})`);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }
  return shapeSpotifyArtist(await res.json());
}
