// Custom dashboard widgets: one row per widget per user, plus the model step that
// turns a free-form request into a widget spec.
//
// Generation is a short tool-use loop driven by the client: the data tools run in
// the browser through the app's existing APIs (so they see exactly what the user
// can see, already shaped and without listener geography), and this module only
// makes one model call per step. The loop ends when the model calls render_widget.
import Anthropic from '@anthropic-ai/sdk';
import { query, exec } from './db.js';

// Created lazily too (mirrors db/schema.sql) so a database that hasn't had
// `npm run db:schema` re-run since this table was added still works.
let tableReady;
export function ensureWidgetsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS dashboard_widgets (
          user_id    text NOT NULL,
          id         text NOT NULL,
          data       jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, id)
        )`);
    })().catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

const MAX_BYTES = 256 * 1024;
const MAX_WIDGETS = 50;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

/** Throws unless `w` is a storable widget; returns its JSON. */
export function widgetJson(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) throw bad('Widget must be an object');
  if (typeof w.id !== 'string' || !w.id || w.id.length > 100) throw bad('Widget needs an id');
  if (!w.spec || typeof w.spec !== 'object') throw bad('Widget needs a spec');
  const json = JSON.stringify(w);
  if (json.length > MAX_BYTES) throw bad('Widget is too large');
  return json;
}

/** The user's widgets, oldest first (the order they were added to the dashboard). */
export async function listWidgets(uid) {
  const rows = await query('SELECT data FROM dashboard_widgets WHERE user_id = $1 ORDER BY created_at, id', [uid]);
  return rows.map(r => r.data);
}

/** Insert or replace one widget. */
export async function saveWidget(uid, widget) {
  const json = widgetJson(widget);
  const [{ n }] = await query(
    'SELECT count(*)::int AS n FROM dashboard_widgets WHERE user_id = $1 AND id <> $2', [uid, widget.id],
  );
  if (n >= MAX_WIDGETS) throw bad(`You can have up to ${MAX_WIDGETS} custom widgets`);
  await exec(
    `INSERT INTO dashboard_widgets (user_id, id, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [uid, widget.id, json],
  );
}

export async function deleteWidget(uid, id) {
  await exec('DELETE FROM dashboard_widgets WHERE user_id = $1 AND id = $2', [uid, id]);
}

// ── Generation ───────────────────────────────────────────────────────────────

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You build one dashboard widget for Prelude, a music industry intelligence app used by managers, labels and A&R. The user describes what they want to see; you gather the data with the tools and then call render_widget once.

How to work:
- The context lists the artists the user follows ("my artists", "my roster") and their named groups. Use the other tools for anything else: metric history, tracks, releases, playlist placements, social posts, the wider catalog, the user's campaigns and smart links.
- Call independent tools in parallel. Most widgets need one to three tool calls.
- Always finish by calling render_widget. Never answer in plain text.
- Use only numbers that come from the context or a tool result. Never estimate, invent or extrapolate data. If the data the user asked for does not exist in these sources, render a short "text" widget saying what is missing and, if one exists, the closest thing you can show.
- Never show where an artist's listeners are (listener cities or countries). If asked, say in a text widget that listener geography is not shown in Prelude. An artist's own home country/city, smart link visitor counts by country and campaign audience breakdowns are fine.

