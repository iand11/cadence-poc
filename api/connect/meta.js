// /api/connect/meta — connect artists' Meta assets for Instagram ads.
//
// Partner access (default, see api/lib/meta-partner.js) — the artist shares their Page and
// optionally their ad account with Prelude's business; no Meta login:
//   GET                      → { mode: 'partner', configured, businessId, connected, selection, … }
//   GET ?assets=1            → + picks up approvals, then { pages, adAccounts, adAccountRequests,
//                              instagramAccounts }
//   POST { action: 'add_page', page }             → request access to a Page (URL or id)
//   POST { action: 'add_ad_account', adAccountId } → request access to an ad account
//   POST { action: 'remove', pageId | adAccountId } → forget it and withdraw Prelude's access
//   POST { action: 'assign', … }                   → same as below
//   DELETE                   → forget everything this user shared
//
// Facebook Login for Business (META_FACEBOOK_LOGIN=on):
//   GET                      → connection status { configured, connected, expiresAt, selection, ... }
//   GET ?assets=1            → + { adAccounts, instagramAccounts } the connection can use
//   GET ?code=…&state=…      → OAuth callback from Meta (browser redirect, no bearer token);
//                              stores the token and redirects back to /app/campaigns
//   POST { action: 'start' } → { url } of the Meta login dialog
//   POST { action: 'assign', igUserId, adAccountId } → set which ad account that
//                            Instagram account's boosts run in (adAccountId null = unassign;
//                            'prelude' + consent: true = Prelude-managed: new ads run in Prelude's
//                            ad account and Prelude is granted access to advertise as that account;
//                            unassigning a managed account withdraws that access)
//   DELETE                   → forget the connection
import {
  metaConfigured, signState, verifyState, graph, graphList, getUid, loadConnection,
  saveConnection, saveSelection, deleteConnection, readBody, sendError, actId, GRAPH_VERSION,
  listInstagramAccounts, managedConfigured, grantPreludeAccess, revokePreludeAccess, isAdmin, MANAGED_ACCOUNT_NAME,
  loginEnabled, preludeAccount,
} from '../lib/meta.js';
import { prepayEnabled } from '../lib/stripe.js';
import {
  partnerConfigured, preludeBusiness, addPartnerPage, addPartnerAdAccount, syncPartnerAssets, partnerAssets,
  savePartnerSelection, grantManagedPartner, revokeManagedPartner, removePartnerAsset,
} from '../lib/meta-partner.js';

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

function shapeStatus(conn, uid) {
  // Shown with or without a connection: managed ads still need the artist's Instagram shared
  const common = {
    mode: 'login',
    configured: metaConfigured(),
    managedAvailable: managedConfigured(),
    managedPrepay: prepayEnabled(),
    isAdmin: isAdmin(uid),
  };
  if (!conn) return { ...common, connected: false };
  const expired = !!(conn.expires_at && new Date(conn.expires_at) <= new Date());
  return {
    ...common,
    connected: !expired,
    expired,
    tokenType: conn.token_type,
    expiresAt: conn.expires_at,
    scopes: conn.scopes || [],
    selection: conn.selection,
    connectedAt: conn.connected_at,
  };
}

// ── Partner access ──────────────────────────────────────────────────────────

/**
 * Same assign semantics as Facebook Login, against the user's shared assets: an Instagram
 * account runs ads in a shared ad account, in Prelude's (managed), or nowhere (null).
 */
async function partnerAssign(uid, body) {
  const assets = await partnerAssets(uid);
  const ig = assets.instagramAccounts.find(a => a.igUserId === String(body.igUserId));
  if (!ig) throw Object.assign(new Error("That Instagram account isn't shared with Prelude yet."), { status: 400 });

  const accountMap = { ...(assets.selection.accountMap || {}) };
  const wasManaged = !!accountMap[ig.igUserId]?.managed;
  if (body.adAccountId === 'prelude') {
    if (!managedConfigured()) return { status: 400, error: 'Prelude-managed ads are not set up on the server yet.' };
    if (body.consent !== true) return { status: 400, error: 'Confirm that Prelude may run ads for this account.' };
    if (!wasManaged) await grantManagedPartner(ig, preludeAccount().act);
    accountMap[ig.igUserId] = {
      managed: true, adAccountName: MANAGED_ACCOUNT_NAME, username: ig.username, grantedAt: new Date().toISOString(),
    };
  } else if (body.adAccountId) {
    const account = assets.adAccounts.find(a => a.id === actId(body.adAccountId));
    if (!account || account.status !== 'active') return { status: 400, error: "That ad account isn't shared with Prelude yet." };
    if (!account.active) return { status: 400, error: `${account.name} can't run ads right now (check its status in Meta).` };
    accountMap[ig.igUserId] = { adAccountId: account.id, adAccountName: account.name, currency: account.currency, username: ig.username };
  } else {
    delete accountMap[ig.igUserId];
  }
  if (wasManaged && !accountMap[ig.igUserId]?.managed) await revokeManagedPartner(ig, preludeAccount().act);
  const selection = { ...assets.selection, accountMap };
  await savePartnerSelection(uid, selection);
  return { status: 200, selection };
}

