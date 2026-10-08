// /api/links — the signed-in user's smart links.
//
//   GET                       → { links: [{ slug, url, title, artistName, links, pixelId, views, clicks }] }
//   GET ?slug=x               → { link, stats, daily: [{ day, views, clicks }], byCampaign }
//   GET ?campaign=<id>        → stats for one Prelude campaign across links (from ?c= on the link)
//   GET ?pixels=1             → { pixels: [{ id, name, adAccountId }] } from the user's assigned ad accounts
//   GET ?fans=<slug>          → { fans: [...] } Spotify fans captured by that link (newest first),
//                               with their plays of the release / artist since capture
//   POST { action: 'sync', slug } → sync that link's fans' recent Spotify plays now
//   POST { sourceUrl, artistSlug?, artistName?, title?, imageUrl?, links?, pixelId?, fanCapture? }
//        → creates a link; service links are looked up from sourceUrl unless given
//   PATCH { slug, title?, links?, pixelId?, fanCapture? }
//   DELETE ?slug=x
import { query, queryOne } from '../lib/db.js';
import { getUid, readBody, sendError, loadConnection, graphList, assignedAdAccounts } from '../lib/meta.js';
import {
  ensureTables, resolveLinks, cleanLinks, makeSlug, linkUrl, statsFor, isHttpUrl,
} from '../lib/smartlinks.js';
import { spotifyLoginConfigured } from '../lib/spotify-fans.js';
import { ensureSyncTables, listeningStats, releaseFilter, syncListener } from '../lib/spotify-sync.js';

/** Plays by this link's fans (null when it has never captured a fan). */
async function linkListening(row) {
  return listeningStats({ slug: row.slug, link: row });
}

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

function shape(req, row, counts = {}) {
  return {
    slug: row.slug,
    url: linkUrl(req, row.slug),
    title: row.title,
    artistSlug: row.artist_slug,
    artistName: row.artist_name,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    links: row.links || [],
    pixelId: row.pixel_id,
    fanCapture: !!row.fan_capture,
    createdAt: row.created_at,
    views: counts.views ?? 0,
    clicks: counts.clicks ?? 0,
  };
}

async function ownedLink(uid, slug) {
  const row = await queryOne('SELECT * FROM smart_links WHERE slug = $1 AND user_id = $2', [slug, uid]);
  if (!row) throw bad('Link not found', 404);
  return row;
}

async function listPixels(uid) {
  const conn = await loadConnection(uid);
  if (!conn) return [];
  const accounts = [...assignedAdAccounts(conn.selection)];
  const lists = await Promise.all(accounts.map(act =>
    graphList(`${act}/adspixels`, conn.token, { fields: 'id,name' }, 1)
      .then(px => px.map(p => ({ id: p.id, name: p.name, adAccountId: act })))
      .catch(() => [])));
  const seen = new Set();
  return lists.flat().filter(p => !seen.has(p.id) && seen.add(p.id));
}

