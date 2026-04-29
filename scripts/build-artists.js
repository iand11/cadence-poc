#!/usr/bin/env node
// Stream-process the giant responses.json into split data files:
//   1. src/data/artists-index.generated.json — artist metadata (no tracks/albums)
//   2. public/data/artists/{slug}.json — per-artist track/album detail files
// Why: responses.json exceeds V8's max string length, and the monolithic 86MB
// generated file is too large for the frontend bundle.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'responses.json');
const INDEX_OUT = path.join(ROOT, 'src/data/artists-index.generated.json');
const ARTISTS_DIR = path.join(ROOT, 'public/data/artists');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Normalize track name for deduplication: strip "(with X)", "(feat. X)", "- Radio Edit", etc.
function normalizeTrackName(name) {
  let n = name.toLowerCase().trim();
  n = n.replace(/\s*\((?:with|feat\.?|featuring)\s+[^)]+\)/g, '');
  n = n.replace(/\s*-\s*(?:radio edit|audio|single version|album version|explicit|clean|remastered|remaster|bonus track|deluxe).*$/i, '');
  return n.trim();
}

function pickStat(t) {
  const s = t.cm_statistics || {};
  return {
    sp_streams: s.sp_streams || 0,
    sp_popularity: s.sp_popularity || 0,
    num_sp_playlists: s.num_sp_playlists || 0,
    num_sp_editorial_playlists: s.num_sp_editorial_playlists || 0,
    sp_playlist_total_reach: s.sp_playlist_total_reach || 0,
    num_yt_playlists: s.num_yt_playlists || 0,
    yt_playlist_total_reach: s.yt_playlist_total_reach || 0,
    num_am_playlists: s.num_am_playlists || 0,
    num_am_editorial_playlists: s.num_am_editorial_playlists || 0,
    num_de_playlists: s.num_de_playlists || 0,
    de_playlist_total_reach: s.de_playlist_total_reach || 0,
    num_tt_videos: s.num_tt_videos || 0,
  };
}

function trimTrack(t) {
  const versionFlags = Object.entries(t.version_types || {})
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  return {
    cm_track: t.cm_track || t.id,
    isrc: t.isrc || null,
    name: t.name || 'Untitled',
    image_url: t.image_url || null,
    spotify_duration_ms: t.spotify_duration_ms || null,
    preview_url: t.preview_url || null,
    artist_type: t.artist_type || 'main',
    artist_names: t.artist_names || [],
    spotify_track_id: (t.spotify_track_ids || [])[0] || null,
    spotify_album_id: (t.spotify_album_ids || [])[0] || null,
    release_date: (t.release_dates || [])[0] || null,
    album_name: (t.album_names || [])[0] || null,
    album_ids: (t.album_ids || []).map(String),
    album_label: (t.album_label || [])[0] || null,
    tags: t.tags || null,
    version_flags: versionFlags,
    track_types: t.cm_track_cluster?.track_types || [],
    stats: pickStat(t),
  };
}

function trimAlbum(a) {
  return {
    cm_album: a.cm_album || a.id || a.upc,
    upc: a.upc || null,
    name: a.name || 'Untitled Album',
    image_url: a.image_url || null,
    release_date: a.release_date || null,
    label: a.label || null,
    spotify_popularity: a.spotify_popularity || 0,
    album_type: a.album_type || null,
    num_track: a.num_track || 0,
    spotify_album_id: (a.spotify_album_ids || [])[0] || null,
    moods: (a.moods || []).map(m => m.name),
    activities: (a.activities || []).map(x => x.name),
    description: a.description || null,
  };
}

function isOwnAlbum(album, cmArtistId) {
  if (!Array.isArray(album.artists)) return false;
  return album.artists.some(x => x?.cm_artist === cmArtistId);
}

