// Smart links: Prelude's own landing page per release with a button for each
// streaming service. Every view and click is recorded (smart_link_events), tagged
// with the campaign the visitor came from, and each click is sent to Meta as a
// DSPClick event (Pixel in the page + Conversions API from the server, deduplicated
// by a shared event id) so ads can be measured and optimized on streaming clicks.
//
// Env:
//   ODESLI_API_KEY       — optional; look links up through song.link/Odesli (see link-lookup.js)
//   SMART_LINK_BASE_URL  — optional; public origin for links (default: the request's origin)
//   META_TEST_EVENT_CODE — optional; sends Conversions API events to Events Manager's Test Events
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { graph, loadConnection } from './meta.js';
import { lookupRelease } from './link-lookup.js';
import {
  cookies, clientIp, geo, parseUserAgent, language, trackingParams, consentState, mayTrack, gpc, visitorId,
} from './visitor.js';

export { cookies };

// Display order, labels and colors for the landing page and reports
export const SERVICES = {
  spotify: { label: 'Spotify', color: '#1DB954' },
  appleMusic: { label: 'Apple Music', color: '#FA243C' },
  youtubeMusic: { label: 'YouTube Music', color: '#FF0000' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  amazonMusic: { label: 'Amazon Music', color: '#25D1DA' },
  deezer: { label: 'Deezer', color: '#A238FF' },
  tidal: { label: 'TIDAL', color: '#FFFFFF' },
  soundcloud: { label: 'SoundCloud', color: '#FF5500' },
  pandora: { label: 'Pandora', color: '#3668FF' },
};

// Visitor detail on each event (kept in sync with db/schema.sql)
const EVENT_COLUMNS_SQL = `ALTER TABLE smart_link_events
  ADD COLUMN IF NOT EXISTS event_id text, ADD COLUMN IF NOT EXISTS view_id text,
  ADD COLUMN IF NOT EXISTS visitor_id text, ADD COLUMN IF NOT EXISTS consent text,
  ADD COLUMN IF NOT EXISTS gpc boolean, ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text, ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS os_version text, ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS browser_version text, ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS in_app text, ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS region text, ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text, ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision, ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS referrer_host text, ADD COLUMN IF NOT EXISTS utm jsonb,
  ADD COLUMN IF NOT EXISTS click_ids jsonb, ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS fbc text, ADD COLUMN IF NOT EXISTS ms_on_page integer,
  ADD COLUMN IF NOT EXISTS client jsonb`;

let tablesReady;
export function ensureTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS smart_links (
          slug text PRIMARY KEY, user_id text NOT NULL, artist_slug text, artist_name text,
          title text, image_url text, source_url text,
          links jsonb NOT NULL DEFAULT '[]'::jsonb, pixel_id text,
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS smart_link_events (
          id bigserial PRIMARY KEY,
          slug text NOT NULL REFERENCES smart_links (slug) ON DELETE CASCADE,
          kind text NOT NULL, service text, campaign text, country text, device text, referrer text,
          from_ad boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
        )`);
      await query('CREATE INDEX IF NOT EXISTS smart_link_events_slug_idx ON smart_link_events (slug, created_at)');
      await query(EVENT_COLUMNS_SQL);
      await query('CREATE INDEX IF NOT EXISTS smart_link_events_visitor_idx ON smart_link_events (visitor_id, created_at) WHERE visitor_id IS NOT NULL');
      await query('CREATE INDEX IF NOT EXISTS smart_link_events_event_id_idx ON smart_link_events (event_id) WHERE event_id IS NOT NULL');
      await query('ALTER TABLE smart_links ADD COLUMN IF NOT EXISTS fan_capture boolean NOT NULL DEFAULT false');
      await query('ALTER TABLE smart_links ALTER COLUMN title DROP NOT NULL'); // title is optional
      await query(`
        CREATE TABLE IF NOT EXISTS smart_link_fans (
          slug text NOT NULL REFERENCES smart_links (slug) ON DELETE CASCADE,
          spotify_user_id text NOT NULL, display_name text, email text, country text, product text,
          followed boolean NOT NULL DEFAULT false, saved boolean NOT NULL DEFAULT false,
          top_artists jsonb, campaign text, from_ad boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (slug, spotify_user_id)
        )`);
      // Ties a captured fan to their anonymous visits (smart_link_events.visitor_id)
      await query('ALTER TABLE smart_link_fans ADD COLUMN IF NOT EXISTS visitor_id text');
    })().catch((err) => { tablesReady = undefined; throw err; });
  }
  return tablesReady;
}

export const isHttpUrl = (u) => {
  try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; }
};

/** Keep only known services with valid URLs, in display order. */
export function cleanLinks(links) {
  const byService = new Map();
  for (const l of links || []) {
    if (SERVICES[l?.service] && isHttpUrl(l.url) && !byService.has(l.service)) byService.set(l.service, l.url);
  }
  return Object.keys(SERVICES).filter(s => byService.has(s)).map(service => ({ service, url: byService.get(service) }));
}

/** Look up a release on every service from one URL (Spotify, Apple Music, Deezer, YouTube). */
export async function resolveLinks(sourceUrl) {
  const found = await lookupRelease(sourceUrl);
  return { ...found, links: cleanLinks(found.links) };
}

export function makeSlug(title) {
  const base = String(title || 'link').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'link';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export function publicOrigin(req) {
  if (process.env.SMART_LINK_BASE_URL) return process.env.SMART_LINK_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export const linkUrl = (req, slug) => `${publicOrigin(req)}/l/${slug}`;

export async function getLink(slug) {
  await ensureTables();
  return queryOne('SELECT * FROM smart_links WHERE slug = $1', [slug]);
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|preview|headless/i;
export const isBot = (req) => BOT_RE.test(req.headers['user-agent'] || '');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const hostOf = (u) => { try { return new URL(u).hostname || null; } catch { return null; } };
const short = (v, n) => (v ? String(v).slice(0, n) : null);
const jsonOrNull = (o) => (o && Object.keys(o).length ? JSON.stringify(o) : null);

/**
 * Record a view or click with everything the request tells us about the visitor
 * (see api/lib/visitor.js). `params` are the visit's query params (UTM tags, click
 * ids, `v` = the landing page view it came from, `ms` = time on page before the
 * click). Pass `res` so a new visitor gets their id cookie. Never throws —
 * tracking must not break the page or the redirect.
 */
export async function recordEvent(req, slug, {
  kind, service = null, campaign = null, fromAd = false, params = new URLSearchParams(), res = null, eventId = null,
}) {
  if (isBot(req)) return;
  try {
    await ensureTables();
    const ua = parseUserAgent(req);
    const g = geo(req);
    const { utm, clickIds } = trackingParams(params);
    const c = cookies(req);
    const consent = consentState(req);
    const tracking = mayTrack(req);
    const ms = Number(params.get('ms'));
    const referrer = short(req.headers.referer, 500);
    await query(
      `INSERT INTO smart_link_events (slug, kind, service, campaign, country, device, referrer, from_ad,
         event_id, view_id, visitor_id, consent, gpc, ip, user_agent, os, os_version, browser, browser_version,
         device_model, in_app, language, region, city, postal_code, latitude, longitude, timezone,
         referrer_host, utm, click_ids, fbp, fbc, ms_on_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
         $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)`,
      [slug, kind, service, short(campaign, 100), g.country, ua.device, referrer, fromAd,
        short(eventId, 64), short(params.get('v'), 64), visitorId(req, res), consent, gpc(req), clientIp(req),
        short(ua.userAgent, 500), ua.os, ua.osVersion, ua.browser, ua.browserVersion, short(ua.deviceModel, 100),
        ua.inApp, short(language(req), 35), g.region, g.city, g.postalCode, g.latitude, g.longitude, g.timezone,
        referrer ? hostOf(referrer) : null, jsonOrNull(utm), jsonOrNull(clickIds),
        tracking ? short(c._fbp, 200) : null, tracking ? short(c._fbc, 300) : null,
        Number.isFinite(ms) && ms > 0 ? Math.min(Math.round(ms), 2_147_000_000) : null]
    );
  } catch (err) {
    console.error('[smartlinks] record failed', err.message);
  }
}

/**
 * Attach the browser's own signals (screen, timezone, connection, … — see the
 * page's beacon) and, after an EU/UK visitor answers the consent bar, their
 * choice and visitor id to the page view they belong to.
 */
export async function recordClientInfo(req, slug, { viewId, client, consent, visitor }) {
  if (!viewId || isBot(req)) return;
  try {
    await ensureTables();
    await query(
      `UPDATE smart_link_events SET client = COALESCE($3::jsonb, client),
         consent = COALESCE($4, consent), visitor_id = COALESCE(visitor_id, $5),
         fbp = COALESCE(fbp, $6), fbc = COALESCE(fbc, $7)
       WHERE event_id = $1 AND slug = $2 AND kind = 'view' AND created_at > now() - interval '1 day'`,
      [viewId, slug, client ? JSON.stringify(client) : null, consent || null, visitor || null,
        visitor ? short(cookies(req)._fbp, 200) : null, visitor ? short(cookies(req)._fbc, 300) : null]);
  } catch (err) {
    console.error('[smartlinks] client info failed', err.message);
  }
}

/**
 * Send a click to Meta through the Conversions API using the link owner's Meta
 * connection. Shares `eventId` with the Pixel event fired in the page so Meta
 * counts it once. Never throws.
 */
export async function sendMetaEvent(req, link, { eventName, eventId, service, campaign, sourceUrl, fbclid, email, country }) {
  // Nothing goes to Meta without consent (EU/UK) or with a Global Privacy Control opt-out
  if (!link.pixel_id || isBot(req) || !mayTrack(req) || gpc(req)) return;
  try {
    const conn = await loadConnection(link.user_id);
    if (!conn) return;
    const c = cookies(req);
    const fbc = c._fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
    await graph('POST', `${link.pixel_id}/events`, conn.token, {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || undefined,
        action_source: 'website',
        event_source_url: sourceUrl,
        user_data: {
          client_ip_address: clientIp(req) || undefined,
          client_user_agent: req.headers['user-agent'] || undefined,
          fbc,
          fbp: c._fbp || undefined,
          external_id: c.pl_vid ? [sha256(c.pl_vid)] : undefined,
          // Hashed, as Meta requires; only present for fans who logged in with Spotify
          em: email ? [sha256(email.trim().toLowerCase())] : undefined,
          country: country ? [sha256(country.trim().toLowerCase())] : undefined,
        },
        custom_data: { service, link: link.slug, title: link.title, campaign: campaign || undefined },
      }],
      test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
    });
  } catch (err) {
    console.error('[smartlinks] Conversions API event failed', err.message, err.meta || '');
  }
}

/** Views, clicks and clicks per service for a set of events. */
export async function statsFor(where, params) {
  await ensureTables();
  const [totals] = await query(
    `SELECT count(*) FILTER (WHERE kind = 'view')::int AS views,
            count(*) FILTER (WHERE kind = 'click')::int AS clicks,
            count(*) FILTER (WHERE kind = 'click' AND from_ad)::int AS ad_clicks
     FROM smart_link_events WHERE ${where}`, params);
  const byService = await query(
    `SELECT service, count(*)::int AS clicks FROM smart_link_events
     WHERE ${where} AND kind = 'click' GROUP BY service ORDER BY clicks DESC`, params);
  return {
    views: totals.views,
    clicks: totals.clicks,
    adClicks: totals.ad_clicks,
    clickRate: totals.views ? totals.clicks / totals.views : 0,
    fans: (await query(`SELECT count(*)::int AS n FROM smart_link_fans WHERE ${where}`, params))[0].n,
    byService: byService.map(r => ({ service: r.service, label: SERVICES[r.service]?.label || r.service, clicks: r.clicks })),
  };
}
