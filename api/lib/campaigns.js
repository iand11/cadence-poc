// Saved campaigns ("directives"), one row per campaign, owned by the Firebase user
// who created it. The campaign object the app builds is stored as-is in `data`.
import { query, exec } from './db.js';

// Created lazily too (mirrors db/schema.sql) so a database that hasn't had
// `npm run db:schema` re-run since this table was added still works.
let tableReady;
export function ensureCampaignsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS campaigns (
          user_id    text NOT NULL,
          id         text NOT NULL,
          data       jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, id)
        )`);
    })().catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

const MAX_BYTES = 256 * 1024;
const bad = (message) => Object.assign(new Error(message), { status: 400 });

/** Throws unless `c` is a storable campaign; returns its JSON. */
export function campaignJson(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw bad('Campaign must be an object');
  if (typeof c.id !== 'string' || !c.id || c.id.length > 100) throw bad('Campaign needs an id');
  const json = JSON.stringify(c);
  if (json.length > MAX_BYTES) throw bad('Campaign is too large');
  return json;
}

/** The user's campaigns, newest first. */
export async function listCampaigns(uid) {
  const rows = await query('SELECT data FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC, id', [uid]);
  return rows.map(r => r.data);
}

/** Insert or replace one campaign. */
export async function saveCampaign(uid, campaign) {
  const json = campaignJson(campaign);
  const created = Date.parse(campaign.createdAt);
  await exec(
    `INSERT INTO campaigns (user_id, id, data, created_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
     ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [uid, campaign.id, json, Number.isFinite(created) ? new Date(created).toISOString() : null],
  );
}

/** Add campaigns saved in a browser before they were stored per account; existing ids are kept as they are. */
export async function importCampaigns(uid, campaigns) {
  if (!Array.isArray(campaigns) || campaigns.length > 500) throw bad('Expected a list of campaigns');
  let added = 0;
  for (const c of campaigns) {
    const json = campaignJson(c);
    const created = Date.parse(c.createdAt);
    const r = await query(
      `INSERT INTO campaigns (user_id, id, data, created_at)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
       ON CONFLICT (user_id, id) DO NOTHING RETURNING id`,
      [uid, c.id, json, Number.isFinite(created) ? new Date(created).toISOString() : null],
    );
    added += r.length;
  }
  return added;
}

export async function deleteCampaign(uid, id) {
  await exec('DELETE FROM campaigns WHERE user_id = $1 AND id = $2', [uid, id]);
}
