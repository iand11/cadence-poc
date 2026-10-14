// What a smart link visit tells us about the visitor, without them logging in:
// request headers (IP, Vercel geo, user agent, client hints, language), the URL
// (UTM tags, ad click ids), our own first-party cookies (visitor id, consent) and
// Meta's _fbp/_fbc. Browser-side signals (screen, timezone, connection, …) arrive
// later through the page's beacon (see api/l.js).
//
// Consent: visitors in the EU/EEA, UK and Switzerland get a consent bar. Until they
// allow it, no visitor cookie is set, the Meta Pixel doesn't load, nothing is sent to
// the Conversions API and the page reads nothing from the browser. Server-side event
// rows (headers only) are still written. A Global Privacy Control signal (Sec-GPC)
// opts the visitor out of Meta sharing everywhere.
import crypto from 'node:crypto';

const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU
  'IS', 'LI', 'NO', // EEA
  'GB', 'CH',
]);

export const VISITOR_COOKIE = 'pl_vid';
export const CONSENT_COOKIE = 'pl_consent';

// Ad-platform click ids; any one present means the visit came from that platform's ad or post
export const CLICK_ID_PARAMS = ['fbclid', 'igshid', 'gclid', 'gbraid', 'wbraid', 'dclid', 'ttclid', 'twclid', 'msclkid', 'sccid', 'li_fat_id', 'epik', 'rdt_cid'];
export const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
// Query params the landing page passes on to /go and the consent page
export const CARRY_PARAMS = ['c', ...CLICK_ID_PARAMS, ...UTM_PARAMS];

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => {
    const i = c.indexOf('=');
    let v = c.slice(i + 1);
    try { v = decodeURIComponent(v); } catch { /* keep raw */ }
    return [c.slice(0, i), v];
  }));
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
}

const header = (req, name) => {
  const v = req.headers[name];
  if (!v) return null;
  try { return decodeURIComponent(String(v)); } catch { return String(v); }
};
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Vercel's IP geolocation headers (absent in local dev). */
export function geo(req) {
  return {
    country: header(req, 'x-vercel-ip-country'),
    region: header(req, 'x-vercel-ip-country-region'),
    city: header(req, 'x-vercel-ip-city'),
    postalCode: header(req, 'x-vercel-ip-postal-code'),
    latitude: num(req.headers['x-vercel-ip-latitude']),
    longitude: num(req.headers['x-vercel-ip-longitude']),
    timezone: header(req, 'x-vercel-ip-timezone'),
  };
}

const IN_APP = [
  ['instagram', /Instagram/i], ['facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i], ['messenger', /Messenger|FBAN\/Messenger/i],
  ['tiktok', /musical_ly|BytedanceWebview|TikTok|trill_/i], ['snapchat', /Snapchat/i], ['twitter', /Twitter/i],
  ['linkedin', /LinkedInApp/i], ['pinterest', /Pinterest/i], ['threads', /Barcelona/i], ['line', /\bLine\//i],
  ['wechat', /MicroMessenger/i], ['whatsapp', /WhatsApp/i], ['telegram', /Telegram/i], ['reddit', /Reddit/i],
  ['discord', /Discord/i], ['youtube', /com\.google\.ios\.youtube|YouTube/i], ['gsa', /GSA\//i],
];

const vers = (s) => (s ? s.replace(/_/g, '.') : null);

/** OS, browser, device type/model and in-app browser from the user agent and client hints. */
export function parseUserAgent(req) {
  const ua = req.headers['user-agent'] || '';
  let os = null; let osVersion = null; let m;
  if ((m = ua.match(/iPhone OS ([\d_]+)|iPad.*OS ([\d_]+)|CPU OS ([\d_]+)/))) { os = 'iOS'; osVersion = vers(m[1] || m[2] || m[3]); }
  else if ((m = ua.match(/Android ([\d.]+)/))) { os = 'Android'; osVersion = m[1]; }
  else if ((m = ua.match(/Windows NT ([\d.]+)/))) { os = 'Windows'; osVersion = m[1]; }
  else if ((m = ua.match(/Mac OS X ([\d_.]+)/))) { os = 'macOS'; osVersion = vers(m[1]); }
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = null; let browserVersion = null;
  for (const [name, re] of [
    ['Edge', /Edg(?:A|iOS)?\/([\d.]+)/], ['Opera', /OPR\/([\d.]+)/], ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/], ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['Safari', /Version\/([\d.]+).*Safari/],
  ]) {
    if ((m = ua.match(re))) { browser = name; browserVersion = m[1]; break; }
  }
  const inApp = IN_APP.find(([, re]) => re.test(ua))?.[0] || null;
  if (inApp && !browser) browser = 'WebView';

  const tablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua);
  const mobile = !tablet && /Mobile|iPhone|iPod|Android/i.test(ua);
  let deviceModel = null;
  if (/iPhone/.test(ua)) deviceModel = 'iPhone';
  else if (/iPad/.test(ua)) deviceModel = 'iPad';
  else if ((m = ua.match(/Android [\d.]+;(?: [a-z]{2}[-_][A-Z]{2};)? ([^;)]+?)(?: Build\/|\))/))) deviceModel = m[1].trim();
  // Instagram/Facebook iOS in-app browsers include the exact model, e.g. "iPhone15,3"
  if ((m = ua.match(/\b(iPhone\d+,\d+|iPad\d+,\d+)\b/))) deviceModel = m[1];

  // Chromium client hints (sent after the page asks with Accept-CH) are more exact
  const hint = (n) => String(req.headers[n] || '').replace(/^"|"$/g, '') || null;
  const chModel = hint('sec-ch-ua-model');
  const chPlatform = hint('sec-ch-ua-platform');
  const chPlatformVersion = hint('sec-ch-ua-platform-version');
  if (chModel) deviceModel = chModel;
  if (chPlatform && chPlatformVersion) {
    os = chPlatform === 'macOS' || chPlatform === 'Windows' || chPlatform === 'Android' ? chPlatform : os || chPlatform;
    osVersion = chPlatformVersion;
  }
  return {
    userAgent: ua || null,
    device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
    os, osVersion, browser, browserVersion, deviceModel, inApp,
  };
}

