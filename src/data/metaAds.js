// Meta ads: account connection (/api/connect/meta) and boost execution
// (/api/campaign/boost, /api/campaign/meta-campaign). Firebase-authed; the Meta
// token itself stays on the server.
import { getIdToken } from '../lib/firebase';

async function request(url, { method = 'GET', body } = {}) {
  const headers = {};
  const token = await getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.reconnect = !!data.reconnect;
    // not_configured | not_connected | post_not_found | no_ad_account | ineligible
    err.code = data.code || null;
    throw err;
  }
  return data;
}

/** @returns {Promise<{configured, connected, expired?, expiresAt?, selection?, adAccounts?, instagramAccounts?}>} */
export const fetchMetaConnection = ({ assets = false } = {}) =>
  request(`/api/connect/meta${assets ? '?assets=1' : ''}`);

/** Sends the browser to Meta's login dialog; Meta redirects back to /app/campaigns?meta=… */
export async function startMetaConnect() {
  const { url } = await request('/api/connect/meta', { method: 'POST', body: { action: 'start' } });
  window.location.assign(url);
}

/** Set the ad account an Instagram account's boosts run in (null to unassign). */
export const assignMetaAdAccount = (igUserId, adAccountId) =>
  request('/api/connect/meta', { method: 'POST', body: { action: 'assign', igUserId, adAccountId } });

export const disconnectMeta = () => request('/api/connect/meta', { method: 'DELETE' });

/**
 * Checks a boost can launch (Meta connected, the post's Instagram account shared and
 * assigned to an ad account, post eligible) without creating anything.
 * @returns {Promise<{ready: true, igUsername, adAccountId, adAccountName}>} — throws with err.code otherwise
 */
export const checkMetaBoost = (directive) =>
  request('/api/campaign/boost', { method: 'POST', body: { directive, check: true } });

/** True for a directive that boosts an Instagram post on Meta (runs for real, never simulated). */
export const isMetaPostBoost = (directive) =>
  directive?.platform === 'meta' && !!directive.creative?.postId;

/** Codes the user fixes in the Ad Accounts modal. */
export const ACCOUNT_FIX_CODES = new Set(['not_connected', 'post_not_found', 'no_ad_account']);

/** Creates the paused Meta campaign for a directive that boosts an Instagram post. */
export const createMetaBoost = (directive) =>
  request('/api/campaign/boost', { method: 'POST', body: { directive } });

export const fetchMetaCampaign = (id) =>
  request(`/api/campaign/meta-campaign?id=${encodeURIComponent(id)}`);

/** status: 'ACTIVE' (go live) | 'PAUSED' */
export const setMetaCampaignStatus = (id, status) =>
  request('/api/campaign/meta-campaign', { method: 'POST', body: { id, status } });
