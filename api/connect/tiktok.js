// /api/connect/tiktok — connect a user's TikTok ad accounts (advertiser authorization).
//
//   GET                          → { configured, connected, advertisers, defaultAdvertiserId,
//                                    accountAuthAvailable, accounts } (accounts = artists' TikTok
//                                    accounts connected through /api/connect/tiktok-account)
//   GET ?identities=1&advertiserId= → { identities } TikTok accounts that ad account can run
//                                    ads as (linked in TikTok Ads Manager / Business Center)
//   GET ?auth_code=…&state=…     → advertiser authorization callback (browser redirect);
//                                    stores the token and redirects back to /app/campaigns
//   POST { action: 'start' }     → { url } of TikTok's advertiser authorization page
//   POST { action: 'default', advertiserId } → ad account used when a campaign names none
//   POST { action: 'spark-code', authCode, advertiserId? } → applies an artist's Spark Ads
//                                    authorization code to the ad account and returns the post
//   DELETE                       → forget the connection
import { getUid, readBody, sendError, signState, verifyState, needs } from '../lib/meta.js';
import {
  tiktokConfigured, accountAuthConfigured, tt, exchangeAdvertiserCode, listAdvertisers,
  loadConnection, saveConnection, saveSelection, deleteConnection, requireConnection, advertiserFor,
  publicAccounts, ADVERTISER_AUTH_URL,
} from '../lib/tiktok.js';

function redirectUri(req) {
  if (process.env.TIKTOK_REDIRECT_URI) return process.env.TIKTOK_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/connect/tiktok`;
}

function redirect(res, path) {
  res.statusCode = 302;
  res.setHeader('Location', path);
  res.end();
}

async function handleCallback(res, params) {
  const back = (status, reason) =>
    redirect(res, `/app/campaigns?tiktok=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);

  const state = verifyState(params.get('state'));
  if (!state) return back('error', 'The connection link expired. Try again.');
  const code = params.get('auth_code') || params.get('code');
  if (!code) return back('error', params.get('error_description') || 'TikTok authorization was cancelled.');

  try {
    const tokens = await exchangeAdvertiserCode(code);
    const advertisers = await listAdvertisers(tokens.access_token);
    await saveConnection(state.uid, {
      token: tokens.access_token,
      scopes: (tokens.scope || []).map(String),
      selection: { advertisers },
    });
    return back('connected');
  } catch (err) {
    console.error('[tiktok] callback failed', err.message, err.meta || '');
    return back('error', err.message);
  }
}

/** Resolve a creator's Spark Ads code to its post, and authorize that post for the ad account. */
async function applySparkCode(token, advertiserId, authCode) {
  const info = await tt('GET', 'tt_video/info/', token, { advertiser_id: advertiserId, auth_code: authCode });
  const item = info.item_info || {};
  if (!item.item_id) throw needs('spark_code_invalid', "TikTok didn't find a post for that code. Check it and try again.");
  const auth = info.auth_info || {};
  // Already applied to this ad account is fine; anything else is a real error
  try {
    await tt('POST', 'tt_video/authorize/', token, { advertiser_id: advertiserId, auth_code: authCode });
  } catch (err) {
    if (!/already|exist/i.test(err.message)) throw err;
  }
  return {
    itemId: String(item.item_id),
    identityId: info.user_info?.identity_id || null,
    identityType: info.user_info?.identity_type || 'AUTH_CODE',
    username: info.user_info?.tiktok_name || null,
    text: item.text || '',
    coverUrl: info.video_info?.poster_url || info.carousel_info?.image_info?.[0]?.image_url || null,
    authEnd: auth.auth_end_time || null,
  };
}

function shapeStatus(conn, accountsConn) {
  const common = {
    configured: tiktokConfigured(),
    accountAuthAvailable: accountAuthConfigured(),
    accounts: publicAccounts(accountsConn),
  };
  if (!conn) return { ...common, connected: false };
  return {
    ...common,
    connected: true,
    advertisers: conn.selection.advertisers || [],
    defaultAdvertiserId: advertiserFor(conn.selection)?.id || null,
    connectedAt: conn.connected_at,
  };
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;

  try {
    if (req.method === 'GET' && (params.has('auth_code') || params.has('code') || params.has('error'))) {
      return await handleCallback(res, params);
    }

    const uid = await getUid(req);

    if (req.method === 'GET') {
      if (params.get('identities')) {
        const conn = await requireConnection(uid);
        const advertiser = advertiserFor(conn.selection, params.get('advertiserId'));
        if (!advertiser) throw needs('no_ad_account', 'Choose which TikTok ad account to use.');
        const data = await tt('GET', 'identity/get/', conn.token, { advertiser_id: advertiser.id, page_size: 100 });
        const identities = (data.identity_list || data.list || [])
          .filter(i => i.identity_type === 'TT_USER' || i.identity_type === 'BC_AUTH_TT')
          .map(i => ({
            id: i.identity_id, type: i.identity_type, name: i.display_name || i.identity_id,
            imageUrl: i.profile_image || null, bcId: i.identity_authorized_bc_id || null,
          }));
        return res.status(200).json({ advertiserId: advertiser.id, identities });
      }
      const [conn, accountsConn] = await Promise.all([loadConnection(uid), loadConnection(uid, 'tiktok_account')]);
      return res.status(200).json(shapeStatus(conn, accountsConn));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);

      if (body.action === 'start') {
        if (!tiktokConfigured()) {
          return res.status(500).json({ error: 'TikTok is not configured on the server (TIKTOK_APP_ID, TIKTOK_APP_SECRET).' });
        }
        const url = new URL(ADVERTISER_AUTH_URL);
        url.searchParams.set('app_id', process.env.TIKTOK_APP_ID);
        url.searchParams.set('state', signState(uid));
        url.searchParams.set('redirect_uri', redirectUri(req));
        return res.status(200).json({ url: url.toString() });
      }

      if (body.action === 'default') {
        const conn = await requireConnection(uid);
        const advertiser = advertiserFor(conn.selection, body.advertiserId);
        if (!advertiser) return res.status(400).json({ error: 'That ad account is not part of this connection.' });
        const selection = { ...conn.selection, defaultAdvertiserId: advertiser.id };
        await saveSelection(uid, 'tiktok', selection);
        return res.status(200).json({ ok: true, defaultAdvertiserId: advertiser.id });
      }

      if (body.action === 'spark-code') {
        const conn = await requireConnection(uid);
        const authCode = String(body.authCode || '').trim();
        if (!authCode) return res.status(400).json({ error: 'Paste the Spark Ads code from TikTok.' });
        const advertiser = advertiserFor(conn.selection, body.advertiserId);
        if (!advertiser) throw needs('no_ad_account', 'Choose which TikTok ad account the ads run in (Ad Accounts).');
        const post = await applySparkCode(conn.token, advertiser.id, authCode);
        return res.status(200).json({ advertiserId: advertiser.id, post });
      }

      return res.status(400).json({ error: "action must be 'start', 'default' or 'spark-code'" });
    }

    if (req.method === 'DELETE') {
      await deleteConnection(uid);
      return res.status(200).json({ ok: true });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
