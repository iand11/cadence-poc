// Shared Postgres pool for CLI scripts (loads .env, unlike api/lib/db.js
// which relies on the Vercel/vite environment).
import pg from 'pg';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dns.setDefaultResultOrder('ipv4first');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Load .env if SUPABASE_DB_URL isn't already in the environment
if (!process.env.SUPABASE_DB_URL) {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // node < 21 fallback: minimal parse
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

if (!process.env.SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL is not set (checked environment and .env)');
  process.exit(1);
}

// Lazily constructed so scripts can set DB_POOL_SIZE in their module body
// before first use (ESM imports run before that body, so an eager pool would
// lock in the default size).
let _pool;
function ensurePool() {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      max: Number(process.env.DB_POOL_SIZE || 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export const pool = new Proxy({}, {
  get(_, prop) {
    const p = ensurePool();
    const value = p[prop];
    return typeof value === 'function' ? value.bind(p) : value;
  },
});

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// "2005-05-23T00:00:00.000Z" | "2005-05-23" | "2005" → "YYYY-MM-DD" or null
export function toDate(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}`;
}
