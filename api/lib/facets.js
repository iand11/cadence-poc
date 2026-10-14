// Artist catalog facets (filter options + headline totals) for
// GET /api/artists/facets. Computing them reads the whole catalog (minutes on
// a cold 500k-artist database), so they are stored in catalog_facets and
// refreshed off the request path: daily cron /api/cron/refresh-facets and
// `npm run db:refresh-facets`.
import { query } from './db.js';
import { cached } from './cache.js';

export async function computeFacets() {
  // Each aggregate is written so it can be answered from an index
  // (genre / country / label / stage indexes, the stats paging indexes).
  const [genres, countries, labels, stages, [counts], [stats]] = await Promise.all([
    query(`SELECT primary_genre AS value, count(*)::int AS count FROM artists
           WHERE primary_genre IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`),
    query(`SELECT country AS value, count(*)::int AS count FROM artists
           WHERE country IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
    query(`SELECT record_label AS value, count(*)::int AS count FROM artists
           WHERE record_label IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`),
    query(`SELECT career_stage AS value, count(*)::int AS count FROM artists
           WHERE career_stage IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
    query('SELECT count(*)::bigint AS total FROM artists'),
    query(`SELECT
             (SELECT COALESCE(sum(sp_monthly_listeners), 0) FROM artist_stats_current WHERE sp_monthly_listeners IS NOT NULL)::bigint AS total_listeners,
             (SELECT COALESCE(sum(sp_followers), 0) FROM artist_stats_current WHERE sp_followers IS NOT NULL)::bigint AS total_followers,
             (SELECT COALESCE(avg(score), 0) FROM artist_stats_current WHERE score IS NOT NULL)::float AS avg_score`),
  ]);
  return {
    genres,
    countries,
    labels,
    stages,
    stats: {
      total: Number(counts.total),
      totalListeners: Number(stats.total_listeners),
      totalFollowers: Number(stats.total_followers),
      avgScore: stats.avg_score,
    },
  };
}

export async function refreshFacets() {
  const data = await computeFacets();
  await query(
    `INSERT INTO catalog_facets (key, data, refreshed_at) VALUES ('artists', $1, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, refreshed_at = now()`,
    [data]
  );
  return data;
}

// Stored facets; computed (and stored) on the first request if the table is
// empty. Falls back to computing when catalog_facets doesn't exist yet.
export function loadFacets() {
  return cached('artists:facets', 10 * 60_000, async () => {
    let rows;
    try {
      rows = await query(`SELECT data FROM catalog_facets WHERE key = 'artists'`);
    } catch (err) {
      if (err.code === '42P01') return computeFacets(); // undefined_table
      throw err;
    }
    return rows[0]?.data || refreshFacets();
  });
}