Choosing the view:
- metric: one to four headline numbers.
- bar: comparing values across artists, tracks, platforms or categories.
- line or area: values over time (x axis is a date string, oldest first).
- pie: share of a whole, at most eight slices.
- radar: two or three artists compared across four to six dimensions on the same scale.
- table: rows with several columns.
- list: a ranked or grouped list of items, optionally linking to their page.
- text: a qualitative answer or summary, at most 80 words, plain markdown.
Keep the title under 40 characters and the optional subtitle under 60. At most 30 rows or points. Values are raw numbers, never formatted strings like "1.2M". Links are app paths: /app/artist/<slug>, /app/track/<id>, /app/album/<id>, /app/playlist/<id>.`;

const ARTIST_SLUGS = {
  type: 'array', items: { type: 'string' },
  description: 'Artist slugs (from the context or catalog_artists). Max 20.',
};

const TOOLS = [{
  name: 'artist_history',
  description: 'Daily metric history for up to 10 artists. Common metric keys: sp_monthly_listeners, sp_followers, sp_popularity, ins_followers, tiktok_followers, tiktok_likes, ycs_subscribers, ycs_views, twitter_followers, num_sp_playlists, num_sp_editorial_playlists, sp_playlist_total_reach, shazam_count. Unknown keys return the list of available keys.',
  input_schema: {
    type: 'object',
    properties: {
      slugs: { ...ARTIST_SLUGS, description: 'Artist slugs, max 10.' },
      metrics: { type: 'array', items: { type: 'string' }, description: 'Metric keys to return.' },
      days: { type: 'integer', description: 'Window in days, 7 to 365. Default 90.' },
    },
    required: ['slugs', 'metrics'],
  },
}, {
  name: 'tracks',
  description: 'Tracks by the given artists with Spotify streams, popularity, release date and playlist counts.',
  input_schema: {
    type: 'object',
    properties: {
      slugs: ARTIST_SLUGS,
      sort: { type: 'string', enum: ['streams', 'recent', 'popularity'] },
      limit: { type: 'integer', description: '1 to 50. Default 20.' },
    },
    required: ['slugs'],
  },
}, {
  name: 'releases',
  description: 'Albums and singles by the given artists.',
  input_schema: {
    type: 'object',
    properties: {
      slugs: ARTIST_SLUGS,
      sort: { type: 'string', enum: ['recent', 'popularity'] },
      limit: { type: 'integer', description: '1 to 50. Default 20.' },
    },
    required: ['slugs'],
  },
}, {
  name: 'playlist_placements',
  description: 'Playlist placements (Spotify, Apple Music, Deezer) for the given artists: a summary (playlists, reach, added/removed in 30 days, by platform) and placement rows (playlist, followers, track, position, peak, added/removed dates).',
  input_schema: {
    type: 'object',
    properties: {
      slugs: ARTIST_SLUGS,
      status: { type: 'string', enum: ['current', 'past', 'all'] },
      platform: { type: 'string', enum: ['spotify', 'apple', 'deezer'] },
      editorial: { type: 'boolean', description: 'Only editorial and chart playlists.' },
      limit: { type: 'integer', description: '0 to 100. 0 returns only the summary. Default 30.' },
    },
    required: ['slugs'],
  },
}, {
  name: 'social_posts',
  description: 'Recent social posts (Instagram, TikTok, YouTube) by the given artists with views, likes, comments, shares and publish date.',
  input_schema: {
    type: 'object',
    properties: {
      slugs: ARTIST_SLUGS,
      platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube'] },
      sort: { type: 'string', enum: ['recent', 'engagement'] },
      limit: { type: 'integer', description: '1 to 100. Default 30.' },
    },
    required: ['slugs'],
  },
}, {
  name: 'catalog_artists',
  description: 'Search or rank the whole artist catalog (not only followed artists).',
  input_schema: {
    type: 'object',
    properties: {
      q: { type: 'string', description: 'Name search.' },
      genre: { type: 'string' },
      country: { type: 'string', description: 'Two-letter country code of the artist.' },
      stage: { type: 'string', enum: ['developing', 'mid_level', 'mainstream', 'superstar', 'legendary'] },
      sort: { type: 'string', enum: ['rank', 'listeners', 'followers', 'score', 'name'] },
      limit: { type: 'integer', description: '1 to 50. Default 20.' },
    },
  },
}, {
  name: 'campaigns',
  description: "The user's ad campaigns (Instagram, TikTok, YouTube): artist, platform, status, goal, budget, dates and the Meta campaign id once launched.",
  input_schema: { type: 'object', properties: {} },
}, {
  name: 'campaign_report',
  description: 'Delivery report for one launched Meta campaign: spend, impressions, reach, link clicks, streaming-service clicks, video completion, daily series and breakdowns.',
  input_schema: {
    type: 'object',
    properties: { metaCampaignId: { type: 'string', description: 'Meta campaign id from the campaigns tool.' } },
    required: ['metaCampaignId'],
  },
}, {
  name: 'smart_links',
  description: "The user's smart links (release landing pages) with visits and clicks per streaming service.",
  input_schema: { type: 'object', properties: {} },
}, {
  name: 'render_widget',
  description: 'Render the finished widget. Call exactly once, last.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      subtitle: { type: 'string' },
      type: { type: 'string', enum: ['metric', 'bar', 'line', 'area', 'pie', 'radar', 'table', 'list', 'text'] },
      data: {
        type: 'array', items: { type: 'object' },
        description: 'bar/line/area/pie/radar/table rows. Each row is one point or row.',
      },
      xKey: { type: 'string', description: 'bar/line/area: key of the x value in each row. radar: key of the dimension label.' },
      series: {
        type: 'array',
        items: {
          type: 'object',
          properties: { key: { type: 'string' }, name: { type: 'string' } },
          required: ['key'],
        },
        description: 'bar/line/area/radar: value keys to plot. pie: [label key, value key].',
      },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            format: { type: 'string', enum: ['text', 'number', 'currency', 'percent', 'date'] },
            link: { type: 'string', description: 'Row key holding an app path to link this cell to.' },
          },
          required: ['key', 'label'],
        },
        description: 'table: columns in order.',
      },
      metrics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: ['number', 'string'] },
            format: { type: 'string', enum: ['number', 'currency', 'percent', 'text'] },
            change: { type: 'number', description: 'Optional percent change, e.g. 4.2 for +4.2%.' },
          },
          required: ['label', 'value'],
        },
        description: 'metric: one to four numbers.',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            value: { type: ['number', 'string'] },
            format: { type: 'string', enum: ['number', 'currency', 'percent', 'text'] },
            link: { type: 'string' },
            imageUrl: { type: 'string' },
          },
          required: ['title'],
        },
        description: 'list: items in order.',
      },
      unit: { type: 'string', description: 'Unit for chart values, e.g. "streams" or "USD".' },
      text: { type: 'string', description: 'text: markdown, at most 80 words.' },
    },
    required: ['title', 'type'],
  },
}];

const MAX_MESSAGES = 24;
const MAX_REQUEST_BYTES = 600 * 1024;

// Model calls per user per hour (a widget takes ~2–4), per warm instance.
const RATE_LIMIT = 120;
const RATE_WINDOW = 60 * 60e3;
const hits = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const entry = hits.get(uid);
  if (!entry || now - entry.start > RATE_WINDOW) {
    hits.set(uid, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/**
 * One step of the widget loop. `messages` is the conversation so far (the first
 * user message is the request; later ones carry tool results). Returns the model's
 * content blocks unchanged so the client can append them as the next assistant turn.
 */
export async function generateStep(uid, { messages, context }) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) throw bad('Bad widget request');
  if (messages[0]?.role !== 'user') throw bad('Bad widget request');
  if (JSON.stringify(messages).length > MAX_REQUEST_BYTES) throw bad('Widget request is too large');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw bad('ANTHROPIC_API_KEY not configured', 503);
  if (rateLimited(uid)) throw bad('Too many widget requests. Try again later.', 429);

  const ctx = typeof context === 'string' && context.trim()
    ? context.slice(0, 40_000)
    : 'The user does not follow any artists yet.';

  const client = new Anthropic({ apiKey });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${ctx}` },
    ],
    tools: TOOLS,
    messages,
  });
  return { content: response.content, stopReason: response.stop_reason };
}
