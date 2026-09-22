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

const summaryCache = new Map(); // slug → artist summary
const detailCache = new Map();  // slug|include → full response

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/**
 * Paginated, filtered artist index.
 * @param {object} opts { q, genre, country, stage, slugs, sort, order, page, perPage }
 * @returns {Promise<{artists: Array, total: number, page: number, perPage: number}>}
 */
export async function fetchArtists(opts = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const data = await getJson(`/api/artists?${params}`);
  for (const a of data.artists) summaryCache.set(a.slug, a);
  return data;
}

/** Batch-fetch specific artists by slug (e.g. the user's tracked roster). */
export async function fetchArtistsBySlugs(slugs) {
  if (!slugs?.length) return [];
  const missing = slugs.filter((s) => !summaryCache.has(s));
  if (missing.length) {
    await fetchArtists({ slugs: missing, perPage: Math.min(missing.length, 200) });
  }
  return slugs.map((s) => summaryCache.get(s)).filter(Boolean);
}

/** Synchronous cache lookup (null when not yet fetched). */
export function getCachedArtist(slug) {
  return summaryCache.get(slug) || null;
}

/** Facet option lists + catalog-wide stats for the artists list page. */
export async function fetchFacets() {
  return getJson('/api/artists/facets');
}

/**
 * Ask for an artist missing from the catalog to be added. Creates a pending
 * artist_requests row that an outside service fulfills.
 * @returns {Promise<{request?, duplicate?, exists?, artist?}>}
 *   exists:true + artist when the name is already in the catalog;
 *   duplicate:true when someone already has an open request for this name.
 */
export async function requestArtist({ name, spotifyUrl, notes } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/artists/requests', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, spotifyUrl, notes }),
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
  const params = new URLSearchParams({ slugs: slugs.join(',') });
  if (q) params.set('q', q);
  if (sort) params.set('sort', sort);
  if (dedupe) params.set('dedupe', '1');
  if (page) params.set('page', String(page));
  if (perPage) params.set('perPage', String(perPage));
  return getJson(`/api/tracks?${params}`);
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
  const params = new URLSearchParams({ slugs: slugs.join(',') });
  if (sort) params.set('sort', sort);
  if (page) params.set('page', String(page));
  if (perPage) params.set('perPage', String(perPage));
  return getJson(`/api/albums?${params}`);
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
  const cacheKey = `${slug}|${include}|${days}`;
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);
  const data = await getJson(
    `/api/artists/${encodeURIComponent(slug)}?include=${include}&days=${days}`
  );
  summaryCache.set(slug, data.artist);
  detailCache.set(cacheKey, data);
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
  return getJson(`/api/feed?${params}`);
}
