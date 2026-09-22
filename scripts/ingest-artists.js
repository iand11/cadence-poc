#!/usr/bin/env node
// Bulk-ingest per-artist Chartmetric JSON files into Postgres.
//
//   node scripts/ingest-artists.js --dir ~/Downloads/artist2/artists
//
// Flags:
//   --dir <path>        directory of {slug}.json artist files (required)
//   --limit <n>         only process the first n pending files (for testing)
//   --concurrency <n>   parallel files in flight (default 6)
//   --force             re-ingest files already recorded in ingest_files
//   --no-snapshot       skip writing an artist_metric_snapshots row
//
// Resumable: every completed file is recorded in ingest_files and skipped on
// the next run, so the 200k-file load can be stopped and restarted freely.

import fs from 'node:fs';
import path from 'node:path';
import { pool, slugify, toDate } from './lib/db.js';

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const DIR = flag('dir');
const LIMIT = Number(flag('limit', 0)) || 0;
const CONCURRENCY = Number(flag('concurrency', 6)) || 6;
// Each worker holds one dedicated connection — make sure the pool is at
// least that big, or workers beyond the pool cap would silently idle.
if (!process.env.DB_POOL_SIZE) process.env.DB_POOL_SIZE = String(CONCURRENCY + 1);
const FORCE = args.includes('--force');
const SNAPSHOT = !args.includes('--no-snapshot');

if (!DIR || DIR === true) {
  console.error('Usage: node scripts/ingest-artists.js --dir <path-to-artist-json-dir>');
  process.exit(1);
}

// --- Transformations (mirrors scripts/build-artists.js trimming) -----------

function isOwnAlbum(album, cmArtistId) {
  if (!Array.isArray(album.artists)) return true; // no attribution data — keep
  return album.artists.some((x) => x?.cm_artist === cmArtistId);
}

