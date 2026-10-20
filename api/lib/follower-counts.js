// Followers per day for campaigns: the artist's Instagram followers, TikTok followers and
// YouTube subscribers, read daily next to the stream counts (same trackers, same tables:
// one stream_tracker_sources row per profile, one stream_counts row per day).
//
// How each count is read (checked 2026-10-20):
//   - YouTube subscribers: Data API channels.list (YOUTUBE_API_KEY). YouTube rounds counts
//     above 1,000 to three significant figures. Same Developer Policies as views (III.E.4):
//     kept 30 days, no derived figures (gains) until the analytics audit passes.
//   - Instagram followers, official first: the Graph API `followers_count` of an IG account
//     the campaign owner connected in Ad Accounts (their token), then Business Discovery
//     through Prelude's own IG professional account (META_PRELUDE_IG_USER_ID +
//     META_PRELUDE_TOKEN; needs instagram_basic, instagram_manage_insights,
//     pages_read_engagement, likely Advanced Access). Last, the public profile page.
//     Instagram's Terms ban automated collection without permission; Ian chose page reads
//     anyway (2026-10-20). INSTAGRAM_FOLLOWERS_SCRAPE=0 turns them off.
//   - TikTok followers: the official API (user.info.stats) only returns the signed-in user's
//     own count, so the public profile page is read. TikTok's Terms ban scraping; Ian's call
//     (2026-10-20). TIKTOK_FOLLOWERS_SCRAPE=0 turns it off.
// Page reads use no account and never get past a login wall or challenge: a page that
// doesn't show the count is reported on the source, and the day's count can be typed in.
import { query, queryOne } from './db.js';
import { parseSourceUrl } from './link-lookup.js';
import { graph, loadConnection, listInstagramAccounts } from './meta.js';
import { launchBrowser, UA } from './spotify-playcount.js';

const YOUTUBE_API = process.env.YOUTUBE_API_URL || 'https://www.googleapis.com/youtube/v3';
const INSTAGRAM_WEB = process.env.INSTAGRAM_WEB_URL || 'https://www.instagram.com';
const TIKTOK_WEB = process.env.TIKTOK_WEB_URL || 'https://www.tiktok.com';
const WAIT_MS = 15_000;

export const instagramScrapeEnabled = () => process.env.INSTAGRAM_FOLLOWERS_SCRAPE !== '0';
export const tiktokScrapeEnabled = () => process.env.TIKTOK_FOLLOWERS_SCRAPE !== '0';
const businessDiscoveryConfigured = () => !!(process.env.META_PRELUDE_IG_USER_ID && process.env.META_PRELUDE_TOKEN);

/** Follower services, in display order. `auto`: read every day; `manual`: a count can be typed in. */
export const FOLLOWER_SERVICES = {
  instagram: { label: 'Instagram followers', socialKey: 'instagram', get auto() { return true; }, manual: true },
  tiktok: { label: 'TikTok followers', socialKey: 'tiktok', get auto() { return tiktokScrapeEnabled(); }, manual: true },
  youtubeChannel: { label: 'YouTube subscribers', socialKey: 'youtube', auto: true, manual: false },
};
export const isFollowerService = (service) => !!FOLLOWER_SERVICES[service];

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

// ── Profile URLs ────────────────────────────────────────────────────────────

const IG_RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'stories', 'direct', 'about', 'legal']);

/**
 * A profile URL → { service, externalId, url } or null. Instagram and TikTok are keyed by
 * username; YouTube by the channel reference in the URL (UC… id, @handle, user/…, c/…).
 */
