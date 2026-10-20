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
import {
  FOLLOWER_SERVICES, isFollowerService, addFollowerSources, readFollowers,
  instagramScrapeEnabled, tiktokScrapeEnabled,
} from './follower-counts.js';

const YOUTUBE_API = process.env.YOUTUBE_API_URL || 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_RETENTION_DAYS = 30;
// Counts keep being read this many days after a campaign ends, to see how long the lift lasts
export const AFTER_CAMPAIGN_DAYS = 30;
export const youtubeApproved = () => process.env.YOUTUBE_ANALYTICS_APPROVED === '1';
export const youtubeConfigured = () => !!process.env.YOUTUBE_API_KEY;

/** Services with a public count. `auto`: Prelude reads it every day; `manual`: a count can be typed in. */
export const TRACKED = {
  spotify: { label: 'Spotify', get auto() { return spotifyScrapeEnabled(); }, manual: true },
  youtube: { label: 'YouTube', auto: true, manual: false },
  // The artist's followers (api/lib/follower-counts.js)
  ...FOLLOWER_SERVICES,
};
const isYouTube = (service) => service === 'youtube' || service === 'youtubeChannel';

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
      // Removing a source only hides it, so its counts stay for later analysis
      await query('ALTER TABLE stream_tracker_sources ADD COLUMN IF NOT EXISTS removed_at timestamptz');
      // Set once the artist's follower profiles have been looked up for this tracker
      await query('ALTER TABLE stream_trackers ADD COLUMN IF NOT EXISTS followers_started boolean NOT NULL DEFAULT false');
      await query(`
        CREATE TABLE IF NOT EXISTS stream_tracker_campaigns (
          tracker_id text NOT NULL REFERENCES stream_trackers (id) ON DELETE CASCADE,
          directive_id text NOT NULL, platform text, objective text, setup jsonb NOT NULL,
          meta_campaign_id text, created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (tracker_id, directive_id)
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS campaign_report_snapshots (
          campaign_id text NOT NULL, day date NOT NULL, user_id text NOT NULL,
          managed boolean NOT NULL DEFAULT false, report jsonb NOT NULL,
          recorded_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (campaign_id, day)
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

/**
 * Take today's count for every automatic source of one tracker (or only `services`).
 * Follower profiles are read together, so one headless browser serves Instagram and TikTok.
 */
export async function snapshotTracker(trackerId, { services } = {}) {
  const tracker = await queryOne('SELECT * FROM stream_trackers WHERE id = $1', [trackerId]);
  const sources = (await query('SELECT * FROM stream_tracker_sources WHERE tracker_id = $1 AND removed_at IS NULL', [trackerId]))
    .filter(s => !services || services.includes(s.service));
  const day = today();
  const results = { counted: 0, errors: 0 };
  const followerSources = sources.filter(s => isFollowerService(s.service));
  let followers = {};
  if (followerSources.length) {
    try {
      followers = await readFollowers(followerSources, tracker);
    } catch (err) {
      followers = Object.fromEntries(Object.keys(FOLLOWER_SERVICES).map(svc => [svc,
        Object.fromEntries(followerSources.filter(s => s.service === svc).map(s => [s.external_id, { error: err.message }]))]));
    }
  }
  const fetchers = { ...FETCHERS, ...Object.fromEntries(Object.keys(FOLLOWER_SERVICES).map(svc => [svc, async () => followers[svc] || {}])) };
  for (const [service, fetcher] of Object.entries(fetchers)) {
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
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tracker_id, service, external_id, day)
           DO UPDATE SET count = EXCLUDED.count, source = EXCLUDED.source, recorded_at = now()`,
          [trackerId, service, s.external_id, day, r.count, r.source || 'api']);
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
    `DELETE FROM stream_counts WHERE service IN ('youtube', 'youtubeChannel') AND day < current_date - $1::int RETURNING 1`,
    [YOUTUBE_RETENTION_DAYS]);
  return rows.length;
}

