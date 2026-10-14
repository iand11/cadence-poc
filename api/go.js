// GET /go/:slug/:service (rewritten to /api/go?slug=&service=) — records a streaming
// service click, sends it to Meta through the Conversions API (when the link has a
// Pixel), then redirects to the service. Works without JavaScript.
import { getLink, recordEvent, sendMetaEvent, publicOrigin } from './lib/smartlinks.js';
import { visitorId, ACCEPT_CH } from './lib/visitor.js';

// Don't hold the listener up for long if Meta is slow
const META_TIMEOUT_MS = 1500;

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const slug = params.get('slug');
  const service = params.get('service');
  const link = slug ? await getLink(slug).catch(() => null) : null;
  const target = link?.links?.find(l => l.service === service)?.url;

  if (!target) {
    res.statusCode = 302;
    res.setHeader('Location', link ? `/l/${encodeURIComponent(link.slug)}` : '/');
    return res.end();
  }

  const campaign = params.get('c');
  const fbclid = params.get('fbclid');
  visitorId(req, res); // set before the Meta event so it carries the visitor's external_id
  await Promise.all([
    recordEvent(req, link.slug, { kind: 'click', service, campaign, fromAd: !!fbclid, params, res, eventId: params.get('e') }),
    Promise.race([
      sendMetaEvent(req, link, {
        eventName: 'DSPClick', eventId: params.get('e'), service, campaign, fbclid,
        sourceUrl: `${publicOrigin(req)}/l/${link.slug}`,
      }),
      new Promise(r => setTimeout(r, META_TIMEOUT_MS)),
    ]),
  ]);

  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Accept-CH', ACCEPT_CH);
  res.setHeader('Location', target);
  return res.end();
}
