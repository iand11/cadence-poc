import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

function sheetProxyPlugin() {
  return {
    name: 'sheet-csv-proxy',
    configureServer(server) {
      server.middlewares.use('/api/sheet-proxy', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        for await (const chunk of req) body += chunk;

        let parsed;
        try { parsed = JSON.parse(body); }
        catch { res.writeHead(400); res.end('Invalid JSON'); return; }

        const { url } = parsed;
        if (!url || !url.includes('docs.google.com')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Google Sheets URL' }));
          return;
        }

        try {
          const response = await fetch(url, {
            headers: { Accept: 'text/csv,text/plain,*/*' },
            redirect: 'follow',
          });
          if (!response.ok) {
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: response.status === 404
              ? 'Sheet not found. Make sure it is published to the web.'
              : `Google Sheets returned ${response.status}` }));
            return;
          }
          const text = await response.text();
          res.writeHead(200, { 'Content-Type': 'text/csv' });
          res.end(text);
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

function claudeApiPlugin() {
  let Anthropic = null;

  return {
    name: 'claude-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        if (!Anthropic) Anthropic = (await import('@anthropic-ai/sdk')).default;

        let body = '';
        for await (const chunk of req) body += chunk;

        let parsed;
        try { parsed = JSON.parse(body); }
        catch { res.writeHead(400); res.end('Invalid JSON'); return; }

        const { messages, artistContext } = parsed;
        const rosterContext = typeof artistContext === 'string' && artistContext.trim()
          ? artistContext.slice(0, 30_000)
          : 'No tracked artists yet — the user has not added artists to their roster.';
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey || apiKey === 'your-api-key-here') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'ANTHROPIC_API_KEY not configured. Add your key to .env' })}\n\n`);
          res.end();
          return;
        }

        const client = new Anthropic({ apiKey });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const systemPrompt = `You are MusicSpace, a music industry intelligence assistant in the MusicSpace platform. You help A&R, managers, and label executives make data-driven decisions.

Real-time roster data:
${rosterContext}

Rules:
- Use the REAL data above. Cite specific numbers.
- Be concise: 2-3 paragraphs max. Direct and professional.
- Speak authoritatively — no hedging like "Based on my data".
- End with one follow-up suggestion.
- You are MusicSpace, not Claude.
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

        try {
          const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: systemPrompt,
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

          req.on('close', () => {});
        } catch (error) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
        }
      });
    },
  };
}

function campaignGeneratePlugin() {
  return {
    name: 'campaign-generate-proxy',
    configureServer(server) {
      server.middlewares.use('/api/campaign/generate', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        for await (const chunk of req) body += chunk;
        let parsed;
        try { parsed = JSON.parse(body); }
        catch { res.writeHead(400); res.end('Invalid JSON'); return; }

        req.body = parsed;
        // Disable Nagle for SSE
        if (res.socket) res.socket.setNoDelay(true);

        const handler = (await import('./api/campaign/generate.js')).default;
        await handler(req, res);
      });
    },
  };
}

function pitchAuthPlugin() {
  return {
    name: 'pitch-auth-proxy',
    configureServer(server) {
      server.middlewares.use('/api/pitch', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try { req.body = JSON.parse(body || '{}'); } catch { req.body = {}; }
        }
        const handler = (await import('./api/pitch.js')).default;
        await handler(req, res);
      });
    },
  };
}

function appAuthPlugin() {
  return {
    name: 'app-auth-proxy',
    configureServer(server) {
      server.middlewares.use('/api/auth', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try { req.body = JSON.parse(body || '{}'); } catch { req.body = {}; }
        }
        const handler = (await import('./api/auth.js')).default;
        await handler(req, res);
      });
    },
  };
}

function userDataPlugin() {
  return {
    name: 'user-data-proxy',
    configureServer(server) {
      server.middlewares.use('/api/user-data', async (req, res) => {
        if (req.method === 'POST' || req.method === 'PUT') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try { req.body = JSON.parse(body || '{}'); } catch { req.body = {}; }
        }
        // api/user-data.js is written Vercel-style (res.status().json()).
        // Shim those onto the raw Node response so the same handler runs in dev.
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        const handler = (await import('./api/user-data.js')).default;
        await handler(req, res);
      });
    },
  };
}

function dbApiPlugin() {
  const shim = (res) => {
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
  };
  return {
    name: 'db-api-proxy',
    configureServer(server) {
      // /api/<resource> and /api/<resource>/:id — connect strips the mount
      // prefix, so req.url is '/' for the index and '/<id>' for detail.
      const mountResource = (mount, dir, detailFile) => {
        server.middlewares.use(mount, async (req, res) => {
          shim(res);
          const subpath = (req.url || '/').split('?')[0].replace(/^\/+|\/+$/g, '');
          // Static routes (e.g. artists/facets.js) win over the dynamic
          // [slug]/[id] handler, matching Vercel's file routing.
          const file = !subpath ? 'index.js'
            : existsSync(`./api/${dir}/${subpath}.js`) ? `${subpath}.js`
            : detailFile;
          // Absolute file URL — vite bundles this config into node_modules/
          // .vite-temp, so relative dynamic imports would resolve wrong.
          const handler = (await import(
            pathToFileURL(join(process.cwd(), 'api', dir, file)).href
          )).default;
          await handler(req, res);
        });
      };
      mountResource('/api/artists', 'artists', '[slug].js');
      mountResource('/api/tracks', 'tracks', '[id].js');
      mountResource('/api/albums', 'albums', '[id].js');
      server.middlewares.use('/api/feed', async (req, res) => {
        shim(res);
        const handler = (await import('./api/feed.js')).default;
        await handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  return { plugins: [react(), tailwindcss(), sheetProxyPlugin(), claudeApiPlugin(), campaignGeneratePlugin(), pitchAuthPlugin(), appAuthPlugin(), userDataPlugin(), dbApiPlugin()] };
});
