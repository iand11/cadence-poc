// Meta partner access: the default way artists connect while Facebook Login is switched off
// (META_FACEBOOK_LOGIN unset). No Meta login and no App Review: the artist shares their
// Facebook Page (with its linked Instagram account), and optionally their ad account, with
// Prelude's business portfolio, and Prelude's system user does every Graph call.
//
//   1. The user enters a Page (URL or id) and, if they have one, an ad account id in Ad Accounts.
//   2. Prelude asks Meta for access from its business (client_pages / client_ad_accounts);
//      the owner approves in Facebook / Meta Business Suite. Sharing from their side
//      (Business settings → Partners → Prelude's business id) works the same way.
//   3. Once Meta shows the asset under Prelude's client assets, Prelude assigns it to its
//      system user and reads the Page's Instagram account.
//   4. The Instagram account is assigned to the shared ad account (ads run and bill there)
//      or to Prelude's ad account (managed ads, unchanged).
//
// Each Page and ad account belongs to one Prelude user (the first to add it), so knowing an
// id is not enough to advertise as someone else's artist.
//
// Env: META_APP_SECRET, META_PRELUDE_BUSINESS_ID, META_PRELUDE_TOKEN (system user with
// ads_management, business_management, pages_show_list, pages_read_engagement,
// instagram_basic). META_PRELUDE_AD_ACCOUNT_ID additionally enables managed ads.
import { query, queryOne } from './db.js';
import { graph, graphList, actId, needs } from './meta.js';

const PAGE_TASKS = ['ADVERTISE', 'ANALYZE'];
const AD_ACCOUNT_TASKS = ['MANAGE', 'ADVERTISE', 'ANALYZE'];

export function partnerConfigured() {
  return !!(process.env.META_APP_SECRET && process.env.META_PRELUDE_BUSINESS_ID && process.env.META_PRELUDE_TOKEN);
}

/** Prelude's business and system-user token, or a 409 when partner access isn't set up. */
export function preludeBusiness() {
  if (!partnerConfigured()) {
    throw needs('not_configured', 'Meta partner access is not configured on the server (META_APP_SECRET, META_PRELUDE_BUSINESS_ID, META_PRELUDE_TOKEN).');
  }
  return { businessId: process.env.META_PRELUDE_BUSINESS_ID, token: process.env.META_PRELUDE_TOKEN };
}

// ── Storage (mirrors db/schema.sql; created lazily too) ─────────────────────

