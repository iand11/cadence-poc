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
//   AD_TOKEN_KEY                   — secret used to encrypt stored tokens
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { verifyAuth } from './auth.js';

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
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

export function signState(uid) {
  const data = Buffer.from(JSON.stringify({
    uid, n: crypto.randomBytes(8).toString('hex'), exp: Date.now() + STATE_TTL_MS,
  })).toString('base64url');
  const mac = crypto.createHmac('sha256', secretKey()).update(data).digest('base64url');
  return `${data}.${mac}`;
}

export function verifyState(state) {
  if (!state || !state.includes('.')) return null;
  const [data, mac] = state.split('.');
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

export async function loadConnection(uid) {
  const row = await queryOne(
    `SELECT * FROM ad_platform_connections WHERE user_id = $1 AND platform = 'meta'`,
    [uid]
  );
  if (!row) return null;
  return { ...row, token: decryptToken(row.token_enc), selection: row.selection || {} };
}

/** Like loadConnection, but throws a 409 the client can act on when not ready. */
export async function requireConnection(uid) {
  const conn = await loadConnection(uid);
  if (!conn) throw Object.assign(new Error('Connect a Meta account first.'), { status: 409, reconnect: true });
  if (conn.expires_at && new Date(conn.expires_at) <= new Date()) {
    throw Object.assign(new Error('Your Meta connection expired. Reconnect to continue.'), { status: 409, reconnect: true });
  }
  if (!conn.selection.adAccountId) {
    throw Object.assign(new Error('Choose an ad account in Ad Accounts first.'), { status: 409 });
  }
  return conn;
}

export async function saveConnection(uid, { token, tokenType, expiresAt, scopes, metaUserId }) {
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
