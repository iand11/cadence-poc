import crypto from 'node:crypto';

/* ──────────────────────────────────────────────────────────────────────────
   APP-WIDE ACCESS GATE (server-validated)

   Protects the whole prototype behind a single shared password. The password is
   checked server-side and never ships in the client bundle; on success we set an
   HMAC-signed, HttpOnly session cookie that the client re-checks on load.

   This is independent from the investor pitch gate (api/pitch.js), which keeps
   its own password. Required env vars:
     APP_PASSWORD         — the password required to enter the app
     APP_SESSION_SECRET   — random string used to sign the session cookie
   Set these in `.env` for local dev and in Vercel project settings for prod.

   NOTE: this gates the app UI. Because the site is a static SPA, the JS/JSON
   assets are still individually fetchable by direct URL. For edge-level
   protection of every asset, enable Vercel Deployment Protection (password) too.
   ────────────────────────────────────────────────────────────────────────── */

const COOKIE_NAME = 'ms_app';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_SECRET = process.env.APP_SESSION_SECRET || process.env.PITCH_SESSION_SECRET || 'dev-change-me';

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [data, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const authed = !!verify(cookies[COOKIE_NAME]);
  const secure = req.headers['x-forwarded-proto'] === 'https';

  if (req.method === 'GET') {
    return json(res, authed ? 200 : 401, { ok: authed });
  }

  if (req.method === 'POST') {
    const password = process.env.APP_PASSWORD;
    if (!password) {
      return json(res, 500, { ok: false, error: 'APP_PASSWORD is not configured on the server.' });
    }

    const body = await readJsonBody(req);
    const submitted = body?.password ?? '';

    if (!safeEqual(submitted, password)) {
      return json(res, 401, { ok: false });
    }

    const token = sign({ exp: Date.now() + MAX_AGE_SECONDS * 1000 });
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`,
    );
    return json(res, 200, { ok: true });
  }

  res.statusCode = 405;
  res.end();
}
