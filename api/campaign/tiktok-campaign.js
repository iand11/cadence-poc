// /api/campaign/tiktok-campaign — status, results and go-live / pause for a TikTok Smart+
// campaign created by /api/campaign/tiktok-launch.
//
//   GET ?id=<campaign id>&advertiserId=  → { status: ACTIVE|PAUSED|DELETED, effectiveStatus, name,
//                                            totals, daily, currency }
//   POST { id, advertiserId, adGroupId, adId, status: 'ACTIVE' | 'PAUSED' }
//        ACTIVE turns on the campaign, its ad group and its ad (all created disabled);
//        PAUSED turns the campaign off.
// The ad account must belong to the user's TikTok connection.
import { getUid, readBody, sendError } from '../lib/meta.js';
import { tt, requireConnection, advertiserFor } from '../lib/tiktok.js';

const METRICS = ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'video_play_actions', 'video_watched_2s', 'video_views_p100'];
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function shapeMetrics(m = {}) {
  return {
    spend: num(m.spend),
    impressions: num(m.impressions),
    reach: num(m.reach),
    clicks: num(m.clicks),
    ctr: num(m.ctr),
    cpc: num(m.cpc),
    cpm: num(m.cpm),
    videoViews: num(m.video_play_actions),
    videoViews2s: num(m.video_watched_2s),
    videoCompletes: num(m.video_views_p100),
  };
}

function report(token, advertiserId, campaignId, extra) {
  return tt('GET', 'report/integrated/get/', token, {
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    data_level: 'AUCTION_CAMPAIGN',
    metrics: METRICS,
    // Report filters are a list (entity endpoints take a plain object)
    filtering: [{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([campaignId]) }],
    page_size: 100,
    ...extra,
  });
}

/** Daily rows since the campaign was created; TikTok caps a daily report at 30 days per request. */
async function dailyReport(token, advertiserId, campaignId, createdAt) {
  const first = createdAt ? new Date(createdAt.replace(' ', 'T') + 'Z') : new Date(Date.now() - 29 * DAY);
  const today = new Date();
  const rows = [];
  for (let from = first; from <= today; from = new Date(from.getTime() + 30 * DAY)) {
    const to = new Date(Math.min(today.getTime(), from.getTime() + 29 * DAY));
    const data = await report(token, advertiserId, campaignId, {
      dimensions: ['campaign_id', 'stat_time_day'], start_date: iso(from), end_date: iso(to),
    });
    for (const r of data.list || []) {
      rows.push({ date: String(r.dimensions?.stat_time_day || '').slice(0, 10), ...shapeMetrics(r.metrics) });
    }
  }
  return rows.filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
}

export default async function handler(req, res) {
  try {
    const uid = await getUid(req);
    const conn = await requireConnection(uid);

    if (req.method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const id = params.get('id');
      const advertiser = advertiserFor(conn.selection, params.get('advertiserId'));
      if (!id || !advertiser) return res.status(400).json({ error: 'Campaign or ad account not found in your TikTok connection.' });

      const found = await tt('GET', 'smart_plus/campaign/get/', conn.token, {
        advertiser_id: advertiser.id, filtering: { campaign_ids: [id] },
      });
      const campaign = (found.list || [])[0];
      if (!campaign) return res.status(404).json({ error: 'TikTok has no such campaign in this ad account (it may have been deleted).' });

      const [lifetime, daily] = await Promise.all([
        report(conn.token, advertiser.id, id, { dimensions: ['campaign_id'], query_lifetime: true }),
        dailyReport(conn.token, advertiser.id, id, campaign.create_time),
      ]);
      const op = campaign.operation_status;
      return res.status(200).json({
        id,
        name: campaign.campaign_name || null,
        status: op === 'ENABLE' ? 'ACTIVE' : op === 'DISABLE' ? 'PAUSED' : op || null,
        effectiveStatus: campaign.secondary_status || op || null,
        currency: advertiser.currency || null,
        totals: shapeMetrics((lifetime.list || [])[0]?.metrics),
        daily,
      });
    }

    if (req.method === 'POST') {
      const { id, advertiserId, adGroupId, adId, status } = await readBody(req);
      const advertiser = advertiserFor(conn.selection, advertiserId);
      if (!id || !advertiser) return res.status(400).json({ error: 'Campaign or ad account not found in your TikTok connection.' });
      if (status !== 'ACTIVE' && status !== 'PAUSED') return res.status(400).json({ error: "status must be 'ACTIVE' or 'PAUSED'" });
      const operation = status === 'ACTIVE' ? 'ENABLE' : 'DISABLE';
      if (status === 'ACTIVE') {
        // The ad group and ad were created disabled too
        if (adGroupId) {
          await tt('POST', 'smart_plus/adgroup/status/update/', conn.token, {
            advertiser_id: advertiser.id, adgroup_ids: [String(adGroupId)], operation_status: operation,
          });
        }
        if (adId) {
          await tt('POST', 'smart_plus/ad/status/update/', conn.token, {
            advertiser_id: advertiser.id, smart_plus_ad_ids: [String(adId)], operation_status: operation,
          });
        }
      }
      await tt('POST', 'smart_plus/campaign/status/update/', conn.token, {
        advertiser_id: advertiser.id, campaign_ids: [String(id)], operation_status: operation,
      });
      return res.status(200).json({ ok: true, status });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
