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
import { loadFacets } from '../lib/facets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const facets = await loadFacets();
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(facets);
  } catch (err) {
    console.error('GET /api/artists/facets failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