async function validPixel(uid, pixelId) {
  if (!pixelId) return null;
  const pixels = await listPixels(uid);
  if (!pixels.some(p => p.id === String(pixelId))) throw bad("That Pixel isn't in an ad account you've assigned in Ad Accounts.");
  return String(pixelId);
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  try {
    await ensureTables();
    const uid = await getUid(req);

    if (req.method === 'GET') {
      if (params.get('pixels')) return res.status(200).json({ pixels: await listPixels(uid) });

      if (params.get('fans')) {
        const row = await ownedLink(uid, params.get('fans'));
        await ensureSyncTables();
        const release = releaseFilter(row);
        const fans = await query(
          `SELECT f.spotify_user_id, f.display_name, f.email, f.country, f.product, f.followed, f.saved,
                  f.top_artists, f.campaign, f.from_ad, f.created_at, l.last_synced_at, l.revoked, l.sync_error,
                  (SELECT count(*)::int FROM spotify_plays p WHERE p.spotify_user_id = f.spotify_user_id
                     AND p.played_at >= f.created_at AND ${release}) AS release_plays,
                  (SELECT count(*)::int FROM spotify_plays p WHERE p.spotify_user_id = f.spotify_user_id
                     AND p.played_at >= f.created_at AND p.artist_ids && $2::text[]) AS artist_plays,
                  (SELECT max(p.played_at) FROM spotify_plays p WHERE p.spotify_user_id = f.spotify_user_id
                     AND ${release}) AS last_release_play
           FROM smart_link_fans f LEFT JOIN spotify_listeners l USING (spotify_user_id)
           WHERE f.slug = $1 ORDER BY f.created_at DESC LIMIT 5000`, [row.slug, row.spotify_artist_ids || []]);
        return res.status(200).json({
          fans: fans.map(f => ({
            spotifyUserId: f.spotify_user_id, name: f.display_name, email: f.email, country: f.country,
            product: f.product, followed: f.followed, saved: f.saved, topArtists: f.top_artists || [],
            campaign: f.campaign, fromAd: f.from_ad, createdAt: f.created_at,
            releasePlays: f.release_plays, artistPlays: f.artist_plays, lastReleasePlay: f.last_release_play,
            lastSyncedAt: f.last_synced_at, accessRemoved: !!f.revoked, syncError: f.sync_error || null,
          })),
        });
      }

      if (params.get('campaign')) {
        // Only campaigns that point at this user's links
        const stats = await statsFor(
          `campaign = $1 AND slug IN (SELECT slug FROM smart_links WHERE user_id = $2)`,
          [params.get('campaign'), uid]);
        // Listening: measured against the release of the campaign's (first) link
        const linkRow = await queryOne(
          `SELECT l.* FROM smart_links l WHERE l.user_id = $2 AND l.slug IN
             (SELECT slug FROM smart_link_events WHERE campaign = $1) LIMIT 1`, [params.get('campaign'), uid]);
        const listening = linkRow && stats.fans ? await listeningStats({
          campaign: params.get('campaign'), uid,
          link: linkRow,
        }) : null;
        return res.status(200).json({ ...stats, listening });
      }

      if (params.get('slug')) {
        const row = await ownedLink(uid, params.get('slug'));
        const stats = await statsFor('slug = $1', [row.slug]);
        const daily = await query(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  count(*) FILTER (WHERE kind = 'view')::int AS views,
                  count(*) FILTER (WHERE kind = 'click')::int AS clicks
           FROM smart_link_events WHERE slug = $1 AND created_at > now() - interval '30 days'
           GROUP BY 1 ORDER BY 1`, [row.slug]);
        const byCampaign = await query(
          `SELECT campaign, count(*) FILTER (WHERE kind = 'view')::int AS views,
                  count(*) FILTER (WHERE kind = 'click')::int AS clicks
           FROM smart_link_events WHERE slug = $1 AND campaign IS NOT NULL
           GROUP BY campaign ORDER BY clicks DESC`, [row.slug]);
        const listening = stats.fans ? await linkListening(row) : null;
        return res.status(200).json({ link: shape(req, row, stats), stats, daily, byCampaign, listening });
      }

      const rows = await query(
        `SELECT l.*, c.views, c.clicks FROM smart_links l
         LEFT JOIN LATERAL (
           SELECT count(*) FILTER (WHERE kind = 'view')::int AS views,
                  count(*) FILTER (WHERE kind = 'click')::int AS clicks
           FROM smart_link_events e WHERE e.slug = l.slug
         ) c ON true
         WHERE l.user_id = $1 ORDER BY l.created_at DESC`, [uid]);
      return res.status(200).json({ links: rows.map(r => shape(req, r, r)), spotifyLogin: spotifyLoginConfigured() });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action === 'sync') {
        const row = await ownedLink(uid, body.slug);
        await ensureSyncTables();
        const listeners = await query(
          `SELECT l.* FROM spotify_listeners l
           WHERE NOT l.revoked AND l.refresh_token_enc IS NOT NULL
             AND l.spotify_user_id IN (SELECT spotify_user_id FROM smart_link_fans WHERE slug = $1)`, [row.slug]);
        let plays = 0;
        for (const l of listeners) plays += await syncListener(l);
        const failed = listeners.length ? await query(
          `SELECT sync_error FROM spotify_listeners WHERE spotify_user_id = ANY($1) AND sync_error IS NOT NULL`,
          [listeners.map(l => l.spotify_user_id)]) : [];
        return res.status(200).json({ listeners: listeners.length, plays, errors: failed.map(f => f.sync_error) });
      }
      if (!isHttpUrl(body.sourceUrl) && !body.links?.length) {
        throw bad('Paste a Spotify, Apple Music or YouTube link to the release.');
      }
      let found = { title: null, artistName: null, imageUrl: null, links: [] };
      if (body.links?.length) found.links = cleanLinks(body.links);
      else found = await resolveLinks(body.sourceUrl);
      if (!found.links.length) throw bad('No streaming service links found for that release. Add them yourself.');

      const title = String(body.title || found.title || '').trim();
      if (!title) throw bad('Give the link a title.');
      const slug = makeSlug(title);
      const row = await queryOne(
        `INSERT INTO smart_links (slug, user_id, artist_slug, artist_name, title, image_url, source_url, links, pixel_id, fan_capture)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [slug, uid, body.artistSlug || null, body.artistName || found.artistName || null, title,
          (isHttpUrl(body.imageUrl) && body.imageUrl) || found.imageUrl || null,
          isHttpUrl(body.sourceUrl) ? body.sourceUrl : null,
          JSON.stringify(found.links), await validPixel(uid, body.pixelId), !!body.fanCapture]);
      return res.status(201).json({ link: shape(req, row) });
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const row = await ownedLink(uid, body.slug);
      const links = body.links ? cleanLinks(body.links) : row.links;
      if (!links.length) throw bad('A link needs at least one streaming service.');
      const pixelId = 'pixelId' in body ? await validPixel(uid, body.pixelId) : row.pixel_id;
      const updated = await queryOne(
        `UPDATE smart_links SET title = $3, links = $4, pixel_id = $5, fan_capture = $6, updated_at = now()
         WHERE slug = $1 AND user_id = $2 RETURNING *`,
        [row.slug, uid, String(body.title || row.title).trim(), JSON.stringify(links), pixelId,
          'fanCapture' in body ? !!body.fanCapture : row.fan_capture]);
      return res.status(200).json({ link: shape(req, updated) });
    }

    if (req.method === 'DELETE') {
      const row = await ownedLink(uid, params.get('slug'));
      await query('DELETE FROM smart_links WHERE slug = $1', [row.slug]);
      return res.status(200).json({ ok: true });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
