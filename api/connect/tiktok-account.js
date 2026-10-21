// /api/connect/tiktok-account — artists' TikTok accounts (TikTok account holder authorization).
// The redirect URL set for the TikTok app's "TikTok account holder redirect URL".
//
//   GET                       → { available, accounts } connected accounts (no tokens)
//   GET ?videos=<openId>      → { videos } that account's recent posts
//   GET ?code=…&state=…       → authorization callback (browser redirect); stores the account's
//                               tokens and profile, then redirects back to /app/campaigns
//   POST { action: 'start' }  → { url } of TikTok's sign-in page for the account holder
//   POST { action: 'refresh', openId } → re-reads the profile (follower count)
//   DELETE ?openId=           → revokes Prelude's access and forgets the account
import { getUid, readBody, sendError, signState, verifyState, decryptToken } from '../lib/meta.js';
import {
  accountAuthConfigured, tt, exchangeAccountCode, accountEntry, accountProfile, accountToken, saveAccount,
  loadConnection, saveSelection, publicAccounts,
} from '../lib/tiktok.js';

function redirectUri(req) {
  if (process.env.TIKTOK_ACCOUNT_REDIRECT_URI) return process.env.TIKTOK_ACCOUNT_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/connect/tiktok-account`;
}

function redirect(res, path) {
  res.statusCode = 302;
  res.setHeader('Location', path);
  res.end();
}

async function handleCallback(req, res, params) {
  const back = (status, reason) =>
    redirect(res, `/app/campaigns?tiktok=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);

  const state = verifyState(params.get('state'));
  if (!state) return back('error', 'The sign-in link expired. Try again.');
  if (!params.get('code')) return back('error', params.get('error_description') || 'TikTok sign-in was cancelled.');

  try {
    const tokens = await exchangeAccountCode(params.get('code'), redirectUri(req));
    const openId = String(tokens.open_id || tokens.creator_id || '');
    if (!openId) throw Object.assign(new Error('TikTok did not say which account signed in.'), { status: 502 });
    const profile = await accountProfile(tokens.access_token, openId).catch(() => null);
    const existing = (await loadConnection(state.uid, 'tiktok_account'))?.selection?.accounts?.[openId];
    await saveAccount(state.uid, openId, accountEntry(tokens, profile, existing));
    return back('account');
  } catch (err) {
    console.error('[tiktok] account callback failed', err.message, err.meta || '');
    return back('error', err.message);
  }
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;

  try {
    if (req.method === 'GET' && (params.has('code') || params.has('error'))) {
      return await handleCallback(req, res, params);
    }

    const uid = await getUid(req);
    const conn = await loadConnection(uid, 'tiktok_account');

    if (req.method === 'GET') {
      const openId = params.get('videos');
      if (openId) {
        const token = await accountToken(uid, conn, openId);
        const data = await tt('GET', 'business/video/list/', token, {
          business_id: openId,
          fields: ['item_id', 'create_time', 'thumbnail_url', 'share_url', 'caption', 'video_views', 'likes', 'comments', 'shares'],
          max_count: 20,
        });
        const videos = (data.videos || []).map(v => ({
          itemId: String(v.item_id), caption: v.caption || '', thumbnailUrl: v.thumbnail_url || null,
          url: v.share_url || null, createdAt: v.create_time || null,
          views: v.video_views ?? null, likes: v.likes ?? null, comments: v.comments ?? null, shares: v.shares ?? null,
        }));
        return res.status(200).json({ videos });
      }
      return res.status(200).json({ available: accountAuthConfigured(), accounts: publicAccounts(conn) });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);

      if (body.action === 'start') {
        if (!accountAuthConfigured()) {
          return res.status(500).json({ error: 'TikTok account sign-in is not configured on the server (TIKTOK_ACCOUNT_AUTH_URL).' });
        }
        // The app's own authorization URL (from the TikTok developer portal) carries its client
        // key, scopes and redirect; Prelude only adds which user the sign-in belongs to.
        const url = new URL(process.env.TIKTOK_ACCOUNT_AUTH_URL);
        url.searchParams.set('state', signState(uid));
        return res.status(200).json({ url: url.toString() });
      }

      if (body.action === 'refresh') {
        const openId = String(body.openId || '');
        const token = await accountToken(uid, conn, openId);
        const profile = await accountProfile(token, openId);
        const entry = { ...conn.selection.accounts[openId] };
        entry.username = profile.username || entry.username;
        entry.displayName = profile.display_name || entry.displayName;
        entry.imageUrl = profile.profile_image || entry.imageUrl;
        entry.followers = profile.followers_count ?? entry.followers;
        const selection = { ...conn.selection, accounts: { ...conn.selection.accounts, [openId]: entry } };
        await saveSelection(uid, 'tiktok_account', selection);
        return res.status(200).json({ accounts: publicAccounts({ selection }) });
      }

      return res.status(400).json({ error: "action must be 'start' or 'refresh'" });
    }

    if (req.method === 'DELETE') {
      const openId = params.get('openId');
      const entry = conn?.selection?.accounts?.[openId];
      if (!entry) return res.status(404).json({ error: 'That TikTok account is not connected.' });
      await tt('POST', 'tt_user/oauth2/revoke/', null, {
        client_id: process.env.TIKTOK_APP_ID,
        client_secret: process.env.TIKTOK_APP_SECRET,
        access_token: decryptToken(entry.tokenEnc),
      }).catch(err => console.warn('[tiktok] revoke failed', err.message));
      const accounts = { ...conn.selection.accounts };
      delete accounts[openId];
      await saveSelection(uid, 'tiktok_account', { ...conn.selection, accounts });
      return res.status(200).json({ ok: true });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
