import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached = null;

// In-memory rate limiter (per warm instance)
const RATE_LIMIT = 20;         // max requests
const RATE_WINDOW = 60 * 60e3; // per hour
const ipHits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    ipHits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function buildArtistContext() {
  const indexData = JSON.parse(readFileSync(join(process.cwd(), 'src/data/artists-index.generated.json'), 'utf-8'));
  const raw = indexData.artists;
  const fmt = (n) =>
    n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
    n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
    n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);

  const artists = raw
    .filter((r) => r.ok && r.body?.data)
    .map((r) => {
      const d = r.body.data;
      const s = d.cm_statistics || {};
      const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const cities = (s.sp_where_people_listen || []).slice(0, 2).map((c) => c.name).join('/');
      return {
        rank: d.cm_artist_rank,
        line: `#${d.cm_artist_rank} ${d.name} (${slug}) | ${d.genres?.primary?.name || '?'} | pop:${s.sp_popularity || 0} | Sp:${fmt(s.sp_monthly_listeners || 0)}mo ${fmt(s.sp_followers || 0)}fol | IG:${fmt(s.ins_followers || 0)} TT:${fmt(s.tiktok_followers || 0)} YT:${fmt(s.ycs_subscribers || 0)} | PL:${s.num_sp_playlists || 0}(${s.num_sp_editorial_playlists || 0}ed) ${fmt(s.sp_playlist_total_reach || 0)}reach | ${cities}`,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const totalListeners = raw
    .filter((r) => r.ok)
    .reduce((sum, r) => sum + (r.body?.data?.cm_statistics?.sp_monthly_listeners || 0), 0);

  return `ROSTER: ${artists.length} artists | ${fmt(totalListeners)} total monthly listeners\n` +
    artists.map((a) => a.line).join('\n');
}

const systemPrompt = (context) => `You are Cadence, a music industry intelligence assistant in the Cadence platform. You help A&R, managers, and label executives make data-driven decisions.

Real-time roster data:
${context}

Rules:
- Use the REAL data above. Cite specific numbers.
- Be concise: 2-3 paragraphs max. Direct and professional.
- Speak authoritatively — no hedging like "Based on my data".
- End with one follow-up suggestion.
- You are Cadence, not Claude.
- Use markdown formatting: **bold** for artist names and key numbers, bullet lists for comparisons.`;

const tools = [{
  name: 'create_report',
  description: 'Create a custom analytics report. Use when the user asks to build/create/generate a report. Widget IDs: artist-comparison, streaming-trends, revenue-breakdown, social-growth, geography, forecast, playlists, benchmarks. Artist slugs are lowercase-hyphenated (e.g. "taylor-swift", "bad-bunny").',
  input_schema: {
    type: 'object',
    properties: {
      artistSlugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Artist slugs (lowercase-hyphenated names)',
      },
      widgets: {
        type: 'array',
        items: { type: 'string' },
        description: 'Widget IDs to include',
      },
    },
    required: ['artistSlugs'],
  },
}];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Try again later.' })}\n\n`);
    return res.end();
  }

  if (!cached) cached = buildArtistContext();

  const { messages } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'ANTHROPIC_API_KEY not configured' })}\n\n`);
    return res.end();
  }

  const client = new Anthropic({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt(cached),
      messages: messages || [],
      tools,
      stream: true,
    });

    for await (const event of response) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`);
        } else if (event.delta.type === 'input_json_delta') {
          res.write(`data: ${JSON.stringify({ type: 'tool_input_delta', json: event.delta.partial_json })}\n\n`);
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          res.write(`data: ${JSON.stringify({ type: 'tool_start', name: event.content_block.name })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

export const config = {
  maxDuration: 30,
};
