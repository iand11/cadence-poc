// Spotify login for smart link fans (authorization code flow). A fan who taps
// "Continue with Spotify" on a link's consent page grants these scopes once; we
// read their profile and top artists, follow the artist and save the release for
// them, store the fan, and drop the token. Uses the same Spotify app as
// api/lib/spotify.js (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET); its redirect URI
// must include <origin>/api/spotify-fan (or SPOTIFY_REDIRECT_URI).
import { publicOrigin } from './smartlinks.js';

const ACCOUNTS = process.env.SPOTIFY_ACCOUNTS_URL || 'https://accounts.spotify.com';
const API = process.env.SPOTIFY_API_URL || 'https://api.spotify.com/v1';

export const FAN_SCOPES = [
  'user-read-email', 'user-read-private', 'user-follow-modify', 'user-library-modify', 'user-top-read',
];

export const spotifyLoginConfigured = () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

export const fanRedirectUri = (req) => process.env.SPOTIFY_REDIRECT_URI || `${publicOrigin(req)}/api/spotify-fan`;

export function authorizeUrl(req, state) {
  const u = new URL(`${ACCOUNTS}/authorize`);
  u.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', fanRedirectUri(req));
  u.searchParams.set('scope', FAN_SCOPES.join(' '));
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeCode(req, code) {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: fanRedirectUri(req) }),
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed (${res.status})`);
  return (await res.json()).access_token;
}

async function call(token, method, path) {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify ${method} ${path.split('?')[0]} failed (${res.status})`);
  return res.status === 204 || method !== 'GET' ? null : res.json();
}

/** { type: 'track' | 'album', id } from an open.spotify.com URL. */
export function spotifyItem(url) {
  const m = String(url || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album)\/([A-Za-z0-9]{22})/);
  return m ? { type: m[1], id: m[2] } : null;
}

/**
 * Profile + top artists, then follow the release's artist(s) and save the release.
 * Each write is best effort; the result says which ones worked.
 */
export async function captureFan(token, item) {
  const me = await call(token, 'GET', '/me');
  let followed = false;
  let saved = false;
  let topArtists = null;
  if (item) {
    try {
      const release = await call(token, 'GET', `/${item.type}s/${item.id}`);
      const artistIds = (release.artists || []).map(a => a.id).slice(0, 5);
      if (artistIds.length) {
        await call(token, 'PUT', `/me/following?type=artist&ids=${artistIds.join(',')}`);
        followed = true;
      }
    } catch (err) { console.error('[spotify-fan] follow failed', err.message); }
    try {
      await call(token, 'PUT', `/me/${item.type === 'album' ? 'albums' : 'tracks'}?ids=${item.id}`);
      saved = true;
    } catch (err) { console.error('[spotify-fan] save failed', err.message); }
  }
  try {
    const top = await call(token, 'GET', '/me/top/artists?limit=10&time_range=medium_term');
    topArtists = (top.items || []).map(a => a.name);
  } catch (err) { console.error('[spotify-fan] top artists failed', err.message); }
  return {
    spotifyUserId: me.id,
    displayName: me.display_name || null,
    email: me.email || null,
    country: me.country || null,
    product: me.product || null,
    followed,
    saved,
    topArtists,
  };
}
