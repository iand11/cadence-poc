// Fan listening history: keep each consenting fan's Spotify access (refresh token,
// encrypted) and periodically copy their recently played tracks into spotify_plays.
// Spotify's recently-played lists only the last 50 plays (30s+), so syncing often
// enough matters for heavy listeners; anything older than that window is gone.
import { query, queryOne } from './db.js';
import { encryptToken, decryptToken } from './meta.js';
import { spotifyItem } from './spotify-fans.js';

const ACCOUNTS = process.env.SPOTIFY_ACCOUNTS_URL || 'https://accounts.spotify.com';
const API = process.env.SPOTIFY_API_URL || 'https://api.spotify.com/v1';
const RESYNC_AFTER = process.env.SPOTIFY_RESYNC_INTERVAL || '2 hours';

let tablesReady;
export function ensureSyncTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS spotify_listeners (
          spotify_user_id text PRIMARY KEY, refresh_token_enc text, scopes text,
          last_played_at timestamptz, last_synced_at timestamptz, sync_error text,
          revoked boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS spotify_plays (
          spotify_user_id text NOT NULL, played_at timestamptz NOT NULL, track_id text NOT NULL,
          track_name text, album_id text, artist_ids text[], artist_names text[], context_uri text,
          PRIMARY KEY (spotify_user_id, played_at)
        )`);
      await query('CREATE INDEX IF NOT EXISTS spotify_plays_track_idx ON spotify_plays (track_id, played_at)');
      await query('ALTER TABLE smart_links ADD COLUMN IF NOT EXISTS spotify_artist_ids text[]');
      await query('ALTER TABLE smart_links ADD COLUMN IF NOT EXISTS spotify_track_name text');
    })().catch((err) => { tablesReady = undefined; throw err; });
  }
  return tablesReady;
}

/** Remember a fan's Spotify access so their plays can be synced. */
export async function saveListener(spotifyUserId, refreshToken, scopes) {
  if (!refreshToken) return;
  await ensureSyncTables();
  await query(
    `INSERT INTO spotify_listeners (spotify_user_id, refresh_token_enc, scopes)
     VALUES ($1, $2, $3)
     ON CONFLICT (spotify_user_id) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc,
       scopes = EXCLUDED.scopes, revoked = false, sync_error = null, updated_at = now()`,
    [spotifyUserId, encryptToken(refreshToken), scopes || null]);
}

async function refreshAccess(row) {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptToken(row.refresh_token_enc) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant: the fan removed Prelude's access in their Spotify account
    throw Object.assign(new Error(body.error_description || body.error || `refresh failed (${res.status})`),
      { revoked: body.error === 'invalid_grant' });
  }
  // Spotify may rotate the refresh token
  if (body.refresh_token) {
    await query('UPDATE spotify_listeners SET refresh_token_enc = $2 WHERE spotify_user_id = $1',
      [row.spotify_user_id, encryptToken(body.refresh_token)]);
  }
  return body.access_token;
}

/**
 * Copy one fan's recent plays into spotify_plays. Returns plays added. Always reads the
 * latest 50 (no `after` cursor, which can skip plays) and lets the primary key dedupe.
 */
export async function syncListener(row, accessToken = null) {
  try {
    const token = accessToken || await refreshAccess(row);
    const url = new URL(`${API}/me/player/recently-played`);
    url.searchParams.set('limit', '50');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`recently-played failed (${res.status})`);
    const items = (await res.json()).items || [];
    let added = 0;
    for (const it of items) {
      const t = it.track || {};
      const r = await query(
        `INSERT INTO spotify_plays (spotify_user_id, played_at, track_id, track_name, album_id, artist_ids, artist_names, context_uri)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING 1`,
        [row.spotify_user_id, it.played_at, t.id, t.name || null, t.album?.id || null,
          (t.artists || []).map(a => a.id), (t.artists || []).map(a => a.name), it.context?.uri || null]);
      added += r.length;
    }
    const newest = items.reduce((m, it) => (!m || it.played_at > m ? it.played_at : m), null);
    await query(
      `UPDATE spotify_listeners SET last_synced_at = now(), sync_error = null,
         last_played_at = GREATEST(last_played_at, $2::timestamptz), updated_at = now()
       WHERE spotify_user_id = $1`, [row.spotify_user_id, newest]);
    return added;
  } catch (err) {
    await query(
      `UPDATE spotify_listeners SET last_synced_at = now(), sync_error = $2, revoked = revoked OR $3, updated_at = now()
       WHERE spotify_user_id = $1`, [row.spotify_user_id, err.message.slice(0, 300), !!err.revoked]);
    return 0;
  }
}

/** Sync every fan whose last sync is older than the interval. */
export async function syncDueListeners({ limit = 200, concurrency = 5, force = false } = {}) {
  await ensureSyncTables();
  const rows = await query(
    `SELECT * FROM spotify_listeners
     WHERE NOT revoked AND refresh_token_enc IS NOT NULL
       AND ($2 OR last_synced_at IS NULL OR last_synced_at < now() - $3::interval)
     ORDER BY last_synced_at NULLS FIRST LIMIT $1`, [limit, force, RESYNC_AFTER]);
  let plays = 0;
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (next < rows.length) plays += await syncListener(rows[next++]);
  }));
  const errors = rows.length ? (await query(
    `SELECT count(*)::int AS n FROM spotify_listeners WHERE spotify_user_id = ANY($1) AND sync_error IS NOT NULL`,
    [rows.map(r => r.spotify_user_id)]))[0].n : 0;
  return { listeners: rows.length, plays, errors };
}

const sqlText = (v) => `'${String(v).replace(/'/g, "''")}'`;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * SQL filter on spotify_plays `p` for plays of a link's release. A track matches by id,
 * or by name + one of its artists, since the same song often has several Spotify ids
 * (single, album, regional versions) and the app may play a different one.
 */
