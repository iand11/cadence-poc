// Remote (database-backed) artist data — the drop-in replacement path for the
// static module in ./artists.js.
//
// Every function here resolves to the exact same object shapes the static
// module produces (allArtists entries, normalizeTrack/normalizeAlbum output),
// so pages can migrate by swapping the import and awaiting the result:
//
//   import { allArtists, getArtist }        from '../data/artists';        // static (bundled, capped roster)
//   import { fetchArtists, fetchArtist }    from '../data/artistsRemote';  // DB (200k+ artists, live stats)
//
// With 200k+ artists there is no client-side "allArtists" array any more —
// list pages should pass their query/filter/sort/page state to fetchArtists
// and let Postgres do the work.

import { getIdToken } from '../lib/firebase';
import { getJson, qs } from './http';

const summaryCache = new Map(); // slug → artist summary (sync lookups via getCachedArtist)
const MAX_PER_PAGE = 200;

/**
 * Paginated, filtered artist index.
 * @param {object} opts { q, genre, country, stage, slugs, sort, order, page, perPage }
 * @returns {Promise<{artists: Array, total: number, page: number, perPage: number}>}
 */
export async function fetchArtists(opts = {}) {
  const data = await getJson(`/api/artists?${qs(opts)}`, { ttl: 60_000 });
  for (const a of data.artists) summaryCache.set(a.slug, a);
  return data;
}

/** Batch-fetch specific artists by slug (e.g. the user's tracked roster). */
export async function fetchArtistsBySlugs(slugs) {
  if (!slugs?.length) return [];
  const missing = [...new Set(slugs.filter((s) => !summaryCache.has(s)))].sort();
  // The API pages at 200 — fetch larger sets in parallel chunks.
  const chunks = [];
  for (let i = 0; i < missing.length; i += MAX_PER_PAGE) chunks.push(missing.slice(i, i + MAX_PER_PAGE));
  await Promise.all(chunks.map((chunk) => fetchArtists({ slugs: chunk, perPage: chunk.length })));
  return slugs.map((s) => summaryCache.get(s)).filter(Boolean);
}

/** Synchronous cache lookup (null when not yet fetched). */
export function getCachedArtist(slug) {
  return summaryCache.get(slug) || null;
}

/** Facet option lists + catalog-wide stats for the artists list page. */
export async function fetchFacets() {
  return getJson('/api/artists/facets', { ttl: 60 * 60_000 });
}

async function authHeaders(base = {}) {
  const headers = { ...base };
  const token = await getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Search Spotify for artists (the missing-artist request flow). Each result:
 * { spotifyId, name, spotifyUrl, imageUrl, followers, popularity, genres,
 *   catalogMatch: { slug, name, by: 'spotify'|'name' } | null, requested }.
 */
export async function searchSpotifyArtists(q, { signal } = {}) {
  const res = await fetch(`/api/artists/spotify-search?q=${encodeURIComponent(q)}`, {
    headers: await authHeaders(),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Spotify search failed (${res.status})`);
  return body.artists || [];
}

/**
 * Ask for an artist missing from the catalog to be added. Takes the Spotify
 * id picked from searchSpotifyArtists — the server re-validates it and stores
 * Spotify's name/url. Creates a pending artist_requests row that an outside
 * service fulfills.
 * @returns {Promise<{request?, duplicate?, exists?, artist?}>}
 *   exists:true + artist when that Spotify artist is already in the catalog;
 *   duplicate:true when someone already has an open request for it.
 */
export async function requestArtist({ spotifyId, notes } = {}) {
  const res = await fetch('/api/artists/requests', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ spotifyId, notes }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

/** One track by canonical id — drop-in for getTrackAsync. */
export async function fetchTrack(id) {
  try {
    const { track } = await getJson(`/api/tracks/${encodeURIComponent(id)}`);
    return track;
  } catch {
    return null;
  }
}

/**
 * Tracks across a set of artists (normalizeTrack shape + artistSlug).
 * @param {object} opts { slugs (required), q, sort: streams|recent|popularity, dedupe, page, perPage }
 * @returns {Promise<{tracks, total, page, perPage}>}
 */
export async function fetchTracks({ slugs, q, sort, dedupe, page, perPage } = {}) {
  if (!slugs?.length) return { tracks: [], total: 0, page: 1, perPage: perPage || 50 };
  return getJson(`/api/tracks?${qs({ slugs, q, sort, dedupe: !!dedupe, page, perPage })}`);
}

/** One album by canonical id (+ tracks) — drop-in for getAlbumAsync/getAlbumTracksAsync. */
export async function fetchAlbum(id, { tracks = false } = {}) {
  try {
    return await getJson(
      `/api/albums/${encodeURIComponent(id)}${tracks ? '?include=tracks' : ''}`
    );
  } catch {
    return null;
  }
}

/**
 * Albums across a set of artists (normalizeAlbum shape + artistSlug).
 * @param {object} opts { slugs (required), sort: recent|popularity, page, perPage }
 * @returns {Promise<{albums, total, page, perPage}>}
 */
export async function fetchAlbums({ slugs, sort, page, perPage } = {}) {
  if (!slugs?.length) return { albums: [], total: 0, page: 1, perPage: perPage || 20 };
  return getJson(`/api/albums?${qs({ slugs, sort, page, perPage })}`);
}

/** Name search — same result shape as searchArtists() in artists.js. */
export async function searchArtists(query, limit = 20) {
  if (!query?.trim()) return [];
  const { artists } = await fetchArtists({ q: query.trim(), perPage: limit });
  return artists;
}

/**
 * Full artist profile: summary + tracks + albums (+ metric history).
 * artist matches the allArtists entry shape; tracks/albums match
 * loadArtistDetail()'s normalized output.
 * @returns {Promise<{artist, tracks, albums, history?}>}
 */
export async function fetchArtist(slug, { history = false, days = 90 } = {}) {
  const include = history ? 'tracks,albums,history' : 'tracks,albums';
  const data = await getJson(
    `/api/artists/${encodeURIComponent(slug)}?include=${include}&days=${days}`,
    { ttl: 5 * 60_000 }
  );
  summaryCache.set(slug, data.artist);
  return data;
}

/** Tracks/albums only — drop-in for loadArtistDetail(slug). */
export async function loadArtistDetail(slug) {
  const { tracks, albums } = await fetchArtist(slug);
  return { tracks, albums };
}

/**
 * Social content feed from the database — drop-in for api.getContentFeed().
 * @returns {Promise<{items, artistAverages, total}>}
 */
export async function fetchContentFeed({ platform, type, sort = 'recent', artist, artists, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (platform) params.set('platform', platform);
  if (type) params.set('type', type);
  if (sort) params.set('sort', sort);
  if (artist) params.set('artist', artist);
  else if (artists?.length) params.set('artists', artists.join(','));
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return getJson(`/api/feed?${params}`, { ttl: 60_000 });
}