export function profileFromUrl(service, raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  if (service === 'instagram') {
    if (host !== 'instagram.com' || !parts[0] || IG_RESERVED.has(parts[0].toLowerCase())) return null;
    const name = parts[0].replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(name)) return null;
    return { service, externalId: name, url: `https://www.instagram.com/${name}/` };
  }
  if (service === 'tiktok') {
    if (host !== 'tiktok.com' || !parts[0]?.startsWith('@')) return null;
    const name = parts[0].slice(1).toLowerCase();
    if (!/^[a-z0-9._]{1,24}$/.test(name)) return null;
    return { service, externalId: name, url: `https://www.tiktok.com/@${name}` };
  }
  if (service === 'youtubeChannel') {
    const src = parseSourceUrl(u.href);
    if (!src || src.kind !== 'artist') return null;
    const ref = src.id.startsWith('channel/') ? src.id.slice(8) : src.id;
    const path = ref.startsWith('UC') || ref.startsWith('@') ? (ref.startsWith('@') ? ref : `channel/${ref}`) : ref;
    return { service, externalId: ref, url: `https://www.youtube.com/${path}` };
  }
  return null;
}

/** The service a pasted profile URL belongs to, or null. */
export function followerServiceOf(url) {
  return Object.keys(FOLLOWER_SERVICES).find(s => profileFromUrl(s, url)) || null;
}

/**
 * The artist's profiles: the catalog's social_urls first, else the profile this user
 * entered on an earlier campaign for the same artist. { [service]: url }
 */
export async function artistProfiles(uid, artistSlug) {
  const out = {};
  if (!artistSlug) return out;
  const artist = await queryOne('SELECT social_urls FROM artists WHERE slug = $1', [artistSlug]).catch(() => null);
  const urls = artist?.social_urls && typeof artist.social_urls === 'object' ? artist.social_urls : {};
  for (const [service, { socialKey }] of Object.entries(FOLLOWER_SERVICES)) {
    const list = (Array.isArray(urls[socialKey]) ? urls[socialKey] : [urls[socialKey]]).filter(v => typeof v === 'string');
    const hit = list.map(v => profileFromUrl(service, v)).find(Boolean);
    if (hit) out[service] = hit.url;
  }
  const earlier = await query(
    `SELECT DISTINCT ON (s.service) s.service, s.url
     FROM stream_tracker_sources s JOIN stream_trackers t ON t.id = s.tracker_id
     WHERE t.user_id = $1 AND t.artist_slug = $2 AND s.service = ANY($3) AND s.removed_at IS NULL
     ORDER BY s.service, s.created_at DESC`,
    [uid, artistSlug, Object.keys(FOLLOWER_SERVICES)]);
  for (const r of earlier) out[r.service] ??= r.url;
  return out;
}

async function upsertSource(trackerId, p) {
  await query(
    `INSERT INTO stream_tracker_sources (tracker_id, service, external_id, kind, url, label)
     VALUES ($1, $2, $3, 'profile', $4, NULL)
     ON CONFLICT (tracker_id, service, external_id) DO UPDATE SET removed_at = NULL, url = EXCLUDED.url`,
    [trackerId, p.service, p.externalId, p.url]);
}

/** Start reading the artist's followers on a tracker, for each profile Prelude knows. */
export async function addFollowerSources(tracker) {
  const profiles = await artistProfiles(tracker.user_id, tracker.artist_slug);
  for (const [service, url] of Object.entries(profiles)) {
    const has = await queryOne('SELECT 1 FROM stream_tracker_sources WHERE tracker_id = $1 AND service = $2', [tracker.id, service]);
    if (has) continue; // already tracked, or removed by the user
    const p = profileFromUrl(service, url);
    if (p) await upsertSource(tracker.id, p);
  }
  await query('UPDATE stream_trackers SET followers_started = true WHERE id = $1', [tracker.id]);
}

/** A profile URL the user added; replaces the one tracked for that service. */
export async function addProfile(trackerId, url) {
  const service = followerServiceOf(url);
  if (!service) throw bad('Paste an Instagram profile, TikTok profile (tiktok.com/@name) or YouTube channel link.');
  const p = profileFromUrl(service, url);
  await query('UPDATE stream_tracker_sources SET removed_at = now() WHERE tracker_id = $1 AND service = $2 AND external_id <> $3 AND removed_at IS NULL',
    [trackerId, service, p.externalId]);
  await upsertSource(trackerId, p);
  return service;
}