export function releaseFilter(link) {
  const item = spotifyItem((link?.links || []).find(l => l.service === 'spotify')?.url);
  if (!item) return 'false';
  if (item.type === 'album') return `p.album_id = ${sqlText(item.id)}`;
  const byId = `p.track_id = ${sqlText(item.id)}`;
  const name = link.spotify_track_name || link.title;
  const artists = (link.spotify_artist_ids || []).filter(id => SPOTIFY_ID.test(id));
  if (!name || !artists.length) return byId;
  return `(${byId} OR (lower(p.track_name) = lower(${sqlText(name)}) AND p.artist_ids && ARRAY[${artists.map(sqlText).join(',')}]::text[]))`;
}

/**
 * Listening by a link's fans after they were captured, optionally for one campaign:
 * fans synced, fans who streamed the release, release plays, plays of the artist,
 * and how many were already listening to the artist before.
 */
export async function listeningStats({ slug = null, campaign = null, uid, link }) {
  await ensureSyncTables();
  const where = slug ? 'f.slug = $1' : 'f.campaign = $1 AND f.slug IN (SELECT slug FROM smart_links WHERE user_id = $2)';
  const params = slug ? [slug] : [campaign, uid];
  const release = releaseFilter(link);
  const artistIdx = params.length + 1;
  const row = await queryOne(
    `WITH fans AS (
       SELECT DISTINCT ON (f.spotify_user_id) f.spotify_user_id, f.created_at
       FROM smart_link_fans f WHERE ${where} ORDER BY f.spotify_user_id, f.created_at
     )
     SELECT
       (SELECT count(*)::int FROM fans x JOIN spotify_listeners l USING (spotify_user_id) WHERE l.last_synced_at IS NOT NULL) AS synced,
       count(DISTINCT p.spotify_user_id) FILTER (WHERE ${release} AND p.played_at >= fans.created_at)::int AS streamers,
       count(*) FILTER (WHERE ${release} AND p.played_at >= fans.created_at)::int AS release_plays,
       count(*) FILTER (WHERE p.artist_ids && $${artistIdx}::text[] AND p.played_at >= fans.created_at)::int AS artist_plays,
       count(DISTINCT p.spotify_user_id) FILTER (WHERE p.artist_ids && $${artistIdx}::text[] AND p.played_at < fans.created_at)::int AS prior_listeners
     FROM fans LEFT JOIN spotify_plays p ON p.spotify_user_id = fans.spotify_user_id`,
    [...params, link?.spotify_artist_ids || []]);
  return {
    fansSynced: row.synced,
    fansStreamed: row.streamers,
    releasePlays: row.release_plays,
    playsPerStreamer: row.streamers ? row.release_plays / row.streamers : 0,
    artistPlays: row.artist_plays,
    priorListeners: row.prior_listeners,
  };
}
