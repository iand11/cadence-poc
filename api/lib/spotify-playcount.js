// Spotify play counts read from the public web player page (open.spotify.com/track|album/<id>).
//
// Spotify shows a track's all-time play count to anyone, logged in or not, but no API
// returns it. Its User Guidelines ban collecting it by automated means; reading it anyway
// was Ian's call (2026-10-17). To keep that apart from Prelude's own Spotify developer app
// (link lookup, fan capture), this uses no Spotify credentials: a plain page request,
// once per release per day. SPOTIFY_PLAYCOUNT_SCRAPE=0 turns it off (counts are then
// entered by hand).
//
// The page embeds its data as JSON (sometimes base64-encoded) in <script> tags. Spotify
// changes this without notice, so a miss is reported on the source, not guessed at.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const ORIGIN = process.env.SPOTIFY_WEB_URL || 'https://open.spotify.com';

export const spotifyScrapeEnabled = () => process.env.SPOTIFY_PLAYCOUNT_SCRAPE !== '0';

const fail = (message) => Object.assign(new Error(message), { status: 502 });

/** Every JSON value embedded in the page's <script> tags (plain or base64). */
export function embeddedJson(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1].trim();
    if (body.length < 20) continue;
    try { out.push(JSON.parse(body)); continue; } catch { /* not plain JSON */ }
    if (/^[A-Za-z0-9+/=_-]+$/.test(body)) {
      try { out.push(JSON.parse(Buffer.from(body, 'base64').toString('utf8'))); } catch { /* not base64 JSON */ }
    }
  }
  return out;
}

const toCount = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

// Depth-first walk over every object in a JSON value
function* objects(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) yield value;
  for (const v of Object.values(value)) yield* objects(v, seen);
}

/**
 * The play count in a page's embedded data. A track: the object whose uri is the track's
 * and that has a playcount. An album: the sum over its tracks' playcounts.
 */
export function playcountFromPage(html, { kind, id }) {
  const blobs = embeddedJson(html);
  const uri = `spotify:${kind}:${id}`;
  if (kind === 'track') {
    for (const blob of blobs) {
      for (const o of objects(blob)) {
        if ((o.uri === uri || o.id === id) && toCount(o.playcount) != null) {
          return { count: toCount(o.playcount), title: o.name || null };
        }
      }
    }
    return null;
  }
  // Album: find the album object, then every track inside it that carries a playcount
  for (const blob of blobs) {
    for (const o of objects(blob)) {
      if (o.uri !== uri && !(o.id === id && /album/i.test(String(o.__typename || o.type || '')))) continue;
      const tracks = new Map();
      for (const t of objects(o)) {
        if (t !== o && String(t.uri || '').startsWith('spotify:track:') && toCount(t.playcount) != null) tracks.set(t.uri, toCount(t.playcount));
      }
      if (tracks.size) return { count: [...tracks.values()].reduce((a, b) => a + b, 0), title: o.name || null, tracks: tracks.size };
    }
  }
  return null;
}

/** Fetch the page and read the count. Throws with a reason the campaign page can show. */
export async function spotifyPlaycount({ kind, id }) {
  const res = await fetch(`${ORIGIN}/${kind}/${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
  });
  if (!res.ok) throw fail(`Spotify page returned ${res.status}.`);
  const html = await res.text();
  const hit = playcountFromPage(html, { kind, id });
  if (!hit) throw fail("Spotify's page didn't include the play count (its layout may have changed). Enter today's count by hand.");
  return hit;
}

/** What the page contains, for checking the scraper against the live site. */
export async function probeSpotifyPage({ kind, id }) {
  const res = await fetch(`${ORIGIN}/${kind}/${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
  });
  const html = await res.text();
  const blobs = embeddedJson(html);
  return {
    status: res.status,
    bytes: html.length,
    embeddedJson: blobs.length,
    mentionsPlaycount: /playcount/i.test(html) || JSON.stringify(blobs).includes('playcount'),
    result: playcountFromPage(html, { kind, id }),
  };
}