// ── Reading counts ──────────────────────────────────────────────────────────

/** "1,234" → 1234; "12.5K" / "1.2M" → rounded counts, flagged. */
export function parseCount(text) {
  const m = String(text ?? '').trim().match(/^([\d.,]+)\s*([KMB])?$/i);
  if (!m) return null;
  if (!m[2]) {
    const n = Number(m[1].replace(/[,.]/g, ''));
    return Number.isFinite(n) ? { count: n, rounded: false } : null;
  }
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return { count: Math.round(n * { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()]), rounded: true };
}

const toInt = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// Every object in a JSON value
function* objects(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) yield value;
  for (const v of Object.values(value)) yield* objects(v, seen);
}

/** JSON embedded in <script> tags (application/json or ld+json, and window.X = {...}). */
export function embeddedJson(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* not JSON */ }
  }
  return out;
}

const metaContent = (html, prop) =>
  String(html).match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1]
  ?? String(html).match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'))?.[1] ?? null;

const decode = (s) => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/** "… 12.5K Followers …" in a description → { count, rounded }. */
function followersInText(text) {
  const m = decode(text).match(/([\d.,]+\s*[KMB]?)\s+Followers/i);
  return m ? parseCount(m[1].replace(/\s/g, '')) : null;
}

/** Instagram followers from a profile page (embedded data first, it's exact; then the description). */
export function instagramFromHtml(html, username) {
  for (const blob of embeddedJson(html)) {
    for (const o of objects(blob)) {
      const name = String(o.username || '').toLowerCase();
      if (name && name !== username) continue;
      const n = toInt(o.edge_followed_by?.count ?? o.follower_count);
      if (name === username && n != null) return { count: n, rounded: false };
      // schema.org ProfilePage: interactionStatistic FollowAction
      if (o.interactionType && /FollowAction/.test(JSON.stringify(o.interactionType)) && toInt(o.userInteractionCount) != null) {
        return { count: toInt(o.userInteractionCount), rounded: false };
      }
    }
  }
  const m = String(html).match(new RegExp(`"username":"${username.replace(/\./g, '\\.')}"[\\s\\S]{0,4000}?"edge_followed_by":\\{"count":(\\d+)\\}`));
  if (m) return { count: Number(m[1]), rounded: false };
  return followersInText(metaContent(html, 'og:description') || metaContent(html, 'description'));
}

/** TikTok followers from a profile page (the rehydration data the page ships with). */
export function tiktokFromHtml(html, username) {
  const blobs = embeddedJson(html);
  const sigi = String(html).match(/<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (sigi) { try { blobs.push(JSON.parse(sigi)); } catch { /* not JSON */ } }
  return tiktokFromJson(blobs, username) || followersInText(metaContent(html, 'description') || metaContent(html, 'og:description'));
}

export function tiktokFromJson(blobs, username) {
  for (const blob of blobs) {
    for (const o of objects(blob)) {
      // webapp.user-detail → userInfo: { user: { uniqueId }, stats: { followerCount }, statsV2 }
      if (String(o.user?.uniqueId || '').toLowerCase() === username) {
        const n = toInt(o.statsV2?.followerCount ?? o.stats?.followerCount);
        if (n != null) return { count: n, rounded: false };
      }
      // SIGI_STATE → UserModule.stats[uniqueId].followerCount
      const keyed = o.stats && typeof o.stats === 'object' && Object.entries(o.stats).find(([k]) => k.toLowerCase() === username)?.[1];
      if (keyed && toInt(keyed.followerCount) != null) return { count: toInt(keyed.followerCount), rounded: false };
    }
  }
  return null;
}

const LOGIN_WALL = /\/accounts\/login|\/login\b|captcha|verify/i;

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', accept: 'text/html' }, redirect: 'follow' });
  return { status: res.status, url: res.url || url, html: res.ok ? await res.text() : '' };
}

