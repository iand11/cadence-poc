#!/usr/bin/env node
// Apply db/schema.sql idempotently: npm run db:schema
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './lib/db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sql = fs.readFileSync(path.join(ROOT, 'db/schema.sql'), 'utf8');

try {
  await pool.query(sql);
  const { rows } = await pool.query(`
    SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::bigint AS rows
    FROM (
      SELECT table_name,
             query_to_xml(format('SELECT count(*) AS cnt FROM %I', table_name), false, true, '') AS xml_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    ) t ORDER BY table_name
  `);
  console.log('Schema applied. Tables:');
  for (const r of rows) console.log(`  ${r.table_name.padEnd(28)} ${r.rows} rows`);
} finally {
  await pool.end();
}
