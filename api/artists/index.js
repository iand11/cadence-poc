// GET /api/artists — paginated, filterable artist index from Postgres.
// Replaces the bundled artists-index.generated.json (which cannot scale to 200k).
//
// Query params:
//   q        search by name (trigram-backed ILIKE)
//   genre    primary or secondary genre match
//   country  code2
//   stage    career_stage (developing | mid_level | mainstream | superstar | legendary)
//   slugs    comma-separated slugs (batch fetch, e.g. the user's tracked roster)
//   sort     rank | listeners | followers | score | name   (default rank)
//   order    asc | desc
//   page     1-based (default 1)
//   perPage  default 50, max 200
//
// Response: { artists: [<allArtists entry shape>], total, page, perPage }
import { query } from '../lib/db.js';
import { artistRowToSummary } from '../lib/artist-shape.js';
import { cached } from '../lib/cache.js';
import { loadFacets } from '../lib/facets.js';

const SORTS = {
  rank: 'sc.rank ASC NULLS LAST',
  listeners: 'sc.sp_monthly_listeners DESC NULLS LAST',
  followers: 'sc.sp_followers DESC NULLS LAST',
  score: 'sc.score DESC NULLS LAST',
  name: 'a.name ASC',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.searchParams;

  const where = [];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  const q = p.get('q')?.trim();
  if (q) add('a.name ILIKE ?', `%${q}%`);
  const genre = p.get('genre')?.trim();
  if (genre) {
    params.push(genre);
    where.push(`(a.primary_genre = $${params.length} OR $${params.length} = ANY(a.secondary_genres))`);
  }
  const country = p.get('country')?.trim();
  if (country) add('a.country = ?', country.toUpperCase());
  const stage = p.get('stage')?.trim();
  if (stage) add('a.career_stage = ?', stage);
  const slugs = p.get('slugs')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (slugs?.length) {
    params.push(slugs);
    where.push(`a.slug = ANY($${params.length})`);
  }
  const label = p.get('label')?.trim();
  if (label) add('a.record_label = ?', label);
  const isBand = p.get('isBand');
  if (isBand === '1' || isBand === '0') add('a.is_band = ?', isBand === '1');
  const minListeners = Number(p.get('minListeners'));
  if (minListeners > 0) add('sc.sp_monthly_listeners >= ?', minListeners);
  const maxListeners = Number(p.get('maxListeners'));
  if (maxListeners > 0) add('sc.sp_monthly_listeners < ?', maxListeners);

  const orderBy = SORTS[p.get('sort')] || SORTS.rank;
  const flipped = p.get('order') === 'desc' && orderBy.includes('ASC')
    ? orderBy.replace('ASC', 'DESC')
    : p.get('order') === 'asc' && orderBy.includes('DESC')
      ? orderBy.replace('DESC', 'ASC')
      : orderBy;

  const perPage = Math.min(Math.max(Number(p.get('perPage')) || 50, 1), 200);
  const page = Math.max(Number(p.get('page')) || 1, 1);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const statsFilter = where.some((w) => w.includes('sc.'));
  const statsJoin = 'LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id';
  const countKey = `artists:count:${whereSql}:${JSON.stringify(params)}`;
  const sortKey = flipped.split(' ')[0];
  const dir = flipped.includes('DESC') ? 'DESC' : 'ASC';
  const offset = (page - 1) * perPage;
  const pageSql = `LIMIT ${perPage} OFFSET ${offset}`;

  try {
    // The unfiltered total is the stored catalog total (counting 500k+
    // artists per request reads the whole table). Filtered totals barely move
    // between pages / requests — cache them.
    const countPromise = where.length
      ? cached(countKey, 10 * 60_000, () => query(
        `SELECT count(*)::bigint AS n FROM artists a ${statsFilter ? statsJoin : ''} ${whereSql}`,
        params
      ))
      : loadFacets().then((f) => [{ n: f.stats.total }]);

    // 1. Pick this page's ids by walking an index in sort order, so a page
    //    reads ~perPage rows instead of sorting the whole catalog (which, on a
    //    database whose tables don't fit in memory, means reading them all
    //    from disk on every request).
    let ids;
    if (q || slugs?.length) {
      // Name search / slug lists match few rows: filter first, then sort them.
      ids = (await query(
        `SELECT a.id FROM artists a ${statsJoin} ${whereSql}
         ORDER BY ${flipped}, a.id ASC ${pageSql}`,
        params
      )).map((r) => r.id);
    } else if (sortKey === 'a.name') {
      ids = (await query(
        `SELECT a.id FROM artists a ${statsFilter ? statsJoin : ''} ${whereSql}
         ORDER BY a.name ${dir}, a.id ASC ${pageSql}`,
        params
      )).map((r) => r.id);
    } else {
      // Artists with a value for the sort key come first, in the order of the
      // (key, artist_id) indexes in db/schema.sql; ties break on id ascending
      // in the default direction (as before) and the index's reverse when flipped.
      const tieDir = flipped === orderBy ? 'ASC' : 'DESC';
      const keyed = [...where, `${sortKey} IS NOT NULL`].join(' AND ');
      // Without artist filters the join to artists is redundant (artist_id is
      // a foreign key), so the page is read from the stats index alone.
      const keyedFrom = where.some((w) => /\ba\./.test(w))
        ? 'artist_stats_current sc JOIN artists a ON a.id = sc.artist_id'
        : 'artist_stats_current sc';
      ids = (await query(
        `SELECT sc.artist_id AS id FROM ${keyedFrom}
         WHERE ${keyed}
         ORDER BY ${sortKey} ${dir}, sc.artist_id ${tieDir} ${pageSql}`,
        params
      )).map((r) => r.id);
      // Past the end of those: artists with no value (or no stats row) by id,
      // matching the old NULLS LAST, id ASC order.
      if (ids.length < perPage) {
        const keyedTotal = ids.length
          ? offset + ids.length
          : Number((await cached(`${countKey}:${sortKey}`, 60_000, () => query(
            `SELECT count(*)::bigint AS n FROM ${keyedFrom} WHERE ${keyed}`,
            params
          )))[0].n);
        const rest = await query(
          `SELECT a.id FROM artists a ${statsJoin}
           WHERE ${[...where, `${sortKey} IS NULL`].join(' AND ')}
           ORDER BY a.id ASC LIMIT ${perPage - ids.length} OFFSET ${Math.max(0, offset - keyedTotal)}`,
          params
        );
        ids = ids.concat(rest.map((r) => r.id));
      }
    }

    // 2. Wide profile + stats columns for just this page.
    const [countRows, wide] = await Promise.all([
      countPromise,
      ids.length
        ? query(
          `SELECT a.*, sc.rank, sc.score, sc.stats, sc.as_of AS stats_as_of
           FROM artists a ${statsJoin}
           WHERE a.id = ANY($1::bigint[])`,
          [ids]
        )
        : [],
    ]);
    const byId = new Map(wide.map((r) => [String(r.id), r]));
    const rows = ids.map((id) => byId.get(String(id))).filter(Boolean);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      artists: rows.map(artistRowToSummary),
      total: Number(countRows[0]?.n || 0),
      page,
      perPage,
    });
  } catch (err) {
    console.error('GET /api/artists failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
