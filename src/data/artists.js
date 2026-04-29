import indexData from './artists-index.generated.json';

const { artists: responses, trackIndex: _trackIdx, albumIndex: _albumIdx, topTracks: rawTopTracks, recentReleases: rawRecentReleases } = indexData;

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Convert a pre-slimmed track record into the UI-shaped object
function normalizeTrack(t, artistSlug) {
  const s = t.stats || {};
  return {
    id: String(t.cm_track),
    artistSlug,
    name: t.name || 'Untitled',
    isrc: t.isrc,
    imageUrl: t.image_url || null,
    durationMs: t.spotify_duration_ms || null,
    previewUrl: t.preview_url || null,
    isFeature: t.artist_type === 'featured',
    artistNames: t.artist_names || [],
    spotifyTrackId: t.spotify_track_id || null,
    spotifyAlbumId: t.spotify_album_id || null,
    releaseDate: t.release_date || null,
    albumName: t.album_name || null,
    albumIds: t.album_ids || [],
    albumId: (t.album_ids || [])[0] || null,
    albumLabel: t.album_label || null,
    streams: s.sp_streams || 0,
    popularity: s.sp_popularity || 0,
    spotifyPlaylists: s.num_sp_playlists || 0,
    spotifyEditorialPlaylists: s.num_sp_editorial_playlists || 0,
    spotifyPlaylistReach: s.sp_playlist_total_reach || 0,
    youtubePlaylists: s.num_yt_playlists || 0,
    youtubePlaylistReach: s.yt_playlist_total_reach || 0,
    applePlaylists: s.num_am_playlists || 0,
    appleEditorialPlaylists: s.num_am_editorial_playlists || 0,
    deezerPlaylists: s.num_de_playlists || 0,
    deezerPlaylistReach: s.de_playlist_total_reach || 0,
    tiktokVideos: s.num_tt_videos || 0,
    tags: t.tags || null,
    versionFlags: t.version_flags || [],
    trackTypes: t.track_types || [],
  };
}

// Convert a pre-slimmed album record into the UI-shaped object
function normalizeAlbum(a, artistSlug) {
  return {
    id: String(a.cm_album || a.upc),
    artistSlug,
    name: a.name || 'Untitled Album',
    imageUrl: a.image_url || null,
    releaseDate: a.release_date || null,
    label: a.label || null,
    popularity: a.spotify_popularity || 0,
    type: a.album_type || null,
    numTracks: a.num_track || 0,
    upc: a.upc || null,
    spotifyAlbumId: a.spotify_album_id || null,
    moods: a.moods || [],
    activities: a.activities || [],
    description: a.description || null,
  };
}

