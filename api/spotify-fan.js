// GET /api/spotify-fan — Spotify login for a smart link's fans.
//
//   ?slug=&c=&fbclid=&e=   start: from the consent page's "Continue with Spotify";
//                          redirects to Spotify's authorize page
//   ?code=&state=          Spotify's callback: store the fan, follow + save, then send
//                          them to the release on Spotify
//   ?error=&state=         declined: still send them to the release
//
// Whatever happens, the fan ends up listening: every failure path redirects to the
// Spotify link (or the link page). The click is recorded and sent to Meta like a
// normal Spotify click, with the fan's hashed email when we have it.
import { query } from './lib/db.js';
import { signData, verifyData } from './lib/meta.js';
import { getLink, recordEvent, sendMetaEvent, publicOrigin, ensureTables } from './lib/smartlinks.js';
import { spotifyLoginConfigured, authorizeUrl, exchangeCode, captureFan, spotifyItem } from './lib/spotify-fans.js';

const META_TIMEOUT_MS = 1500;

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', location);
  res.end();
}

const spotifyUrl = (link) => link?.links?.find(l => l.service === 'spotify')?.url || null;

async function finishClick(req, link, ctx, fan) {
  await Promise.all([
    recordEvent(req, link.slug, { kind: 'click', service: 'spotify', campaign: ctx.c, fromAd: !!ctx.fbclid }),
    Promise.race([
      sendMetaEvent(req, link, {
        eventName: 'DSPClick', eventId: ctx.e, service: 'spotify', campaign: ctx.c, fbclid: ctx.fbclid,
        sourceUrl: `${publicOrigin(req)}/l/${link.slug}`, email: fan?.email, country: fan?.country,
      }),
      new Promise(r => setTimeout(r, META_TIMEOUT_MS)),
    ]),
  ]);
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;

  // Spotify's callback
  if (params.has('state')) {
    const ctx = verifyData(params.get('state'));
    const link = ctx ? await getLink(ctx.slug).catch(() => null) : null;
    if (!link) return redirect(res, '/');
    const target = spotifyUrl(link) || `/l/${link.slug}`;
    let fan = null;
    if (params.get('code')) {
      try {
        const token = await exchangeCode(req, params.get('code'));
        fan = await captureFan(token, spotifyItem(target));
        await ensureTables();
        await query(
          `INSERT INTO smart_link_fans (slug, spotify_user_id, display_name, email, country, product,
             followed, saved, top_artists, campaign, from_ad)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (slug, spotify_user_id) DO UPDATE SET
             display_name = EXCLUDED.display_name, email = EXCLUDED.email, country = EXCLUDED.country,
             product = EXCLUDED.product, followed = smart_link_fans.followed OR EXCLUDED.followed,
             saved = smart_link_fans.saved OR EXCLUDED.saved,
             top_artists = COALESCE(EXCLUDED.top_artists, smart_link_fans.top_artists),
             campaign = COALESCE(smart_link_fans.campaign, EXCLUDED.campaign),
             from_ad = smart_link_fans.from_ad OR EXCLUDED.from_ad, updated_at = now()`,
          [link.slug, fan.spotifyUserId, fan.displayName, fan.email, fan.country, fan.product,
            fan.followed, fan.saved, fan.topArtists ? JSON.stringify(fan.topArtists) : null,
            ctx.c || null, !!ctx.fbclid]);
      } catch (err) {
        console.error('[spotify-fan] capture failed', err.message);
      }
    } else {
      await recordEvent(req, link.slug, { kind: 'fan_declined', service: 'spotify', campaign: ctx.c, fromAd: !!ctx.fbclid });
    }
    await finishClick(req, link, ctx, fan);
    return redirect(res, target);
  }

  // Start
  const slug = params.get('slug');
  const link = slug ? await getLink(slug).catch(() => null) : null;
  if (!link) return redirect(res, '/');
  const carry = new URLSearchParams();
  for (const k of ['c', 'fbclid', 'e']) if (params.get(k)) carry.set(k, params.get(k));
  if (!link.fan_capture || !spotifyUrl(link) || !spotifyLoginConfigured()) {
    return redirect(res, `/go/${encodeURIComponent(link.slug)}/spotify${carry.size ? `?${carry}` : ''}`);
  }
  try {
    const state = signData({
      slug: link.slug, c: params.get('c') || null, fbclid: params.get('fbclid') || null, e: params.get('e') || null,
    }, 15 * 60 * 1000);
    return redirect(res, authorizeUrl(req, state));
  } catch (err) {
    console.error('[spotify-fan] start failed', err.message);
    return redirect(res, `/go/${encodeURIComponent(link.slug)}/spotify${carry.size ? `?${carry}` : ''}`);
  }
}
