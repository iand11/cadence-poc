import { getTopTracksAcrossRoster, getArtist } from './artists';
import { getArtistPlaylists } from './playlistData';

// --- Seeded random (same pattern as playlistData.js) ---
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hashId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// --- Per-track streaming trend ---

export function generateTrackStreamingTrend(track, days = 90) {
  const totalStreams = track.streams || 100_000;
  const pop = track.popularity || 30;
  const seed = hashId(track.id);

  // Estimate daily base from total streams (assume track has been accumulating for ~365 days)
  const dailyBase = Math.round(totalStreams / 365);
  const growthRate = (pop - 40) / 150; // slower growth than artist-level

  const startDate = new Date('2026-01-25');
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const t = 1 + growthRate * (i / days);
    const noise = 1 + (seededRandom(i * 7 + seed) - 0.5) * 0.18;
    const total = Math.max(0, Math.round(dailyBase * t * noise));
    return {
      date: date.toISOString().split('T')[0],
      spotify: Math.round(total * (0.44 + (seededRandom(i * 13 + seed) - 0.5) * 0.06)),
      apple: Math.round(total * (0.17 + (seededRandom(i * 17 + seed) - 0.5) * 0.03)),
      youtube: Math.round(total * (0.24 + (seededRandom(i * 23 + seed) - 0.5) * 0.04)),
      amazon: Math.round(total * 0.09),
      tidal: Math.round(total * 0.06),
    };
  });
}

// --- Per-track performance metrics ---

export function generateTrackPerformance(track) {
  const seed = hashId(track.id);
  const totalStreams = track.streams || 0;
  const pop = track.popularity || 0;
  const playlists = track.spotifyPlaylists || 0;
  const reach = track.spotifyPlaylistReach || 0;

  const dailyStreams = Math.round(totalStreams / 365);
  const growthDelta = Math.round((seededRandom(seed * 41) - 0.3) * 25 * 10) / 10;
  const estimatedPeak = Math.max(1, Math.round(1 + (100 - pop) * 0.5 + seededRandom(seed * 13) * 20));
  const weeksTrending = Math.max(1, Math.round(seededRandom(seed * 29) * 52));
  const playlistConversion = reach > 0
    ? Math.round((totalStreams / reach) * 100 * 10) / 10
    : 0;

  return {
    dailyStreams,
    growthDelta,
    estimatedPeak,
    weeksTrending,
    playlistConversion,
  };
}

// --- Track playlist placements (proxy: artist's playlists) ---

export function getTrackPlaylists(track) {
  if (!track?.artistSlug) return [];
  return getArtistPlaylists(track.artistSlug);
}

// --- Track comparison helper ---

export function getTrackComparison(tracks) {
  return tracks.map(track => ({
    track,
    performance: generateTrackPerformance(track),
    trend: generateTrackStreamingTrend(track),
    artist: getArtist(track.artistSlug),
  }));
}

// --- Roster-wide track stats (for dashboard widget) ---

let _cachedStats = null;

export function getRosterTrackStats() {
  if (_cachedStats) return _cachedStats;

  const topTracks = getTopTracksAcrossRoster(20);
  let totalStreams = 0;
  let totalPop = 0;
  let totalPlaylists = 0;
  let totalEditorial = 0;

  const withPerf = topTracks.map(t => {
    totalStreams += t.streams;
    totalPop += t.popularity;
    totalPlaylists += t.spotifyPlaylists;
    totalEditorial += t.spotifyEditorialPlaylists;
    return {
      ...t,
      perf: generateTrackPerformance(t),
    };
  });

  // Sort by growth delta for "top movers"
  const topMovers = [...withPerf]
    .sort((a, b) => b.perf.growthDelta - a.perf.growthDelta)
    .slice(0, 8);

  const avgPopularity = topTracks.length > 0 ? Math.round(totalPop / topTracks.length) : 0;
  const editorialRate = totalPlaylists > 0 ? Math.round(totalEditorial / totalPlaylists * 100) : 0;

  _cachedStats = {
    totalStreams,
    avgPopularity,
    totalPlaylists,
    editorialRate,
    topMovers,
    topTracks: withPerf,
  };
  return _cachedStats;
}
