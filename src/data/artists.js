// Core artist data module — database-backed.
//
// The static bundle (artists-index.generated.json / allArtists) is gone.
// Artist data now comes from two places:
//   * the tracked roster (rosterStore, populated by TrackedArtistsProvider
//     from /api/artists?slugs=...) — sync lookups against artists the user
//     tracks;
//   * the HTTP API (artistsRemote) — async search, browse, and detail across
//     the full 200k+ catalog.
//
// The seeded generators (streaming trend, social timeline, forecast, revenue)
// are unchanged: pure functions of an artist summary object.

import { getRoster, getRosterArtist } from './rosterStore';
import {
  fetchArtists,
  fetchArtistsBySlugs,
  fetchArtist,
  getCachedArtist,
  loadArtistDetail as remoteLoadArtistDetail,
  searchArtists as remoteSearchArtists,
  fetchTrack,
  fetchTracks,
  fetchAlbum,
  fetchAlbums,
} from './artistsRemote';

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Synchronous lookup: tracked roster first, then anything already fetched
 * through the API this session. Returns null when unknown — callers must
 * guard (the old static version silently fell back to the #1 artist).
 */
export function getArtist(slug) {
  return getRosterArtist(slug) || getCachedArtist(slug);
}

/** Async lookup across the full catalog (summary only). */
export async function getArtistAsync(slug) {
  const cached = getArtist(slug);
  if (cached) return cached;
  const [artist] = await fetchArtistsBySlugs([slug]);
  return artist || null;
}

/** Full profile: { artist, tracks, albums, history? } from the database. */
export { fetchArtist };

/** Tracks/albums detail for one artist ({ tracks, albums }). */
export const loadArtistDetail = remoteLoadArtistDetail;

/** Async name search across the full catalog (was sync over the bundle). */
export const searchArtists = remoteSearchArtists;

/** Top N artists in the catalog by rank (async — was sync over the bundle). */
export async function getTopArtists(n = 10) {
  const { artists } = await fetchArtists({ sort: 'rank', perPage: n });
  return artists;
}

export async function getTrackAsync(id) {
  if (id == null) return null;
  return fetchTrack(id);
}

export async function getAlbumAsync(id) {
  if (id == null) return null;
  const result = await fetchAlbum(id);
  return result?.album || null;
}

export async function getAlbumTracksAsync(albumId) {
  if (albumId == null) return [];
  const result = await fetchAlbum(albumId, { tracks: true });
  return result?.tracks || [];
}

/**
 * Top tracks across a set of artists (deduped by song, streams desc).
 * Defaults to the tracked roster. Async — was sync over the bundle.
 */
export async function getTopTracksAcrossRoster(n = 10, slugs = null) {
  const scope = slugs || getRoster().map((a) => a.slug);
  const { tracks } = await fetchTracks({ slugs: scope, sort: 'streams', dedupe: true, perPage: n });
  return tracks;
}

/** Recent releases across a set of artists. Defaults to the tracked roster. */
export async function getRecentReleases(n = 10, slugs = null) {
  const scope = slugs || getRoster().map((a) => a.slug);
  const { albums } = await fetchAlbums({ slugs: scope, sort: 'recent', perPage: n });
  return albums;
}

// ---------------------------------------------------------------------------
// Roster-scoped aggregates (operate on the tracked roster, or a passed array)
// ---------------------------------------------------------------------------

export function getAggregateStats(artists = null) {
  const roster = artists || getRoster();
  const total = roster.length;
  if (!total) {
    return { total: 0, totalListeners: 0, totalFollowers: 0, totalPlaylists: 0, avgScore: 0, totalPlaylistReach: 0 };
  }
  const totalListeners = roster.reduce((sum, a) => sum + a.spotify.monthlyListeners, 0);
  const totalFollowers = roster.reduce((sum, a) => sum + a.spotify.followers, 0);
  const totalPlaylists = roster.reduce((sum, a) => sum + a.playlists.spotify.total, 0);
  const avgScore = roster.reduce((sum, a) => sum + a.score, 0) / total;
  const totalPlaylistReach = roster.reduce((sum, a) => sum + a.playlists.spotify.reach, 0);

  return { total, totalListeners, totalFollowers, totalPlaylists, avgScore, totalPlaylistReach };
}

/**
 * Compare an artist against the roster average (normalized 0-100).
 * Baseline is the tracked roster (or a passed array). With no roster the
 * artist itself is the ceiling, so bars render sensibly instead of NaN.
 */
export function getBenchmarkComparison(artist, artists = null) {
  const pool = (artists || getRoster());
  const roster = pool.length ? pool : [artist];

  const maxListeners = Math.max(...roster.map((a) => a.spotify.monthlyListeners), artist.spotify.monthlyListeners);
  const maxFollowers = Math.max(...roster.map((a) => a.spotify.followers), artist.spotify.followers);
  const maxPlaylists = Math.max(...roster.map((a) => a.playlists.spotify.total), artist.playlists.spotify.total);
  const maxTiktok = Math.max(...roster.map((a) => a.social.tiktok), artist.social.tiktok);
  const maxInstagram = Math.max(...roster.map((a) => a.social.instagram), artist.social.instagram);
  const maxShazam = Math.max(...roster.map((a) => a.engagement.shazam), artist.engagement.shazam);

  const normalize = (val, max) => (max > 0 ? Math.round((val / max) * 100) : 0);
  const avg = (fn) => roster.reduce((s, a) => s + fn(a), 0) / roster.length;

  return {
    dimensions: ['Monthly Listeners', 'Spotify Followers', 'Playlists', 'TikTok', 'Instagram', 'Shazam'],
    artist: {
      normalized: [
        normalize(artist.spotify.monthlyListeners, maxListeners),
        normalize(artist.spotify.followers, maxFollowers),
        normalize(artist.playlists.spotify.total, maxPlaylists),
        normalize(artist.social.tiktok, maxTiktok),
        normalize(artist.social.instagram, maxInstagram),
        normalize(artist.engagement.shazam, maxShazam),
      ],
    },
    benchmark: {
      normalized: [
        normalize(avg((a) => a.spotify.monthlyListeners), maxListeners),
        normalize(avg((a) => a.spotify.followers), maxFollowers),
        normalize(avg((a) => a.playlists.spotify.total), maxPlaylists),
        normalize(avg((a) => a.social.tiktok), maxTiktok),
        normalize(avg((a) => a.social.instagram), maxInstagram),
        normalize(avg((a) => a.engagement.shazam), maxShazam),
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Generated time-series data based on real metrics (unchanged — pure
// functions of an artist summary object)
// ---------------------------------------------------------------------------

export function generateStreamingTrend(artist, days = 90) {
  const dailyBase = Math.round((artist.spotify.monthlyListeners || 1000000) / 30);
  const pop = artist.spotify.popularity || 50;
  const growthRate = (pop - 40) / 100;

  const startDate = new Date('2026-01-25');
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const t = 1 + growthRate * (i / days);
    const noise = 1 + (seededRandom(i * 7 + artist.id) - 0.5) * 0.12;
    const total = Math.round(dailyBase * t * noise);
    return {
      date: date.toISOString().split('T')[0],
      spotify: Math.round(total * (0.42 + (seededRandom(i * 13 + artist.id) - 0.5) * 0.04)),
      apple: Math.round(total * (0.16 + (seededRandom(i * 17 + artist.id) - 0.5) * 0.02)),
      youtube: Math.round(total * (0.26 + (seededRandom(i * 23 + artist.id) - 0.5) * 0.03)),
      amazon: Math.round(total * 0.09),
      tidal: Math.round(total * 0.07),
    };
  });
}

export function generateSocialTimeline(artist, days = 90) {
  const platforms = {
    tiktok: { current: artist.social.tiktok, growth: artist.spotify.popularity > 70 ? 0.3 : 0.08 },
    instagram: { current: artist.social.instagram, growth: 0.06 },
    twitter: { current: artist.social.twitter, growth: 0.03 },
    youtube: { current: artist.social.youtube, growth: 0.1 },
  };

  const startDate = new Date('2026-01-25');
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const entry = { date: date.toISOString().split('T')[0] };
    Object.entries(platforms).forEach(([platform, { current, growth }], pIdx) => {
      const backDays = days - i;
      const factor = 1 / (1 + growth * (backDays / days));
      const noise = 1 + (seededRandom(i * 11 + pIdx * 97 + artist.id) - 0.5) * 0.02;
      entry[platform] = Math.round(current * factor * noise);
    });
    return entry;
  });
}

export function generateForecast(artist, totalDays = 90, actualDays = 60) {
  const dailyBase = Math.round((artist.spotify.monthlyListeners || 1000000) / 30);
  const pop = artist.spotify.popularity || 50;
  const growthRate = (pop - 40) / 100;

  const startDate = new Date('2026-01-25');
  return Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const t = 1 + growthRate * (i / totalDays);

    if (i < actualDays) {
      const noise = 1 + (seededRandom(i * 7 + artist.id) - 0.5) * 0.12;
      return { date: dateStr, actual: Math.round(dailyBase * t * noise), forecast: null, upper: null, lower: null };
    } else {
      const forecastBase = Math.round(dailyBase * t);
      const noise = 1 + (seededRandom(i * 19 + artist.id + 41) - 0.5) * 0.06;
      const val = Math.round(forecastBase * noise);
      const band = 0.06 + (i - actualDays) * 0.008;
      return { date: dateStr, actual: null, forecast: val, upper: Math.round(val * (1 + band)), lower: Math.round(val * (1 - band)) };
    }
  });
}

// Revenue breakdown generated from streaming data
export function generateRevenue(artist) {
  const streamingRev = Math.round(artist.spotify.monthlyListeners * 0.004 * 12);
  const syncRev = Math.round(streamingRev * 0.15);
  const liveRev = Math.round(streamingRev * 0.25);
  const merchRev = Math.round(streamingRev * 0.08);
  const total = streamingRev + syncRev + liveRev + merchRev;
  return [
    { source: 'Streaming', amount: streamingRev, percentage: Math.round(streamingRev / total * 100) },
    { source: 'Live', amount: liveRev, percentage: Math.round(liveRev / total * 100) },
    { source: 'Sync', amount: syncRev, percentage: Math.round(syncRev / total * 100) },
    { source: 'Merch', amount: merchRev, percentage: Math.round(merchRev / total * 100) },
  ];
}