// Dedupe regional album variants by (name + type), keeping most tracks
function dedupeAlbums(albums) {
  const map = new Map();
  for (const a of albums) {
    const key = `${(a.name || '').toLowerCase().trim()}|${a.album_type || ''}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, a); continue; }
    const better =
      (a.num_track || 0) > (prev.num_track || 0) ||
      ((a.num_track || 0) === (prev.num_track || 0) &&
        (a.spotify_popularity || 0) > (prev.spotify_popularity || 0));
    if (better) map.set(key, a);
  }
  return [...map.values()];
}

// Split per the schema: identity/profile → artists, volatile metrics →
// artist_stats_current (+ an append-only snapshot).
function buildArtistRow(d) {
  const career = d.career_status || {};
  return {
    id: d.id,
    slug: slugify(d.name),
    name: d.name,
    image_url: d.image_url || null,
    cover_url: d.cover_url || null,
    country: d.code2 || null,
    city: d.current_city || d.hometown_city || null,
    hometown: d.hometown_city || null,
    is_band: !!d.band,
    gender: d.gender_title || null,
    pronouns: d.pronoun_title || null,
    record_label: d.record_label || null,
    description: d.description || null,
    isni: d.isni || null,
    career_stage: career.stage || null,
    career_stage_score: career.stage_score ?? null,
    career_trend: career.trend || null,
    career_trend_score: career.trend_score ?? null,
    primary_genre: d.genres?.primary?.name || null,
    secondary_genres: (d.genres?.secondary || []).map((g) => g.name),
    genres: d.genres || null,
    moods: (d.moods || []).map((m) => m.name ?? m),
    activities: (d.activities || []).map((a) => a.name ?? a),
    collaborators: d.topSongwriterCollaborators || [],
  };
}

function buildStatsCurrentRow(d) {
  const s = d.cm_statistics || {};
  return {
    artist_id: d.id,
    rank: d.cm_artist_rank ?? null,
    score: d.cm_artist_score ?? null,
    sp_monthly_listeners: s.sp_monthly_listeners ?? null,
    sp_followers: s.sp_followers ?? null,
    sp_popularity: s.sp_popularity ?? null,
    ins_followers: s.ins_followers ?? null,
    tiktok_followers: s.tiktok_followers ?? null,
    ycs_subscribers: s.ycs_subscribers ?? null,
    stats: s,
    where_people_listen: d.wherePeopleListen || null,
  };
}

function buildTrackRow(t) {
  const versionFlags = Object.entries(t.version_types || {})
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const s = t.cm_statistics || {};
  return {
    id: t.cm_track || t.id,
    isrc: t.isrc || null,
    name: t.name || 'Untitled',
    image_url: t.image_url || null,
    duration_ms: t.spotify_duration_ms || t.deezer_duration || null,
    preview_url: t.preview_url || null,
    spotify_track_id: (t.spotify_track_ids || [])[0] || null,
    spotify_album_id: (t.spotify_album_ids || [])[0] || null,
    release_date: toDate((t.release_dates || [])[0]),
    album_name: (t.album_names || [])[0] || null,
    album_ids: (t.album_ids || []).filter(Boolean),
    album_label: (t.album_label || [])[0] || null,
    artist_names: t.artist_names || [],
    tags: t.tags || null,
    version_flags: versionFlags,
    track_types: t.cm_track_cluster?.track_types || [],
    sp_streams: s.sp_streams || 0,
    sp_popularity: s.sp_popularity || 0,
    stats: s,
    audio_features: t.cm_audio_features || null,
    artist_type: t.artist_type || 'main',
  };
}

function buildAlbumRow(a) {
  return {
    id: a.cm_album || a.id,
    upc: a.upc || null,
    name: a.name || 'Untitled Album',
    image_url: a.image_url || null,
    release_date: toDate(a.release_date),
    label: a.label || null,
    spotify_popularity: a.spotify_popularity || 0,
    album_type: a.album_type || null,
    num_track: a.num_track || 0,
    spotify_album_id: (a.spotify_album_ids || [])[0] || null,
    moods: (a.moods || []).map((m) => m.name ?? m),
    activities: (a.activities || []).map((x) => x.name ?? x),
    description: a.description || null,
  };
}

// --- SQL --------------------------------------------------------------------

const UPSERT_ARTIST = `
INSERT INTO artists (
  id, slug, name, image_url, cover_url, country, city, hometown, is_band,
  gender, pronouns, record_label, description, isni,
  career_stage, career_stage_score, career_trend, career_trend_score,
  primary_genre, secondary_genres, genres, moods, activities, collaborators,
  track_count, album_count, updated_at
)
SELECT
  r.id, $2, r.name, r.image_url, r.cover_url, r.country, r.city, r.hometown, r.is_band,
  r.gender, r.pronouns, r.record_label, r.description, r.isni,
  r.career_stage, r.career_stage_score, r.career_trend, r.career_trend_score,
  r.primary_genre,
  ARRAY(SELECT jsonb_array_elements_text(r.secondary_genres)),
  r.genres,
  ARRAY(SELECT jsonb_array_elements_text(r.moods)),
  ARRAY(SELECT jsonb_array_elements_text(r.activities)),
  ARRAY(SELECT jsonb_array_elements_text(r.collaborators)),
  $3, $4, now()
FROM jsonb_to_record($1::jsonb) AS r(
  id bigint, name text, image_url text, cover_url text, country text, city text,
  hometown text, is_band boolean, gender text, pronouns text, record_label text,
  description text, isni text,
  career_stage text, career_stage_score integer, career_trend text, career_trend_score integer,
  primary_genre text, secondary_genres jsonb, genres jsonb, moods jsonb,
  activities jsonb, collaborators jsonb
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, name = EXCLUDED.name, image_url = EXCLUDED.image_url,
  cover_url = EXCLUDED.cover_url, country = EXCLUDED.country, city = EXCLUDED.city,
  hometown = EXCLUDED.hometown, is_band = EXCLUDED.is_band, gender = EXCLUDED.gender,
  pronouns = EXCLUDED.pronouns, record_label = EXCLUDED.record_label,
  description = EXCLUDED.description, isni = EXCLUDED.isni,
  career_stage = EXCLUDED.career_stage, career_stage_score = EXCLUDED.career_stage_score,
  career_trend = EXCLUDED.career_trend, career_trend_score = EXCLUDED.career_trend_score,
  primary_genre = EXCLUDED.primary_genre, secondary_genres = EXCLUDED.secondary_genres,
  genres = EXCLUDED.genres, moods = EXCLUDED.moods, activities = EXCLUDED.activities,
  collaborators = EXCLUDED.collaborators,
  track_count = EXCLUDED.track_count, album_count = EXCLUDED.album_count, updated_at = now()
`;

const UPSERT_STATS_CURRENT = `
INSERT INTO artist_stats_current (
  artist_id, rank, score, sp_monthly_listeners, sp_followers, sp_popularity,
  ins_followers, tiktok_followers, ycs_subscribers, stats, where_people_listen, as_of
)
SELECT
  r.artist_id, r.rank, r.score, r.sp_monthly_listeners, r.sp_followers, r.sp_popularity,
  r.ins_followers, r.tiktok_followers, r.ycs_subscribers, r.stats, r.where_people_listen, now()
FROM jsonb_to_record($1::jsonb) AS r(
  artist_id bigint, rank integer, score double precision,
  sp_monthly_listeners bigint, sp_followers bigint, sp_popularity integer,
  ins_followers bigint, tiktok_followers bigint, ycs_subscribers bigint,
  stats jsonb, where_people_listen jsonb
)
ON CONFLICT (artist_id) DO UPDATE SET
  rank = EXCLUDED.rank, score = EXCLUDED.score,
  sp_monthly_listeners = EXCLUDED.sp_monthly_listeners, sp_followers = EXCLUDED.sp_followers,
  sp_popularity = EXCLUDED.sp_popularity, ins_followers = EXCLUDED.ins_followers,
  tiktok_followers = EXCLUDED.tiktok_followers, ycs_subscribers = EXCLUDED.ycs_subscribers,
  stats = EXCLUDED.stats, where_people_listen = EXCLUDED.where_people_listen, as_of = now()
`;

const UPSERT_TRACKS = `
INSERT INTO tracks (
  id, isrc, name, image_url, duration_ms, preview_url, spotify_track_id,
  spotify_album_id, release_date, album_name, album_ids, album_label,
  artist_names, tags, version_flags, track_types, sp_streams, sp_popularity,
  stats, audio_features, updated_at
)
SELECT
  r.id, r.isrc, r.name, r.image_url, r.duration_ms, r.preview_url, r.spotify_track_id,
  r.spotify_album_id, r.release_date, r.album_name,
  ARRAY(SELECT jsonb_array_elements_text(r.album_ids))::bigint[],
  r.album_label,
  ARRAY(SELECT jsonb_array_elements_text(r.artist_names)),
  r.tags,
  ARRAY(SELECT jsonb_array_elements_text(r.version_flags)),
  ARRAY(SELECT jsonb_array_elements_text(r.track_types)),
  r.sp_streams, r.sp_popularity, r.stats, r.audio_features, now()
FROM jsonb_to_recordset($1::jsonb) AS r(
  id bigint, isrc text, name text, image_url text, duration_ms integer,
  preview_url text, spotify_track_id text, spotify_album_id text,
  release_date date, album_name text, album_ids jsonb, album_label text,
  artist_names jsonb, tags text, version_flags jsonb, track_types jsonb,
  sp_streams bigint, sp_popularity integer, stats jsonb, audio_features jsonb
)
ON CONFLICT (id) DO UPDATE SET
  isrc = EXCLUDED.isrc, name = EXCLUDED.name, image_url = EXCLUDED.image_url,
  duration_ms = EXCLUDED.duration_ms, preview_url = EXCLUDED.preview_url,
  spotify_track_id = EXCLUDED.spotify_track_id, spotify_album_id = EXCLUDED.spotify_album_id,
  release_date = EXCLUDED.release_date, album_name = EXCLUDED.album_name,
  album_ids = EXCLUDED.album_ids, album_label = EXCLUDED.album_label,
  artist_names = EXCLUDED.artist_names, tags = EXCLUDED.tags,
  version_flags = EXCLUDED.version_flags, track_types = EXCLUDED.track_types,
  sp_streams = EXCLUDED.sp_streams, sp_popularity = EXCLUDED.sp_popularity,
  stats = EXCLUDED.stats, audio_features = EXCLUDED.audio_features, updated_at = now()
`;

const UPSERT_ALBUMS = `
INSERT INTO albums (
  id, upc, name, image_url, release_date, label, spotify_popularity,
  album_type, num_track, spotify_album_id, moods, activities, description, updated_at
)
SELECT
  r.id, r.upc, r.name, r.image_url, r.release_date, r.label, r.spotify_popularity,
  r.album_type, r.num_track, r.spotify_album_id,
  ARRAY(SELECT jsonb_array_elements_text(r.moods)),
  ARRAY(SELECT jsonb_array_elements_text(r.activities)),
  r.description, now()
FROM jsonb_to_recordset($1::jsonb) AS r(
  id bigint, upc text, name text, image_url text, release_date date, label text,
  spotify_popularity integer, album_type text, num_track integer,
  spotify_album_id text, moods jsonb, activities jsonb, description text
)
ON CONFLICT (id) DO UPDATE SET
  upc = EXCLUDED.upc, name = EXCLUDED.name, image_url = EXCLUDED.image_url,
  release_date = EXCLUDED.release_date, label = EXCLUDED.label,
  spotify_popularity = EXCLUDED.spotify_popularity, album_type = EXCLUDED.album_type,
  num_track = EXCLUDED.num_track, spotify_album_id = EXCLUDED.spotify_album_id,
  moods = EXCLUDED.moods, activities = EXCLUDED.activities,
  description = EXCLUDED.description, updated_at = now()
`;

// --- Per-file ingest ---------------------------------------------------------

async function ingestFile(client, filePath, filename) {
  const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!d?.id || !d?.name) throw new Error('missing id/name');

  const rawTracks = Array.isArray(d.tracks) ? d.tracks : [];
  const rawAlbums = Array.isArray(d.albums) ? d.albums : [];

  const albums = dedupeAlbums(
    rawAlbums.filter((a) => a.name && a.release_date && isOwnAlbum(a, d.id))
  ).map(buildAlbumRow).filter((a) => a.id);

  const seen = new Set();
  const tracks = [];
  for (const t of rawTracks) {
    const row = buildTrackRow(t);
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    tracks.push(row);
  }

  const artist = buildArtistRow(d);
  const statsCurrent = buildStatsCurrentRow(d);

  await client.query('BEGIN');
  try {
    // Slug collisions (different artists, same name): retry with -{id} suffix
    const artistJson = JSON.stringify(artist);
    try {
      await client.query('SAVEPOINT slug_try');
      await client.query(UPSERT_ARTIST, [artistJson, artist.slug, tracks.length, albums.length]);
    } catch (err) {
      if (err.code !== '23505') throw err;
      await client.query('ROLLBACK TO SAVEPOINT slug_try');
      await client.query(UPSERT_ARTIST, [artistJson, `${artist.slug}-${artist.id}`, tracks.length, albums.length]);
    }

    if (tracks.length) {
      await client.query(UPSERT_TRACKS, [JSON.stringify(tracks)]);
      const linkRows = tracks.map((t) => ({ track_id: t.id, artist_type: t.artist_type }));
      await client.query(
        `INSERT INTO artist_tracks (artist_id, track_id, artist_type)
         SELECT $1, r.track_id, r.artist_type
         FROM jsonb_to_recordset($2::jsonb) AS r(track_id bigint, artist_type text)
         ON CONFLICT (artist_id, track_id) DO UPDATE SET artist_type = EXCLUDED.artist_type`,
        [artist.id, JSON.stringify(linkRows)]
      );
    }

    if (albums.length) {
      await client.query(UPSERT_ALBUMS, [JSON.stringify(albums)]);
      await client.query(
        `INSERT INTO artist_albums (artist_id, album_id)
         SELECT $1, x::bigint FROM jsonb_array_elements_text($2::jsonb) x
         ON CONFLICT DO NOTHING`,
        [artist.id, JSON.stringify(albums.map((a) => a.id))]
      );
    }

    await client.query(UPSERT_STATS_CURRENT, [JSON.stringify(statsCurrent)]);

    if (SNAPSHOT && statsCurrent.stats && Object.keys(statsCurrent.stats).length) {
      await client.query(
        `INSERT INTO artist_metric_snapshots (artist_id, source, captured_at, metrics)
         VALUES ($1, 'import', now(), $2)
         ON CONFLICT DO NOTHING`,
        [artist.id, JSON.stringify(statsCurrent.stats)]
      );
    }

    await client.query(
      `INSERT INTO ingest_files (filename, artist_id, ingested_at)
       VALUES ($1, $2, now())
       ON CONFLICT (filename) DO UPDATE SET artist_id = EXCLUDED.artist_id, ingested_at = now()`,
      [filename, artist.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// --- Main loop ----------------------------------------------------------------

async function main() {
  const dir = path.resolve(DIR.replace(/^~/, process.env.HOME || '~'));
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  console.log(`${all.length} JSON files in ${dir}`);

  let done = new Set();
  if (!FORCE) {
    const { rows } = await pool.query('SELECT filename FROM ingest_files');
    done = new Set(rows.map((r) => r.filename));
  }
  let pending = all.filter((f) => !done.has(f));
  if (LIMIT) pending = pending.slice(0, LIMIT);
  console.log(`${pending.length} pending (${done.size} already ingested)${FORCE ? ' [force]' : ''}`);
  if (!pending.length) { await pool.end(); return; }

  let ok = 0, failed = 0;
  const errors = [];
  const started = Date.now();
  let cursor = 0;

  async function worker() {
    const client = await pool.connect();
    try {
      while (cursor < pending.length) {
        const filename = pending[cursor++];
        try {
          await ingestFile(client, path.join(dir, filename), filename);
          ok++;
        } catch (err) {
          failed++;
          errors.push(`${filename}: ${err.message}`);
        }
        const n = ok + failed;
        if (n % 25 === 0 || n === pending.length) {
          const rate = n / ((Date.now() - started) / 1000);
          const eta = Math.round((pending.length - n) / rate);
          process.stdout.write(`  ${n}/${pending.length}  ok=${ok} failed=${failed}  ${rate.toFixed(1)}/s  eta ${eta}s   \r`);
        }
      }
    } finally {
      client.release();
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  console.log(`\nDone: ${ok} ingested, ${failed} failed in ${Math.round((Date.now() - started) / 1000)}s`);
  if (errors.length) {
    console.log('First errors:');
    for (const e of errors.slice(0, 10)) console.log('  ' + e);
  }
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
