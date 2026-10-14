// Meta (Facebook / Instagram) Marketing API helpers shared by api/connect/meta.js
// and the api/campaign/* execution endpoints.
//
// Model: each Prelude user connects their own Meta business with Facebook Login
// for Business. Ads run in *their* ad account (Meta bills their card); Prelude
// charges its own fee separately. The access token is stored encrypted in
// ad_platform_connections and never reaches the browser.
//
// Env:
//   META_APP_ID, META_APP_SECRET   — the Meta app
//   META_LOGIN_CONFIG_ID           — Facebook Login for Business configuration
//                                    (defines the permissions + token type; use a
//                                    system-user token config so it never expires)
//   META_REDIRECT_URI              — optional; defaults to <origin>/api/connect/meta
//   META_GRAPH_VERSION             — optional; defaults to GRAPH_VERSION below
//   META_GRAPH_URL                 — optional Graph API base override (local mock for testing)
//   AD_TOKEN_KEY                   — secret used to encrypt stored tokens
//
// Prelude-managed ads (artists without their own ad account): new ads run in Prelude's
// ad account, as the artist's Instagram account, and Meta bills Prelude. Optional:
//   META_PRELUDE_AD_ACCOUNT_ID     — Prelude's ad account (act_… or the number)
//   META_PRELUDE_BUSINESS_ID       — the business portfolio that owns it
//   META_PRELUDE_TOKEN             — a system-user token of that business with ads_management
//   PRELUDE_ADMIN_UIDS             — comma-separated Prelude user ids who approve go-live
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { verifyAuth } from './auth.js';

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const GRAPH = process.env.META_GRAPH_URL || `https://graph.facebook.com/${GRAPH_VERSION}`;
const STATE_TTL_MS = 10 * 60 * 1000;

export function metaConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_LOGIN_CONFIG_ID);
}

function secretKey() {
  const raw = process.env.AD_TOKEN_KEY || process.env.APP_SESSION_SECRET;
  if (!raw) throw Object.assign(new Error('AD_TOKEN_KEY is not configured on the server.'), { status: 500 });
  return crypto.createHash('sha256').update(raw).digest();
}

// ── Token encryption (AES-256-GCM) ──────────────────────────────────────────

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64url')).join('.');
}

export function decryptToken(blob) {
  const [iv, tag, enc] = blob.split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── OAuth state (binds the browser redirect back to the Prelude user) ───────

/** HMAC-signed, expiring payload (OAuth state for Meta and the smart link Spotify flow). */
export function signData(payload, ttlMs = STATE_TTL_MS) {
  const data = Buffer.from(JSON.stringify({
    ...payload, n: crypto.randomBytes(8).toString('hex'), exp: Date.now() + ttlMs,
  })).toString('base64url');
  const mac = crypto.createHmac('sha256', secretKey()).update(data).digest('base64url');
  return `${data}.${mac}`;
}

export function verifyData(signed) {
  if (!signed || !signed.includes('.')) return null;
  const [data, mac] = signed.split('.');
  const expected = crypto.createHmac('sha256', secretKey()).update(data).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export const signState = (uid) => signData({ uid });
export const verifyState = (state) => verifyData(state);

// ── Graph API ───────────────────────────────────────────────────────────────

function appSecretProof(token) {
  return crypto.createHmac('sha256', process.env.META_APP_SECRET).update(token).digest('hex');
}

/** Call the Graph API. `params` are sent as query (GET/DELETE) or form body (POST). */
export async function graph(method, path, token, params = {}) {
  const all = { ...params };
  if (token) {
    all.access_token = token;
    all.appsecret_proof = appSecretProof(token);
  }
  const encoded = new URLSearchParams();
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined || v === null) continue;
    encoded.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const url = `${GRAPH}/${path.replace(/^\//, '')}`;
  const res = method === 'POST'
    ? await fetch(url, { method, body: encoded })
    : await fetch(`${url}?${encoded}`, { method });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    const err = new Error(e.error_user_msg || e.message || `Meta API error (${res.status})`);
    err.status = res.status >= 500 ? 502 : 400;
    err.meta = { code: e.code, subcode: e.error_subcode, type: e.type, fbtraceId: e.fbtrace_id };
    // 190 = invalid/expired token — the user has to reconnect
    if (e.code === 190) err.reconnect = true;
    throw err;
  }
  return body;
}

