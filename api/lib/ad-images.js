// Images users upload for new ads, kept in Postgres. Served by id at
// /api/ad-images?id=<uuid> (ids are random, so the URL is the only key) and read
// straight from the database when an ad is launched.
import crypto from 'node:crypto';
import { query, queryOne } from './db.js';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // under Vercel's 4.5 MB body limit once base64'd
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ID_RE = /^[0-9a-f-]{36}$/;

let tableReady;
export function ensureAdImages() {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS ad_images (
        id           uuid PRIMARY KEY,
        user_id      text NOT NULL,
        content_type text NOT NULL,
        bytes        bytea NOT NULL,
        width        int,
        height       int,
        created_at   timestamptz NOT NULL DEFAULT now()
      )`).catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

export const adImageUrl = (id) => `/api/ad-images?id=${id}`;

/** The upload id inside one of our image URLs (relative or absolute), else null. */
export function adImageId(url) {
  const m = String(url || '').match(/\/api\/ad-images\?id=([0-9a-f-]{36})/);
  return m ? m[1] : null;
}

/** Save a data: URL upload. Returns { id, url }. */
export async function saveAdImage(uid, dataUrl, { width, height } = {}) {
  const m = String(dataUrl || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m || !TYPES.includes(m[1])) {
    throw Object.assign(new Error('Upload a JPG, PNG or WebP image.'), { status: 400 });
  }
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('That image is too large. Use one under 3 MB.'), { status: 400 });
  }
  await ensureAdImages();
  const id = crypto.randomUUID();
  await query(
    'INSERT INTO ad_images (id, user_id, content_type, bytes, width, height) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, uid, m[1], bytes, Number(width) || null, Number(height) || null]);
  return { id, url: adImageUrl(id) };
}

export async function getAdImage(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  await ensureAdImages();
  return queryOne('SELECT id, user_id, content_type, bytes FROM ad_images WHERE id = $1', [id]);
}