/** Daily job: every tracker whose campaign hasn't ended or ended in the last AFTER_CAMPAIGN_DAYS days. */
export async function snapshotDueTrackers() {
  await ensureStreamTables();
  const pruned = await pruneYouTube();
  const trackers = await query(`SELECT * FROM stream_trackers WHERE end_date >= current_date - $1::int ORDER BY created_at`, [AFTER_CAMPAIGN_DAYS + 1]);
  let counted = 0, errors = 0;
  for (const t of trackers) {
    // Trackers from before follower tracking start reading the artist's followers too
    if (!t.followers_started && t.artist_slug) await addFollowerSources(t).catch(err => console.warn('[stream-counts] followers', err.message));
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
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tracker_id, service, external_id) DO UPDATE SET removed_at = NULL`,
      [trackerId, s.service, s.externalId, s.kind, s.url, link.label || null]);
  }
  return skipped;
}

/**
 * Keep each campaign's setup (platform, objective, budget, schedule, audience, creative) next
 * to its stream counts, so results can later be compared against how campaigns were run.
 * Uploaded image data isn't copied, only its ids.
 */
export async function saveCampaigns(trackerId, campaigns) {
  for (const c of campaigns || []) {
    if (!c?.id) continue;
    const setup = {
      platform: c.platform, objective: c.objective, budget: c.budget, schedule: c.schedule,
      audience: c.audience, goal: c.goal || null, artistSlug: c.artistSlug || null,
      creative: c.creative && Object.fromEntries(Object.entries(c.creative)
        .filter(([, v]) => !(typeof v === 'string' && v.startsWith('data:')))),
    };
    await query(
      `INSERT INTO stream_tracker_campaigns (tracker_id, directive_id, platform, objective, setup, meta_campaign_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tracker_id, directive_id) DO UPDATE SET platform = EXCLUDED.platform, objective = EXCLUDED.objective,
         setup = EXCLUDED.setup, meta_campaign_id = COALESCE(EXCLUDED.meta_campaign_id, stream_tracker_campaigns.meta_campaign_id),
         updated_at = now()`,
      [trackerId, String(c.id), c.platform || null, c.objective || null, JSON.stringify(setup), c.result?.campaignId || null]);
  }
}

/** Record the Meta campaign a tracked campaign launched as (its daily results are then saved too). */
export async function linkMetaCampaign(trackerId, directiveId, campaignId) {
  if (!/^\d+$/.test(String(campaignId || ''))) throw bad('Invalid campaign id');
  const row = await queryOne(
    `UPDATE stream_tracker_campaigns SET meta_campaign_id = $3, updated_at = now()
     WHERE tracker_id = $1 AND directive_id = $2 RETURNING 1`, [trackerId, String(directiveId), String(campaignId)]);
  if (!row) throw bad('Campaign not found on this stream tracking', 404);
}

/** Hide a source from the report and stop reading it; its counts are kept. */
export async function removeSource(trackerId, service, externalId) {
  await query('UPDATE stream_tracker_sources SET removed_at = now() WHERE tracker_id = $1 AND service = $2 AND external_id = $3',
    [trackerId, service, externalId]);
}

const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

/**
 * Start tracking. Links come from the release's smart link (linkSlug, the user's own)
 * plus any given; without a YouTube video, one is searched for by title + artist.
 */
export async function createTracker(uid, { id, title, artistSlug, artistName, linkSlug, startDate, endDate, links = [], campaigns = [] }) {
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
  // Without release links, only the artist's followers are tracked
  if (!all.length && !artistSlug) throw bad('Add the release links to track.');

  await query(
    `INSERT INTO stream_trackers (id, user_id, title, artist_slug, artist_name, link_slug, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET title = COALESCE(EXCLUDED.title, stream_trackers.title),
       link_slug = COALESCE(EXCLUDED.link_slug, stream_trackers.link_slug),
       artist_slug = COALESCE(EXCLUDED.artist_slug, stream_trackers.artist_slug),
       start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date`,
    [id, uid, releaseTitle, artistSlug || null, releaseArtist, linkSlug || null, start, end]);

  const skipped = await addSources(id, all);
  await saveCampaigns(id, campaigns);
  const notes = [];
  const hasYouTube = await queryOne(`SELECT 1 FROM stream_tracker_sources WHERE tracker_id = $1 AND service = 'youtube'`, [id]);
  if (!hasYouTube && all.length) {
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
  await addFollowerSources(await queryOne('SELECT * FROM stream_trackers WHERE id = $1', [id]));
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
  const src = await queryOne('SELECT 1 FROM stream_tracker_sources WHERE tracker_id = $1 AND service = $2 AND external_id = $3 AND removed_at IS NULL',
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
 * when tracking began after the start). The gain runs to the campaign's last day; counts from
 * the AFTER_CAMPAIGN_DAYS after it show in `daily` (and `latest`) as afterEnd.
 * Gains are left out for YouTube until the audit.
 */
export function summarize(tracker, sources, counts) {
  const start = dayStr(tracker.start_date);
  const end = dayStr(tracker.end_date);
  return sources.map(s => {
    const rows = counts
      .filter(c => c.service === s.service && c.external_id === s.external_id)
      .map(c => ({ day: dayStr(c.day), count: Number(c.count), source: c.source }))
      .sort((a, b) => a.day.localeCompare(b.day));
    const before = rows.filter(r => r.day < start);
    const baseline = before.length ? before[before.length - 1] : rows[0] || null;
    const latest = rows[rows.length - 1] || null;
    const during = rows.filter(r => r.day <= end);
    const last = during[during.length - 1] || null;
    const showGain = !isYouTube(s.service) || youtubeApproved();
    return {
      service: s.service, externalId: s.external_id, kind: s.kind, url: s.url, label: s.label,
      auto: !!TRACKED[s.service]?.auto, manual: !!TRACKED[s.service]?.manual, lastError: s.last_error || null,
      baseline: baseline ? { ...baseline, afterStart: baseline.day >= start } : null,
      latest,
      gain: showGain && baseline && last && last.day !== baseline.day ? last.count - baseline.count : null,
      gainTo: last?.day || null,
      showGain,
      daily: rows.map((r, i) => ({ ...r, afterEnd: r.day > end, change: showGain && i > 0 ? r.count - rows[i - 1].count : null })),
    };
  });
}

export async function trackerReport(tracker) {
  const sources = await query('SELECT * FROM stream_tracker_sources WHERE tracker_id = $1 AND removed_at IS NULL ORDER BY service, created_at', [tracker.id]);
  const counts = await query('SELECT * FROM stream_counts WHERE tracker_id = $1 ORDER BY day', [tracker.id]);
  return {
    id: tracker.id, title: tracker.title, artistName: tracker.artist_name, linkSlug: tracker.link_slug,
    startDate: dayStr(tracker.start_date), endDate: dayStr(tracker.end_date), lastRunAt: tracker.last_run_at,
    trackedUntil: new Date(Date.parse(dayStr(tracker.end_date)) + AFTER_CAMPAIGN_DAYS * 86400000).toISOString().slice(0, 10),
    sources: summarize(tracker, sources, counts),
    youtube: { configured: youtubeConfigured(), approved: youtubeApproved(), retentionDays: youtubeApproved() ? null : YOUTUBE_RETENTION_DAYS },
    followers: {
      started: !!tracker.followers_started,
      // Follower services with no profile to read: the page asks for the link
      missing: Object.keys(FOLLOWER_SERVICES).filter(svc => !sources.some(s => s.service === svc)),
      pageReads: { instagram: instagramScrapeEnabled(), tiktok: tiktokScrapeEnabled() },
    },
  };
}
