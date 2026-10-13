// Slug → artist id resolution for the playlist endpoints.
//
// Scoping playlist_entries by artist used to be written as
// `JOIN artists a ON a.id = ANY(e.artist_ids) AND a.slug = ANY($slugs)`, which
// Postgres can only run by unnesting every entry row. Resolving the slugs to
// ids first lets the queries use `e.artist_ids && $ids` instead, which is
// served by the GIN index on playlist_entries.artist_ids (db/schema.sql).
import { query } from './db.js';
import { cached } from './cache.js';

// playlist_entries is created by the external crawler, so read the element
// type of artist_ids (bigint[] / integer[]) once instead of assuming it —
// `&&` needs both sides to be the same array type.
export function artistIdArrayType() {
  return cached('playlist_entries.artist_ids type', 24 * 3600_000, async () => {
    const [r] = await query(
      `SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute
       WHERE attrelid = 'playlist_entries'::regclass AND attname = 'artist_ids'`
    );
    return r?.t === 'integer[]' ? 'integer[]' : 'bigint[]';
  });
}

// Slug → id never changes for an artist, so cache per slug set.
export function artistIdsForSlugs(slugs) {
  const key = [...new Set(slugs)].sort();
  return cached(`ids:${key.join(',')}`, 3600_000, async () => {
    const rows = await query('SELECT id FROM artists WHERE slug = ANY($1)', [key]);
    return rows.map((r) => String(r.id));
  });
}