/** POST a multipart form with one binary part (video uploads). Same error handling as `graph`. */
export async function graphUpload(path, token, params, fileField, buffer, filename = 'upload.bin') {
  const form = new FormData();
  const all = { ...params, access_token: token, appsecret_proof: appSecretProof(token) };
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined || v === null) continue;
    form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  form.set(fileField, new Blob([buffer]), filename);
  const res = await fetch(`${GRAPH}/${path.replace(/^\//, '')}`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    const err = new Error(e.error_user_msg || e.message || `Meta API error (${res.status})`);
    err.status = res.status >= 500 ? 502 : 400;
    err.meta = { code: e.code, subcode: e.error_subcode, type: e.type, fbtraceId: e.fbtrace_id };
    if (e.code === 190) err.reconnect = true;
    throw err;
  }
  return body;
}

/** Follow `paging.next` for list edges (capped so a huge business can't stall a request). */
export async function graphList(path, token, params = {}, maxPages = 5) {
  const out = [];
  let after;
  for (let i = 0; i < maxPages; i++) {
    const page = await graph('GET', path, token, { limit: 100, ...params, after });
    out.push(...(page.data || []));
    after = page.paging?.cursors?.after;
    if (!page.paging?.next || !after) break;
  }
  return out;
}

// ── Prelude user + stored connection ────────────────────────────────────────

export async function getUid(req) {
  const decoded = await verifyAuth(req);
  return decoded?.uid || decoded?.sub || 'anonymous';
}

