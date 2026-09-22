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

  try {
    const countRows = await query(
      `SELECT count(*)::bigint AS n FROM artists a
       LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id ${whereSql}`,
      params
    );
    const rows = await query(
      `SELECT a.*, sc.rank, sc.score, sc.stats, sc.where_people_listen, sc.as_of AS stats_as_of
       FROM artists a
       LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id
       ${whereSql}
       ORDER BY ${flipped}, a.id ASC
       LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      params
    );
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
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