// Process raw API responses into clean artist objects (metadata only — no tracks/albums)
export const allArtists = responses
  .filter(r => r.ok && r.body?.data)
  .map(r => {
    const d = r.body.data;
    const s = d.cm_statistics || {};
    const slug = slugify(d.name);
    return {
      id: d.id,
      slug,
      name: d.name,
      trackCount: d.trackCount || 0,
      albumCount: d.albumCount || 0,
      spotifyUrl: r.spotifyUrl,
      imageUrl: d.image_url,
      coverUrl: d.cover_url,
      description: d.description || '',
      country: d.code2,
      city: d.current_city || d.hometown_city || '',
      isBand: d.band,
      label: d.record_label || 'Independent',
      gender: d.gender_title,
      pronouns: d.pronoun_title,
      genres: d.genres || {},
      moods: (d.moods || []).map(m => m.name),
      activities: (d.activities || []).map(a => a.name),
      collaborators: d.topSongwriterCollaborators || [],
      rank: d.cm_artist_rank,
      score: d.cm_artist_score || 0,

      spotify: {
        followers: s.sp_followers || 0,
        monthlyListeners: s.sp_monthly_listeners || 0,
        popularity: s.sp_popularity || 0,
        followersRank: s.sp_followers_rank,
        listenersRank: s.sp_monthly_listeners_rank,
        popularityRank: s.sp_popularity_rank,
        topCities: (s.sp_where_people_listen || []).map(c => ({
          city: c.name,
          country: (c.code2 || '').toUpperCase(),
          listeners: c.listeners,
        })),
      },

      social: {
        instagram: s.ins_followers || 0,
        instagramRank: s.ins_followers_rank,
        youtube: s.ycs_subscribers || 0,
        youtubeRank: s.ycs_subscribers_rank,
        youtubeViews: s.ycs_views || 0,
        youtubeDaily: s.youtube_daily_video_views || 0,
        youtubeMonthly: s.youtube_monthly_video_views || 0,
        tiktok: s.tiktok_followers || 0,
        tiktokRank: s.tiktok_followers_rank,
        tiktokLikes: s.tiktok_likes || 0,
        tiktokTopVideoViews: s.tiktok_top_video_views || 0,
        tiktokTrackPosts: s.tiktok_track_posts || 0,
        twitter: s.twitter_followers || 0,
      },

      playlists: {
        spotify: {
          editorial: s.num_sp_editorial_playlists || 0,
          total: s.num_sp_playlists || 0,
          reach: s.sp_playlist_total_reach || 0,
          editorialReach: s.sp_editorial_playlist_total_reach || 0,
        },
        apple: { editorial: s.num_am_editorial_playlists || 0, total: s.num_am_playlists || 0 },
        deezer: {
          editorial: s.num_de_editorial_playlists || 0,
          total: s.num_de_playlists || 0,
          reach: s.de_playlist_total_reach || 0,
          editorialReach: s.de_editorial_playlist_total_reach || 0,
        },
        amazon: { editorial: s.num_az_editorial_playlists || 0, total: s.num_az_playlists || 0 },
        youtube: {
          editorial: s.num_yt_editorial_playlists || 0,
          total: s.num_yt_playlists || 0,
          reach: s.yt_playlist_total_reach || 0,
          editorialReach: s.yt_editorial_playlist_total_reach || 0,
        },
      },

      rankings: {
        overall: d.cm_artist_rank,
        country: s.countryRank || null,
        engagement: s.engagement_rank,
        fanBase: s.fan_base_rank,
      },

      engagement: {
        shazam: s.shazam_count || 0,
        genius: s.genius_pageviews || 0,
        pandoraListeners: s.pandora_listeners_28_day || 0,
        pandoraLifetimeStreams: s.pandora_lifetime_streams || 0,
      },
    };
  })
  .sort((a, b) => a.rank - b.rank);

// Lookup artist by slug
export function getArtist(slug) {
  return allArtists.find(a => a.slug === slug) || allArtists[0];
}

// --- Async detail loading (tracks/albums fetched on demand) ---

const detailCache = new Map();

export async function loadArtistDetail(slug) {
  if (detailCache.has(slug)) return detailCache.get(slug);
  try {
    const resp = await fetch(`/data/artists/${slug}.json`);
    if (!resp.ok) return { tracks: [], albums: [] };
    const data = await resp.json();
    const tracks = (data.tracks || [])
      .map(t => normalizeTrack(t, slug))
      .filter(t => t.streams > 0 || t.spotifyPlaylists > 0)
      .sort((a, b) => b.streams - a.streams);
    const albums = (data.albums || [])
      .map(a => normalizeAlbum(a, slug))
      .filter(a => a.name && a.releaseDate)
      .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
    const result = { tracks, albums };
    detailCache.set(slug, result);
    return result;
  } catch {
    return { tracks: [], albums: [] };
  }
}

export async function getTrackAsync(id) {
  if (id == null) return null;
  const slug = _trackIdx[String(id)];
  if (!slug) return null;
  const detail = await loadArtistDetail(slug);
  return detail.tracks.find(t => t.id === String(id)) || null;
}

export async function getAlbumAsync(id) {
  if (id == null) return null;
  const slug = _albumIdx[String(id)];
  if (!slug) return null;
  const detail = await loadArtistDetail(slug);
  return detail.albums.find(a => a.id === String(id)) || null;
}

