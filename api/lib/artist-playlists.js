// Rollup of the playlists each artist is currently on:
// artist_playlists_current — one row per artist per playlist with the number
// of that playlist's current entries featuring them, plus a copy of the
// playlist's sort / filter columns (followers, active, platform, type,
// is_editorial). Lists scoped to followed artists read, sort and count this
// through its primary key and only touch playlists for the rows on the page,
// instead of scanning playlist_entries (9M+ rows) and playlists per request.
//
// playlists / playlist_entries belong to the external crawler, so the rollup
// is kept current by triggers on them (no crawler change needed), and built
// once from scratch with rebuildArtistPlaylists():
//   npm run db:rebuild-artist-playlists   (or db:diagnose -- --apply-indexes)
// The API only reads the rollup once a rebuild has recorded the
// 'artist_playlists' marker row in catalog_facets.
import { query, withTransaction } from './db.js';
import { cached } from './cache.js';

// Playlist columns copied into the rollup (kept in step by a playlists trigger).
const PLAYLIST_ATTRS = ['followers', 'active', 'platform', 'type', 'is_editorial'];
const COLUMNS = ['artist_id', 'playlist_id', 'tracks', ...PLAYLIST_ATTRS].join(', ');

// Each changed entry adds (+1 new / -1 old) to the (artist, playlist) pairs it
// covers while current (removed_at IS NULL); rows that reach 0 are dropped.
const deltas = (rowsSql) => `
  INSERT INTO artist_playlists_current AS c (${COLUMNS})
  SELECT d.aid, d.playlist_id, d.delta, ${PLAYLIST_ATTRS.map((c) => `p.${c}`).join(', ')}
  FROM (
    SELECT x.aid, e.playlist_id, sum(e.delta)::int AS delta
    FROM (${rowsSql}) e
    CROSS JOIN LATERAL (SELECT DISTINCT unnest(e.artist_ids)::bigint AS aid) x
    WHERE x.aid IS NOT NULL
    GROUP BY 1, 2
    HAVING sum(e.delta) <> 0
  ) d
  LEFT JOIN playlists p ON p.id = d.playlist_id
  ON CONFLICT (artist_id, playlist_id) DO UPDATE SET tracks = c.tracks + EXCLUDED.tracks;
  DELETE FROM artist_playlists_current WHERE tracks <= 0;`;

