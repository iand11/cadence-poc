// GET /l/:slug (rewritten to /api/l?slug=) — public smart link landing page.
// Records a view and renders a button per streaming service. Buttons go through
// /go/:slug/:service, which records the click and redirects. If the link has a Meta
// Pixel, the page fires PageView and a DSPClick event whose id the server reuses for
// the Conversions API, so Meta counts each click once.
import crypto from 'node:crypto';
import { getLink, recordEvent, SERVICES } from './lib/smartlinks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function pixelSnippet(pixelId, viewEventId) {
  if (!pixelId) return '';
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(String(pixelId))});
fbq('track', 'PageView', {}, { eventID: ${JSON.stringify(viewEventId)} });
</script>`;
}

function page({ link, params, pixelId }) {
  const carry = new URLSearchParams();
  for (const k of ['c', 'fbclid']) if (params.get(k)) carry.set(k, params.get(k));
  const buttons = (link.links || []).map(({ service }) => {
    const s = SERVICES[service] || { label: service };
    const href = `/go/${encodeURIComponent(link.slug)}/${encodeURIComponent(service)}${carry.size ? `?${carry}` : ''}`;
    return `<a class="svc" href="${esc(href)}" data-service="${esc(service)}">
      <span class="dot" style="background:${esc(s.color || '#DA7756')}"></span>
      <span class="name">${esc(s.label)}</span><span class="go">Play</span></a>`;
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
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0D0C0B;color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;justify-content:center}
  main{width:100%;max-width:420px;padding:32px 16px 48px}
  .art{width:100%;aspect-ratio:1;border-radius:10px;object-fit:cover;background:#171614;display:block}
  h1{font-size:20px;margin:18px 0 2px}p{margin:0 0 20px;color:#9B9590;font-size:14px}
  .svc{display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:10px;background:#171614;border:1px solid #2C2B28;border-radius:8px;color:#F5F0E8;text-decoration:none;font-size:15px}
  .svc:hover{border-color:#DA7756}.dot{width:10px;height:10px;border-radius:50%;flex:none}.name{flex:1}
  .go{font-size:12px;color:#0D0C0B;background:#DA7756;border-radius:999px;padding:5px 12px;font-weight:600}
  footer{margin-top:28px;text-align:center;font-size:11px;color:#6B6560}
</style>
${pixelSnippet(pixelId, params.get('_view'))}
</head><body><main>
${link.image_url ? `<img class="art" src="${esc(link.image_url)}" alt="">` : '<div class="art"></div>'}
<h1>${esc(link.title)}</h1>
<p>${esc(link.artist_name || 'Choose a service')}</p>
${buttons}
<footer>Powered by Prelude</footer>
</main>
<script>
document.querySelectorAll('a.svc').forEach(function (a) {
  a.addEventListener('click', function () {
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
  await recordEvent(req, link.slug, { kind: 'view', campaign: params.get('c'), fromAd: params.has('fbclid') });
  params.set('_view', crypto.randomUUID());
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(page({ link, params, pixelId: link.pixel_id }));
}
