// /api/campaign/meta-campaign — read or change a Meta campaign Prelude created.
//
//   GET ?id=<campaignId>             → { status, effectiveStatus, insights }
//   POST { id, status: 'ACTIVE' }    → go live (campaign, ad sets and ads)
//   POST { id, status: 'PAUSED' }    → pause the campaign
//
// Only campaigns in an ad account the user assigned in Ad Accounts are reachable here.
import { graph, graphList, getUid, requireConnection, readBody, sendError, assignedAdAccounts } from '../lib/meta.js';

async function loadOwnedCampaign(conn, id) {
  if (!/^\d+$/.test(String(id || ''))) throw Object.assign(new Error('Invalid campaign id'), { status: 400 });
  const campaign = await graph('GET', id, conn.token, { fields: 'id,name,account_id,status,effective_status' });
  if (!assignedAdAccounts(conn.selection).has(`act_${campaign.account_id}`)) {
    throw Object.assign(new Error('That campaign is not in one of your assigned ad accounts.'), { status: 403 });
  }
  return campaign;
}

export default async function handler(req, res) {
  try {
    const uid = await getUid(req);
    const conn = await requireConnection(uid);

    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      const campaign = await loadOwnedCampaign(conn, id);
      const insights = await graph('GET', `${id}/insights`, conn.token, {
        fields: 'spend,impressions,reach,clicks,actions',
        date_preset: 'maximum',
      });
      const row = insights.data?.[0] || null;
      return res.status(200).json({
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        insights: row && {
          spend: Number(row.spend || 0),
          impressions: Number(row.impressions || 0),
          reach: Number(row.reach || 0),
          clicks: Number(row.clicks || 0),
          engagements: Number(row.actions?.find(a => a.action_type === 'post_engagement')?.value || 0),
        },
      });
    }

    if (req.method === 'POST') {
      const { id, status } = await readBody(req);
      if (!['ACTIVE', 'PAUSED'].includes(status)) {
        return res.status(400).json({ error: "status must be 'ACTIVE' or 'PAUSED'" });
      }
      await loadOwnedCampaign(conn, id);

      if (status === 'ACTIVE') {
        // Children were created paused too; a campaign only delivers when all three are active.
        const [adSets, ads] = await Promise.all([
          graphList(`${id}/adsets`, conn.token, { fields: 'id' }),
          graphList(`${id}/ads`, conn.token, { fields: 'id' }),
        ]);
        for (const obj of [...adSets, ...ads]) {
          await graph('POST', obj.id, conn.token, { status: 'ACTIVE' });
        }
      }
      await graph('POST', id, conn.token, { status });
      return res.status(200).json({ ok: true, status });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