/** Drop accountMap entries that point at a removed Page's Instagram account or a removed ad account. */
async function forgetInSelection(uid, { igUserId, adAccountId }) {
  const { selection } = await partnerAssets(uid);
  const accountMap = { ...(selection.accountMap || {}) };
  for (const [ig, entry] of Object.entries(accountMap)) {
    if ((igUserId && ig === igUserId) || (adAccountId && entry.adAccountId === adAccountId)) {
      if (entry.managed && managedConfigured()) {
        await revokeManagedPartner({ igUserId: ig, username: entry.username }, preludeAccount().act);
      }
      delete accountMap[ig];
    }
  }
  await savePartnerSelection(uid, { ...selection, accountMap });
}

async function partnerHandler(req, res, uid, params) {
  const common = {
    mode: 'partner',
    configured: partnerConfigured(),
    businessId: process.env.META_PRELUDE_BUSINESS_ID || null,
    managedAvailable: managedConfigured(),
    managedPrepay: prepayEnabled(),
    isAdmin: isAdmin(uid),
  };

  if (req.method === 'GET') {
    if (!common.configured) return res.status(200).json({ ...common, connected: false });
    if (params.get('assets')) await syncPartnerAssets(uid);
    const assets = await partnerAssets(uid);
    const connected = assets.instagramAccounts.length > 0;
    const out = { ...common, connected, selection: assets.selection, pending: assets.pages.some(p => p.status !== 'active') };
    return res.status(200).json(params.get('assets') ? { ...out, ...assets } : out);
  }

  if (req.method === 'POST') {
    preludeBusiness(); // 409 not_configured when partner access isn't set up
    const body = await readBody(req);
    if (body.action === 'add_page') {
      const page = await addPartnerPage(uid, body.page);
      return res.status(200).json({ ok: true, page: { pageId: page.page_id, status: page.status, error: page.last_error || null } });
    }
    if (body.action === 'add_ad_account') {
      const row = await addPartnerAdAccount(uid, body.adAccountId);
      return res.status(200).json({ ok: true, adAccount: { id: row.ad_account_id, status: row.status, error: row.last_error || null } });
    }
    if (body.action === 'remove') {
      const removed = await removePartnerAsset(uid, { pageId: body.pageId, adAccountId: body.adAccountId });
      if (!removed) return res.status(404).json({ error: 'Not found' });
      await forgetInSelection(uid, { igUserId: removed.ig_user_id || null, adAccountId: removed.ad_account_id || null });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'assign') {
      const { status, error, selection } = await partnerAssign(uid, body);
      return status === 200 ? res.status(200).json({ ok: true, selection }) : res.status(status).json({ error });
    }
    return res.status(400).json({ error: "action must be 'add_page', 'add_ad_account', 'remove' or 'assign'" });
  }

  if (req.method === 'DELETE') {
    preludeBusiness();
    const assets = await partnerAssets(uid);
    for (const p of assets.pages) {
      const removed = await removePartnerAsset(uid, { pageId: p.pageId });
      if (removed) await forgetInSelection(uid, { igUserId: removed.ig_user_id || null });
    }
    for (const a of assets.adAccountRequests) await removePartnerAsset(uid, { adAccountId: a.id });
    await savePartnerSelection(uid, {});
    return res.status(200).json({ ok: true });
  }

  res.statusCode = 405;
  return res.end();
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;

  try {
    if (!loginEnabled()) {
      if (req.method === 'GET' && (params.has('code') || params.has('error'))) {
        return redirect(res, '/app/campaigns?meta=error&reason=' + encodeURIComponent('Facebook Login is switched off. Add the artist\'s Page in Ad Accounts instead.'));
      }
      return await partnerHandler(req, res, await getUid(req), params);
    }

    if (req.method === 'GET' && (params.has('code') || params.has('error'))) {
      return await handleCallback(req, res, params);
    }

    const uid = await getUid(req);

    if (req.method === 'GET') {
      const conn = await loadConnection(uid);
      const status = shapeStatus(conn, uid);
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
        const wasManaged = !!accountMap[ig.igUserId]?.managed;
        if (body.adAccountId === 'prelude') {
          if (!managedConfigured()) return res.status(400).json({ error: 'Prelude-managed ads are not set up on the server yet.' });
          if (body.consent !== true) return res.status(400).json({ error: 'Confirm that Prelude may run ads for this account.' });
          await grantPreludeAccess(conn.token, ig);
          accountMap[ig.igUserId] = {
            managed: true, adAccountName: MANAGED_ACCOUNT_NAME, username: ig.username, grantedAt: new Date().toISOString(),
          };
        } else if (body.adAccountId) {
          const account = adAccounts.find(a => a.id === actId(body.adAccountId));
          if (!account) return res.status(400).json({ error: 'That ad account is not available to this connection.' });
          if (!account.active) return res.status(400).json({ error: `${account.name} can't run ads right now (check its status in Meta).` });
          accountMap[ig.igUserId] = { adAccountId: account.id, adAccountName: account.name, currency: account.currency, username: ig.username };
        } else {
          delete accountMap[ig.igUserId];
        }
        // Stopping Prelude-managed ads also withdraws Prelude's access on Meta
        if (wasManaged && !accountMap[ig.igUserId]?.managed) await revokePreludeAccess(conn.token, ig);
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
