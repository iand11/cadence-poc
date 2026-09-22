// GET /api/feed — DB-backed social content feed.
// Mirrors the response shape of api.getContentFeed() in src/data/api.js:
//   { items: [...], artistAverages: { [artistId]: { [platform]: { [type]: {views, engagement, count} } } }, total }
//
// Query params: platform, type (posts|video), artist (slug), artists (comma slugs),
//               sort (recent|engagement), limit, offset
import { query } from './lib/db.js';

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
  if (p.get('type')) add('sp.content_type = ?', p.get('type'));
  if (p.get('artist')) add('a.slug = ?', p.get('artist'));
  else if (p.get('artists')) {
    params.push(p.get('artists').split(',').map((s) => s.trim()).filter(Boolean));
    where.push(`a.slug = ANY($${params.length})`);
  }

  const sort = p.get('sort') === 'engagement'
    ? '(sp.likes + sp.comments + sp.shares) DESC'
    : 'sp.published_at DESC NULLS LAST';
  const limit = Math.min(Math.max(Number(p.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  try {
    const countRows = await query(
      `SELECT count(*)::bigint AS n FROM social_posts sp JOIN artists a ON a.id = sp.artist_id ${whereSql}`,
      params
    );
    const rows = await query(
      `SELECT sp.*, a.slug AS artist_slug, a.name AS artist_name, a.image_url AS artist_image
       FROM social_posts sp JOIN artists a ON a.id = sp.artist_id
       ${whereSql} ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Per-artist per-platform per-type averages (for boost detection)
    const avgRows = await query(
      `SELECT artist_id, platform, content_type,
              round(avg(views))::bigint AS views,
              round(avg(likes + comments + shares))::bigint AS engagement,
              count(*)::int AS count
       FROM social_posts WHERE artist_id IS NOT NULL
       GROUP BY artist_id, platform, content_type`
    );
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

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({ items, artistAverages, total: Number(countRows[0]?.n || 0) });
  } catch (err) {
    console.error('GET /api/feed failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
