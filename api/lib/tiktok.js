// TikTok Marketing API helpers shared by api/connect/tiktok*.js and the
// api/campaign/tiktok-* execution endpoints.
//
// Two connections per Prelude user, both stored in ad_platform_connections:
//   • platform 'tiktok'         — the advertiser authorization (TikTok Ads Manager ad accounts).
//                                 Ads run, and bill, in those ad accounts.
//   • platform 'tiktok_account' — TikTok accounts (artists) that signed in through the
//                                 "TikTok account holder" authorization. Each account's
//                                 tokens live encrypted in `selection.accounts`.
// Tokens never reach the browser.
//
// Endpoints and fields follow TikTok's official SDK (github.com/tiktok/tiktok-business-api-sdk,
// v1.3) and, for /tt_user/* and /business/*, the maintained python-tiktok wrapper. TikTok's own
// docs pages could not be read when this was written, so enum values are the documented
// legacy ones; check them against the sandbox.
//
// Env:
//   TIKTOK_APP_ID, TIKTOK_APP_SECRET — the Marketing API app ("Prelude Ads")
//   TIKTOK_ACCOUNT_AUTH_URL         — the app's "TikTok account holder" authorization URL, copied
//                                     from My Apps → app → Basic information (optional; without
//                                     it artists can't sign in, ads still work)
//   TIKTOK_REDIRECT_URI             — optional; defaults to <origin>/api/connect/tiktok
//   TIKTOK_ACCOUNT_REDIRECT_URI     — optional; defaults to <origin>/api/connect/tiktok-account
//   TIKTOK_API_URL                  — optional API base override (sandbox or a local mock)
//   AD_TOKEN_KEY                    — secret used to encrypt stored tokens (shared with Meta)
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { encryptToken, decryptToken, ensureTable, needs } from './meta.js';

const API = (process.env.TIKTOK_API_URL || 'https://business-api.tiktok.com/open_api/v1.3').replace(/\/$/, '');
export const ADVERTISER_AUTH_URL = 'https://business-api.tiktok.com/portal/auth';

export function tiktokConfigured() {
  return !!(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET);
}

export function accountAuthConfigured() {
  return tiktokConfigured() && !!process.env.TIKTOK_ACCOUNT_AUTH_URL;
}

function apiError(body, status) {
  const err = new Error(body?.message || `TikTok API error (${status})`);
  err.status = status >= 500 ? 502 : 400;
  err.meta = { code: body?.code, requestId: body?.request_id };
  // TikTok answers HTTP 200 with the error in the body; an invalid or revoked token
  // means the user has to connect again
  if (/access[ _-]?token/i.test(body?.message || '')) err.reconnect = true;
  return err;
}

/**
 * Call the Marketing API. GET params go in the query string (objects as JSON), POST params
 * as a JSON body. Returns `data`.
 */
export async function tt(method, path, token, params = {}) {
  const url = new URL(`${API}/${path.replace(/^\//, '')}`);
  const headers = {};
  if (token) headers['Access-Token'] = token;
  let body;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(params);
  }
  const res = await fetch(url, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw apiError(json, res.ok ? 400 : res.status);
  return json.data || {};
}