let ready;
function ensureTables() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS meta_partner_pages (
        page_id      text PRIMARY KEY,
        user_id      text NOT NULL,
        page_name    text,
        ig_user_id   text,
        ig_username  text,
        ig_picture   text,
        status       text NOT NULL DEFAULT 'pending',
        last_error   text,
        requested_at timestamptz NOT NULL DEFAULT now(),
        active_at    timestamptz
      );
      CREATE INDEX IF NOT EXISTS meta_partner_pages_user_idx ON meta_partner_pages (user_id);
      CREATE TABLE IF NOT EXISTS meta_partner_ad_accounts (
        ad_account_id text PRIMARY KEY,
        user_id       text NOT NULL,
        name          text,
        currency      text,
        account_status integer,
        status        text NOT NULL DEFAULT 'pending',
        last_error    text,
        requested_at  timestamptz NOT NULL DEFAULT now(),
        active_at     timestamptz
      );
      CREATE INDEX IF NOT EXISTS meta_partner_ad_accounts_user_idx ON meta_partner_ad_accounts (user_id);
      CREATE TABLE IF NOT EXISTS meta_partner_settings (
        user_id    text PRIMARY KEY,
        selection  jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `).catch((err) => { ready = undefined; throw err; });
  }
  return ready;
}

async function userRows(uid) {
  await ensureTables();
  const [pages, adAccounts, settings] = await Promise.all([
    query('SELECT * FROM meta_partner_pages WHERE user_id = $1 ORDER BY requested_at', [uid]),
    query('SELECT * FROM meta_partner_ad_accounts WHERE user_id = $1 ORDER BY requested_at', [uid]),
    queryOne('SELECT selection FROM meta_partner_settings WHERE user_id = $1', [uid]),
  ]);
  return { pages, adAccounts, selection: settings?.selection || {} };
}

export async function savePartnerSelection(uid, selection) {
  await ensureTables();
  await query(
    `INSERT INTO meta_partner_settings (user_id, selection) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET selection = EXCLUDED.selection, updated_at = now()`,
    [uid, selection]
  );
}

// ── Shapes ──────────────────────────────────────────────────────────────────

/** Same shape as listInstagramAccounts() in meta.js. */
const igShape = (p) => ({
  igUserId: p.ig_user_id, username: p.ig_username, imageUrl: p.ig_picture || null, pageId: p.page_id, pageName: p.page_name,
});

const adAccountShape = (a) => ({
  id: a.ad_account_id, name: a.name || a.ad_account_id, currency: a.currency || null,
  active: a.status === 'active' && a.account_status === 1, status: a.status, business: null,
});

export function partnerInstagramAccounts(pages) {
  return pages.filter(p => p.status === 'active' && p.ig_user_id).map(igShape);
}

/**
 * The partner-mode equivalent of a stored Facebook Login connection: Prelude's token plus the
 * user's shared assets. null when nothing is shared yet or partner access isn't configured.
 */
export async function loadPartnerConnection(uid) {
  if (!partnerConfigured()) return null;
  const { pages, adAccounts, selection } = await userRows(uid);
  if (!pages.length && !adAccounts.length) return null;
  return {
    mode: 'partner',
    token: process.env.META_PRELUDE_TOKEN,
    selection,
    pages,
    adAccounts,
    instagramAccounts: partnerInstagramAccounts(pages),
  };
}

// ── Asking Meta for access ──────────────────────────────────────────────────

/** A Page id from what the user pasted: a numeric id or a facebook.com URL. */
export async function resolvePageId(input) {
  const raw = String(input || '').trim();
  if (/^\d{5,}$/.test(raw)) return raw;
  let url;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { url = null; }
  if (!url || !/(^|\.)(facebook|fb)\.com$/i.test(url.hostname)) {
    throw Object.assign(new Error('Paste the Facebook Page link (facebook.com/…) or its Page ID.'), { status: 400 });
  }
  const byQuery = url.searchParams.get('id');
  if (/^\d+$/.test(byQuery || '')) return byQuery;
  const parts = url.pathname.split('/').filter(Boolean);
  const numeric = parts.find(p => /^\d{5,}$/.test(p)) || parts.join('-').match(/-(\d{5,})$/)?.[1];
  if (numeric) return numeric;
  const username = parts[0];
  if (!username || ['pages', 'people', 'profile.php'].includes(username)) {
    throw Object.assign(new Error("Couldn't read a Page from that link. Paste the Page ID instead (Page → About → Page transparency)."), { status: 400 });
  }
  try {
    const page = await graph('GET', username, preludeBusiness().token, { fields: 'id' });
    if (page.id) return String(page.id);
  } catch { /* falls through */ }
  throw Object.assign(new Error(`Meta didn't recognise "${username}" as a Page. Paste the Page ID instead (Page → About → Page transparency).`), { status: 400 });
}

async function clientIds(edge) {
  const { businessId, token } = preludeBusiness();
  const rows = await graphList(`${businessId}/${edge}`, token, { fields: 'id' }, 10);
  return new Set(rows.map(r => String(r.id)));
}

let systemUser;
async function systemUserId(token) {
  if (!systemUser) systemUser = graph('GET', 'me', token, { fields: 'id' }).then(me => me.id).catch(() => { systemUser = undefined; return null; });
  return systemUser;
}

/** Give Prelude's system user the shared asset, then read what Prelude needs from it. */
async function activatePage(row) {
  const { businessId, token } = preludeBusiness();
  const suid = await systemUserId(token);
  if (suid) {
    await graph('POST', `${row.page_id}/assigned_users`, token, { user: suid, tasks: PAGE_TASKS, business: businessId })
      .catch(err => console.warn('[meta-partner] assigning page to system user failed', err.message));
  }
  const page = await graph('GET', row.page_id, token, { fields: 'id,name,instagram_business_account{id,username,profile_picture_url}' });
  const ig = page.instagram_business_account;
  await query(
    `UPDATE meta_partner_pages SET status = 'active', page_name = $2, ig_user_id = $3, ig_username = $4, ig_picture = $5,
       last_error = $6, active_at = COALESCE(active_at, now()) WHERE page_id = $1`,
    [row.page_id, page.name || row.page_name, ig?.id || null, ig?.username || null, ig?.profile_picture_url || null,
      ig ? null : 'This Page has no Instagram professional account linked. Link one in the Page settings, then check again.']
  );
}

