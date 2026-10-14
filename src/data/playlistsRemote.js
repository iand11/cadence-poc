// Real playlist data (DB-backed, crawled by music-scrapers) — replaces the
// seeded synthetic module ./playlistData.js.
//
// Shapes (see api/lib/playlist-shape.js):
//   playlist   { id, platform, platformId, name, description, curator, type, typeLabel,
//                isEditorial, followers, trackCount, imageUrl, url, categories,
//                lastCrawledAt, lastChangedAt, rosterTracks?, rosterArtists? }
//   entry      { entryId, trackId, platformTrackId, trackName, artistNames, artists[{slug,name}],
//                position, peakPosition, addedAt, firstSeenAt, lastSeenAt, removedAt, current, daysOn }
//   placement  { playlist, ...entry, artistSlug }

import { getJson, qs } from './http';

// Crawls land daily, so playlist responses can be reused for a few minutes.
const TTL = 5 * 60_000;

/**
 * Playlist universe, filtered/sorted server-side.
 * @param {object} opts { q, platform, type, editorial, slugs, sort, page, perPage }
 * @returns {Promise<{playlists, total, page, perPage}>}
 */
export function fetchPlaylists(opts = {}) {
  if (opts.slugs && !opts.slugs.length) return Promise.resolve({ playlists: [], total: 0, page: 1, perPage: opts.perPage || 50 });
  return getJson(`/api/playlists?${qs(opts)}`, { ttl: TTL });
}

/** One playlist: tracks, followerHistory, changes (+ roster flags when slugs given). */
export async function fetchPlaylist(id, { slugs, days } = {}) {
  try {
    return await getJson(`/api/playlists/${encodeURIComponent(id)}?${qs({ slugs, days })}`, { ttl: TTL });
  } catch {
    return null;
  }
}

/** Playlists sharing the most artists with this one (loaded after the profile). */
export async function fetchSimilarPlaylists(id) {
  try {
    const { similar } = await getJson(`/api/playlists/${encodeURIComponent(id)}?part=similar`, { ttl: TTL });
    return similar;
  } catch {
    return [];
  }
}

/**
 * Placements for artists (slugs) or one catalog track (track).
 * @param {object} opts { slugs, track, status: current|past|all, platform, editorial, limit }
 *   limit: 0 returns only the summary (no placement rows).
 * @returns {Promise<{placements, summary}>}
 */
export function fetchPlacements(opts = {}) {
  if (!opts.track && !opts.slugs?.length) {
    return Promise.resolve({ placements: [], summary: { playlists: 0, placements: 0, editorialPlaylists: 0, reach: 0, editorialReach: 0, added30d: 0, removed30d: 0, byPlatform: {} } });
  }
  return getJson(`/api/playlists/placements?${qs(opts)}`, { ttl: TTL });
}

export const PLATFORM_LABELS = { spotify: 'Spotify', apple: 'Apple Music', deezer: 'Deezer' };
export const TYPE_LABELS = { editorial: 'Editorial', chart: 'Chart', algorithmic: 'Algorithmic', this_is: 'This Is', label: 'Major label', brand: 'Brand', user: 'User' };

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '—');
