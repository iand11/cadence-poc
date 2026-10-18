// Daily copies of each Meta campaign's report (campaign_report_snapshots), kept per Prelude
// account so stream counts can later be compared with what the ads delivered. One row per
// campaign per day; a later read the same day replaces it. Written whenever a report is read
// (api/campaign/meta-campaign.js) and by the daily stream-counts cron for tracked campaigns.
import { query } from './db.js';
import { ensureStreamTables, AFTER_CAMPAIGN_DAYS, today } from './stream-counts.js';

export async function saveReportSnapshot(uid, campaignId, managed, report) {
  await ensureStreamTables();
  await query(
    `INSERT INTO campaign_report_snapshots (campaign_id, day, user_id, managed, report)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (campaign_id, day) DO UPDATE SET report = EXCLUDED.report, recorded_at = now()`,
    [String(campaignId), today(), uid, !!managed, JSON.stringify(report)]);
}

/** Meta campaigns on stream trackers still being read: [{ campaign_id, user_id }]. */
export async function trackedMetaCampaigns() {
  await ensureStreamTables();
  return query(
    `SELECT DISTINCT c.meta_campaign_id AS campaign_id, t.user_id
     FROM stream_tracker_campaigns c JOIN stream_trackers t ON t.id = c.tracker_id
     WHERE c.meta_campaign_id IS NOT NULL AND t.end_date >= current_date - $1::int`,
    [AFTER_CAMPAIGN_DAYS + 1]);
}