async function activateAdAccount(row) {
  const { businessId, token } = preludeBusiness();
  const suid = await systemUserId(token);
  if (suid) {
    await graph('POST', `${row.ad_account_id}/assigned_users`, token, { user: suid, tasks: AD_ACCOUNT_TASKS, business: businessId })
      .catch(err => console.warn('[meta-partner] assigning ad account to system user failed', err.message));
  }
  const act = await graph('GET', row.ad_account_id, token, { fields: 'name,currency,account_status' });
  await query(
    `UPDATE meta_partner_ad_accounts SET status = 'active', name = $2, currency = $3, account_status = $4,
       last_error = NULL, active_at = COALESCE(active_at, now()) WHERE ad_account_id = $1`,
    [row.ad_account_id, act.name || null, act.currency || null, act.account_status ?? null]
  );
}

const setError = (table, key, id, message) =>
  query(`UPDATE ${table} SET last_error = $2 WHERE ${key} = $1`, [id, message == null ? null : String(message).slice(0, 500)]);

/** Readable reason a client_pages / client_ad_accounts request failed, plus the owner-side fallback. */
function requestError(err, id, owner) {
  const share = `The ${owner} can share it with Prelude instead: Business settings → Partners → Add → business ID ${process.env.META_PRELUDE_BUSINESS_ID}, then press "Check for approvals".`;
  if (/\(#3\)|capability/i.test(err.message)) return `Meta only lets Prelude send access requests once its app is approved. ${share}`;
  if (/global id .* not allowed/i.test(err.message)) return `Meta says ${id} isn't a Page ID (usually a personal profile or a Page's profile link). Remove it and add the Page ID from Meta Business Suite → Settings → Business assets → Pages. ${share}`;
  return `Meta didn't send the request (${err.message}). ${share}`;
}

/** Claim a Page for this user and ask its owner to share it with Prelude's business. */
export async function addPartnerPage(uid, input) {
  const { businessId, token } = preludeBusiness();
  const pageId = await resolvePageId(input);
  await ensureTables();
  const existing = await queryOne('SELECT * FROM meta_partner_pages WHERE page_id = $1', [pageId]);
  if (existing && existing.user_id !== uid) {
    throw Object.assign(new Error('That Page is already connected to another Prelude account.'), { status: 409 });
  }
  if (!existing) await query('INSERT INTO meta_partner_pages (page_id, user_id) VALUES ($1, $2)', [pageId, uid]);
  const row = await queryOne('SELECT * FROM meta_partner_pages WHERE page_id = $1', [pageId]);

  if ((await clientIds('client_pages')).has(pageId)) {
    await activatePage(row);
  } else {
    await graph('POST', `${businessId}/client_pages`, token, { page_id: pageId, permitted_tasks: PAGE_TASKS })
      .then(() => setError('meta_partner_pages', 'page_id', pageId, null))
      .catch(err => setError('meta_partner_pages', 'page_id', pageId, requestError(err, pageId, 'Page owner')));
  }
  return queryOne('SELECT * FROM meta_partner_pages WHERE page_id = $1', [pageId]);
}

/** Claim an ad account for this user and ask its owner to share it with Prelude's business. */
export async function addPartnerAdAccount(uid, input) {
  const { businessId, token } = preludeBusiness();
  const act = actId(String(input || '').trim().replace(/\D/g, ''));
  if (process.env.META_PRELUDE_AD_ACCOUNT_ID && act === actId(process.env.META_PRELUDE_AD_ACCOUNT_ID)) {
    throw Object.assign(new Error("That is Prelude's own ad account. Choose \"Let Prelude run ads\" for the artist instead."), { status: 400 });
  }
  await ensureTables();
  const existing = await queryOne('SELECT * FROM meta_partner_ad_accounts WHERE ad_account_id = $1', [act]);
  if (existing && existing.user_id !== uid) {
    throw Object.assign(new Error('That ad account is already connected to another Prelude account.'), { status: 409 });
  }
  if (!existing) await query('INSERT INTO meta_partner_ad_accounts (ad_account_id, user_id) VALUES ($1, $2)', [act, uid]);
  const row = await queryOne('SELECT * FROM meta_partner_ad_accounts WHERE ad_account_id = $1', [act]);

  const shared = await clientIds('client_ad_accounts');
  if (shared.has(act) || shared.has(act.replace(/^act_/, ''))) {
    await activateAdAccount(row);
  } else {
    await graph('POST', `${businessId}/client_ad_accounts`, token, { adaccount_id: act, permitted_tasks: AD_ACCOUNT_TASKS })
      .then(() => setError('meta_partner_ad_accounts', 'ad_account_id', act, null))
      .catch(err => setError('meta_partner_ad_accounts', 'ad_account_id', act, requestError(err, act, 'owner')));
  }
  return queryOne('SELECT * FROM meta_partner_ad_accounts WHERE ad_account_id = $1', [act]);
}

/**
 * Pick up approvals: anything now among Prelude's client assets becomes active, and active
 * Pages re-read their Instagram account (it may have been linked since). Errors are stored
 * per asset, never thrown, so one bad asset doesn't hide the rest.
 */
export async function syncPartnerAssets(uid) {
  if (!partnerConfigured()) return;
  const { pages, adAccounts } = await userRows(uid);
  if (!pages.length && !adAccounts.length) return;
  const [clientPages, clientAccounts] = await Promise.all([
    pages.length ? clientIds('client_pages') : new Set(),
    adAccounts.length ? clientIds('client_ad_accounts') : new Set(),
  ]);
  for (const p of pages) {
    if (p.status === 'active' && p.ig_user_id) continue;
    if (p.status === 'active' || clientPages.has(p.page_id)) {
      await activatePage(p).catch(err => setError('meta_partner_pages', 'page_id', p.page_id, err.message));
    }
  }
  for (const a of adAccounts) {
    const shared = clientAccounts.has(a.ad_account_id) || clientAccounts.has(a.ad_account_id.replace(/^act_/, ''));
    if (a.status === 'active' || shared) {
      await activateAdAccount(a).catch(err => setError('meta_partner_ad_accounts', 'ad_account_id', a.ad_account_id, err.message));
    }
  }
}

/** Status payload for Ad Accounts (pending and active assets, with what's still needed). */
export async function partnerAssets(uid) {
  const { pages, adAccounts, selection } = await userRows(uid);
  return {
    selection,
    pages: pages.map(p => ({
      pageId: p.page_id, pageName: p.page_name, status: p.status, igUsername: p.ig_username, error: p.last_error || null,
    })),
    adAccounts: adAccounts.map(adAccountShape),
    adAccountRequests: adAccounts.map(a => ({ id: a.ad_account_id, name: a.name, status: a.status, error: a.last_error || null })),
    instagramAccounts: partnerInstagramAccounts(pages),
  };
}

/**
 * Let Prelude's ad account run ads as a shared Instagram account (managed ads). The Page is
 * already shared with Prelude's business, so Prelude's own token authorizes it.
 */
export async function grantManagedPartner(ig, act) {
  const { businessId, token } = preludeBusiness();
  try {
    await graph('POST', `${ig.igUserId}/authorized_adaccounts`, token, { business: businessId, account_id: act.replace(/^act_/, '') });
  } catch (err) {
    throw needs('managed_access', `Meta didn't let Prelude's ad account advertise as @${ig.username} (${err.message}). Ask the owner to also share @${ig.username} with Prelude's business (Business settings → Partners → business ID ${businessId}), then try again.`);
  }
}

export async function revokeManagedPartner(ig, act) {
  if (!partnerConfigured()) return;
  const { businessId, token } = preludeBusiness();
  await graph('DELETE', `${ig.igUserId}/authorized_adaccounts`, token, { business: businessId, account_id: act.replace(/^act_/, '') })
    .catch(err => console.warn('[meta-partner] removing Prelude ad account from Instagram failed', err.message));
}

/** Forget a Page or ad account (and withdraw Prelude's access on Meta, best effort). */
export async function removePartnerAsset(uid, { pageId, adAccountId }) {
  const { businessId, token } = preludeBusiness();
  if (pageId) {
    const row = await queryOne('SELECT * FROM meta_partner_pages WHERE page_id = $1 AND user_id = $2', [String(pageId), uid]);
    if (!row) return null;
    await graph('DELETE', `${businessId}/client_pages`, token, { page_id: row.page_id })
      .catch(err => console.warn('[meta-partner] removing client page failed', err.message));
    await query('DELETE FROM meta_partner_pages WHERE page_id = $1', [row.page_id]);
    return row;
  }
  if (adAccountId) {
    const act = actId(adAccountId);
    const row = await queryOne('SELECT * FROM meta_partner_ad_accounts WHERE ad_account_id = $1 AND user_id = $2', [act, uid]);
    if (!row) return null;
    await graph('DELETE', `${businessId}/client_ad_accounts`, token, { adaccount_id: act })
      .catch(err => console.warn('[meta-partner] removing client ad account failed', err.message));
    await query('DELETE FROM meta_partner_ad_accounts WHERE ad_account_id = $1', [act]);
    return row;
  }
  return null;
}
