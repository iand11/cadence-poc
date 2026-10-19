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
// POST /l/:slug — the page's beacon: browser signals (screen, timezone, connection, …)
// and the visitor's answer to the consent bar, attached to the view (api/lib/visitor.js).
import crypto from 'node:crypto';
import { getLink, recordEvent, recordClientInfo, SERVICES } from './lib/smartlinks.js';
import {
  carryParams, consentState, consentRequired, gpc, visitorId, cleanClientInfo, ACCEPT_CH, CONSENT_COOKIE,
} from './lib/visitor.js';
import { spotifyLoginConfigured } from './lib/spotify-fans.js';
import { dspIconSvg } from './lib/dsp-icons.js';

// Percent-encode characters that could end a CSS url('…') before HTML-escaping
const cssUrl = (u) => esc(String(u).replace(/['"()\\\s]/g, c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Defines loadPixel(); the page calls it right away, or after an EU/UK visitor allows it
function pixelSnippet(pixelId, viewEventId) {
  if (!pixelId) return '<script>function loadPixel(){}</script>';
  return `<script>
function loadPixel(){
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(String(pixelId))});
fbq('track', 'PageView', {}, { eventID: ${JSON.stringify(viewEventId)} });
}
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
  .consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:5;max-width:420px;margin:0 auto;background:#171614;color:#F5F0E8;border:1px solid #2C2B28;border-radius:10px;padding:14px 14px 12px;font-size:13px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .consent div{display:flex;gap:8px;margin-top:10px}.consent button{flex:1;padding:9px 0;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #2C2B28;background:transparent;color:#F5F0E8}
  .consent button.ok{background:#F5F0E8;color:#0D0C0B;border-color:#F5F0E8}
  footer{margin-top:22px;text-align:center;font-size:11px;color:rgba(255,255,255,.65)}
`;
// Brand color for each logo on the white rows (TIDAL's white mark becomes black)
const iconColor = (service) => (service === 'tidal' ? '#000000' : SERVICES[service]?.color || '#DA7756');

function consentPage({ link, params }) {
  const carry = carryParams(params, ['e', 'v', 'ms']);
  const q = carry.size ? `&${carry}` : '';
  const artist = link.artist_name || 'the artist';
  const name = link.title || link.artist_name || 'this release';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} on Spotify</title><meta name="robots" content="noindex">
<style>${STYLE}</style>
</head><body><main>
<div class="head">
  ${link.image_url ? `<img class="thumb" src="${esc(link.image_url)}" alt="">` : '<div class="thumb"></div>'}
  <div><h1>${esc(link.title || link.artist_name || '')}</h1><p>${esc(link.title ? link.artist_name || '' : '')}</p></div>
</div>
${spotifyKind(link) === 'artist' ? `<p style="color:#F5F0E8;font-size:16px;margin-bottom:10px">Follow ${esc(artist)} on Spotify?</p>
<ul>
  <li>Continuing follows ${esc(artist)}.</li>` : `<p style="color:#F5F0E8;font-size:16px;margin-bottom:10px">Follow ${esc(artist)} and save ${link.title ? `"${esc(link.title)}"` : `this ${esc(spotifyKind(link))}`} on Spotify?</p>
<ul>
  <li>Continuing follows ${esc(artist)} and adds the ${esc(spotifyKind(link))} to your library.</li>`}
  <li>${esc(artist)}'s team sees your Spotify name, email, favorite artists and what you listen to.</li>
  <li>You can remove access anytime in your Spotify account under Apps.</li>
</ul>
<a class="btn spotify" href="/api/spotify-fan?slug=${encodeURIComponent(link.slug)}${esc(q)}">Continue with Spotify</a>
<a class="btn plain" href="/go/${encodeURIComponent(link.slug)}/spotify${carry.size ? `?${esc(carry.toString())}` : ''}">Just listen</a>
<footer>Powered by Prelude</footer>
</main></body></html>`;
}

const spotifyKind = (link) => {
  const m = (link.links?.find(l => l.service === 'spotify')?.url || '').match(/\/(album|artist)\//);
  return m ? m[1] : 'song';
};

function page({ link, params, pixelId, preview, consent = 'not_required', sendGpc = false }) {
  const carry = carryParams(params);
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
  const parts = [link.title, link.artist_name].filter(Boolean);
  const title = parts.join(' · ') || 'Listen';
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
<div class="bar"><h1>${esc(parts.slice().reverse().join(' | ') || 'Listen')}</h1><p>Choose your preferred music service</p></div>
${buttons}
</div>
<footer>Powered by Prelude</footer>
</main>
${!preview && consent === 'unknown' ? `<div class="consent" id="consent">${esc(link.artist_name || 'This page')} uses cookies to measure visits and ads (including Meta).
<div><button type="button" data-consent="denied">No thanks</button><button type="button" class="ok" data-consent="granted">Allow</button></div></div>` : ''}
<script>
var preview = ${preview ? 'true' : 'false'};
var viewId = ${JSON.stringify(params.get('_view') || '')};
var consent = ${JSON.stringify(consent)};
var noMeta = ${sendGpc ? 'true' : 'false'};
var started = Date.now();
// Browser signals for the view: screen, timezone, connection, … (no fingerprint id is built from them)
function clientInfo() {
  var n = navigator, c = n.connection || {}, mm = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  return {
    screenW: screen.width, screenH: screen.height, viewportW: innerWidth, viewportH: innerHeight,
    dpr: window.devicePixelRatio, colorDepth: screen.colorDepth,
    timezone: (window.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || '', tzOffset: new Date().getTimezoneOffset(),
    languages: n.languages ? Array.prototype.slice.call(n.languages) : [n.language], platform: n.platform || '',
    cores: n.hardwareConcurrency, memory: n.deviceMemory, touchPoints: n.maxTouchPoints,
    effectiveType: c.effectiveType || '', connectionType: c.type || '', downlink: c.downlink, rtt: c.rtt, saveData: !!c.saveData,
    dark: mm('(prefers-color-scheme: dark)'), reducedMotion: mm('(prefers-reduced-motion: reduce)'),
    standalone: mm('(display-mode: standalone)'), orientation: (screen.orientation && screen.orientation.type) || '',
    cookies: n.cookieEnabled, doNotTrack: n.doNotTrack === '1', gpc: !!n.globalPrivacyControl,
    referrer: document.referrer, msToBeacon: Date.now() - started
  };
}
function beacon(body) {
  body.view = viewId;
  var data = JSON.stringify(body);
  try { if (navigator.sendBeacon && navigator.sendBeacon(location.pathname, new Blob([data], { type: 'application/json' }))) return; } catch (e) {}
  try { fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true, credentials: 'same-origin' }); } catch (e) {}
}
function allowed() { return consent === 'not_required' || consent === 'granted'; }
if (!preview && allowed()) { if (!noMeta) loadPixel(); beacon({ client: clientInfo() }); }
var bar = document.getElementById('consent');
if (bar) bar.addEventListener('click', function (ev) {
  var choice = ev.target && ev.target.getAttribute('data-consent');
  if (!choice) return;
  consent = choice;
  document.cookie = ${JSON.stringify(CONSENT_COOKIE)} + '=' + choice + '; Max-Age=31536000; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  bar.remove();
  // The server sets the visitor id cookie on this request when allowed
  if (choice === 'granted') { if (!noMeta) loadPixel(); beacon({ consent: choice, client: clientInfo() }); }
  else beacon({ consent: choice });
});
document.querySelectorAll('a.row').forEach(function (a) {
  a.addEventListener('click', function (ev) {
    if (preview) { ev.preventDefault(); return; }
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
    var u = new URL(a.href);
    u.searchParams.set('e', id); u.searchParams.set('v', viewId); u.searchParams.set('ms', String(Date.now() - started));
    a.href = u.toString();
    if (window.fbq) fbq('trackCustom', 'DSPClick', { service: a.dataset.service }, { eventID: id });
  });
});
</script>
</body></html>`;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) return {}; }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

// The page's beacon: browser signals and the consent bar's answer for a view
async function beaconHandler(req, res, link) {
  const body = await readJson(req);
  const choice = ['granted', 'denied'].includes(body.consent) ? body.consent : null;
  // The answer arrives with this request's cookie set by the page; mint the visitor id now if allowed
  if (choice && consentRequired(req)) {
    req.headers.cookie = `${req.headers.cookie ? `${req.headers.cookie}; ` : ''}${CONSENT_COOKIE}=${choice}`;
  }
  const consent = consentState(req);
  const allowed = consent === 'not_required' || consent === 'granted';
  await recordClientInfo(req, link.slug, {
    viewId: typeof body.view === 'string' ? body.view.slice(0, 64) : null,
    client: allowed ? cleanClientInfo(body.client) : null,
    consent: choice,
    visitor: allowed ? visitorId(req, res) : null,
  });
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const slug = params.get('slug');
  const link = slug ? await getLink(slug).catch(() => null) : null;
  if (req.method === 'POST') {
    if (!link) { res.statusCode = 404; return res.end(); }
    return beaconHandler(req, res, link);
  }
  if (!link) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif">This link doesn\'t exist.</p>');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (params.get('view') === 'spotify' && link.fan_capture) {
    await recordEvent(req, link.slug, {
      kind: 'consent_view', service: 'spotify', campaign: params.get('c'), fromAd: params.has('fbclid'), params, res,
    });
    return res.end(consentPage({ link, params }));
  }
  if (params.get('preview') === '1') return res.end(page({ link, params, pixelId: null, preview: true }));
  const viewId = crypto.randomUUID();
  res.setHeader('Accept-CH', ACCEPT_CH);
  await recordEvent(req, link.slug, {
    kind: 'view', campaign: params.get('c'), fromAd: params.has('fbclid'), params, res, eventId: viewId,
  });
  params.set('_view', viewId);
  return res.end(page({ link, params, pixelId: link.pixel_id, consent: consentState(req), sendGpc: gpc(req) }));
}