export function language(req) {
  const first = String(req.headers['accept-language'] || '').split(',')[0].split(';')[0].trim();
  return first || null;
}

/** UTM tags and ad click ids from the request URL. */
export function trackingParams(params) {
  const utm = {}; const clickIds = {};
  for (const k of UTM_PARAMS) if (params.get(k)) utm[k] = params.get(k).slice(0, 200);
  for (const k of CLICK_ID_PARAMS) if (params.get(k)) clickIds[k] = params.get(k).slice(0, 300);
  return { utm, clickIds };
}

/** URLSearchParams with the params worth passing to the next hop. */
export function carryParams(params, extra = []) {
  const carry = new URLSearchParams();
  for (const k of [...CARRY_PARAMS, ...extra]) if (params.get(k)) carry.set(k, params.get(k));
  return carry;
}

export const consentRequired = (req) => CONSENT_COUNTRIES.has(String(req.headers['x-vercel-ip-country'] || '').toUpperCase());
export const gpc = (req) => req.headers['sec-gpc'] === '1';

/** 'not_required' | 'granted' | 'denied' | 'unknown' */
export function consentState(req) {
  if (!consentRequired(req)) return 'not_required';
  const v = cookies(req)[CONSENT_COOKIE];
  return v === 'granted' || v === 'denied' ? v : 'unknown';
}

/** Whether we may set cookies, read the browser and load the Pixel for this visitor. */
export const mayTrack = (req) => ['not_required', 'granted'].includes(consentState(req));

const secure = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';

/**
 * The visitor's first-party id: read from our cookie, or minted and set (1 year,
 * HttpOnly — server-set cookies aren't cut to 7 days by Safari like script-set
 * ones). Returns null when the visitor hasn't consented where consent is needed.
 */
export function visitorId(req, res) {
  if (!mayTrack(req)) return null;
  const existing = cookies(req)[VISITOR_COOKIE];
  if (existing && /^[\w-]{8,64}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  if (res && !res.headersSent) {
    const cookie = `${VISITOR_COOKIE}=${id}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax${secure(req) ? '; Secure' : ''}`;
    const prev = res.getHeader?.('Set-Cookie');
    res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
  }
  // Remember it for the rest of this request
  req.headers.cookie = `${req.headers.cookie ? `${req.headers.cookie}; ` : ''}${VISITOR_COOKIE}=${id}`;
  return id;
}

// Ask Chromium browsers for the exact device model and OS version on later requests
export const ACCEPT_CH = 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List';

/** Clean the browser beacon's payload down to known keys and sane sizes. */
export function cleanClientInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  const NUM = ['screenW', 'screenH', 'viewportW', 'viewportH', 'dpr', 'colorDepth', 'tzOffset', 'cores', 'memory',
    'touchPoints', 'downlink', 'rtt', 'msToBeacon'];
  const STR = ['timezone', 'platform', 'effectiveType', 'connectionType', 'orientation', 'referrer', 'url'];
  const BOOL = ['dark', 'reducedMotion', 'saveData', 'standalone', 'cookies', 'doNotTrack', 'gpc'];
  for (const k of NUM) if (Number.isFinite(Number(raw[k])) && raw[k] !== null && raw[k] !== '') out[k] = Number(raw[k]);
  for (const k of STR) if (typeof raw[k] === 'string' && raw[k]) out[k] = raw[k].slice(0, 300);
  for (const k of BOOL) if (typeof raw[k] === 'boolean') out[k] = raw[k];
  if (Array.isArray(raw.languages)) out.languages = raw.languages.filter(l => typeof l === 'string').slice(0, 10).map(l => l.slice(0, 20));
  return Object.keys(out).length ? out : null;
}
