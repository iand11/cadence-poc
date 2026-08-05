import crypto from 'node:crypto';

/* ──────────────────────────────────────────────────────────────────────────
   HARD-GATED INVESTOR CONTENT (server only)

   This module runs on the server and is NEVER shipped to the browser. The copy
   and figures below are only sent to a client that has authenticated with the
   correct password. Edit the [bracketed] placeholders here before sharing.

   `icon` fields are STRING NAMES that the client maps to lucide icons.

   Required env vars:
     PITCH_PASSWORD         — the password required to view the page
     PITCH_SESSION_SECRET   — random string used to sign the session cookie
   Set these in `.env` for local dev and in Vercel project settings for prod.
   ────────────────────────────────────────────────────────────────────────── */
const PITCH_DATA = {
  company: 'Prelude',

  eyebrow: 'Investor Overview · Confidential',
  headline: ['The intelligence layer', 'for the music industry'],
  subhead:
    'Prelude unifies streaming, social, and revenue data into one workspace — with AI that turns it into decisions, branded artist pages, and ad campaigns teams actually ship.',

  raise: {
    stage: 'Seed',
    amount: '$1.5M',
    line: 'to grow the team, expand data coverage, and scale go-to-market.',
  },

  // Demo video — drop a file at /public/demo.mp4 (and optional /public/demo-poster.jpg).
  // Or set `src` to a hosted MP4 URL. Until a file exists, a placeholder is shown.
  video: {
    src: '/ElevenLabs_demo.mp4',
    poster: '/demo-poster.jpg',
    caption: 'A 3-minute walkthrough of Prelude in action.',
  },

  problem: {
    heading: 'Navigating the Global Music Ecosystem is Diverse, Dynamic, and Hyper-Complex',
    points: [
      { title: 'A Borderless Market', body: 'Music is inherently global. Today, location is irrelevant; artists must approach their careers and growth with a worldwide perspective because audiences can be cultivated anywhere.' },
      { title: 'Hyper-Competitive Reality', body: 'With over 100,000 new tracks released daily—a number that continues to climb—simply putting music out is just the starting point. The real challenge lies in cutting through the noise to build an audience and drive meaningful engagement.' },
      { title: 'Overwhelming Variables', body: 'The modern music ecosystem involves too many moving parts. Gaining a comprehensive, data-driven understanding of your catalog is increasingly complex, and translating those insights into actionable strategies remains a major hurdle.' },
    ],
  },

  // Flagship / core IP — the closed-loop advertising engine
  flagship: {
    eyebrow: 'The core IP',
    heading: 'From marketing plan to live campaigns — and back',
    subhead:
      'Our defensible IP is a closed-loop advertising engine. Prelude builds a cross-platform marketing plan, launches it on real ad networks, monitors performance in one place, and reallocates budget toward what’s working — turning data into spend that compounds.',
    steps: [
      { icon: 'ClipboardList', title: 'Plan', body: 'AI turns roster signals into a concrete marketing plan — objective, audience, budget, and creative — tuned for each platform.' },
      { icon: 'Rocket', title: 'Launch', body: 'Push campaigns live across platforms through native ad APIs, with the right objective and creative format per channel.' },
      { icon: 'Activity', title: 'Monitor', body: 'Track spend, reach, and performance across every platform in a single dashboard — no tab-hopping between ad managers.' },
      { icon: 'Shuffle', title: 'Reallocate', body: 'When a channel outperforms, the engine shifts budget toward it — continuously optimizing the plan without manual rework.' },
    ],
    platforms: ['Spotify', 'Meta / Instagram', 'Google Search', 'YouTube', 'TikTok', 'X (Twitter)'],
    moat: 'The moat is the allocation layer — the cross-platform data model, the plan → launch → optimize loop, and the reallocation engine that no single ad network provides.',
  },

  solution: {
    heading: 'The platform around the engine',
    pillars: [
      { icon: 'BarChart3', accent: '#7BAF73', title: 'Unified Analytics', body: 'Streaming, social, playlist, geography, and revenue signals across every major platform — normalized and always current.' },
      { icon: 'MessageSquare', accent: '#DA7756', title: 'AI Copilot', body: 'Ask anything about the roster in plain English. Get answers with live charts, and generate full reports from a single prompt.' },
      { icon: 'ListChecks', accent: '#D4A574', title: 'Prioritized Actions', body: 'The platform surfaces what matters and turns it into a ranked, trackable to-do list per artist — high, medium, low.' },
      { icon: 'Sheet', accent: '#9B7ED8', title: 'Branded Artist Pages', body: 'Shareable, editable one-pagers with live data and one-click PDF export — no design tools required.' },
      { icon: 'FileText', accent: '#4A90D9', title: 'Reports', body: 'Compose board- and label-ready reports from modular widgets, auto-saved and shareable by link.' },
    ],
  },

  whyNow: {
    heading: 'Why now',
    points: [
      { icon: 'TrendingUp', title: 'Everyone faces the same challenge', body: 'From self-releasing artists to indie labels to the majors, every tier is drowning in fragmented data and lacks tooling that turns it into action. Independents are the fastest-growing segment — but the pain runs all the way up.' },
      { icon: 'Zap', title: 'AI makes analysis a commodity', body: 'What required a data team a year ago is now a prompt. The winners will be whoever owns the workflow, not just the model.' },
      { icon: 'Globe', title: 'Data has never been more open', body: 'Platform APIs and third-party feeds make a true cross-platform view finally buildable at startup scale.' },
    ],
  },

  market: {
    heading: 'A large, underserved market',
    tam: { label: 'TAM', value: '$300–500M', note: 'Global music tech & analytics spend' },
    sam: { label: 'SAM', value: '$60–100M', note: 'Labels, managers & distributors seeking intelligence tooling' },
    som: { label: 'SOM (3-yr)', value: '$2–4M ARR', note: 'Reachable teams & independent artists in target markets' },
    // footnote: 'Sizing is illustrative — replace with your sourced model before sharing.',
  },

  traction: {
    heading: 'Early traction',
    stats: [
      { value: '600,000+', label: 'Artists tracked in-platform' },
      { value: '12', label: 'Data sources integrated' },
      { value: '[XX]', label: 'Design partners / pilots' },
      { value: '[$XXk]', label: 'ARR / signed pipeline' },
    ],
  },

  model: {
    heading: 'How we make money',
    tiers: [
      { name: 'Pro', price: '$25 / mo', body: 'Per-seat for managers and independent artists. Full analytics, AI copilot, and artist pages.' },
      { name: 'Team', price: '$50 / mo', body: 'Multi-seat for labels and management companies. Shared roster, reports, and campaign tooling.' },
      { name: 'Enterprise', price: 'Custom', body: 'Distributors and majors. Custom data feeds, SSO, and volume seating.' },
    ],
  },

  ask: {
    heading: 'The ask',
    useOfFunds: [
      { label: 'Product & engineering', pct: 45 },
      { label: 'Data & integrations', pct: 25 },
      { label: 'Go-to-market', pct: 20 },
      { label: 'Operations', pct: 10 },
    ],
  },

  team: {
    heading: 'Team',
    members: [
      { name: 'Andreas Katsambas', role: 'Co-founder', image: '/team/andreas.jpg', bio: 'President & COO at Chartmetric · founder of The End Records (acq. BMG)' },
      { name: 'Ian Driscoll', role: 'Co-founder', image: '/team/ian.jpg', bio: 'Staff Software Engineer · Multi Platinum Producer | Engineer' },
      { name: 'Tom Windish', role: 'Co-founder', image: '/team/tom.jpg', bio: 'EVP at THE•TEAM · 3× Pollstar Agent of the Year nominee' },
    ],
  },

  contact: {
    heading: 'Let’s talk',
    body: 'We’re raising to turn a working product into the default workspace for music teams. If that’s a bet you make, we’d love to walk you through it.',
    email: 'founders@preludemusic.ai', // EDIT
  },
};

/* ── Session / auth helpers ────────────────────────────────────────────────── */

const COOKIE_NAME = 'ms_pitch';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours
const SESSION_SECRET = process.env.PITCH_SESSION_SECRET || 'dev-change-me';

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

/* ── Handler ───────────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const authed = !!verify(cookies[COOKIE_NAME]);
  const secure = req.headers['x-forwarded-proto'] === 'https';

  if (req.method === 'GET') {
    if (!authed) return json(res, 401, { ok: false });
    return json(res, 200, { ok: true, data: PITCH_DATA });
  }

  if (req.method === 'POST') {
    const password = process.env.PITCH_PASSWORD;
    if (!password) {
      return json(res, 500, { ok: false, error: 'PITCH_PASSWORD is not configured on the server.' });
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
    return json(res, 200, { ok: true, data: PITCH_DATA });
  }

  res.statusCode = 405;
  res.end();
}
