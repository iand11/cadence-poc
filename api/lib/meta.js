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

/** `act_123` form, from either `123` or `act_123`. */
export function actId(adAccountId) {
  const id = String(adAccountId || '').replace(/^act_/, '');
  if (!/^\d+$/.test(id)) throw Object.assign(new Error('Invalid ad account id'), { status: 400 });
  return `act_${id}`;
}
