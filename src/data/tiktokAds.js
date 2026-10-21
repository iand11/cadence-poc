// TikTok ads: ad account connection (/api/connect/tiktok), artists' TikTok accounts
// (/api/connect/tiktok-account), and launching Smart+ campaigns (/api/campaign/tiktok-launch,
// /api/campaign/tiktok-campaign). Tokens stay on the server.
import { request } from './metaAds';

/** @returns {Promise<{configured, connected, advertisers?, defaultAdvertiserId?, accountAuthAvailable, accounts}>} */
export const fetchTikTokConnection = () => request('/api/connect/tiktok');

/** Sends the browser to TikTok's advertiser authorization; TikTok redirects back to /app/campaigns?tiktok=… */
export async function startTikTokConnect() {
  const { url } = await request('/api/connect/tiktok', { method: 'POST', body: { action: 'start' } });
  window.location.assign(url);
}

/** An artist signs in with their TikTok account (account holder authorization). */
export async function startTikTokAccountConnect() {
  const { url } = await request('/api/connect/tiktok-account', { method: 'POST', body: { action: 'start' } });
  window.location.assign(url);
}

export const setDefaultTikTokAdvertiser = (advertiserId) =>
  request('/api/connect/tiktok', { method: 'POST', body: { action: 'default', advertiserId } });

export const disconnectTikTok = () => request('/api/connect/tiktok', { method: 'DELETE' });

export const disconnectTikTokAccount = (openId) =>
  request(`/api/connect/tiktok-account?openId=${encodeURIComponent(openId)}`, { method: 'DELETE' });

export const refreshTikTokAccount = (openId) =>
  request('/api/connect/tiktok-account', { method: 'POST', body: { action: 'refresh', openId } });

/** TikTok accounts the ad account can run new ads as. */
export const fetchTikTokIdentities = (advertiserId) =>
  request(`/api/connect/tiktok?identities=1${advertiserId ? `&advertiserId=${encodeURIComponent(advertiserId)}` : ''}`);

/** Apply an artist's Spark Ads code to the ad account. Returns { advertiserId, post: { itemId, username, text, coverUrl } }. */
export const applySparkCode = (authCode, advertiserId) =>
  request('/api/connect/tiktok', { method: 'POST', body: { action: 'spark-code', authCode, advertiserId } });

export const isTikTokDirective = (directive) => directive?.platform === 'tiktok';

/** Codes the user fixes in the Ad Accounts modal. */
export const TIKTOK_ACCOUNT_FIX_CODES = new Set(['not_configured', 'not_connected', 'no_ad_account']);

/** Checks a TikTok campaign can launch without creating anything. */
export const checkTikTokLaunch = (directive) =>
  request('/api/campaign/tiktok-launch', { method: 'POST', body: { directive, check: true } });

/** Creates the paused TikTok campaign for a directive. */
export const launchTikTokCampaign = (directive) =>
  request('/api/campaign/tiktok-launch', { method: 'POST', body: { directive } });

export const fetchTikTokCampaign = (directive) =>
  request(`/api/campaign/tiktok-campaign?id=${encodeURIComponent(directive.platformCampaignId)}&advertiserId=${encodeURIComponent(directive.advertiserId || '')}`);

/** status: 'ACTIVE' (go live) | 'PAUSED' */
export const setTikTokCampaignStatus = (directive, status) =>
  request('/api/campaign/tiktok-campaign', {
    method: 'POST',
    body: {
      id: directive.platformCampaignId, advertiserId: directive.advertiserId,
      adGroupId: directive.platformAdGroupId, adId: directive.platformAdId, status,
    },
  });