export const ROLLUP_DDL = `
CREATE TABLE IF NOT EXISTS artist_playlists_current (
  artist_id    bigint  NOT NULL,
  playlist_id  bigint  NOT NULL,
  tracks       integer NOT NULL,
  PRIMARY KEY (artist_id, playlist_id)
);
ALTER TABLE artist_playlists_current
  ADD COLUMN IF NOT EXISTS followers    bigint,
  ADD COLUMN IF NOT EXISTS active       boolean,
  ADD COLUMN IF NOT EXISTS platform     text,
  ADD COLUMN IF NOT EXISTS type         text,
  ADD COLUMN IF NOT EXISTS is_editorial boolean;
CREATE INDEX IF NOT EXISTS artist_playlists_current_playlist_idx
  ON artist_playlists_current (playlist_id);
CREATE INDEX IF NOT EXISTS artist_playlists_current_empty_idx
  ON artist_playlists_current (artist_id) WHERE tracks <= 0;

-- SECURITY DEFINER: the crawler's role writes playlist_entries but needn't
-- have rights on the rollup.
CREATE OR REPLACE FUNCTION artist_playlists_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    ${deltas('SELECT playlist_id, artist_ids, 1 AS delta FROM new_rows WHERE removed_at IS NULL')}
  ELSIF TG_OP = 'UPDATE' THEN
    ${deltas(`SELECT playlist_id, artist_ids, 1 AS delta FROM new_rows WHERE removed_at IS NULL
              UNION ALL
              SELECT playlist_id, artist_ids, -1 FROM old_rows WHERE removed_at IS NULL`)}
  ELSIF TG_OP = 'DELETE' THEN
    ${deltas('SELECT playlist_id, artist_ids, -1 AS delta FROM old_rows WHERE removed_at IS NULL')}
  ELSIF TG_OP = 'TRUNCATE' THEN
    TRUNCATE artist_playlists_current;
  END IF;
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION artist_playlists_attrs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE artist_playlists_current
  SET ${PLAYLIST_ATTRS.map((c) => `${c} = NEW.${c}`).join(', ')}
  WHERE playlist_id = NEW.id;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS artist_playlists_attrs ON playlists;
CREATE TRIGGER artist_playlists_attrs AFTER UPDATE ON playlists FOR EACH ROW
  WHEN (${PLAYLIST_ATTRS.map((c) => `OLD.${c} IS DISTINCT FROM NEW.${c}`).join(' OR ')})
  EXECUTE FUNCTION artist_playlists_attrs();

DROP TRIGGER IF EXISTS artist_playlists_ins ON playlist_entries;
CREATE TRIGGER artist_playlists_ins AFTER INSERT ON playlist_entries
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION artist_playlists_sync();
DROP TRIGGER IF EXISTS artist_playlists_upd ON playlist_entries;
CREATE TRIGGER artist_playlists_upd AFTER UPDATE ON playlist_entries
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION artist_playlists_sync();
DROP TRIGGER IF EXISTS artist_playlists_del ON playlist_entries;
CREATE TRIGGER artist_playlists_del AFTER DELETE ON playlist_entries
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION artist_playlists_sync();
DROP TRIGGER IF EXISTS artist_playlists_trunc ON playlist_entries;
CREATE TRIGGER artist_playlists_trunc AFTER TRUNCATE ON playlist_entries
  FOR EACH STATEMENT EXECUTE FUNCTION artist_playlists_sync();
`;

// Install the triggers and rebuild the rollup from playlist_entries. Crawler
// writes wait (SHARE lock) while it runs so none are missed; reads continue.
export async function rebuildArtistPlaylists() {
  return withTransaction(async (run) => {
    await run('CREATE TABLE IF NOT EXISTS catalog_facets (key text PRIMARY KEY, data jsonb NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now())');
    await run(ROLLUP_DDL);
    await run('LOCK TABLE playlist_entries, playlists IN SHARE MODE');
    await run('TRUNCATE artist_playlists_current');
    // Inserted in artist order so each artist's rows sit together on disk.
    await run(`
      INSERT INTO artist_playlists_current (${COLUMNS})
      SELECT d.aid, d.playlist_id, d.tracks, ${PLAYLIST_ATTRS.map((c) => `p.${c}`).join(', ')}
      FROM (
        SELECT x.aid, e.playlist_id, count(*)::int AS tracks
        FROM playlist_entries e
        CROSS JOIN LATERAL (SELECT DISTINCT unnest(e.artist_ids)::bigint AS aid) x
        WHERE e.removed_at IS NULL AND x.aid IS NOT NULL
        GROUP BY 1, 2
      ) d
      LEFT JOIN playlists p ON p.id = d.playlist_id
      ORDER BY d.aid, d.playlist_id`);
    const [{ n }] = await run('SELECT count(*)::bigint AS n FROM artist_playlists_current');
    await run(
      `INSERT INTO catalog_facets (key, data, refreshed_at) VALUES ('artist_playlists', $1, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, refreshed_at = now()`,
      [{ rows: Number(n) }]
    );
    await run('ANALYZE artist_playlists_current');
    return Number(n);
  }, { statementTimeoutMs: 0 });
}

// True once a rebuild has populated the rollup.
export function rollupReady() {
  return cached('artist_playlists:ready', 10 * 60_000, async () => {
    try {
      const rows = await query(`SELECT 1 FROM catalog_facets WHERE key = 'artist_playlists'`);
      return rows.length > 0;
    } catch (err) {
      if (err.code === '42P01') return false; // undefined_table
      throw err;
    }
  });
}
