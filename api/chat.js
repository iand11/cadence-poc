import Anthropic from '@anthropic-ai/sdk';


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

const systemPrompt = (context) => `You are Prelude, a music industry intelligence assistant in the Prelude platform. You help A&R, managers, and label executives make data-driven decisions.

Real-time roster data:
${context}

Rules:
- Use the REAL data above. Cite specific numbers.
- Be concise: 2-3 paragraphs max. Direct and professional.
- Speak authoritatively — no hedging like "Based on my data".
- End with one follow-up suggestion.
- You are Prelude, not Claude.
- Use markdown formatting: **bold** for artist names and key numbers, bullet lists for comparisons.
- When asked to show, visualize, or chart data, use the render_chart tool. Construct the data array from the roster stats above. Include brief text analysis alongside the chart.
- When the user asks to create a task, action item, reminder, or to-do for an artist, use the create_action tool. This adds the item to the Action Center.`;

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
}, {
  name: 'render_chart',
  description: 'Render an inline chart in the conversation. Use when the user asks to show, chart, graph, or visualize data. Build the data array from the roster data above. Keep data arrays concise (max ~20 items).',
  input_schema: {
    type: 'object',
    properties: {
      chartType: {
        type: 'string',
        enum: ['bar', 'line', 'area', 'pie', 'radar'],
        description: 'Chart type to render',
      },
      title: {
        type: 'string',
        description: 'Short chart title',
      },
      data: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of data objects. Each object is one data point with keys matching series definitions.',
      },
      series: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Data key in each data object' },
            name: { type: 'string', description: 'Display label for this series' },
          },
          required: ['key'],
        },
        description: 'Series definitions. For pie charts: first item is the name key, second is the value key. For radar: first item is the angle axis key, rest are value series. For bar/line/area: each item is a Y-axis series.',
      },
      xKey: {
        type: 'string',
        description: 'Key for X-axis (bar/line/area only). Defaults to "name".',
      },
      unit: {
        type: 'string',
        description: 'Unit label for values (e.g. "streams", "followers", "USD"). Shown on Y-axis and tooltip.',
      },
    },
    required: ['chartType', 'data', 'series'],
  },
}, {
  name: 'create_action',
  description: 'Create a custom action item in the Action Center. Use when the user asks to add a task, reminder, or to-do for an artist. Artist slugs are lowercase-hyphenated (e.g. "taylor-swift", "bad-bunny").',
  input_schema: {
    type: 'object',
    properties: {
      artistSlug: {
        type: 'string',
        description: 'Artist slug (lowercase-hyphenated name)',
      },
      platform: {
        type: 'string',
        enum: ['spotify', 'apple', 'youtube', 'tiktok', 'instagram', 'twitter', 'general'],
        description: 'Related platform or category',
      },
      dataType: {
        type: 'string',
        enum: ['streaming', 'social', 'playlists', 'geography', 'revenue', 'general'],
        description: 'Data category this action relates to',
      },
      text: {
        type: 'string',
        description: 'Context explaining why this action matters',
      },
      action: {
        type: 'string',
        description: 'The specific action to take',
      },
    },
    required: ['artistSlug', 'action'],
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

  // Roster context now comes from the client, which builds it from the
  // user's tracked artists (DB-backed) — the static bundle is gone.
  const { messages, artistContext } = req.body || {};
  const context = typeof artistContext === 'string' && artistContext.trim()
    ? artistContext.slice(0, 30_000)
    : 'No tracked artists yet — the user has not added artists to their roster.';
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
      max_tokens: 2048,
      system: systemPrompt(context),
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
