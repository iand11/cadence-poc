// /api/connect/meta — connect a user's Meta business (Facebook Login for Business).
//
//   GET                      → connection status { configured, connected, expiresAt, selection, ... }
//   GET ?assets=1            → + { adAccounts, instagramAccounts } the connection can use
//   GET ?code=…&state=…      → OAuth callback from Meta (browser redirect, no bearer token);
//                              stores the token and redirects back to /app/campaigns
//   POST { action: 'start' } → { url } of the Meta login dialog
//   POST { action: 'assign', igUserId, adAccountId } → set which ad account that
//                            Instagram account's boosts run in (adAccountId null = unassign)
//   DELETE                   → forget the connection
import {
  metaConfigured, signState, verifyState, graph, graphList, getUid, loadConnection,
  saveConnection, saveSelection, deleteConnection, readBody, sendError, actId, GRAPH_VERSION,
  listInstagramAccounts,
} from '../lib/meta.js';

function redirectUri(req) {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/connect/meta`;
}

function redirect(res, path) {
  res.statusCode = 302;
  res.setHeader('Location', path);
  res.end();
}

async function handleCallback(req, res, params) {
  const back = (status, reason) =>
    redirect(res, `/app/campaigns?meta=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);

  const state = verifyState(params.get('state'));
  if (!state) return back('error', 'The connection link expired. Try again.');
  if (params.get('error')) return back('error', params.get('error_description') || 'Meta login was cancelled.');

  try {
    const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
    const exchanged = await graph('GET', 'oauth/access_token', null, {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: redirectUri(req),
      code: params.get('code'),
    });
    let token = exchanged.access_token;
    let info = (await graph('GET', 'debug_token', null, { input_token: token, access_token: appToken })).data || {};

    // A system-user login config returns a token that never expires (expires_at 0).
    // A plain user token is short-lived — swap it for the ~60-day one.
    if (info.expires_at && info.type === 'USER') {
      const long = await graph('GET', 'oauth/access_token', null, {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: token,
      });
      token = long.access_token;
      info = (await graph('GET', 'debug_token', null, { input_token: token, access_token: appToken })).data || {};
    }

    await saveConnection(state.uid, {
      token,
      tokenType: info.type === 'SYSTEM_USER' ? 'system_user' : 'user',
      expiresAt: info.expires_at ? new Date(info.expires_at * 1000) : null,
      scopes: info.scopes || [],
      metaUserId: info.user_id || null,
    });
    return back('connected');
  } catch (err) {
    console.error('[meta] callback failed', err.message, err.meta || '');
    return back('error', err.message);
  }
}

async function listAssets(token) {
  const [adAccounts, instagramAccounts] = await Promise.all([
    graphList('me/adaccounts', token, { fields: 'id,account_id,name,account_status,currency,business{id,name}' }),
    listInstagramAccounts(token),
  ]);
  return {
    adAccounts: adAccounts.map(a => ({
      id: a.id, name: a.name, currency: a.currency,
      // 1 = active; anything else (disabled, unsettled, closed…) can't run ads
      active: a.account_status === 1,
      business: a.business?.name || null,
    })),
    instagramAccounts,
  };
}

function shapeStatus(conn) {
  if (!conn) return { configured: metaConfigured(), connected: false };
  const expired = !!(conn.expires_at && new Date(conn.expires_at) <= new Date());
  return {
    configured: metaConfigured(),
    connected: !expired,
    expired,
    tokenType: conn.token_type,
    expiresAt: conn.expires_at,
    scopes: conn.scopes || [],
    selection: conn.selection,
    connectedAt: conn.connected_at,
  };
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;

  try {
    if (req.method === 'GET' && (params.has('code') || params.has('error'))) {
      return await handleCallback(req, res, params);
    }

    const uid = await getUid(req);

    if (req.method === 'GET') {
      const conn = await loadConnection(uid);
      const status = shapeStatus(conn);
      if (params.get('assets') && status.connected) Object.assign(status, await listAssets(conn.token));
      return res.status(200).json(status);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);

      if (body.action === 'start') {
        if (!metaConfigured()) {
          return res.status(500).json({ error: 'Meta is not configured on the server (META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID).' });
        }
        const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
        url.searchParams.set('client_id', process.env.META_APP_ID);
        url.searchParams.set('config_id', process.env.META_LOGIN_CONFIG_ID);
        url.searchParams.set('redirect_uri', redirectUri(req));
        url.searchParams.set('state', signState(uid));
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('override_default_response_type', 'true');
        return res.status(200).json({ url: url.toString() });
      }

      if (body.action === 'assign') {
        const conn = await loadConnection(uid);
        if (!conn) return res.status(409).json({ error: 'Connect a Meta account first.', reconnect: true });
        const { adAccounts, instagramAccounts } = await listAssets(conn.token);
        const ig = instagramAccounts.find(a => a.igUserId === String(body.igUserId));
        if (!ig) return res.status(400).json({ error: 'That Instagram account is not shared with Prelude.' });

        const accountMap = { ...(conn.selection.accountMap || {}) };
        if (body.adAccountId) {
          const account = adAccounts.find(a => a.id === actId(body.adAccountId));
          if (!account) return res.status(400).json({ error: 'That ad account is not available to this connection.' });
          if (!account.active) return res.status(400).json({ error: `${account.name} can't run ads right now (check its status in Meta).` });
          accountMap[ig.igUserId] = { adAccountId: account.id, adAccountName: account.name, currency: account.currency, username: ig.username };
        } else {
          delete accountMap[ig.igUserId];
        }
        const selection = { ...conn.selection, accountMap };
        await saveSelection(uid, selection);
        return res.status(200).json({ ok: true, selection });
      }

      return res.status(400).json({ error: "action must be 'start' or 'assign'" });
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
