import { allArtists, getArtist } from './artists';

// --- Seeded random (same pattern as mockProfiles.js) ---
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- Playlist Universe ---
// Mix of real well-known playlists and genre-specific generated ones

const PLAYLIST_TEMPLATES = [
  // Major editorial (Spotify)
  { name: "Today's Top Hits", curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 34_200_000, genre: null },
  { name: 'New Music Friday', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 15_800_000, genre: null },
  { name: 'RapCaviar', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 14_500_000, genre: 'hip hop' },
  { name: 'Pop Rising', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 11_400_000, genre: 'pop' },
  { name: 'Viva Latino', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 12_800_000, genre: 'latin' },
  { name: 'Hot Country', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 7_200_000, genre: 'country' },
  { name: 'Rock This', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 5_600_000, genre: 'rock' },
  { name: 'Are & Be', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 6_800_000, genre: 'r&b' },
  { name: 'mint', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 8_100_000, genre: 'dance' },
  { name: 'Lorem', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 4_900_000, genre: 'indie' },
  { name: 'Pollen', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 3_200_000, genre: 'alternative' },
  { name: 'All New Indie', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 2_800_000, genre: 'indie' },
  { name: 'Baila Reggaeton', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 9_400_000, genre: 'reggaeton' },
  { name: 'Fresh Finds', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 3_600_000, genre: null },
  { name: 'Anti Pop', curator: 'Spotify Editorial', type: 'editorial', platform: 'spotify', followers: 2_100_000, genre: 'alternative' },

  // Algorithmic (Spotify)
  { name: 'Discover Weekly', curator: 'Spotify Algorithmic', type: 'algorithmic', platform: 'spotify', followers: null, genre: null },
  { name: 'Release Radar', curator: 'Spotify Algorithmic', type: 'algorithmic', platform: 'spotify', followers: null, genre: null },
  { name: 'Daily Mix', curator: 'Spotify Algorithmic', type: 'algorithmic', platform: 'spotify', followers: null, genre: null },
  { name: 'On Repeat', curator: 'Spotify Algorithmic', type: 'algorithmic', platform: 'spotify', followers: null, genre: null },
  { name: 'Repeat Rewind', curator: 'Spotify Algorithmic', type: 'algorithmic', platform: 'spotify', followers: null, genre: null },

  // Apple Music editorial
  { name: 'A-List Pop', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 6_100_000, genre: 'pop' },
  { name: 'New Music Daily', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 4_800_000, genre: null },
  { name: 'ALT CTRL', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 2_300_000, genre: 'alternative' },
  { name: 'The Rap Life', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 3_900_000, genre: 'hip hop' },
  { name: 'Superbloom', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 1_800_000, genre: 'indie' },
  { name: 'danceXL', curator: 'Apple Music Editorial', type: 'editorial', platform: 'apple', followers: 2_700_000, genre: 'dance' },

  // User-generated
  { name: 'Chill Vibes', curator: 'User — @chillcurator', type: 'user', platform: 'spotify', followers: 1_240_000, genre: null },
  { name: 'Study Beats', curator: 'User — @studymusic', type: 'user', platform: 'spotify', followers: 890_000, genre: null },
  { name: 'Workout Bangers', curator: 'User — @fitbeats', type: 'user', platform: 'spotify', followers: 2_100_000, genre: null },
  { name: 'Late Night Drive', curator: 'User — @nightowl', type: 'user', platform: 'spotify', followers: 670_000, genre: null },
  { name: 'Summer Anthems', curator: 'User — @summersound', type: 'user', platform: 'spotify', followers: 1_500_000, genre: null },
  { name: 'Sad Songs Club', curator: 'User — @emotionalmusic', type: 'user', platform: 'spotify', followers: 950_000, genre: null },
  { name: 'Underground Heat', curator: 'User — @undergroundhq', type: 'user', platform: 'spotify', followers: 380_000, genre: 'hip hop' },
  { name: 'Indie Discoveries', curator: 'User — @indiefinder', type: 'user', platform: 'spotify', followers: 520_000, genre: 'indie' },

  // Deezer / Amazon / YouTube editorial
  { name: 'Brand New', curator: 'Deezer Editorial', type: 'editorial', platform: 'deezer', followers: 1_900_000, genre: null },
  { name: 'Pop Hits', curator: 'Deezer Editorial', type: 'editorial', platform: 'deezer', followers: 3_200_000, genre: 'pop' },
  { name: 'Hot New Releases', curator: 'Amazon Music', type: 'editorial', platform: 'amazon', followers: 2_400_000, genre: null },
  { name: 'Breakthrough', curator: 'Amazon Music', type: 'editorial', platform: 'amazon', followers: 1_700_000, genre: null },
  { name: 'Trending', curator: 'YouTube Music', type: 'editorial', platform: 'youtube', followers: 5_100_000, genre: null },
  { name: 'Discover Mix', curator: 'YouTube Music', type: 'algorithmic', platform: 'youtube', followers: null, genre: null },
];

