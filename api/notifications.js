// /api/notifications — the signed-in user's in-app notifications.
//
//   GET                         → { notifications: [...30 newest], unread }
//   POST { action: 'delivered', ids }   mark as delivered (client applied
//                                       side effects + showed the toast)
//   POST { action: 'read', ids? }       mark read (no ids = all)
//
// Rows are written by DB triggers (see on_artist_request_resolved in
// db/schema.sql), never by this endpoint.
import { query, queryOne } from './lib/db.js';
import { verifyAuth } from './lib/auth.js';

const shape = (r) => ({
  id: Number(r.id),
  type: r.type,
  title: r.title,
  body: r.body,
  data: r.data || {},
  createdAt: r.created_at,
  delivered: !!r.delivered_at,
  read: !!r.read_at,
});

async function getUid(req) {
  // Throws 401 in production without a valid token. No x-user-id fallback —
  // a client-supplied header must never pick whose notifications are read.
  const decoded = await verifyAuth(req);
  return decoded?.uid || decoded?.sub || 'anonymous';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  let uid;
  try {
    uid = await getUid(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const [rows, counts] = await Promise.all([
        query(
          `SELECT * FROM notifications WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 30`,
          [uid]
        ),
        queryOne(
          'SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL',
          [uid]
        ),
      ]);
      return res.status(200).json({ notifications: rows.map(shape), unread: counts.unread });
    }

    if (req.method === 'POST') {
      const { action, ids } = await readBody(req);
      const idList = Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : null;
      if (action === 'delivered') {
        if (!idList?.length) return res.status(400).json({ error: 'ids required' });
        await query(
          `UPDATE notifications SET delivered_at = now()
           WHERE user_id = $1 AND id = ANY($2::bigint[]) AND delivered_at IS NULL`,
          [uid, idList]
        );
      } else if (action === 'read') {
        await query(
          `UPDATE notifications SET read_at = now(), delivered_at = coalesce(delivered_at, now())
           WHERE user_id = $1 AND read_at IS NULL ${idList ? 'AND id = ANY($2::bigint[])' : ''}`,
          idList ? [uid, idList] : [uid]
        );
      } else {
        return res.status(400).json({ error: "action must be 'delivered' or 'read'" });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/notifications failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