/** Multipart upload (ad videos). Same error handling as `tt`. */
export async function ttUpload(path, token, fields, fileField, buffer, filename) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) form.set(k, String(v));
  }
  form.set(fileField, new Blob([buffer]), filename);
  const res = await fetch(`${API}/${path.replace(/^\//, '')}`, { method: 'POST', headers: { 'Access-Token': token }, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw apiError(json, res.ok ? 400 : res.status);
  return json.data || {};
}

// ── Advertiser connection ───────────────────────────────────────────────────

/** Exchange the advertiser authorization's auth_code; returns the long-lived access token. */
export async function exchangeAdvertiserCode(authCode) {
  const data = await tt('POST', 'oauth2/access_token/', null, {
    app_id: process.env.TIKTOK_APP_ID,
    secret: process.env.TIKTOK_APP_SECRET,
    auth_code: authCode,
  });
  if (!data.access_token) throw Object.assign(new Error('TikTok did not return an access token.'), { status: 502 });
  return data;
}

/** The ad accounts the advertiser authorization covers, with currency and status when TikTok gives them. */
export async function listAdvertisers(token) {
  const data = await tt('GET', 'oauth2/advertiser/get/', token, {
    app_id: process.env.TIKTOK_APP_ID,
    secret: process.env.TIKTOK_APP_SECRET,
  });
  const list = (data.list || []).map(a => ({ id: String(a.advertiser_id), name: a.advertiser_name || String(a.advertiser_id) }));
  if (!list.length) return list;
  try {
    const info = await tt('GET', 'advertiser/info/', token, { advertiser_ids: list.map(a => a.id) });
    const byId = new Map((info.list || []).map(i => [String(i.advertiser_id), i]));
    return list.map(a => {
      const i = byId.get(a.id);
      return { ...a, name: i?.name || a.name, currency: i?.currency || null, status: i?.status || null };
    });
  } catch {
    return list;
  }
}

export async function loadConnection(uid, platform = 'tiktok') {
  await ensureTable();
  const row = await queryOne(
    `SELECT * FROM ad_platform_connections WHERE user_id = $1 AND platform = $2`,
    [uid, platform]
  );
  if (!row) return null;
  const token = platform === 'tiktok' ? decryptToken(row.token_enc) : null;
  return { ...row, token, selection: row.selection || {} };
}

export async function saveConnection(uid, { token, scopes, selection }) {
  await ensureTable();
  await query(
    `INSERT INTO ad_platform_connections (user_id, platform, token_enc, token_type, scopes, selection)
     VALUES ($1, 'tiktok', $2, 'advertiser', $3, $4)
     ON CONFLICT (user_id, platform) DO UPDATE SET
       token_enc = EXCLUDED.token_enc, scopes = EXCLUDED.scopes,
       selection = ad_platform_connections.selection || EXCLUDED.selection,
       expires_at = NULL, updated_at = now()`,
    [uid, encryptToken(token), scopes, selection]
  );
}

export async function saveSelection(uid, platform, selection) {
  await query(
    `UPDATE ad_platform_connections SET selection = $3, updated_at = now() WHERE user_id = $1 AND platform = $2`,
    [uid, platform, selection]
  );
}

export async function deleteConnection(uid, platform = 'tiktok') {
  await query(`DELETE FROM ad_platform_connections WHERE user_id = $1 AND platform = $2`, [uid, platform]);
}

/** Like loadConnection, but throws a 409 the client can act on when TikTok isn't ready. */
export async function requireConnection(uid) {
  if (!tiktokConfigured()) {
    throw needs('not_configured', 'TikTok is not configured on the server (TIKTOK_APP_ID, TIKTOK_APP_SECRET).');
  }
  const conn = await loadConnection(uid);
  if (!conn) throw needs('not_connected', 'Connect your TikTok ad account in Ad Accounts first.', { reconnect: true });
  return conn;
}

/** The ad account a campaign runs in: the one it names, else the default, else the only one. */
export function advertiserFor(selection, requested) {
  const advertisers = selection?.advertisers || [];
  if (requested) return advertisers.find(a => a.id === String(requested)) || null;
  if (selection?.defaultAdvertiserId) {
    const def = advertisers.find(a => a.id === selection.defaultAdvertiserId);
    if (def) return def;
  }
  return advertisers.length === 1 ? advertisers[0] : null;
}

// ── TikTok accounts (account holder authorization) ──────────────────────────
// selection.accounts[openId] = { tokenEnc, refreshEnc, expiresAt, refreshExpiresAt,
//                                username, displayName, imageUrl, followers, connectedAt }

const ACCOUNT_FIELDS = ['username', 'display_name', 'profile_image', 'followers_count'];

export async function exchangeAccountCode(code, redirectUri) {
  const data = await tt('POST', 'tt_user/oauth2/token/', null, {
    client_id: process.env.TIKTOK_APP_ID,
    client_secret: process.env.TIKTOK_APP_SECRET,
    grant_type: 'authorization_code',
    auth_code: code,
    redirect_uri: redirectUri,
  });
  if (!data.access_token) throw Object.assign(new Error('TikTok did not return an access token.'), { status: 502 });
  return data;
}

const inSeconds = (s) => (s ? new Date(Date.now() + Number(s) * 1000).toISOString() : null);

/** Stored account entry from a token response (+ profile). */
export function accountEntry(tokens, profile, previous = {}) {
  return {
    ...previous,
    tokenEnc: encryptToken(tokens.access_token),
    refreshEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : previous.refreshEnc || null,
    expiresAt: inSeconds(tokens.expires_in),
    refreshExpiresAt: inSeconds(tokens.refresh_token_expires_in) || previous.refreshExpiresAt || null,
    username: profile?.username || previous.username || null,
    displayName: profile?.display_name || previous.displayName || null,
    imageUrl: profile?.profile_image || previous.imageUrl || null,
    followers: profile?.followers_count ?? previous.followers ?? null,
    connectedAt: previous.connectedAt || new Date().toISOString(),
  };
}

export async function accountProfile(token, openId) {
  return tt('GET', 'business/get/', token, { business_id: openId, fields: ACCOUNT_FIELDS });
}

/**
 * A usable access token for a connected TikTok account. Access tokens last a day; the
 * refresh token (a year) renews them, and the new pair is saved.
 */
export async function accountToken(uid, conn, openId) {
  const entry = conn?.selection?.accounts?.[openId];
  if (!entry) throw needs('account_not_connected', 'That TikTok account is not connected to Prelude.');
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() > Date.now() + 60_000) return decryptToken(entry.tokenEnc);
  if (!entry.refreshEnc || (entry.refreshExpiresAt && new Date(entry.refreshExpiresAt) <= new Date())) {
    throw needs('account_expired', `@${entry.username || 'This account'} needs to sign in to TikTok again.`, { reconnect: true });
  }
  const tokens = await tt('POST', 'tt_user/oauth2/refresh_token/', null, {
    client_id: process.env.TIKTOK_APP_ID,
    client_secret: process.env.TIKTOK_APP_SECRET,
    grant_type: 'refresh_token',
    refresh_token: decryptToken(entry.refreshEnc),
  });
  const accounts = { ...conn.selection.accounts, [openId]: accountEntry(tokens, null, entry) };
  conn.selection = { ...conn.selection, accounts };
  await saveSelection(uid, 'tiktok_account', conn.selection);
  return tokens.access_token;
}