// Created lazily too (mirrors db/schema.sql) so a database that hasn't had
// `npm run db:schema` re-run since this table was added still works.
let tableReady;
function ensureTable() {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS ad_platform_connections (
        user_id      text NOT NULL,
        platform     text NOT NULL,
        token_enc    text NOT NULL,
        token_type   text,
        expires_at   timestamptz,
        scopes       text[],
        meta_user_id text,
        selection    jsonb NOT NULL DEFAULT '{}'::jsonb,
        connected_at timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, platform)
      )
    `).catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

export async function loadConnection(uid) {
  await ensureTable();
  const row = await queryOne(
    `SELECT * FROM ad_platform_connections WHERE user_id = $1 AND platform = 'meta'`,
    [uid]
  );
  if (!row) return null;
  return { ...row, token: decryptToken(row.token_enc), selection: row.selection || {} };
}

/** A 4xx the client can act on: `code` says what to fix (open Ad Accounts, pick another post…). */
export function needs(code, message, extra = {}) {
  return Object.assign(new Error(message), { status: 409, code, ...extra });
}

/** Like loadConnection, but throws a 409 the client can act on when not ready. */
export async function requireConnection(uid) {
  if (!metaConfigured()) {
    throw needs('not_configured', 'Meta is not configured on the server (META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID).');
  }
  const conn = await loadConnection(uid);
  if (!conn) throw needs('not_connected', 'Connect your Meta account in Ad Accounts first.', { reconnect: true });
  if (conn.expires_at && new Date(conn.expires_at) <= new Date()) {
    throw needs('not_connected', 'Your Meta connection expired. Reconnect in Ad Accounts.', { reconnect: true });
  }
  return conn;
}

// ── Ad account per Instagram account ────────────────────────────────────────
// selection = { accountMap: { [igUserId]: { adAccountId, adAccountName, username } } }
// A user running campaigns for several artists assigns each artist's Instagram
// account to the ad account its boosts should run (and bill) in.

/** The ad account assigned to an Instagram account, or null. */
export function adAccountFor(selection, igUserId) {
  return selection?.accountMap?.[igUserId]?.adAccountId || null;
}

/** Every ad account this user has assigned to something. */
export function assignedAdAccounts(selection) {
  return new Set(Object.values(selection?.accountMap || {}).map(a => a.adAccountId));
}

/** The Instagram accounts (with their linked Page) this connection can boost from. */
export async function listInstagramAccounts(token) {
  const pages = await graphList('me/accounts', token, {
    fields: 'id,name,instagram_business_account{id,username,profile_picture_url}',
  });
  return pages
    .filter(p => p.instagram_business_account)
    .map(p => ({
      igUserId: p.instagram_business_account.id,
      username: p.instagram_business_account.username,
      imageUrl: p.instagram_business_account.profile_picture_url || null,
      pageId: p.id,
      pageName: p.name,
    }));
}

/** Instagram shortcode from a post URL (instagram.com/p/<code>/, /reel/<code>/, /tv/<code>/). */
export function shortcodeFrom(url) {
  return String(url || '').match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] || null;
}

/**
 * Find a post among the connected Instagram accounts. Our feed stores the
 * scraper's post id and the public permalink, not Meta's media id, so match by
 * shortcode against each account's recent media.
 * @returns {Promise<{mediaId, account, eligibility} | null>}
 */
export async function findInstagramPost(token, { permalink, postId }) {
  const accounts = await listInstagramAccounts(token);
  const code = shortcodeFrom(permalink);
  for (const account of accounts) {
    const media = await graphList(`${account.igUserId}/media`, token, { fields: 'id,shortcode,permalink' }, 3);
    const hit = media.find(m =>
      (code && (m.shortcode === code || shortcodeFrom(m.permalink) === code)) || (postId && m.id === String(postId))
    );
    if (hit) {
      const detail = await graph('GET', hit.id, token, { fields: 'id,boost_eligibility_info' });
      return { mediaId: hit.id, account, eligibility: detail.boost_eligibility_info || null };
    }
  }
  return null;
}

export async function saveConnection(uid, { token, tokenType, expiresAt, scopes, metaUserId }) {
  await ensureTable();
  await query(
    `INSERT INTO ad_platform_connections
       (user_id, platform, token_enc, token_type, expires_at, scopes, meta_user_id)
     VALUES ($1, 'meta', $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, platform) DO UPDATE SET
       token_enc = EXCLUDED.token_enc, token_type = EXCLUDED.token_type,
       expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes,
       meta_user_id = EXCLUDED.meta_user_id,
       -- a different Meta identity can't inherit the previous ad account choice
       selection = CASE WHEN ad_platform_connections.meta_user_id = EXCLUDED.meta_user_id
                        THEN ad_platform_connections.selection ELSE '{}'::jsonb END,
       updated_at = now()`,
    [uid, encryptToken(token), tokenType, expiresAt, scopes, metaUserId]
  );
}

export async function saveSelection(uid, selection) {
  await query(
    `UPDATE ad_platform_connections SET selection = $2, updated_at = now()
     WHERE user_id = $1 AND platform = 'meta'`,
    [uid, selection]
  );
}

export async function deleteConnection(uid) {
  await query(`DELETE FROM ad_platform_connections WHERE user_id = $1 AND platform = 'meta'`, [uid]);
}

// ── Request plumbing shared by the handlers ─────────────────────────────────

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export function sendError(res, err) {
  if (!err.status || err.status >= 500) console.error('[meta]', err.message, err.meta || '');
  return res.status(err.status || 500).json({
    error: err.message || 'Something went wrong',
    code: err.code || null,
    reconnect: !!err.reconnect,
    meta: err.meta,
  });
}

// ── Prelude-managed ads ─────────────────────────────────────────────────────
// accountMap[igUserId] = { managed: true, adAccountName, username } routes that Instagram
// account's new ads to Prelude's ad account. Managed entries carry no adAccountId, so
// assignedAdAccounts() never grants a user access to Prelude's account; each managed
// campaign is tied to the user who launched it in meta_managed_campaigns instead.

export const MANAGED_ACCOUNT_NAME = 'Prelude (managed)';

export function managedConfigured() {
  return !!(process.env.META_PRELUDE_AD_ACCOUNT_ID && process.env.META_PRELUDE_BUSINESS_ID && process.env.META_PRELUDE_TOKEN);
}

/** Prelude's own ad account and token, or a 409 when managed ads aren't set up. */
export function preludeAccount() {
  if (!managedConfigured()) {
    throw needs('managed_not_configured', 'Prelude-managed ads are not set up on the server yet.');
  }
  return {
    act: actId(process.env.META_PRELUDE_AD_ACCOUNT_ID),
    businessId: process.env.META_PRELUDE_BUSINESS_ID,
    token: process.env.META_PRELUDE_TOKEN,
  };
}

export const isManaged = (selection, igUserId) => !!selection?.accountMap?.[igUserId]?.managed;

export function isAdmin(uid) {
  const ids = String(process.env.PRELUDE_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !!uid && uid !== 'anonymous' && ids.includes(uid);
}

/**
 * Let Prelude advertise as an artist's Instagram account, using the artist's own token:
 * Prelude's business becomes an agency on their Page, and Prelude's ad account is
 * authorized to use their Instagram account. Prelude's system user is then given the
 * Page in Prelude's business. Throws a 409 with the manual steps if Meta refuses.
 */
export async function grantPreludeAccess(userToken, ig) {
  const { act, businessId, token } = preludeAccount();
  try {
    await graph('POST', `${ig.pageId}/agencies`, userToken, { business: businessId, permitted_tasks: ['ADVERTISE', 'ANALYZE'] });
    await graph('POST', `${ig.igUserId}/authorized_adaccounts`, userToken, { business: businessId, account_id: act.replace(/^act_/, '') });
  } catch (err) {
    throw needs('managed_access', `Meta didn't let Prelude advertise as @${ig.username} (${err.message}). In Meta Business Suite, open Settings → Partners, add Prelude's business ID ${businessId} as a partner, and give it access to the ${ig.pageName} Page and @${ig.username}. Then choose Prelude's ad account again.`);
  }
  // Prelude's side: its system user needs the Page assigned to build ads with it.
  const me = await graph('GET', 'me', token, { fields: 'id' }).catch(() => null);
  if (me?.id) {
    await graph('POST', `${ig.pageId}/assigned_users`, token, { user: me.id, tasks: ['ADVERTISE', 'ANALYZE'], business: businessId })
      .catch(err => console.warn('[meta] assigning page to Prelude system user failed', err.message));
  }
}