// Build playlist objects with IDs
const playlistUniverse = PLAYLIST_TEMPLATES.map((tpl, i) => ({
  ...tpl,
  id: tpl.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  index: i,
}));

// --- Per-artist playlist placement generation ---

// Genre matching helper
function genreMatches(artistGenre, playlistGenre) {
  if (!playlistGenre) return true; // null genre = accepts all
  if (!artistGenre) return false;
  const ag = artistGenre.toLowerCase();
  const pg = playlistGenre.toLowerCase();
  if (ag.includes(pg) || pg.includes(ag)) return true;
  // Broad category matching
  const popish = ['pop', 'dance', 'electropop', 'synth', 'electro'];
  const hipHopish = ['hip hop', 'rap', 'trap', 'drill', 'r&b'];
  const rockish = ['rock', 'alternative', 'indie', 'punk', 'metal', 'grunge'];
  const latinish = ['latin', 'reggaeton', 'bachata', 'salsa', 'corridos'];
  for (const group of [popish, hipHopish, rockish, latinish]) {
    if (group.some(g => ag.includes(g)) && group.some(g => pg.includes(g))) return true;
  }
  return false;
}

// Cache
const _artistPlaylistCache = new Map();

function generateArtistPlacements(artist) {
  if (_artistPlaylistCache.has(artist.slug)) return _artistPlaylistCache.get(artist.slug);

  const totalTarget = Math.min(30, artist.playlists.spotify.total || 5);
  const editorialTarget = Math.min(totalTarget, artist.playlists.spotify.editorial || 1);
  const totalReach = artist.playlists.spotify.reach || 100_000;
  const pop = artist.spotify.popularity || 30;
  const artistGenre = artist.genres?.primary?.name || '';

  // Score each playlist for this artist
  const scored = playlistUniverse.map((pl, idx) => {
    let score = seededRandom(artist.id * 31 + idx * 17);

    // Genre match bonus
    if (genreMatches(artistGenre, pl.genre)) score += 0.3;

    // Popularity-gated: big editorial playlists need high pop
    if (pl.type === 'editorial' && pl.followers && pl.followers > 10_000_000) {
      if (pop < 60) score -= 0.5;
      else if (pop >= 80) score += 0.3;
    }

    // Algorithmic playlists are more accessible
    if (pl.type === 'algorithmic') score += 0.15;

    // User playlists also accessible
    if (pl.type === 'user') score += 0.1;

    return { playlist: pl, score };
  })
    .sort((a, b) => b.score - a.score);

  // Pick top N playlists
  const editorial = scored.filter(s => s.playlist.type === 'editorial').slice(0, editorialTarget);
  const nonEditorial = scored.filter(s => s.playlist.type !== 'editorial').slice(0, totalTarget - editorial.length);
  const selected = [...editorial, ...nonEditorial].sort((a, b) => b.score - a.score);

  // Distribute reach across placements
  const totalScore = selected.reduce((s, x) => s + x.score, 0);

  const placements = selected.map((s, i) => {
    const weight = totalScore > 0 ? s.score / totalScore : 1 / selected.length;
    const streams = Math.round(totalReach * weight * (0.8 + seededRandom(artist.id * 7 + i * 13) * 0.4));
    const position = s.playlist.type === 'algorithmic' ? null : Math.round(1 + seededRandom(artist.id * 11 + i * 23) * 49);
    const dayOffset = Math.round(seededRandom(artist.id * 3 + i * 19) * 180);
    const dateAdded = new Date(2025, 9, 1 + dayOffset).toISOString().split('T')[0];
    const delta = Math.round((seededRandom(artist.id * 41 + i * 29) - 0.35) * 30 * 10) / 10;

    return {
      playlistId: s.playlist.id,
      playlistName: s.playlist.name,
      curator: s.playlist.curator,
      type: s.playlist.type,
      platform: s.playlist.platform,
      followers: s.playlist.followers,
      position,
      streamsFromPlaylist: streams,
      dateAdded,
      delta,
      artistSlug: artist.slug,
      artistName: artist.name,
    };
  });

  _artistPlaylistCache.set(artist.slug, placements);
  return placements;
}

// --- Build reverse index: playlistId → placements ---
let _playlistArtistMap = null;