export async function getAlbumTracksAsync(albumId) {
  if (albumId == null) return [];
  const id = String(albumId);
  const slug = _albumIdx[id];
  if (!slug) return [];
  const detail = await loadArtistDetail(slug);
  const candidates = detail.tracks.filter(t => t.albumIds.includes(id));
  const byKey = new Map();
  for (const t of candidates) {
    const key = `${t.name.toLowerCase().trim()}|${t.artistSlug}`;
    const existing = byKey.get(key);
    if (!existing || t.streams > existing.streams) byKey.set(key, t);
  }
  return [...byKey.values()].sort((a, b) => b.streams - a.streams);
}

// Precomputed top tracks/releases from build (used by Dashboard)
const _topTracks = rawTopTracks.map(t => normalizeTrack(t, t.artistSlug));
const _recentReleases = rawRecentReleases.map(a => normalizeAlbum(a, a.artistSlug));

export function getTopTracksAcrossRoster(n = 10) {
  return _topTracks.slice(0, n);
}

export function getRecentReleases(n = 10) {
  return _recentReleases.slice(0, n);
}

// Search artists by name, genre, or label
export function searchArtists(query) {
  if (!query || query.length < 1) return [];
  const lower = query.toLowerCase();
  return allArtists.filter(a =>
    a.name.toLowerCase().includes(lower) ||
    (a.genres?.primary?.name || '').toLowerCase().includes(lower) ||
    (a.label || '').toLowerCase().includes(lower) ||
    (a.city || '').toLowerCase().includes(lower)
  ).slice(0, 12);
}

// Get top N artists by rank
export function getTopArtists(n = 10) {
  return allArtists.slice(0, n);
}

// --- Generated time-series data based on real metrics ---

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

// Aggregate stats across all artists
export function getAggregateStats() {
  const total = allArtists.length;
  const totalListeners = allArtists.reduce((sum, a) => sum + a.spotify.monthlyListeners, 0);
  const totalFollowers = allArtists.reduce((sum, a) => sum + a.spotify.followers, 0);
  const totalPlaylists = allArtists.reduce((sum, a) => sum + a.playlists.spotify.total, 0);
  const avgScore = allArtists.reduce((sum, a) => sum + a.score, 0) / total;
  const totalPlaylistReach = allArtists.reduce((sum, a) => sum + a.playlists.spotify.reach, 0);

  return { total, totalListeners, totalFollowers, totalPlaylists, avgScore, totalPlaylistReach };
}

// Compare an artist against the average of all artists (normalized 0-100)
export function getBenchmarkComparison(artist) {
  const maxListeners = Math.max(...allArtists.map(a => a.spotify.monthlyListeners));
  const maxFollowers = Math.max(...allArtists.map(a => a.spotify.followers));
  const maxPlaylists = Math.max(...allArtists.map(a => a.playlists.spotify.total));
  const maxTiktok = Math.max(...allArtists.map(a => a.social.tiktok));
  const maxInstagram = Math.max(...allArtists.map(a => a.social.instagram));
  const maxShazam = Math.max(...allArtists.map(a => a.engagement.shazam));

  const normalize = (val, max) => max > 0 ? Math.round((val / max) * 100) : 0;

  const avgListeners = allArtists.reduce((s, a) => s + a.spotify.monthlyListeners, 0) / allArtists.length;
  const avgFollowers = allArtists.reduce((s, a) => s + a.spotify.followers, 0) / allArtists.length;
  const avgPlaylists = allArtists.reduce((s, a) => s + a.playlists.spotify.total, 0) / allArtists.length;
  const avgTiktok = allArtists.reduce((s, a) => s + a.social.tiktok, 0) / allArtists.length;
  const avgInstagram = allArtists.reduce((s, a) => s + a.social.instagram, 0) / allArtists.length;
  const avgShazam = allArtists.reduce((s, a) => s + a.engagement.shazam, 0) / allArtists.length;

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
        normalize(avgListeners, maxListeners),
        normalize(avgFollowers, maxFollowers),
        normalize(avgPlaylists, maxPlaylists),
        normalize(avgTiktok, maxTiktok),
        normalize(avgInstagram, maxInstagram),
        normalize(avgShazam, maxShazam),
      ],
    },
  };
}
