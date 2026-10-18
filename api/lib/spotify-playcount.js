// Spotify play counts, read from the public web player page in a headless browser.
//
// Spotify shows a track's all-time play count to anyone, logged in or not, but no API
// returns it. Its User Guidelines ban collecting it by automated means; reading it anyway
// was Ian's call (2026-10-17). To keep that apart from Prelude's own Spotify developer app
// (link lookup, fan capture), this uses no Spotify credentials. Once per release per day.
// SPOTIFY_PLAYCOUNT_SCRAPE=0 turns it off (counts are then entered by hand).
//
// The count isn't in the HTML Spotify sends (checked live 2026-10-18); the player fills it
// in after the page loads. So the page is opened in Chromium (playwright-core +
// @sparticuz/chromium on Vercel; CHROMIUM_PATH points at a local Chromium elsewhere) and
// the count is read from what the page loaded: the data responses the player received,
// else the number shown on the page. An album's count is the sum of its tracks'.
// Spotify changes its pages without notice, so a miss is reported on the source (and by
// probeSpotify), never guessed at.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const ORIGIN = process.env.SPOTIFY_WEB_URL || 'https://open.spotify.com';
const WAIT_MS = 20_000;

export const spotifyScrapeEnabled = () => process.env.SPOTIFY_PLAYCOUNT_SCRAPE !== '0';

const toCount = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Depth-first walk over every object in a JSON value
function* objects(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) yield value;
  for (const v of Object.values(value)) yield* objects(v, seen);
}

/**
 * The play count in JSON the page loaded. A track: the object for the track's uri with a
 * playcount. An album: the sum over the tracks inside the album's object.
 */
export function playcountFromJson(blobs, { kind, id }) {
  const uri = `spotify:${kind}:${id}`;
  if (kind === 'track') {
    for (const blob of blobs) {
      for (const o of objects(blob)) {
        if ((o.uri === uri || o.id === id) && toCount(o.playcount) != null) return { count: toCount(o.playcount), title: o.name || null };
      }
    }
    return null;
  }
  for (const blob of blobs) {
    for (const o of objects(blob)) {
      if (o.uri !== uri) continue;
      const tracks = new Map();
      for (const t of objects(o)) {
        if (t !== o && String(t.uri || '').startsWith('spotify:track:') && toCount(t.playcount) != null) tracks.set(t.uri, toCount(t.playcount));
      }
      if (tracks.size) return { count: [...tracks.values()].reduce((a, b) => a + b, 0), title: o.name || null, tracks: tracks.size };
    }
  }
  return null;
}

// @sparticuz/chromium unpacks the browser to /tmp/chromium on first use and reuses any file
// already there. Requests running at the same time in one instance, or one cut off while
// unpacking, could leave a half-written file that fails with "spawn ENOEXEC" on every later
// launch. So unpacking runs once per instance, a marker is written only once it has finished,
// and a /tmp/chromium without the marker is deleted and unpacked again.
const BIN = join(tmpdir(), 'chromium');
const READY = join(tmpdir(), 'chromium.ready');
let unpacking;

function serverlessChromium() {
  unpacking ??= (async () => {
    const chromium = (await import('@sparticuz/chromium')).default;
    if (existsSync(BIN) && !existsSync(READY)) rmSync(BIN, { force: true });
    const path = await chromium.executablePath();
    writeFileSync(READY, '');
    return { path, args: chromium.args };
  })().catch((err) => { unpacking = undefined; throw err; });
  return unpacking;
}

async function launch() {
  const { chromium: pw } = await import('playwright-core');
  if (process.env.CHROMIUM_PATH) return pw.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const { path, args } = await serverlessChromium();
  try {
    return await pw.launch({ executablePath: path, args, headless: true });
  } catch (err) {
    if (!/ENOEXEC|EACCES|ETXTBSY/.test(err.message)) throw err;
    // The unpacked browser is unusable: unpack it again and retry once
    rmSync(BIN, { force: true });
    rmSync(READY, { force: true });
    unpacking = undefined;
    const fresh = await serverlessChromium();
    return pw.launch({ executablePath: fresh.path, args: fresh.args, headless: true });
  }
}


/** Open one track/album page and read its count: { count, title, via, responses }. */
async function readPage(browser, src) {
  const context = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    // Images, fonts and audio aren't needed to read a number
    await page.route('**/*', (route) => (['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue()));
    const loaded = [];
    page.on('response', async (res) => {
      if (!/json/.test(res.headers()['content-type'] || '')) return;
      try { loaded.push(await res.json()); } catch { /* body gone or not JSON */ }
    });
    await page.goto(`${ORIGIN}/${src.kind}/${encodeURIComponent(src.id)}`, { waitUntil: 'domcontentloaded', timeout: WAIT_MS });

    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      const hit = playcountFromJson(loaded, src);
      if (hit) return { ...hit, via: 'data', responses: loaded.length };
      if (src.kind === 'track') {
        const shown = await page.locator('[data-testid="playcount"]').first().textContent({ timeout: 250 }).catch(() => null);
        if (toCount(shown) != null) return { count: toCount(shown), title: null, via: 'page', responses: loaded.length };
      }
      await page.waitForTimeout(500);
    }
    return { count: null, responses: loaded.length };
  } finally {
    await context.close();
  }
}

/** { [id]: { count } | { error } } for Spotify sources ({ kind, external_id }), one browser for all. */
export async function spotifyPlaycounts(sources) {
  const out = {};
  if (!sources.length) return out;
  let browser;
  try {
    browser = await launch();
  } catch (err) {
    for (const s of sources) out[s.external_id] = { error: `Couldn't start the browser that reads Spotify (${err.message.split('\n')[0]}).` };
    return out;
  }
  try {
    for (const s of sources) {
      try {
        const r = await readPage(browser, { kind: s.kind, id: s.external_id });
        out[s.external_id] = r.count != null ? { count: r.count }
          : { error: "Spotify's page didn't show a play count (its layout may have changed). Enter today's count by hand." };
      } catch (err) {
        out[s.external_id] = { error: `Spotify page didn't load (${err.message.split('\n')[0]}).` };
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return out;
}

/** One page against the live site, for checking the reader. */
export async function probeSpotify(src) {
  const started = Date.now();
  let browser;
  try {
    browser = await launch();
  } catch (err) {
    return { ok: false, step: 'browser', error: err.message.split('\n')[0] };
  }
  try {
    const r = await readPage(browser, src);
    return { ok: r.count != null, ...r, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, step: 'page', error: err.message.split('\n')[0], ms: Date.now() - started };
  } finally {
    await browser.close().catch(() => {});
  }
}