function ensurePlaylistArtistMap() {
  if (_playlistArtistMap) return _playlistArtistMap;
  _playlistArtistMap = new Map();
  for (const pl of playlistUniverse) {
    _playlistArtistMap.set(pl.id, []);
  }
  // Only process top 100 artists for performance (they cover the most meaningful placements)
  const artistsToProcess = allArtists.slice(0, 100);
  for (const artist of artistsToProcess) {
    const placements = generateArtistPlacements(artist);
    for (const p of placements) {
      const arr = _playlistArtistMap.get(p.playlistId);
      if (arr) arr.push(p);
    }
  }
  // Sort each playlist's artists by streams
  for (const [, arr] of _playlistArtistMap) {
    arr.sort((a, b) => b.streamsFromPlaylist - a.streamsFromPlaylist);
  }
  return _playlistArtistMap;
}

// --- Public API ---

export function getAllPlaylists() {
  const map = ensurePlaylistArtistMap();
  return playlistUniverse.map(pl => {
    const tracks = map.get(pl.id) || [];
    const totalStreams = tracks.reduce((s, t) => s + t.streamsFromPlaylist, 0);
    return {
      ...pl,
      rosterTracks: tracks.length,
      totalStreamAttribution: totalStreams,
    };
  }).sort((a, b) => b.totalStreamAttribution - a.totalStreamAttribution);
}

export function getPlaylist(id) {
  const pl = playlistUniverse.find(p => p.id === id);
  if (!pl) return null;

  const map = ensurePlaylistArtistMap();
  const tracks = map.get(id) || [];
  const totalStreams = tracks.reduce((s, t) => s + t.streamsFromPlaylist, 0);
  const positions = tracks.filter(t => t.position != null).map(t => t.position);
  const avgPosition = positions.length > 0 ? Math.round(positions.reduce((s, p) => s + p, 0) / positions.length) : null;
  const peakPosition = positions.length > 0 ? Math.min(...positions) : null;

  // Find similar playlists (share the most roster artists)
  const trackArtistSlugs = new Set(tracks.map(t => t.artistSlug));
  const similar = playlistUniverse
    .filter(p => p.id !== id)
    .map(p => {
      const pTracks = map.get(p.id) || [];
      const overlap = pTracks.filter(t => trackArtistSlugs.has(t.artistSlug)).length;
      return { ...p, overlap, rosterTracks: pTracks.length };
    })
    .filter(p => p.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 6);

  return {
    ...pl,
    tracks,
    rosterTracks: tracks.length,
    totalStreamAttribution: totalStreams,
    avgPosition,
    peakPosition,
    similar,
    aiSummary: {
      text: `"${pl.name}" by ${pl.curator} ${pl.followers ? `reaches ${formatNum(pl.followers)} followers` : 'delivers personalized recommendations'}. ${tracks.length} roster artist${tracks.length === 1 ? '' : 's'} appear on this playlist, generating ${formatNum(totalStreams)} attributed streams. ${tracks.length > 0 ? `${tracks[0].artistName} leads with ${formatNum(tracks[0].streamsFromPlaylist)} streams.` : ''} ${avgPosition ? `Average roster position: #${avgPosition}.` : ''}`,
      keyMetrics: [
        { label: 'Followers', value: pl.followers ? formatNum(pl.followers) : 'Personalized' },
        { label: 'Roster Artists', value: String(tracks.length) },
        { label: 'Avg Position', value: avgPosition ? `#${avgPosition}` : '—' },
        { label: 'Stream Attribution', value: formatNum(totalStreams) },
      ],
      suggestions: [
        'Which artists should we pitch to this playlist?',
        'Compare to similar playlists',
        'Show placement history trends',
      ],
    },
  };
}

export function getArtistPlaylists(slug) {
  const artist = getArtist(slug);
  if (!artist) return [];
  return generateArtistPlacements(artist);
}

export function getPlaylistComparison(ids) {
  return ids.map(id => getPlaylist(id)).filter(Boolean);
}

export function getRosterPlaylistStats() {
  const map = ensurePlaylistArtistMap();
  let totalPlacements = 0;
  let editorialPlacements = 0;
  let totalStreamAttribution = 0;

  for (const pl of playlistUniverse) {
    const tracks = map.get(pl.id) || [];
    totalPlacements += tracks.length;
    if (pl.type === 'editorial') editorialPlacements += tracks.length;
    totalStreamAttribution += tracks.reduce((s, t) => s + t.streamsFromPlaylist, 0);
  }

  const totalReach = allArtists.reduce((s, a) => s + a.playlists.spotify.reach, 0);
  const editorialRate = totalPlacements > 0 ? Math.round(editorialPlacements / totalPlacements * 100) : 0;

  // Top playlists by stream attribution
  const topPlaylists = getAllPlaylists().slice(0, 8);

  return {
    totalPlacements,
    editorialPlacements,
    totalStreamAttribution,
    totalReach,
    editorialRate,
    topPlaylists,
  };
}

// --- Helpers ---
function formatNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
