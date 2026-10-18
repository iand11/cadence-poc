// GET /api/cron/stream-counts — daily count for every stream-goal campaign that hasn't
// ended or ended in the last 30 days, plus a copy of each linked Meta campaign's report
// (vercel.json "crons"). Vercel sends `Authorization: Bearer $CRON_SECRET`; when
// CRON_SECRET is set, anything else is refused. Also runnable as `npm run streams:snapshot`.
import { snapshotDueTrackers } from '../lib/stream-counts.js';
import { saveReportSnapshot, trackedMetaCampaigns } from '../lib/campaign-snapshots.js';
import { loadCampaign } from '../campaign/meta-campaign.js';
import { campaignReport } from '../lib/meta-insights.js';
import { metaConfigured } from '../lib/meta.js';

/** Save today's report for every Meta campaign linked to a stream tracker. */
export async function snapshotMetaReports() {
  if (!metaConfigured()) return { saved: 0, errors: 0, skipped: 'Meta is not configured' };
  let saved = 0, errors = 0;
  for (const { campaign_id: id, user_id: uid } of await trackedMetaCampaigns()) {
    try {
      const { campaign, token, managed } = await loadCampaign(uid, id);
      const report = await campaignReport(id, token, campaign);
      await saveReportSnapshot(uid, id, !!managed, { status: campaign.status, effectiveStatus: campaign.effective_status, ...report });
      saved++;
    } catch (err) {
      errors++;
      console.warn('[stream-counts] Meta report not saved', id, err.message);
    }
  }
  return { saved, errors };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const streams = await snapshotDueTrackers();
    return res.status(200).json({ ...streams, metaReports: await snapshotMetaReports() });
  } catch (err) {
    console.error('[stream-counts] snapshot failed', err.message);
    return res.status(500).json({ error: err.message });
  }
}
