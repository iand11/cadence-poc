import pg from 'pg';
import dns from 'dns';

// Force IPv4 — many networks don't route IPv6 to Supabase
dns.setDefaultResultOrder('ipv4first');

let pool;

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Idempotently ensure the per-user key/value table exists. Runs once per process.
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id    text        NOT NULL,
        key        text        NOT NULL,
        data       jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, key)
      )
    `).catch((err) => {
      // Reset so a later call can retry, but don't crash the request path.
      schemaReady = undefined;
      throw err;
    });
  }
  return schemaReady;
}

export async function query(text, params) {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows;
}

export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

export async function exec(text, params) {
  await ensureSchema();
  await getPool().query(text, params);
}