// Dedupe albums by (lowercased name + album_type), keeping the variant with the
// most tracks (proxy for "definitive" release rather than a regional re-issue).
function dedupeAlbums(albums) {
  const map = new Map();
  for (const a of albums) {
    const key = `${(a.name || '').toLowerCase().trim()}|${a.album_type || ''}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, a);
      continue;
    }
    const existingTracks = existing.num_track || 0;
    const newTracks = a.num_track || 0;
    const existingPop = existing.spotify_popularity || 0;
    const newPop = a.spotify_popularity || 0;
    // Prefer more tracks; on tie, prefer higher popularity
    if (newTracks > existingTracks || (newTracks === existingTracks && newPop > existingPop)) {
      map.set(key, a);
    }
  }
  return [...map.values()];
}

function trimArtistRecord(record) {
  if (!record?.ok || !record.body?.data) return null;
  const d = record.body.data;
  const stats = d.cm_statistics || {};
  // Keep only the cm_statistics fields the UI uses (artists.js consumes these)
  const slimStats = {
    sp_followers: stats.sp_followers,
    sp_followers_rank: stats.sp_followers_rank,
    sp_monthly_listeners: stats.sp_monthly_listeners,
    sp_monthly_listeners_rank: stats.sp_monthly_listeners_rank,
    sp_popularity: stats.sp_popularity,
    sp_popularity_rank: stats.sp_popularity_rank,
    sp_where_people_listen: stats.sp_where_people_listen,
    ins_followers: stats.ins_followers,
    ins_followers_rank: stats.ins_followers_rank,
    ycs_subscribers: stats.ycs_subscribers,
    ycs_subscribers_rank: stats.ycs_subscribers_rank,
    ycs_views: stats.ycs_views,
    youtube_daily_video_views: stats.youtube_daily_video_views,
    youtube_monthly_video_views: stats.youtube_monthly_video_views,
    tiktok_followers: stats.tiktok_followers,
    tiktok_followers_rank: stats.tiktok_followers_rank,
    tiktok_likes: stats.tiktok_likes,
    tiktok_top_video_views: stats.tiktok_top_video_views,
    tiktok_track_posts: stats.tiktok_track_posts,
    twitter_followers: stats.twitter_followers,
    num_sp_editorial_playlists: stats.num_sp_editorial_playlists,
    num_sp_playlists: stats.num_sp_playlists,
    sp_playlist_total_reach: stats.sp_playlist_total_reach,
    sp_editorial_playlist_total_reach: stats.sp_editorial_playlist_total_reach,
    num_am_editorial_playlists: stats.num_am_editorial_playlists,
    num_am_playlists: stats.num_am_playlists,
    num_de_editorial_playlists: stats.num_de_editorial_playlists,
    num_de_playlists: stats.num_de_playlists,
    de_playlist_total_reach: stats.de_playlist_total_reach,
    de_editorial_playlist_total_reach: stats.de_editorial_playlist_total_reach,
    num_az_editorial_playlists: stats.num_az_editorial_playlists,
    num_az_playlists: stats.num_az_playlists,
    num_yt_editorial_playlists: stats.num_yt_editorial_playlists,
    num_yt_playlists: stats.num_yt_playlists,
    yt_playlist_total_reach: stats.yt_playlist_total_reach,
    yt_editorial_playlist_total_reach: stats.yt_editorial_playlist_total_reach,
    countryRank: stats.countryRank,
    engagement_rank: stats.engagement_rank,
    fan_base_rank: stats.fan_base_rank,
    shazam_count: stats.shazam_count,
    genius_pageviews: stats.genius_pageviews,
    pandora_listeners_28_day: stats.pandora_listeners_28_day,
    pandora_lifetime_streams: stats.pandora_lifetime_streams,
  };

  const rawTracks = Array.isArray(d.tracks) ? d.tracks : [];
  const rawAlbums = Array.isArray(d.albums) ? d.albums : [];

  // Real releases by this artist only (filter out compilation playlists),
  // dedupe regional variants, prefer real album types.
  const TYPE_RANK = { album: 0, ep: 1, single: 2, compilation: 3 };
  const ownAlbums = rawAlbums.filter(a =>
    a.name && a.release_date && isOwnAlbum(a, d.id)
  );
  const albums = dedupeAlbums(ownAlbums)
    .map(trimAlbum)
    .sort((a, b) => {
      const ra = TYPE_RANK[a.album_type] ?? 9;
      const rb = TYPE_RANK[b.album_type] ?? 9;
      if (ra !== rb) return ra - rb;
      return (b.release_date || '').localeCompare(a.release_date || '');
    })
    .slice(0, 60);

  // Set of album IDs we kept — used to ensure we keep every track that belongs
  // to a kept album, even if it didn't make the top-by-streams cut.
  const keptAlbumIds = new Set(albums.map(a => String(a.cm_album)));

  const candidateTracks = rawTracks
    .filter(t => (t.cm_statistics?.sp_streams || 0) > 0 || (t.cm_statistics?.num_sp_playlists || 0) > 0);

  // Bucket 1: top 50 catalog tracks by Spotify streams
  const topByStreams = [...candidateTracks]
    .sort((a, b) => (b.cm_statistics?.sp_streams || 0) - (a.cm_statistics?.sp_streams || 0))
    .slice(0, 50);

  // Bucket 2: every remaining track that belongs to a kept album
  const seen = new Set(topByStreams.map(t => t.cm_track || t.id));
  const albumLinked = candidateTracks.filter(t => {
    const id = t.cm_track || t.id;
    if (seen.has(id)) return false;
    return (t.album_ids || []).some(aid => keptAlbumIds.has(String(aid)));
  });

  const tracks = [...topByStreams, ...albumLinked]
    .map(trimTrack)
    .sort((a, b) => b.stats.sp_streams - a.stats.sp_streams);

  return {
    spotifyUrl: record.spotifyUrl,
    body: {
      data: {
        id: d.id,
        name: d.name,
        code2: d.code2,
        band: d.band,
        pronoun_title: d.pronoun_title,
        gender_title: d.gender_title,
        cover_url: d.cover_url,
        image_url: d.image_url,
        hometown_city: d.hometown_city,
        current_city: d.current_city,
        record_label: d.record_label,
        topSongwriterCollaborators: d.topSongwriterCollaborators,
        description: d.description,
        cm_artist_rank: d.cm_artist_rank,
        cm_artist_score: d.cm_artist_score,
        genres: d.genres,
        moods: d.moods,
        activities: d.activities,
        cm_statistics: slimStats,
        tracks,
        albums,
      },
    },
    ok: true,
  };
}

// Streaming JSON parser: walk top-level array and yield each element
async function streamArrayElements(filePath, onElement) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 22 });
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;
  let buffer = '';

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (started) buffer += c;
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === '{') {
        if (!started) { started = true; buffer = '{'; }
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && started) {
          const obj = JSON.parse(buffer);
          onElement(obj);
          started = false;
          buffer = '';
        }
      }
    }
  }
}

async function main() {
  console.log('Reading', SRC);
  const out = [];
  let count = 0;
  await streamArrayElements(SRC, (record) => {
    count++;
    const slim = trimArtistRecord(record);
    if (slim) out.push(slim);
    if (count % 20 === 0) {
      process.stdout.write(`  processed ${count}\r`);
    }
  });
  console.log(`\nProcessed ${count} records → ${out.length} valid artists`);

  // Dedupe artists by ID (source data has duplicate entries)
  const seenIds = new Set();
  const deduped = [];
  for (const record of out) {
    const id = record.body.data.id;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    deduped.push(record);
  }
  console.log(`Deduped ${out.length} → ${deduped.length} unique artists`);

  // Create per-artist detail directory
  fs.mkdirSync(ARTISTS_DIR, { recursive: true });

  const trackIndex = {};
  const albumIndex = {};
  const allTracks = [];
  const allAlbums = [];
  const indexRecords = [];

  for (const record of deduped) {
    const d = record.body.data;
    const slug = slugify(d.name);

    // Dedupe tracks by normalized name, keeping highest streams
    const rawTracks = d.tracks || [];
    const trackByName = new Map();
    for (const t of rawTracks) {
      const key = normalizeTrackName(t.name);
      const existing = trackByName.get(key);
      if (!existing || (t.stats?.sp_streams || 0) > (existing.stats?.sp_streams || 0)) {
        trackByName.set(key, t);
      }
    }
    const tracks = [...trackByName.values()];

    const albums = d.albums || [];

    // Build track/album → artist slug mappings
    for (const t of tracks) {
      trackIndex[String(t.cm_track)] = slug;
      allTracks.push({ ...t, _artistSlug: slug });
    }
    for (const a of albums) {
      albumIndex[String(a.cm_album)] = slug;
      allAlbums.push({ ...a, _artistSlug: slug });
    }

    // Write per-artist detail file
    fs.writeFileSync(
      path.join(ARTISTS_DIR, `${slug}.json`),
      JSON.stringify({ tracks, albums })
    );

    // Build metadata-only index record (no tracks/albums)
    const indexData = { ...d };
    delete indexData.tracks;
    delete indexData.albums;
    indexData.trackCount = tracks.length;
    indexData.albumCount = albums.length;

    indexRecords.push({
      spotifyUrl: record.spotifyUrl,
      body: { data: indexData },
      ok: true,
    });
  }

  // Precomputed top tracks across roster (for Dashboard)
  // Dedupe by normalized name — same song appears under multiple artists as features
  const topTracksSorted = allTracks
    .sort((a, b) => (b.stats?.sp_streams || 0) - (a.stats?.sp_streams || 0));
  const topTracksSeen = new Set();
  const topTracks = [];
  for (const t of topTracksSorted) {
    const key = normalizeTrackName(t.name);
    if (topTracksSeen.has(key)) continue;
    topTracksSeen.add(key);
    const { _artistSlug, ...rest } = t;
    topTracks.push({ ...rest, artistSlug: _artistSlug });
    if (topTracks.length >= 10) break;
  }

  // Precomputed recent releases across roster (for Dashboard)
  // Dedupe by normalized name + type
  const recentSorted = allAlbums
    .filter(a => a.release_date)
    .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
  const recentSeen = new Set();
  const recentReleases = [];
  for (const a of recentSorted) {
    const key = `${a.name.toLowerCase().trim()}|${a._artistSlug}`;
    if (recentSeen.has(key)) continue;
    recentSeen.add(key);
    const { _artistSlug, ...rest } = a;
    recentReleases.push({ ...rest, artistSlug: _artistSlug });
    if (recentReleases.length >= 10) break;
  }

  // Write the index file
  const indexPayload = {
    artists: indexRecords,
    trackIndex,
    albumIndex,
    topTracks,
    recentReleases,
  };
  fs.writeFileSync(INDEX_OUT, JSON.stringify(indexPayload));

  const indexSize = (fs.statSync(INDEX_OUT).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${INDEX_OUT} (${indexSize} MB)`);
  console.log(`Wrote ${out.length} artist detail files to ${ARTISTS_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