export async function saveAccount(uid, openId, entry) {
  await ensureTable();
  // One row per user holds every artist account they connected; token_enc is unused here
  await query(
    `INSERT INTO ad_platform_connections (user_id, platform, token_enc, token_type, selection)
     VALUES ($1, 'tiktok_account', '-', 'tt_user', jsonb_build_object('accounts', jsonb_build_object($2::text, $3::jsonb)))
     ON CONFLICT (user_id, platform) DO UPDATE SET
       selection = jsonb_set(
         ad_platform_connections.selection,
         '{accounts}',
         COALESCE(ad_platform_connections.selection->'accounts', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb)
       ),
       updated_at = now()`,
    [uid, openId, entry]
  );
}

/** Connected accounts as the browser sees them (no tokens). */
export function publicAccounts(conn) {
  return Object.entries(conn?.selection?.accounts || {}).map(([openId, a]) => ({
    openId,
    username: a.username,
    displayName: a.displayName,
    imageUrl: a.imageUrl,
    followers: a.followers,
    connectedAt: a.connectedAt,
    expired: !!(a.refreshExpiresAt && new Date(a.refreshExpiresAt) <= new Date()),
  }));
}

// ── Targeting ───────────────────────────────────────────────────────────────

// TikTok location_ids for countries are GeoNames ids. Our codes are ISO alpha-2 (UK = GB).
export const COUNTRY_LOCATION_IDS = {
  US: '6252001', GB: '2635167', UK: '2635167', CA: '6251999', AU: '2077456', DE: '2921044',
  FR: '3017382', BR: '3469034', MX: '3996063', JP: '1861060', KR: '1835841', IE: '2963597',
  NZ: '2186224', ES: '2510769', IT: '3175395', NL: '2750405', SE: '2661886',
};

const AGE_BUCKETS = [
  ['AGE_18_24', 18, 24], ['AGE_25_34', 25, 34], ['AGE_35_44', 35, 44], ['AGE_45_54', 45, 54], ['AGE_55_100', 55, 100],
];

/** TikTok age groups overlapping [min, max] (adults only). */
export function ageGroups([min = 18, max = 65] = []) {
  const lo = Math.max(18, Number(min) || 18);
  const hi = Number(max) || 65;
  return AGE_BUCKETS.filter(([, a, b]) => b >= lo && a <= hi).map(([key]) => key);
}

/** Unique request id Smart+ create calls require (makes retries idempotent). */
export const requestId = () => `${Date.now()}${crypto.randomInt(100000, 999999)}`;

/** Item id from a TikTok post URL (tiktok.com/@user/video/<id> or /photo/<id>), or the id itself. */
export function itemIdFrom(value) {
  const s = String(value || '').trim();
  if (/^\d{8,}$/.test(s)) return s;
  const m = s.match(/tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i);
  return m ? m[1] : null;
}
