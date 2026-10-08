// Smart links: Prelude's own landing page per release with a button for each
// streaming service. Every view and click is recorded (smart_link_events), tagged
// with the campaign the visitor came from, and each click is sent to Meta as a
// DSPClick event (Pixel in the page + Conversions API from the server, deduplicated
// by a shared event id) so ads can be measured and optimized on streaming clicks.
//
// Env:
//   ODESLI_API_URL       — optional; link lookup API base (default song.link's public API)
//   SMART_LINK_BASE_URL  — optional; public origin for links (default: the request's origin)
//   META_TEST_EVENT_CODE — optional; sends Conversions API events to Events Manager's Test Events
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { graph, loadConnection } from './meta.js';

const ODESLI = process.env.ODESLI_API_URL || 'https://api.song.link/v1-alpha.1';

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

let tablesReady;
export function ensureTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS smart_links (
          slug text PRIMARY KEY, user_id text NOT NULL, artist_slug text, artist_name text,
          title text NOT NULL, image_url text, source_url text,
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

/** Look up a release on every service from one URL (Spotify, Apple Music, YouTube, …). */
export async function resolveLinks(sourceUrl) {
  const res = await fetch(`${ODESLI}/links?url=${encodeURIComponent(sourceUrl)}&userCountry=US`);
  if (!res.ok) {
    throw Object.assign(new Error(res.status === 404
      ? "Couldn't find that release. Check the link, or add the service links yourself."
      : `Link lookup failed (${res.status}). Add the service links yourself.`), { status: 400 });
  }
  const body = await res.json();
  const entity = body.entitiesByUniqueId?.[body.entityUniqueId] || {};
  const links = Object.entries(body.linksByPlatform || {}).map(([service, v]) => ({ service, url: v.url }));
  return {
    title: entity.title || null,
    artistName: entity.artistName || null,
    imageUrl: entity.thumbnailUrl || null,
    links: cleanLinks(links),
  };
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

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
}

/** Record a view or click. Never throws — tracking must not break the redirect. */
export async function recordEvent(req, slug, { kind, service = null, campaign = null, fromAd = false }) {
  if (isBot(req)) return;
  const ua = req.headers['user-agent'] || '';
  try {
    await ensureTables();
    await query(
      `INSERT INTO smart_link_events (slug, kind, service, campaign, country, device, referrer, from_ad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [slug, kind, service, campaign ? String(campaign).slice(0, 100) : null,
        req.headers['x-vercel-ip-country'] || null,
        /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop',
        (req.headers.referer || '').slice(0, 300) || null,
        fromAd]
    );
  } catch (err) {
    console.error('[smartlinks] record failed', err.message);
  }
}

/**
 * Send a click to Meta through the Conversions API using the link owner's Meta
 * connection. Shares `eventId` with the Pixel event fired in the page so Meta
 * counts it once. Never throws.
 */
export async function sendMetaEvent(req, link, { eventName, eventId, service, campaign, sourceUrl, fbclid }) {
  if (!link.pixel_id || isBot(req)) return;
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
    byService: byService.map(r => ({ service: r.service, label: SERVICES[r.service]?.label || r.service, clicks: r.clicks })),
  };
}
