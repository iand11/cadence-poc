// /api/campaigns — the signed-in user's saved campaigns (api/lib/campaigns.js).
//
//   GET                                     → { campaigns: [campaign] } newest first
//   PUT  { campaign }                       → insert or replace one
//   POST { action: 'import', campaigns }    → add browser-saved campaigns (existing ids untouched) → { added }
//   DELETE ?id=<campaign id>
import { getUid, readBody, sendError } from '../lib/meta.js';
import { ensureCampaignsTable, listCampaigns, saveCampaign, importCampaigns, deleteCampaign } from '../lib/campaigns.js';

export default async function handler(req, res) {
  try {
    const uid = await getUid(req);
    // getUid falls back to 'anonymous' when token checks are off (local dev); never share one bucket in production
    if (uid === 'anonymous' && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
      return res.status(401).json({ error: 'Sign in to see your campaigns' });
    }
    await ensureCampaignsTable();
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
      return res.status(200).json({ campaigns: await listCampaigns(uid) });
    }
    if (req.method === 'PUT') {
      const { campaign } = await readBody(req);
      await saveCampaign(uid, campaign);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action !== 'import') return res.status(400).json({ error: 'Unknown action' });
      return res.status(200).json({ added: await importCampaigns(uid, body.campaigns) });
    }
    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await deleteCampaign(uid, id);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
