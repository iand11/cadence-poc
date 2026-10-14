#!/usr/bin/env node
// Recompute the stored artist facets (catalog_facets): npm run db:refresh-facets
// Run after a bulk ingest; the daily cron /api/cron/refresh-facets does the same.
import { pool } from './lib/db.js';

try {
  const { refreshFacets } = await import('../api/lib/facets.js');
  const t = Date.now();
  const { stats } = await refreshFacets();
  console.log(`Facets refreshed in ${((Date.now() - t) / 1000).toFixed(1)}s:`, stats);
} catch (err) {
  // Without this the process.exit below would swallow the error.
  console.error(`\nrefresh-facets failed: ${err.message}${err.code ? ` (code ${err.code})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
  process.exit(process.exitCode ?? 0);
}
