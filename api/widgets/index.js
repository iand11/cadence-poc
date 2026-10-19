// /api/widgets — the signed-in user's custom dashboard widgets (api/lib/widgets.js).
//
//   GET                                             → { widgets: [widget] } oldest first
//   PUT  { widget }                                 → insert or replace one
//   POST { action: 'generate', messages, context }  → one model step → { content, stopReason }
//   DELETE ?id=<widget id>
import { getUid, readBody, sendError } from '../lib/meta.js';
import { ensureWidgetsTable, listWidgets, saveWidget, deleteWidget, generateStep } from '../lib/widgets.js';

export default async function handler(req, res) {
  try {
    const uid = await getUid(req);
    // getUid falls back to 'anonymous' when token checks are off (local dev); never share one bucket in production
    if (uid === 'anonymous' && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
      return res.status(401).json({ error: 'Sign in to use custom widgets' });
    }
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action !== 'generate') return res.status(400).json({ error: 'Unknown action' });
      return res.status(200).json(await generateStep(uid, body));
    }

    await ensureWidgetsTable();
    if (req.method === 'GET') {
      return res.status(200).json({ widgets: await listWidgets(uid) });
    }
    if (req.method === 'PUT') {
      const { widget } = await readBody(req);
      await saveWidget(uid, widget);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await deleteWidget(uid, id);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}

export const config = {
  maxDuration: 60,
};
