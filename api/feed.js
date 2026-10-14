// GET /api/feed — DB-backed social content feed.
// Mirrors the response shape of api.getContentFeed() in src/data/api.js:
//   { items: [...], artistAverages: { [artistId]: { [platform]: { [type]: {views, engagement, count} } } }, total }
//
// Query params: platform (or platforms, comma list), type (posts|video), artist (slug), artists (comma slugs),
//               sort (recent|engagement), limit, offset
import { query } from './lib/db.js';
import { cached } from './lib/cache.js';
import { artistIdsForSlugs } from './lib/artist-ids.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.searchParams;

  const where = ['sp.artist_id IS NOT NULL'];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (p.get('platform')) add('sp.platform = ?', p.get('platform'));
  else if (p.get('platforms')) {
    params.push(p.get('platforms').split(',').map((s) => s.trim()).filter(Boolean));
    where.push(`sp.platform = ANY($${params.length})`);
  }
  if (p.get('type')) add('sp.content_type = ?', p.get('type'));
  // Artist scope by id, so it is answered from social_posts_artist_idx.
  const slugs = p.get('artist')
    ? [p.get('artist')]
    : p.get('artists')?.split(',').map((s) => s.trim()).filter(Boolean);

  const sort = p.get('sort') === 'engagement'
    ? '(sp.likes + sp.comments + sp.shares) DESC'
    : 'sp.published_at DESC NULLS LAST';
  const limit = Math.min(Math.max(Number(p.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);

  try {
    if (slugs?.length) {
      const ids = await artistIdsForSlugs(slugs);
      if (!ids.length) return send(res, { items: [], artistAverages: {}, total: 0 });
      add('sp.artist_id = ANY(?::bigint[])', ids);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows, rows] = await Promise.all([
      // Unscoped totals cover the whole table — cache them.
      cached(`feed:count:${whereSql}:${JSON.stringify(params)}`, slugs?.length ? 60_000 : 10 * 60_000, () => query(
        `SELECT count(*)::bigint AS n FROM social_posts sp ${whereSql}`,
        params
      )),
      query(
        `SELECT sp.*, a.slug AS artist_slug, a.name AS artist_name, a.image_url AS artist_image
         FROM social_posts sp JOIN artists a ON a.id = sp.artist_id
         ${whereSql} ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    // Per-artist per-platform per-type averages (for boost detection), for
    // the artists on this page only — clients look them up by item.artistId.
    const pageArtistIds = [...new Set(rows.map((r) => String(r.artist_id)))];
    const avgRows = pageArtistIds.length ? await query(
      `SELECT artist_id, platform, content_type,
              round(avg(views))::bigint AS views,
              round(avg(likes + comments + shares))::bigint AS engagement,
              count(*)::int AS count
       FROM social_posts WHERE artist_id = ANY($1::bigint[])
       GROUP BY artist_id, platform, content_type`,
      [pageArtistIds]
    ) : [];
    const artistAverages = {};
    for (const r of avgRows) {
      const id = Number(r.artist_id);
      artistAverages[id] ??= {};
      artistAverages[id][r.platform] ??= {};
      artistAverages[id][r.platform][r.content_type] = {
        views: Number(r.views),
        engagement: Number(r.engagement),
        count: r.count,
      };
    }

    const items = rows.map((r) => ({
      id: r.post_id,
      artistId: Number(r.artist_id),
      artistSlug: r.artist_slug,
      artistName: r.artist_name,
      artistImage: r.raw?.user_picture || r.artist_image || '',
      platform: r.platform,
      contentType: r.content_type,
      title: r.title || '',
      thumbnailUrl: r.thumbnail_url || '',
      views: Number(r.views) || 0,
      likes: Number(r.likes) || 0,
      comments: Number(r.comments) || 0,
      shares: Number(r.shares) || 0,
      duration: r.duration,
      publishedAt: r.published_at || '',
      permalink: r.permalink || '',
      platformId: r.post_id,
      ownerPlatformId: r.owner_platform_id || '',
    }));

    return send(res, { items, artistAverages, total: Number(countRows[0]?.n || 0) });
  } catch (err) {
    console.error('GET /api/feed failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}

function send(res, body) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
  return res.status(200).json(body);
}
