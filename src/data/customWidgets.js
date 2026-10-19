// Custom dashboard widgets: per-account storage (/api/widgets) and generation.
//
// Generating a widget is a short tool-use loop: /api/widgets makes one model call
// per step, and the data tools the model asks for run here through the app's own
// API adapters, so they return exactly what this user can see (followed artists,
// their campaigns and links) in the shapes the app already uses.
import { request } from './metaAds';
import { getRoster } from './rosterStore';
import { fetchArtist, fetchArtists, fetchTracks, fetchAlbums, fetchContentFeed } from './artistsRemote';
import { fetchPlacements } from './playlistsRemote';
import { fetchCampaigns } from './campaignsRemote';
import { fetchMetaCampaign } from './metaAds';
import { fetchSmartLinks } from './smartLinks';

export const fetchWidgets = () => request('/api/widgets');
export const putWidget = (widget) => request('/api/widgets', { method: 'PUT', body: { widget } });
export const removeWidget = (id) => request(`/api/widgets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
const generateStep = (messages, context) =>
  request('/api/widgets', { method: 'POST', body: { action: 'generate', messages, context } });

// ── Context: the followed artists and groups ────────────────────────────────

const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0));

export function buildWidgetContext(groups) {
  const roster = getRoster();
  const lines = roster.map(a => [
    a.slug,
    a.name,
    a.genres?.primary?.name || '',
    a.label,
    a.careerStage || '',
    a.country || '',
    `rank ${a.rank ?? '—'}`,
    `Spotify listeners ${fmt(a.spotify.monthlyListeners)} followers ${fmt(a.spotify.followers)} popularity ${a.spotify.popularity}`,
    `Instagram ${fmt(a.social.instagram)} TikTok ${fmt(a.social.tiktok)} YouTube ${fmt(a.social.youtube)} X ${fmt(a.social.twitter)}`,
    `Spotify playlists ${a.playlists?.spotify?.total || 0} (${a.playlists?.spotify?.editorial || 0} editorial) reach ${fmt(a.playlists?.spotify?.reach)}`,
    `Shazam ${fmt(a.engagement?.shazam)}`,
    a.statsAsOf ? `as of ${String(a.statsAsOf).slice(0, 10)}` : '',
  ].filter(Boolean).join(' | '));
  const names = new Map(roster.map(a => [a.slug, a.name]));
  const groupLines = (groups || [])
    .filter(g => g.slugs.length > 0)
    .map(g => `${g.name}: ${g.slugs.map(s => names.get(s) || s).join(', ')}`);
  return [
    `FOLLOWED ARTISTS (${roster.length}; slug | name | genre | label | career stage | home country | …). Numbers are rounded; use the tools for exact values.`,
    ...lines,
    ...(groupLines.length ? ['', 'GROUPS (named by the user):', ...groupLines] : []),
  ].join('\n');
}

// ── Data tools (run in the browser) ──────────────────────────────────────────

const clamp = (n, lo, hi, dflt) => Math.min(Math.max(Number.isFinite(Number(n)) ? Number(n) : dflt, lo), hi);
const slugList = (slugs, max = 20) => (Array.isArray(slugs) ? slugs : []).filter(s => typeof s === 'string').slice(0, max);

// Listener geography is never shown in the app; the API already drops it, and this
// guards anything that slips through into a tool result.
const HIDDEN_KEY = /where_people_listen|topCities|listenerCities|listenerCountries/i;

/** Drop empty values, images and hidden keys; trim long strings and arrays. */
function compact(value, depth = 0) {
  if (Array.isArray(value)) return value.slice(0, 100).map(v => compact(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth > 6) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (HIDDEN_KEY.test(k) || /imageUrl|thumbnail|coverUrl|artistImage|previewUrl|audioFeatures/i.test(k)) continue;
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      const c = compact(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return value.slice(0, 300) + '…';
  return value;
}

/** Downsample a time series to at most `max` points, keeping the last one. */
function downsample(points, max = 60) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

const TOOL_RUNNERS = {
  async artist_history({ slugs, metrics, days }) {
    const keys = (Array.isArray(metrics) ? metrics : []).filter(k => !HIDDEN_KEY.test(k)).slice(0, 8);
    const window = clamp(days, 7, 365, 90);
    const out = {};
    const available = new Set();
    await Promise.all(slugList(slugs, 10).map(async (slug) => {
      const { artist, history = [] } = await fetchArtist(slug, { history: true, days: window });
      // One row per day: snapshots from several sources the same day merge
      const byDay = new Map();
      for (const h of history) {
        const day = String(h.capturedAt).slice(0, 10);
        const row = byDay.get(day) || { date: day };
        for (const [k, v] of Object.entries(h.metrics || {})) {
          if (typeof v !== 'number' || HIDDEN_KEY.test(k)) continue;
          available.add(k);
          if (keys.includes(k)) row[k] = v;
        }
        byDay.set(day, row);
      }
      const points = [...byDay.values()].filter(r => Object.keys(r).length > 1);
      out[slug] = { name: artist?.name || slug, points: downsample(points) };
    }));
    const missing = keys.filter(k => !available.has(k));
    return { days: window, artists: out, ...(missing.length ? { missingMetrics: missing, availableMetrics: [...available].sort() } : {}) };
  },

  async tracks({ slugs, sort, limit }) {
    const { tracks, total } = await fetchTracks({ slugs: slugList(slugs), sort: sort || 'streams', dedupe: true, perPage: clamp(limit, 1, 50, 20) });
    return {
      total,
      tracks: tracks.map(t => ({
        id: t.id, name: t.name, artist: t.artistSlug, artists: t.artistNames, album: t.albumName,
        releaseDate: t.releaseDate, streams: t.streams, popularity: t.popularity,
        spotifyPlaylists: t.spotifyPlaylists, spotifyEditorialPlaylists: t.spotifyEditorialPlaylists,
        spotifyPlaylistReach: t.spotifyPlaylistReach, tiktokVideos: t.tiktokVideos,
      })),
    };
  },

  async releases({ slugs, sort, limit }) {
    const { albums, total } = await fetchAlbums({ slugs: slugList(slugs), sort: sort || 'recent', perPage: clamp(limit, 1, 50, 20) });
    return { total, releases: albums };
  },

  async playlist_placements({ slugs, status, platform, editorial, limit }) {
    const { placements, summary } = await fetchPlacements({
      slugs: slugList(slugs), status: status || 'current', platform, editorial: editorial ? 1 : undefined,
      limit: clamp(limit, 0, 100, 30),
    });
    return {
      summary,
      placements: placements.map(p => ({
        playlistId: p.playlist?.id, playlist: p.playlist?.name, platform: p.playlist?.platform, type: p.playlist?.type,
        followers: p.playlist?.followers, artist: p.artistSlug, track: p.trackName, position: p.position,
        peakPosition: p.peakPosition, addedAt: p.addedAt, removedAt: p.removedAt, daysOn: p.daysOn,
      })),
    };
  },

  async social_posts({ slugs, platform, sort, limit }) {
    const { items, total } = await fetchContentFeed({
      artists: slugList(slugs), platform, sort: sort || 'recent', limit: clamp(limit, 1, 100, 30),
    });
    return {
      total,
      posts: items.map(p => ({
        artist: p.artistSlug, platform: p.platform, type: p.contentType, title: p.title,
        views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, publishedAt: p.publishedAt,
      })),
    };
  },

  async catalog_artists({ q, genre, country, stage, sort, limit }) {
    const { artists, total } = await fetchArtists({ q, genre, country, stage, sort: sort || 'rank', perPage: clamp(limit, 1, 50, 20) });
    return {
      total,
      artists: artists.map(a => ({
        slug: a.slug, name: a.name, genre: a.genres?.primary?.name, country: a.country, label: a.label,
        careerStage: a.careerStage, rank: a.rank, spotify: a.spotify, social: a.social,
        spotifyPlaylists: a.playlists?.spotify, shazam: a.engagement?.shazam,
      })),
    };
  },

  async campaigns() {
    const { campaigns } = await fetchCampaigns();
    return {
      campaigns: campaigns.map(c => ({
        id: c.id, name: c.name, artist: c.artistSlug, artistName: c.artistName, platform: c.platform,
        status: c.status, objective: c.objective, budget: c.budget, startDate: c.schedule?.startDate,
        endDate: c.schedule?.endDate, metaCampaignId: c.platformCampaignId, createdAt: c.createdAt,
      })),
    };
  },

  async campaign_report({ metaCampaignId }) {
    return fetchMetaCampaign(String(metaCampaignId || ''));
  },

  async smart_links() {
    return fetchSmartLinks();
  },
};

async function runTool(block) {
  const run = TOOL_RUNNERS[block.name];
  try {
    if (!run) throw new Error(`Unknown tool ${block.name}`);
    let text = JSON.stringify(compact(await run(block.input || {})));
    if (text.length > 30_000) text = text.slice(0, 30_000) + ' …(truncated)';
    return { type: 'tool_result', tool_use_id: block.id, content: text };
  } catch (e) {
    return { type: 'tool_result', tool_use_id: block.id, content: `Error: ${e.message}`, is_error: true };
  }
}

// ── The loop ─────────────────────────────────────────────────────────────────

const MAX_STEPS = 6;
// Past this many messages a refinement starts a fresh conversation from the current spec
const MAX_MESSAGES = 24;
const TYPES = new Set(['metric', 'bar', 'line', 'area', 'pie', 'radar', 'table', 'list', 'text']);

/** What each data tool is doing, for the progress list. */
export const TOOL_LABELS = {
  artist_history: 'Loading metric history',
  tracks: 'Loading tracks',
  releases: 'Loading releases',
  playlist_placements: 'Loading playlist placements',
  social_posts: 'Loading social posts',
  catalog_artists: 'Searching the catalog',
  campaigns: 'Loading campaigns',
  campaign_report: 'Loading campaign report',
  smart_links: 'Loading smart links',
};

/** Keep only what the renderer reads, with sane sizes. */
function cleanSpec(input) {
  const spec = { ...input };
  if (!TYPES.has(spec.type)) spec.type = 'text';
  spec.title = String(spec.title || 'Custom widget').slice(0, 80);
  if (spec.subtitle) spec.subtitle = String(spec.subtitle).slice(0, 120);
  for (const k of ['data', 'items', 'metrics', 'columns', 'series']) {
    if (spec[k] != null && !Array.isArray(spec[k])) delete spec[k];
    if (spec[k]) spec[k] = compact(spec[k].slice(0, k === 'metrics' ? 4 : 50));
  }
  return spec;
}

/** The request a saved widget is rebuilt from: the first ask plus each change. */
export function requestText(requests) {
  if (!requests?.length) return 'A dashboard widget.';
  const [first, ...changes] = requests;
  return changes.length ? `${first}\n\nThen these changes, in order:\n${changes.map(c => `- ${c}`).join('\n')}` : first;
}

/**
 * A widget being built and refined. `run(text)` sends the first request or a change
 * to the current preview and resolves to the new spec. Progress events go to onProgress:
 *   { kind: 'think' } | { kind: 'tools', labels: [string] } | { kind: 'render' }
 *
 * @param {object} opts { groups, base } base: a saved widget { requests, spec } to start from
 */
export function createWidgetSession({ groups, base } = {}) {
  const context = buildWidgetContext(groups);
  let messages = [];
  let pendingRender = null; // tool_use id of the last render_widget, answered by the next run
  let spec = base?.spec || null;
  const requests = [...(base?.requests || [])];

  const fromSpec = (change) => [
    { role: 'user', content: `${requestText(requests)}\n\nThe widget currently looks like this:\n${JSON.stringify(spec)}\n\nChange: ${change}\nFetch fresh data where needed.` },
  ];

  async function run(text, onProgress) {
    try {
      return await attempt(text, onProgress);
    } catch (err) {
      // Drop the failed turn; the next run starts again from the current spec
      requests.pop();
      messages = [];
      pendingRender = null;
      throw err;
    }
  }

  async function attempt(text, onProgress) {
    if (!messages.length || messages.length > MAX_MESSAGES) {
      messages = spec ? fromSpec(text) : [{ role: 'user', content: text }];
    } else {
      messages.push({
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: pendingRender, content: 'Shown to the user as a preview.' },
          { type: 'text', text: `Change: ${text}` },
        ],
      });
    }
    pendingRender = null;
    requests.push(text);

    for (let step = 0; step < MAX_STEPS; step++) {
      onProgress?.({ kind: 'think' });
      const { content, stopReason } = await generateStep(messages, context);
      if (stopReason === 'refusal') throw new Error("Couldn't build that widget");
      messages.push({ role: 'assistant', content });

      const render = content.find(b => b.type === 'tool_use' && b.name === 'render_widget');
      if (render) {
        pendingRender = render.id;
        onProgress?.({ kind: 'render' });
        spec = cleanSpec(render.input || {});
        return spec;
      }

      const calls = content.filter(b => b.type === 'tool_use');
      if (!calls.length) {
        // Answered in text despite the instructions — show it as a text widget, start over next time
        const answer = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        if (!answer) throw new Error("Couldn't build that widget");
        messages = [];
        spec = cleanSpec({ type: 'text', title: text.slice(0, 40), text: answer });
        return spec;
      }

      onProgress?.({ kind: 'tools', labels: [...new Set(calls.map(c => TOOL_LABELS[c.name] || 'Loading data'))] });
      const results = await Promise.all(calls.map(runTool));
      const lastStep = step === MAX_STEPS - 2;
      messages.push({
        role: 'user',
        content: lastStep ? [...results, { type: 'text', text: 'Call render_widget now with the data you have.' }] : results,
      });
    }
    throw new Error("Couldn't build that widget");
  }

  return { run, requests: () => [...requests] };
}

/** Rebuild a saved widget from its requests with fresh data. */
export function rebuildWidgetSpec(widget, { groups } = {}) {
  return createWidgetSession({ groups }).run(requestText(widget.requests));
}