// Created lazily too (mirrors db/schema.sql).
let managedReady;
function ensureManagedTable() {
  if (!managedReady) {
    managedReady = query(`
      CREATE TABLE IF NOT EXISTS meta_managed_campaigns (
        campaign_id   text PRIMARY KEY,
        user_id       text NOT NULL,
        directive_id  text,
        artist_name   text,
        ig_user_id    text NOT NULL,
        ig_username   text,
        budget        numeric NOT NULL,
        budget_period text NOT NULL,
        start_date    date,
        end_date      date,
        review_status text NOT NULL DEFAULT 'draft',
        stripe_session_id text,
        paid_cents    integer,
        paid_at       timestamptz,
        requested_at  timestamptz,
        reviewed_by   text,
        reviewed_at   timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `).catch((err) => { managedReady = undefined; throw err; });
  }
  return managedReady;
}

export async function saveManagedCampaign(row) {
  await ensureManagedTable();
  await query(
    `INSERT INTO meta_managed_campaigns
       (campaign_id, user_id, directive_id, artist_name, ig_user_id, ig_username, budget, budget_period, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [row.campaignId, row.userId, row.directiveId, row.artistName, row.igUserId, row.igUsername, row.budget, row.period, row.startDate || null, row.endDate || null]
  );
}

export async function getManagedCampaign(campaignId) {
  await ensureManagedTable();
  return queryOne(`SELECT * FROM meta_managed_campaigns WHERE campaign_id = $1`, [String(campaignId)]);
}

/** review_status: draft → requested (admin review) or payment (Stripe checkout open) → approved | declined. */
export async function setManagedReview(campaignId, reviewStatus, reviewer = null) {
  await query(
    `UPDATE meta_managed_campaigns SET review_status = $2,
       requested_at = CASE WHEN $2 = 'requested' THEN now() ELSE requested_at END,
       reviewed_by = CASE WHEN $2 IN ('approved', 'declined') THEN $3 ELSE reviewed_by END,
       reviewed_at = CASE WHEN $2 IN ('approved', 'declined') THEN now() ELSE reviewed_at END
     WHERE campaign_id = $1`,
    [String(campaignId), reviewStatus, reviewer]
  );
}

export async function setManagedCheckout(campaignId, sessionId) {
  await query(`UPDATE meta_managed_campaigns SET stripe_session_id = $2, review_status = 'payment' WHERE campaign_id = $1`, [String(campaignId), sessionId]);
}

/** Record the payment once; true only for the call that recorded it (so one caller goes live). */
export async function markManagedPaid(campaignId, sessionId, cents) {
  const rows = await query(
    `UPDATE meta_managed_campaigns SET paid_at = now(), paid_cents = $3, stripe_session_id = $2,
       review_status = 'approved', reviewed_by = 'stripe', reviewed_at = now()
     WHERE campaign_id = $1 AND paid_at IS NULL RETURNING campaign_id`,
    [String(campaignId), sessionId, cents]
  );
  return rows.length > 0;
}

/** Turn on a paused campaign: its ad sets and ads were created paused too, and all three must be active. */
export async function activateCampaign(id, token) {
  const [adSets, ads] = await Promise.all([
    graphList(`${id}/adsets`, token, { fields: 'id' }),
    graphList(`${id}/ads`, token, { fields: 'id' }),
  ]);
  for (const obj of [...adSets, ...ads]) {
    await graph('POST', obj.id, token, { status: 'ACTIVE' });
  }
  await graph('POST', id, token, { status: 'ACTIVE' });
}

export async function listManagedReviews() {
  await ensureManagedTable();
  return query(`SELECT * FROM meta_managed_campaigns WHERE review_status = 'requested' ORDER BY requested_at`);
}

/** `act_123` form, from either `123` or `act_123`. */
export function actId(adAccountId) {
  const id = String(adAccountId || '').replace(/^act_/, '');
  if (!/^\d+$/.test(id)) throw Object.assign(new Error('Invalid ad account id'), { status: 400 });
  return `act_${id}`;
}
