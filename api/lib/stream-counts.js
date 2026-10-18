// Stream counts for stream-goal campaigns: a count per streaming service per day,
// from before the campaign starts until it ends, so the campaign page can show what
// the campaign added.
//
// Which services have a public count, and how Prelude may read it (checked 2026-10-17):
//   - YouTube / YouTube Music: video views, read with the official Data API
//     (videos.list, YOUTUBE_API_KEY). Developer Policies III.E.4: statistics read with
//     an API key are "Non-Authorized Data" and must not be stored for more than 30 days,
//     and Prelude must not derive new metrics (such as views gained) from them. Both are
//     allowed for developers that pass YouTube's analytics audit; set
//     YOUTUBE_ANALYTICS_APPROVED=1 once approved. Scraping YouTube is banned (III.E.6).
//   - Spotify: plays per track are public in the app and web player, but no API returns
//     them and the Spotify User Guidelines ban automated collection. Ian chose to read
//     them from the public page anyway, in a headless browser (api/lib/spotify-playcount.js,
//     no Spotify credentials); SPOTIFY_PLAYCOUNT_SCRAPE=0 turns that off. A count can always be
//     entered by hand, to fill a day the page read failed.
//   - Apple Music, Deezer, Amazon Music, TIDAL, Pandora: no public count, not tracked.
//   - SoundCloud: public counts, but its API needs an approved app and its terms ban
//     scraping; not tracked.
import { query, queryOne } from './db.js';
import { parseSourceUrl, norm } from './link-lookup.js';
import { spotifyPlaycounts, spotifyScrapeEnabled } from './spotify-playcount.js';

const YOUTUBE_API = process.env.YOUTUBE_API_URL || 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_RETENTION_DAYS = 30;
export const youtubeApproved = () => process.env.YOUTUBE_ANALYTICS_APPROVED === '1';
export const youtubeConfigured = () => !!process.env.YOUTUBE_API_KEY;

/** Services with a public count. `auto`: Prelude reads it every day; `manual`: a count can be typed in. */
export const TRACKED = {
  spotify: { label: 'Spotify', get auto() { return spotifyScrapeEnabled(); }, manual: true },
  youtube: { label: 'YouTube', auto: true, manual: false },
};

/** Why each other smart-link service isn't tracked. */
export const NOT_TRACKED = {
  appleMusic: 'Apple Music shows no public play count.',
  deezer: 'Deezer shows no public play count.',
  amazonMusic: 'Amazon Music shows no public play count.',
  tidal: 'TIDAL shows no public play count.',
  pandora: 'Pandora shows no public play count.',
  soundcloud: "SoundCloud's terms ban scraping and its API needs an approved app.",
};

let tablesReady;
export function ensureStreamTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS stream_trackers (
          id text PRIMARY KEY, user_id text NOT NULL, title text, artist_slug text, artist_name text,
          link_slug text, start_date date NOT NULL, end_date date NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(), last_run_at timestamptz
        )`);
      await query('CREATE INDEX IF NOT EXISTS stream_trackers_user_idx ON stream_trackers (user_id)');
      await query(`
        CREATE TABLE IF NOT EXISTS stream_tracker_sources (
          tracker_id text NOT NULL REFERENCES stream_trackers (id) ON DELETE CASCADE,
          service text NOT NULL, external_id text NOT NULL, kind text, url text NOT NULL, label text,
          last_error text, created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (tracker_id, service, external_id)
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS stream_counts (
          tracker_id text NOT NULL, service text NOT NULL, external_id text NOT NULL,
          day date NOT NULL, count bigint NOT NULL, source text NOT NULL,
          recorded_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (tracker_id, service, external_id, day),
          FOREIGN KEY (tracker_id, service, external_id)
            REFERENCES stream_tracker_sources (tracker_id, service, external_id) ON DELETE CASCADE
        )`);
    })().catch((err) => { tablesReady = undefined; throw err; });
  }
  return tablesReady;
}

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * A smart-link entry → a source Prelude can count, or { skipped: reason }.
 * YouTube Music videos share YouTube's ids and view counts, so both count as 'youtube'.
 */
export function sourceFromLink({ service, url }) {
  if (NOT_TRACKED[service]) return { skipped: NOT_TRACKED[service], service };
  const src = parseSourceUrl(url);
  if (!src) return { skipped: `${url} isn't a Spotify track/album or a YouTube video link.`, service };
  if (src.service === 'spotify') {
    if (src.kind === 'artist') return { skipped: 'Spotify artist pages have no play count; use the track or album link.', service };
    return { service: 'spotify', externalId: src.id, kind: src.kind, url: `https://open.spotify.com/${src.kind}/${src.id}` };
  }
  if (src.service === 'youtube' || src.service === 'youtubeMusic') {
    if (src.kind === 'artist') return { skipped: 'YouTube channel links have no per-release count; use the video link.', service };
    return { service: 'youtube', externalId: src.id, kind: 'video', url: `https://www.youtube.com/watch?v=${src.id}` };
  }
  return { skipped: NOT_TRACKED[src.service] || `${src.service} shows no public play count.`, service };
}

