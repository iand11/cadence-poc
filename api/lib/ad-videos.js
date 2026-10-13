// Videos users upload for new Meta ads, kept in Postgres like ad images. A video is
// too big for one request (Vercel caps bodies at 4.5 MB), so it arrives in chunks:
// start → chunk… → finish. The URL /api/ad-videos?id=<uuid> is the creative's
// `videoUrl`; meta-launch reads the bytes straight from the database.
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 3 * 1024 * 1024; // under Vercel's body limit once base64'd
const TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ID_RE = /^[0-9a-f-]{36}$/;

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

let tableReady;
export function ensureAdVideos() {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS ad_videos (
        id           uuid PRIMARY KEY,
        user_id      text NOT NULL,
        name         text,
        content_type text NOT NULL,
        size         bigint NOT NULL,
        bytes        bytea NOT NULL DEFAULT ''::bytea,
        complete     boolean NOT NULL DEFAULT false,
        meta_videos  jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at   timestamptz NOT NULL DEFAULT now()
      )`).catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

export const adVideoUrl = (id) => `/api/ad-videos?id=${id}`;

/** The upload id inside one of our video URLs (relative or absolute), else null. */
export function adVideoId(url) {
  const m = String(url || '').match(/\/api\/ad-videos\?id=([0-9a-f-]{36})/);
  return m ? m[1] : null;
}

export async function startAdVideo(uid, { name, contentType, size }) {
  const type = String(contentType || '').split(';')[0];
  if (!TYPES.includes(type)) throw fail('Upload an MP4, MOV or WebM video.');
  const bytes = Number(size);
  if (!(bytes > 0)) throw fail('The video is empty.');
  if (bytes > MAX_VIDEO_BYTES) throw fail('That video is too large. Use one under 100 MB.');
  await ensureAdVideos();
  const id = crypto.randomUUID();
  await query('INSERT INTO ad_videos (id, user_id, name, content_type, size) VALUES ($1, $2, $3, $4, $5)',
    [id, uid, String(name || '').slice(0, 200) || null, type, bytes]);
  return { id };
}

/** Append one chunk. `offset` must match what's stored, so a retried chunk can't be added twice. */
export async function appendAdVideo(uid, { id, offset, data }) {
  if (!ID_RE.test(String(id || ''))) throw fail('Unknown upload.');
  const chunk = Buffer.from(String(data || ''), 'base64');
  if (!chunk.length) throw fail('Empty chunk.');
  if (chunk.length > MAX_CHUNK_BYTES) throw fail('Chunk too large.');
  await ensureAdVideos();
  const row = await queryOne(
    `UPDATE ad_videos SET bytes = bytes || $4
      WHERE id = $1 AND user_id = $2 AND NOT complete AND octet_length(bytes) = $3
        AND octet_length(bytes) + $5 <= size
      RETURNING octet_length(bytes) AS received`,
    [id, uid, Number(offset), chunk, chunk.length]);
  if (row) return { received: Number(row.received) };
  const current = await queryOne('SELECT octet_length(bytes) AS received FROM ad_videos WHERE id = $1 AND user_id = $2', [id, uid]);
  if (!current) throw fail('Unknown upload.', 404);
  // Already have this chunk (a retry after a lost response): report where we are
  return { received: Number(current.received) };
}

export async function finishAdVideo(uid, { id }) {
  await ensureAdVideos();
  const row = await queryOne(
    `UPDATE ad_videos SET complete = true
      WHERE id = $1 AND user_id = $2 AND octet_length(bytes) = size
      RETURNING id`,
    [id, uid]);
  if (!row) throw fail('The upload is incomplete. Try again.');
  return { id, url: adVideoUrl(id) };
}

/** Metadata only (no bytes) — enough to validate a creative. */
export async function getAdVideoInfo(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  await ensureAdVideos();
  return queryOne('SELECT id, user_id, name, content_type, size, complete, meta_videos FROM ad_videos WHERE id = $1', [id]);
}

export async function getAdVideo(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  await ensureAdVideos();
  return queryOne('SELECT id, user_id, name, content_type, size, complete, meta_videos, bytes FROM ad_videos WHERE id = $1 AND complete', [id]);
}

/** Remember the Meta video id per ad account, so a retry doesn't upload the file again. */
export async function setMetaVideoId(id, adAccountId, metaVideoId) {
  await query(`UPDATE ad_videos SET meta_videos = meta_videos || jsonb_build_object($2::text, $3::text) WHERE id = $1`,
    [id, adAccountId, metaVideoId]);
}
