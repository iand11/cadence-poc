// DB row → UI shape mappers.
// These produce the exact same object shapes src/data/artists.js builds from
// the static JSON (allArtists entries, normalizeTrack, normalizeAlbum), so
// components can consume API responses with zero reshaping.

export function artistRowToSummary(row) {
  const s = row.stats || {};
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    trackCount: row.track_count || 0,
    albumCount: row.album_count || 0,
    spotifyUrl: row.spotify_url || null,
    imageUrl: row.image_url,
    coverUrl: row.cover_url,
    description: row.description || '',
    country: row.country,
    city: row.city || '',
    isBand: row.is_band,
    label: row.record_label || 'Independent',
    gender: row.gender,
    pronouns: row.pronouns,
    genres: row.genres || {},
    moods: row.moods || [],
    activities: row.activities || [],
    collaborators: row.collaborators || [],
    rank: row.rank,
    score: row.score || 0,
    careerStage: row.career_stage || null,
    careerTrend: row.career_trend || null,
    statsAsOf: row.stats_as_of || null,

    spotify: {
      followers: s.sp_followers || 0,
      monthlyListeners: s.sp_monthly_listeners || 0,
      popularity: s.sp_popularity || 0,
      followersRank: s.sp_followers_rank,
      listenersRank: s.sp_monthly_listeners_rank,
      popularityRank: s.sp_popularity_rank,
      topCities: (s.sp_where_people_listen || []).map((c) => ({
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
      overall: row.rank,
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
}

export function trackRowToUI(row, artistSlug) {
  const s = row.stats || {};
  return {
    id: String(row.id),
    artistSlug,
    name: row.name || 'Untitled',
    isrc: row.isrc,
    imageUrl: row.image_url || null,
    durationMs: row.duration_ms || null,
    previewUrl: row.preview_url || null,
    isFeature: row.artist_type === 'featured',
    artistNames: row.artist_names || [],
    spotifyTrackId: row.spotify_track_id || null,
    spotifyAlbumId: row.spotify_album_id || null,
    releaseDate: row.release_date || null, // 'YYYY-MM-DD' (to_char in query)
    albumName: row.album_name || null,
    albumIds: (row.album_ids || []).map(String),
    albumId: (row.album_ids || []).map(String)[0] || null,
    albumLabel: row.album_label || null,
    streams: Number(row.sp_streams) || 0,
    popularity: row.sp_popularity || 0,
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
    tags: row.tags || null,
    versionFlags: row.version_flags || [],
    trackTypes: row.track_types || [],
    audioFeatures: row.audio_features || null,
  };
}

export function albumRowToUI(row, artistSlug) {
  return {
    id: String(row.id),
    artistSlug,
    name: row.name || 'Untitled Album',
    imageUrl: row.image_url || null,
    releaseDate: row.release_date || null, // 'YYYY-MM-DD' (to_char in query)
    label: row.label || null,
    popularity: row.spotify_popularity || 0,
    type: row.album_type || null,
    numTracks: row.num_track || 0,
    upc: row.upc || null,
    spotifyAlbumId: row.spotify_album_id || null,
    moods: row.moods || [],
    activities: row.activities || [],
    description: row.description || null,
  };
}

// Same display filtering artists.js applies in loadArtistDetail: drop
// zero-signal tracks and dedupe alternate versions by normalized name.
export function normalizeTrackName(name) {
  let n = String(name).toLowerCase().trim();
  n = n.replace(/\s*\((?:with|feat\.?|featuring)\s+[^)]+\)/g, '');
  n = n.replace(/\s*-\s*(?:radio edit|audio|single version|album version|explicit|clean|remastered|remaster|bonus track|deluxe).*$/i, '');
  return n.trim();
}

export function filterAndDedupeTracks(tracks) {
  const kept = tracks.filter((t) => t.streams > 0 || t.spotifyPlaylists > 0);
  const byName = new Map();
  for (const t of kept) {
    const key = normalizeTrackName(t.name);
    const prev = byName.get(key);
    if (!prev || t.streams > prev.streams) byName.set(key, t);
  }
  return [...byName.values()].sort((a, b) => b.streams - a.streams);
}