/**
 * Read one public profile page: a plain request first, then (when that page didn't carry
 * the count, as when it's filled in by script) the same page in headless Chromium.
 * { count, rounded, via } or { error }.
 */
async function readProfilePage({ label, url, parse, browser }) {
  try {
    const page = await fetchPage(url);
    if (page.html) {
      const hit = parse(page.html);
      if (hit) return { ...hit, via: 'page' };
    }
    if (LOGIN_WALL.test(new URL(page.url).pathname)) return { error: `${label} showed a login page instead of the profile. Enter today's count by hand.` };
    if (page.status === 404) return { error: `${label} says this profile doesn't exist. Check the link.` };
  } catch { /* try the browser */ }
  const b = await browser();
  if (b.error) return { error: `${label}'s page didn't show a follower count, and the browser that reads it couldn't start (${b.error}).` };
  const context = await b.browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    await page.route('**/*', (route) => (['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue()));
    const loaded = [];
    page.on('response', async (res) => {
      if (!/json/.test(res.headers()['content-type'] || '')) return;
      try { loaded.push(await res.json()); } catch { /* body gone */ }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: WAIT_MS });
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      if (LOGIN_WALL.test(new URL(page.url()).pathname)) return { error: `${label} showed a login page instead of the profile. Enter today's count by hand.` };
      const hit = parse(await page.content(), loaded);
      if (hit) return { ...hit, via: 'browser' };
      await page.waitForTimeout(750);
    }
    return { error: `${label}'s page didn't show a follower count (it may have asked for a login, or changed its layout). Enter today's count by hand.` };
  } catch (err) {
    return { error: `${label}'s page didn't load (${err.message.split('\n')[0]}).` };
  } finally {
    await context.close().catch(() => {});
  }
}

/** One headless browser shared by every page read in a run, started only if needed. */
function lazyBrowser() {
  let started;
  const get = () => (started ??= launchBrowser().then(browser => ({ browser }), err => ({ error: err.message.split('\n')[0] })));
  get.close = async () => { if (started) { const b = await started; await b.browser?.close().catch(() => {}); } };
  return get;
}

// Instagram: the owner's connected IG accounts → Business Discovery → the public page
async function instagramFollowers(sources, tracker, browser) {
  const out = {};
  const todo = new Map(sources.map(s => [s.external_id, s]));

  if (tracker?.user_id) {
    try {
      const conn = await loadConnection(tracker.user_id);
      if (conn && !(conn.expires_at && new Date(conn.expires_at) <= new Date())) {
        const accounts = await listInstagramAccounts(conn.token);
        for (const a of accounts) {
          const name = String(a.username || '').toLowerCase();
          if (!todo.has(name)) continue;
          try {
            const r = await graph('GET', a.igUserId, conn.token, { fields: 'followers_count' });
            if (toInt(r.followers_count) != null) { out[name] = { count: toInt(r.followers_count), source: 'api' }; todo.delete(name); }
          } catch { /* fall through to the next way */ }
        }
      }
    } catch { /* no connection or Meta not configured */ }
  }

  if (businessDiscoveryConfigured()) {
    for (const name of [...todo.keys()]) {
      try {
        const r = await graph('GET', process.env.META_PRELUDE_IG_USER_ID, process.env.META_PRELUDE_TOKEN,
          { fields: `business_discovery.username(${name}){followers_count}` });
        const n = toInt(r.business_discovery?.followers_count);
        if (n != null) { out[name] = { count: n, source: 'api' }; todo.delete(name); }
      } catch { /* personal account, age-gated, or no access: fall through */ }
    }
  }

  for (const [name] of todo) {
    if (!instagramScrapeEnabled()) {
      out[name] = { error: "This Instagram account isn't connected in Ad Accounts, so its followers can't be read. Enter today's count by hand." };
      continue;
    }
    const r = await readProfilePage({
      label: 'Instagram', url: `${INSTAGRAM_WEB}/${encodeURIComponent(name)}/`, browser,
      parse: (html) => instagramFromHtml(html, name),
    });
    out[name] = r.error ? r : { count: r.count, source: r.rounded ? 'page_rounded' : 'page' };
  }
  return out;
}

async function tiktokFollowers(sources, tracker, browser) {
  const out = {};
  for (const s of sources) {
    const name = s.external_id;
    const r = await readProfilePage({
      label: 'TikTok', url: `${TIKTOK_WEB}/@${encodeURIComponent(name)}`, browser,
      parse: (html, loaded = []) => tiktokFromJson(loaded, name) || tiktokFromHtml(html, name),
    });
    out[name] = r.error ? r : { count: r.count, source: r.rounded ? 'page_rounded' : 'page' };
  }
  return out;
}

async function youtubeGet(path, params) {
  const qs = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const res = await fetch(`${YOUTUBE_API}/${path}?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw bad(`YouTube API ${res.status}: ${body.error?.message || 'request failed'}`, 502);
  return body;
}

/** channels.list parameters for a channel reference (UC… id, @handle, user/name). c/name has no lookup: search. */
async function channelLookup(ref) {
  if (/^UC[\w-]{20,}$/.test(ref)) return { id: ref };
  if (ref.startsWith('@')) return { forHandle: ref };
  if (ref.startsWith('user/')) return { forUsername: ref.slice(5) };
  const name = ref.replace(/^c\//, '');
  const found = await youtubeGet('search', { part: 'snippet', type: 'channel', maxResults: '1', q: name });
  const id = found.items?.[0]?.id?.channelId;
  return id ? { id } : null;
}

async function youtubeSubscribers(sources) {
  if (!process.env.YOUTUBE_API_KEY) return Object.fromEntries(sources.map(s => [s.external_id, { error: 'YOUTUBE_API_KEY is not set.' }]));
  const out = {};
  for (const s of sources) {
    try {
      const lookup = await channelLookup(s.external_id);
      const body = lookup && await youtubeGet('channels', { part: 'statistics', ...lookup });
      const st = body?.items?.[0]?.statistics;
      out[s.external_id] = !st ? { error: 'YouTube channel not found. Check the link.' }
        : st.hiddenSubscriberCount ? { error: 'This channel hides its subscriber count.' }
        : { count: Number(st.subscriberCount), source: 'api' };
    } catch (err) {
      out[s.external_id] = { error: err.message };
    }
  }
  return out;
}

/** Today's counts for a tracker's follower sources: { [service]: { [externalId]: { count, source } | { error } } } */
export async function readFollowers(sources, tracker) {
  const browser = lazyBrowser();
  const by = (service) => sources.filter(s => s.service === service);
  const out = {};
  try {
    if (by('instagram').length) out.instagram = await instagramFollowers(by('instagram'), tracker, browser);
    if (by('tiktok').length) {
      out.tiktok = tiktokScrapeEnabled() ? await tiktokFollowers(by('tiktok'), tracker, browser) : {};
    }
    if (by('youtubeChannel').length) out.youtubeChannel = await youtubeSubscribers(by('youtubeChannel'));
  } finally {
    await browser.close();
  }
  return out;
}

/** One profile against the live site, for checking the readers: GET /api/streams?probeProfile=<url>. */
export async function probeProfile(url) {
  const service = followerServiceOf(url);
  if (!service) throw bad('Pass an Instagram, TikTok or YouTube channel link.');
  const p = profileFromUrl(service, url);
  const started = Date.now();
  const r = await readFollowers([{ service, external_id: p.externalId }], null);
  return { service, profile: p.externalId, ...(r[service]?.[p.externalId] || { error: 'Turned off on the server.' }), ms: Date.now() - started };
}
