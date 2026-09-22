// GET /api/artists/facets — filter options + catalog-wide stats for the
// artists browse page (the old page derived these by iterating the bundle).
//
// Response: {
//   genres:    [{ value, count }]   top 40 primary genres by artist count
//   countries: [{ value, count }]   all countries with artists
//   labels:    [{ value, count }]   top 40 labels
//   stages:    [{ value, count }]   career stages
//   stats:     { total, totalListeners, totalFollowers, avgScore }
// }
import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [genres, countries, labels, stages, stats] = await Promise.all([
      query(`SELECT primary_genre AS value, count(*)::int AS count FROM artists
             WHERE primary_genre IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`),
      query(`SELECT country AS value, count(*)::int AS count FROM artists
             WHERE country IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
      query(`SELECT record_label AS value, count(*)::int AS count FROM artists
             WHERE record_label IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`),
      query(`SELECT career_stage AS value, count(*)::int AS count FROM artists
             WHERE career_stage IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
      query(`SELECT count(*)::bigint AS total,
                    COALESCE(sum(sc.sp_monthly_listeners), 0)::bigint AS total_listeners,
                    COALESCE(sum(sc.sp_followers), 0)::bigint AS total_followers,
                    COALESCE(avg(sc.score), 0)::float AS avg_score
             FROM artists a LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id`),
    ]);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      genres,
      countries,
      labels,
      stages,
      stats: {
        total: Number(stats[0].total),
        totalListeners: Number(stats[0].total_listeners),
        totalFollowers: Number(stats[0].total_followers),
        avgScore: stats[0].avg_score,
      },
    });
  } catch (err) {
    console.error('GET /api/artists/facets failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