// ── YouTube Data API ────────────────────────────────────────────────────────

async function youtubeGet(path, params) {
  const qs = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const res = await fetch(`${YOUTUBE_API}/${path}?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw bad(`YouTube API ${res.status}: ${body.error?.message || 'request failed'}`, 502);
  return body;
}

/** { videoId: { views, title } } — one quota unit per 50 videos. */
export async function youtubeViews(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const body = await youtubeGet('videos', { part: 'statistics,snippet', id: ids.slice(i, i + 50).join(','), maxResults: '50' });
    for (const v of body.items || []) {
      out[v.id] = { views: v.statistics?.viewCount != null ? Number(v.statistics.viewCount) : null, title: v.snippet?.title || null };
    }
  }
  return out;
}

/**
 * The release's video on YouTube, by title + artist search (100 quota units of the
 * default 10,000 a day). Prefers the official video, then the "Artist - Topic" audio.
 */
export async function findYouTubeVideo(title, artistName) {
  if (!youtubeConfigured() || !title || !artistName) return null;
  const body = await youtubeGet('search', { part: 'snippet', type: 'video', maxResults: '10', q: `${artistName} ${title}` });
  // Video titles read "Artist - Title (Official Video)", so compare whole titles, not norm()'s cut-down one
  const loose = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
  const want = norm(title);
  const artist = loose(artistName);
  const hits = (body.items || []).filter(i => {
    const t = loose(i.snippet?.title);
    const channel = loose(String(i.snippet?.channelTitle || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, ''));
    return t.includes(want) && (channel.includes(artist) || artist.includes(channel) || t.includes(artist));
  });
  const official = hits.find(i => /official/i.test(i.snippet.title)) || hits[0];
  return official ? `https://www.youtube.com/watch?v=${official.id.videoId}` : null;
}


// Services Prelude reads by itself
const FETCHERS = {
  spotify: async (sources) => (spotifyScrapeEnabled() ? spotifyPlaycounts(sources) : {}),
  youtube: async (sources) => {
    if (!youtubeConfigured()) return Object.fromEntries(sources.map(s => [s.external_id, { error: 'YOUTUBE_API_KEY is not set.' }]));
    const views = await youtubeViews(sources.map(s => s.external_id));
    return Object.fromEntries(sources.map(s => [s.external_id,
      views[s.external_id]?.views != null ? { count: views[s.external_id].views } : { error: 'Video not found or its views are hidden.' }]));
  },
};

/** Take today's count for every automatic source of one tracker. */
export async function snapshotTracker(trackerId) {
  const sources = await query('SELECT * FROM stream_tracker_sources WHERE tracker_id = $1', [trackerId]);
  const day = today();
  const results = { counted: 0, errors: 0 };
  for (const [service, fetcher] of Object.entries(FETCHERS)) {
    const list = sources.filter(s => s.service === service);
    if (!list.length) continue;
    let counts;
    try {
      counts = await fetcher(list);
    } catch (err) {
      counts = Object.fromEntries(list.map(s => [s.external_id, { error: err.message }]));
    }
    for (const s of list) {
      if (!TRACKED[service]?.auto) continue;
      const r = counts[s.external_id] || { error: 'No count returned.' };
      if (r.count != null) {
        await query(
          `INSERT INTO stream_counts (tracker_id, service, external_id, day, count, source)
           VALUES ($1, $2, $3, $4, $5, 'api')
           ON CONFLICT (tracker_id, service, external_id, day)
           DO UPDATE SET count = EXCLUDED.count, source = 'api', recorded_at = now()`,
          [trackerId, service, s.external_id, day, r.count]);
        results.counted++;
      } else {
        results.errors++;
      }
      await query('UPDATE stream_tracker_sources SET last_error = $4 WHERE tracker_id = $1 AND service = $2 AND external_id = $3',
        [trackerId, service, s.external_id, r.error || null]);
    }
  }
  await query('UPDATE stream_trackers SET last_run_at = now() WHERE id = $1', [trackerId]);
  return results;
}

/** YouTube statistics read with an API key may be kept 30 days at most (until the audit is approved). */
export async function pruneYouTube() {
  if (youtubeApproved()) return 0;
  const rows = await query(
    `DELETE FROM stream_counts WHERE service = 'youtube' AND day < current_date - $1::int RETURNING 1`,
    [YOUTUBE_RETENTION_DAYS]);
  return rows.length;
}

/** Daily job: every tracker whose campaign hasn't ended (plus one day to catch the last day). */
export async function snapshotDueTrackers() {
  await ensureStreamTables();
  const pruned = await pruneYouTube();
  const trackers = await query(`SELECT id FROM stream_trackers WHERE end_date >= current_date - 1 ORDER BY created_at`);
  let counted = 0, errors = 0;
  for (const t of trackers) {
    const r = await snapshotTracker(t.id);
    counted += r.counted;
    errors += r.errors;
  }
  return { trackers: trackers.length, counted, errors, prunedYouTube: pruned };
}

// ── Trackers ────────────────────────────────────────────────────────────────

export async function ownedTracker(uid, id) {
  const row = await queryOne('SELECT * FROM stream_trackers WHERE id = $1 AND user_id = $2', [id, uid]);
  if (!row) throw bad('Stream tracking not found', 404);
  return row;
}

/** Add sources; returns the services that were skipped and why. */
export async function addSources(trackerId, links) {
  const skipped = [];
  for (const link of links) {
    if (!link?.url) continue;
    const s = sourceFromLink(link);
    if (s.skipped) { skipped.push({ service: s.service, reason: s.skipped }); continue; }
    await query(
      `INSERT INTO stream_tracker_sources (tracker_id, service, external_id, kind, url, label)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [trackerId, s.service, s.externalId, s.kind, s.url, link.label || null]);
  }
  return skipped;
}

const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

/**
 * Start tracking. Links come from the release's smart link (linkSlug, the user's own)
 * plus any given; without a YouTube video, one is searched for by title + artist.
 */
export async function createTracker(uid, { id, title, artistSlug, artistName, linkSlug, startDate, endDate, links = [] }) {
  await ensureStreamTables();
  const start = isoDate(startDate);
  const end = isoDate(endDate);
  if (!id || !start || !end) throw bad('id, startDate and endDate are required.');
  if (end < start) throw bad('The end date is before the start date.');
  const existing = await queryOne('SELECT user_id FROM stream_trackers WHERE id = $1', [id]);
  if (existing && existing.user_id !== uid) throw bad('Stream tracking not found', 404);

  let all = [...links];
  let releaseTitle = title || null;
  let releaseArtist = artistName || null;
  if (linkSlug) {
    const link = await queryOne('SELECT * FROM smart_links WHERE slug = $1 AND user_id = $2', [linkSlug, uid]);
    if (!link) throw bad('Smart link not found', 404);
    all = [...(link.links || []), ...all];
    releaseTitle = releaseTitle || link.title;
    releaseArtist = releaseArtist || link.artist_name;
  }
  if (!all.length) throw bad('Add the release links to track.');

  await query(
    `INSERT INTO stream_trackers (id, user_id, title, artist_slug, artist_name, link_slug, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, link_slug = EXCLUDED.link_slug,
       start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date`,
    [id, uid, releaseTitle, artistSlug || null, releaseArtist, linkSlug || null, start, end]);

  const skipped = await addSources(id, all);
  const notes = [];
  const hasYouTube = await queryOne(`SELECT 1 FROM stream_tracker_sources WHERE tracker_id = $1 AND service = 'youtube'`, [id]);
  if (!hasYouTube) {
    try {
      const url = await findYouTubeVideo(releaseTitle, releaseArtist);
      if (url) {
        await addSources(id, [{ service: 'youtube', url }]);
        notes.push(`Found the YouTube video by searching "${releaseArtist} ${releaseTitle}". Check it's the right one.`);
      }
    } catch (err) {
      console.warn('[stream-counts] YouTube search failed', err.message);
    }
  }
  await snapshotTracker(id);
  return { skipped: dedupeSkipped(skipped), notes };
}

const dedupeSkipped = (list) => {
  const seen = new Set();
  return list.filter(s => !seen.has(s.service) && seen.add(s.service));
};

/** Record a count by hand (services without an automatic source, or a correction). */
export async function recordCount(trackerId, { service, externalId, day, count }) {
  const d = isoDate(day) || today();
  const n = Number(String(count ?? '').replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw bad('Enter the count as a whole number.');
  if (d > today()) throw bad("That date hasn't happened yet.");
  if (!TRACKED[service]?.manual) throw bad(`${TRACKED[service]?.label || service} counts can't be entered by hand.`);
  const src = await queryOne('SELECT 1 FROM stream_tracker_sources WHERE tracker_id = $1 AND service = $2 AND external_id = $3',
    [trackerId, service, externalId]);
  if (!src) throw bad('Source not found', 404);
  await query(
    `INSERT INTO stream_counts (tracker_id, service, external_id, day, count, source)
     VALUES ($1, $2, $3, $4, $5, 'manual')
     ON CONFLICT (tracker_id, service, external_id, day)
     DO UPDATE SET count = EXCLUDED.count, source = 'manual', recorded_at = now()`,
    [trackerId, service, externalId, d, n]);
}

const dayStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/**
 * Baseline = the last count from before the campaign started (or the first count, flagged,
 * when tracking began after the start). Gains are left out for YouTube until the audit.
 */
export function summarize(tracker, sources, counts) {
  const start = dayStr(tracker.start_date);
  return sources.map(s => {
    const rows = counts
      .filter(c => c.service === s.service && c.external_id === s.external_id)
      .map(c => ({ day: dayStr(c.day), count: Number(c.count), source: c.source }))
      .sort((a, b) => a.day.localeCompare(b.day));
    const before = rows.filter(r => r.day < start);
    const baseline = before.length ? before[before.length - 1] : rows[0] || null;
    const latest = rows[rows.length - 1] || null;
    const showGain = s.service !== 'youtube' || youtubeApproved();
    return {
      service: s.service, externalId: s.external_id, kind: s.kind, url: s.url, label: s.label,
      auto: !!TRACKED[s.service]?.auto, manual: !!TRACKED[s.service]?.manual, lastError: s.last_error || null,
      baseline: baseline ? { ...baseline, afterStart: baseline.day >= start } : null,
      latest,
      gain: showGain && baseline && latest && latest.day !== baseline.day ? latest.count - baseline.count : null,
      showGain,
      daily: rows.map((r, i) => ({ ...r, change: showGain && i > 0 ? r.count - rows[i - 1].count : null })),
    };
  });
}

export async function trackerReport(tracker) {
  const sources = await query('SELECT * FROM stream_tracker_sources WHERE tracker_id = $1 ORDER BY service, created_at', [tracker.id]);
  const counts = await query('SELECT * FROM stream_counts WHERE tracker_id = $1 ORDER BY day', [tracker.id]);
  return {
    id: tracker.id, title: tracker.title, artistName: tracker.artist_name, linkSlug: tracker.link_slug,
    startDate: dayStr(tracker.start_date), endDate: dayStr(tracker.end_date), lastRunAt: tracker.last_run_at,
    sources: summarize(tracker, sources, counts),
    youtube: { configured: youtubeConfigured(), approved: youtubeApproved(), retentionDays: youtubeApproved() ? null : YOUTUBE_RETENTION_DAYS },
  };
}
