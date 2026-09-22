#!/usr/bin/env node
// Load social posts into the social_posts table.
//
//   node scripts/ingest-social-posts.js                       # src/data/social_posts.json
//   node scripts/ingest-social-posts.js --file fresh.json     # a fresh fetch
//
// Input format (same as src/data/social_posts.json):
//   [{ name: "Artist Name", posts: { instagram: [post...], tiktok: [...], youtube: [...] } }]
//
// Upserts by post_id, so re-running with fresh data updates engagement counts
// in place — this is the recurring social-feed refresh write path.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, slugify } from './lib/db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const FILE = fileIdx !== -1 ? args[fileIdx + 1] : path.join(ROOT, 'src/data/social_posts.json');

const PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'twitter']);

function toRow(post, platform, artistId) {
  const stat = post.stat || {};
  return {
    post_id: String(post.post_id),
    artist_id: artistId,
    platform,
    content_type: post.type === 'video' ? 'video' : 'posts',
    title: post.title || post.text || null,
    thumbnail_url: post.thumbnail || post.image || null,
    permalink: post.link || null,
    owner_platform_id: post.user_id ? String(post.user_id) : null,
    views: stat.views || stat.plays || 0,
    likes: stat.likes || 0,
    comments: stat.comments || 0,
    shares: stat.shares || 0,
    duration: post.duration || null,
    published_at: post.created || null,
    raw: post,
  };
}

const UPSERT = `
INSERT INTO social_posts (
  post_id, artist_id, platform, content_type, title, thumbnail_url, permalink,
  owner_platform_id, views, likes, comments, shares, duration, published_at, fetched_at, raw
)
SELECT
  r.post_id, r.artist_id, r.platform, r.content_type, r.title, r.thumbnail_url, r.permalink,
  r.owner_platform_id, r.views, r.likes, r.comments, r.shares, r.duration, r.published_at, now(), r.raw
FROM jsonb_to_recordset($1::jsonb) AS r(
  post_id text, artist_id bigint, platform text, content_type text, title text,
  thumbnail_url text, permalink text, owner_platform_id text, views bigint,
  likes bigint, comments bigint, shares bigint, duration integer,
  published_at timestamptz, raw jsonb
)
ON CONFLICT (post_id) DO UPDATE SET
  artist_id = COALESCE(EXCLUDED.artist_id, social_posts.artist_id),
  views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
  shares = EXCLUDED.shares, title = EXCLUDED.title,
  thumbnail_url = EXCLUDED.thumbnail_url, fetched_at = now(), raw = EXCLUDED.raw
`;

async function main() {
  const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`${entries.length} artist entries in ${FILE}`);

  // Map artist name → id via slug
  const { rows: artistRows } = await pool.query('SELECT id, slug FROM artists');
  const bySlug = new Map(artistRows.map((r) => [r.slug, r.id]));

  const rowsById = new Map();
  let unmatched = 0;
  for (const entry of entries) {
    const artistId = bySlug.get(slugify(entry.name)) ?? null;
    if (artistId === null) unmatched++;
    for (const [platform, posts] of Object.entries(entry.posts || {})) {
      if (!PLATFORMS.has(platform) || !Array.isArray(posts)) continue;
      for (const post of posts) {
        if (!post?.post_id) continue;
        rowsById.set(String(post.post_id), toRow(post, platform, artistId));
      }
    }
  }
  const rows = [...rowsById.values()];
  console.log(`${rows.length} unique posts (${unmatched} artists not in DB — posts kept with null artist_id)`);

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await pool.query(UPSERT, [JSON.stringify(rows.slice(i, i + BATCH))]);
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log('\nDone.');
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
