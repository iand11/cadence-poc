// GET /api/admin/health — data health for the admin monitoring page (api/lib/data-health.js).
// Prelude admins only (PRELUDE_ADMIN_UIDS).
//   GET ?check=1  → { admin } for any signed-in user (shows or hides the nav link)
//   GET [?fresh=1] → the health report; fresh=1 skips the 5-minute reuse
import { getUid, isAdmin, sendError } from '../lib/meta.js';
import { getHealth } from '../lib/data-health.js';

// Local dev runs without token checks (every request is 'anonymous'); let it see the page there
const devOpen = (uid) => uid === 'anonymous' && !process.env.VERCEL && process.env.NODE_ENV !== 'production';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const uid = await getUid(req);
    const admin = isAdmin(uid) || devOpen(uid);
    const params = new URL(req.url, 'http://localhost').searchParams;
    res.setHeader('Cache-Control', 'no-store');
    if (params.get('check')) return res.status(200).json({ admin });
    if (!admin) return res.status(403).json({ error: 'Admins only' });
    return res.status(200).json(await getHealth({ fresh: params.get('fresh') === '1' }));
  } catch (err) {
    return sendError(res, err);
  }
}
