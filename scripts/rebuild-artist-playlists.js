#!/usr/bin/env node
// Install the playlist_entries triggers and rebuild the artist → playlist
// rollup (artist_playlists_current) from scratch:
//   npm run db:rebuild-artist-playlists
// Crawler writes to playlist_entries wait while it runs; reads continue.
import { pool } from './lib/db.js';

try {
  const { rebuildArtistPlaylists } = await import('../api/lib/artist-playlists.js');
  const t = Date.now();
  const rows = await rebuildArtistPlaylists();
  console.log(`Artist playlist rollup rebuilt in ${((Date.now() - t) / 1000).toFixed(1)}s: ${rows} rows`);
} catch (err) {
  // Without this the process.exit below would swallow the error.
  console.error(`\nrebuild-artist-playlists failed: ${err.message}${err.code ? ` (code ${err.code})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
  process.exit(process.exitCode ?? 0);
}
