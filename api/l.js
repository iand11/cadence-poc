// GET /l/:slug (rewritten to /api/l?slug=) — public smart link landing page.
// GET /l/:slug/spotify — consent page shown before Spotify when the link has fan
// capture on: "Continue with Spotify" (login → follow + save → track, see
// api/spotify-fan.js) or "Just listen" (plain tracked click).
// Records a view and renders a button per streaming service. Buttons go through
// /go/:slug/:service, which records the click and redirects. If the link has a Meta
// Pixel, the page fires PageView and a DSPClick event whose id the server reuses for
// the Conversions API, so Meta counts each click once.
// ?preview=1 (the Links page preview) renders the same page without recording a
// view, loading the Pixel or following the buttons.
import crypto from 'node:crypto';
import { getLink, recordEvent, SERVICES } from './lib/smartlinks.js';
import { spotifyLoginConfigured } from './lib/spotify-fans.js';
import { dspIconSvg } from './lib/dsp-icons.js';

// Percent-encode characters that could end a CSS url('…') before HTML-escaping
const cssUrl = (u) => esc(String(u).replace(/['"()\\\s]/g, c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function pixelSnippet(pixelId, viewEventId) {
  if (!pixelId) return '';
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(String(pixelId))});
fbq('track', 'PageView', {}, { eventID: ${JSON.stringify(viewEventId)} });
</script>`;
}

const STYLE = `
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0D0C0B;color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;justify-content:center}
  main{width:100%;max-width:420px;padding:32px 16px 48px}
  h1{font-size:20px;margin:18px 0 2px}p{margin:0 0 20px;color:#9B9590;font-size:14px}
  .btn{display:block;text-align:center;padding:15px 16px;margin-bottom:10px;border-radius:999px;text-decoration:none;font-size:15px;font-weight:700}
  .spotify{background:#1DB954;color:#0D0C0B}.plain{border:1px solid #2C2B28;color:#F5F0E8;font-weight:500}
  ul{margin:0 0 22px;padding-left:18px;color:#9B9590;font-size:13px;line-height:1.7}
  .thumb{width:64px;height:64px;border-radius:8px;object-fit:cover;background:#171614}
  .head{display:flex;gap:14px;align-items:center;margin-bottom:20px}.head h1{margin:0 0 2px;font-size:18px}.head p{margin:0}
  footer{margin-top:28px;text-align:center;font-size:11px;color:#6B6560}
`;

// Landing page: blurred artwork behind a card with the art, the title bar and a row per service
const LANDING_STYLE = `
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0D0C0B;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;justify-content:center}
  .bg{position:fixed;inset:-60px;background:#2C2B28 center/cover no-repeat;filter:blur(40px) brightness(.55);z-index:0}
  main{position:relative;z-index:1;width:100%;max-width:420px;padding:32px 16px 40px}
  .card{border-radius:10px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);background:#fff}
  .art{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#171614}
  .bar{background:#262523;color:#F5F0E8;text-align:center;padding:16px 16px 18px}
  .bar h1{font-size:19px;font-weight:500;margin:0 0 6px;letter-spacing:.2px}.bar p{margin:0;font-size:13px;color:#C9C3BB}
  .row{display:flex;align-items:center;gap:12px;padding:16px 18px;border-top:1px solid #ECECEC;text-decoration:none;color:#111}
  .row:hover{background:#FAFAFA}.logo{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
  .logo span{font-size:18px;font-weight:600;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .play{flex:none;width:104px;text-align:center;font-size:14px;color:#333;border:1px solid #D4D4D4;border-radius:4px;padding:8px 0}
  .row:hover .play{border-color:#111;color:#111}
  footer{margin-top:22px;text-align:center;font-size:11px;color:rgba(255,255,255,.65)}
`;
// Brand color for each logo on the white rows (TIDAL's white mark becomes black)
const iconColor = (service) => (service === 'tidal' ? '#000000' : SERVICES[service]?.color || '#DA7756');

function consentPage({ link, params }) {
  const carry = new URLSearchParams();
  for (const k of ['c', 'fbclid', 'e']) if (params.get(k)) carry.set(k, params.get(k));
  const q = carry.size ? `&${carry}` : '';
  const artist = link.artist_name || 'the artist';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(link.title)} on Spotify</title><meta name="robots" content="noindex">
<style>${STYLE}</style>
</head><body><main>
<div class="head">
  ${link.image_url ? `<img class="thumb" src="${esc(link.image_url)}" alt="">` : '<div class="thumb"></div>'}
  <div><h1>${esc(link.title)}</h1><p>${esc(link.artist_name || '')}</p></div>
</div>
<p style="color:#F5F0E8;font-size:16px;margin-bottom:10px">Follow ${esc(artist)} and save "${esc(link.title)}" on Spotify?</p>
<ul>
  <li>Continuing follows ${esc(artist)} and adds the ${esc(spotifyKind(link))} to your library.</li>
  <li>${esc(artist)}'s team sees your Spotify name, email, country, favorite artists and what you listen to.</li>
  <li>You can remove access anytime in your Spotify account under Apps.</li>
</ul>
<a class="btn spotify" href="/api/spotify-fan?slug=${encodeURIComponent(link.slug)}${esc(q)}">Continue with Spotify</a>
<a class="btn plain" href="/go/${encodeURIComponent(link.slug)}/spotify${carry.size ? `?${esc(carry.toString())}` : ''}">Just listen</a>
<footer>Powered by Prelude</footer>
</main></body></html>`;
}

const spotifyKind = (link) => /\/album\//.test(link.links?.find(l => l.service === 'spotify')?.url || '') ? 'album' : 'song';

function page({ link, params, pixelId, preview }) {
  const carry = new URLSearchParams();
  for (const k of ['c', 'fbclid']) if (params.get(k)) carry.set(k, params.get(k));
  const askFans = link.fan_capture && spotifyLoginConfigured();
  const buttons = (link.links || []).map(({ service }) => {
    const s = SERVICES[service] || { label: service };
    // With fan capture on, Spotify goes through the consent page first
    const base = askFans && service === 'spotify'
      ? `/l/${encodeURIComponent(link.slug)}/spotify`
      : `/go/${encodeURIComponent(link.slug)}/${encodeURIComponent(service)}`;
    const href = preview ? '#' : `${base}${carry.size ? `?${carry}` : ''}`;
    return `<a class="row" href="${esc(href)}" data-service="${esc(service)}">
      <span class="logo">${dspIconSvg(service, { size: 30, color: iconColor(service) })}<span>${esc(s.label)}</span></span>
      <span class="play">Play</span></a>`;
  }).join('\n');
  const title = link.artist_name ? `${link.title} · ${link.artist_name}` : link.title;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Listen on your favorite service">
${link.image_url ? `<meta property="og:image" content="${esc(link.image_url)}">` : ''}
<meta name="robots" content="noindex">
<style>${LANDING_STYLE}</style>
${preview ? '' : pixelSnippet(pixelId, params.get('_view'))}
</head><body>
<div class="bg"${link.image_url ? ` style="background-image:url('${cssUrl(link.image_url)}')"` : ''}></div>
<main>
<div class="card">
${link.image_url ? `<img class="art" src="${esc(link.image_url)}" alt="">` : '<div class="art"></div>'}
<div class="bar"><h1>${esc(link.artist_name ? `${link.artist_name} | ${link.title}` : link.title)}</h1><p>Choose your preferred music service</p></div>
${buttons}
</div>
<footer>Powered by Prelude</footer>
</main>
<script>
var preview = ${preview ? 'true' : 'false'};
document.querySelectorAll('a.row').forEach(function (a) {
  a.addEventListener('click', function (ev) {
    if (preview) { ev.preventDefault(); return; }
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
    a.href += (a.href.indexOf('?') < 0 ? '?' : '&') + 'e=' + encodeURIComponent(id);
    if (window.fbq) fbq('trackCustom', 'DSPClick', { service: a.dataset.service }, { eventID: id });
  });
});
</script>
</body></html>`;
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const slug = params.get('slug');
  const link = slug ? await getLink(slug).catch(() => null) : null;
  if (!link) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif">This link doesn\'t exist.</p>');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (params.get('view') === 'spotify' && link.fan_capture) {
    await recordEvent(req, link.slug, { kind: 'consent_view', service: 'spotify', campaign: params.get('c'), fromAd: params.has('fbclid') });
    return res.end(consentPage({ link, params }));
  }
  if (params.get('preview') === '1') return res.end(page({ link, params, pixelId: null, preview: true }));
  await recordEvent(req, link.slug, { kind: 'view', campaign: params.get('c'), fromAd: params.has('fbclid') });
  params.set('_view', crypto.randomUUID());
  return res.end(page({ link, params, pixelId: link.pixel_id }));
}
