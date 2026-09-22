#!/usr/bin/env node
// Reference worker for the refresh_queue — the outside fetcher service's loop.
//
//   node scripts/process-refresh-queue.js --once --dry        # drain queue, no fetching
//   node scripts/process-refresh-queue.js --worker-id my-box  # run forever (LISTEN + poll)
//
// Flags:
//   --once           process what's pending, then exit (default: run forever)
//   --dry            claim + complete jobs without fetching (pipeline testing)
//   --worker-id <s>  identifier written to refresh_queue.claimed_by
//   --batch <n>      jobs claimed per cycle (default 5)
//   --poll <secs>    fallback poll interval when idle (default 60; LISTEN wakes sooner)
//   --max-attempts <n>  after this many failures a job goes to 'failed' (default 3)
//
// The claim uses FOR UPDATE SKIP LOCKED, so any number of workers can run
// concurrently. To integrate a real data source, replace fetchArtistData():
// return { stats } shaped like cm_statistics (partial is fine — values merge)
// and/or { posts } shaped like social_posts rows. Persistence goes through
// the same paths the rest of the pipeline uses.

import { pool, withClient } from './lib/db.js';
import { persistStatsBatch } from './refresh-stats.js';

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const ONCE = args.includes('--once');
const DRY = args.includes('--dry');
const WORKER_ID = String(flag('worker-id', `worker-${process.pid}`));
const BATCH = Number(flag('batch', 5)) || 5;
const POLL_SECS = Number(flag('poll', 60)) || 60;
const MAX_ATTEMPTS = Number(flag('max-attempts', 3)) || 3;

// ---------------------------------------------------------------------------
// PLUG YOUR FETCHER IN HERE.
// Given an artist row ({ id, slug, name }) and job_type ('full'|'stats'|'posts'),
// return { stats?: object, source?: string } with fresh metric values
// (cm_statistics-shaped keys; partial payloads merge server-side).
// Social posts can be written directly with the UPSERT in
// scripts/ingest-social-posts.js if the fetcher returns posts.
// ---------------------------------------------------------------------------
async function fetchArtistData(artist, jobType) {
  if (DRY) return null; // dry mode: no fetch, jobs complete empty
  throw new Error(
    `No fetcher wired up for ${artist.slug} (${jobType}) — implement fetchArtistData() ` +
    'or run with --dry to test the queue plumbing'
  );
}

async function claimJobs(client) {
  const { rows } = await client.query(
    `UPDATE refresh_queue q SET
       status = 'in_progress', claimed_at = now(), claimed_by = $1, attempts = attempts + 1
     WHERE q.id IN (
       SELECT id FROM refresh_queue
       WHERE status = 'pending'
       ORDER BY priority, requested_at
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING q.id, q.artist_id, q.job_type, q.reason, q.attempts`,
    [WORKER_ID, BATCH]
  );
  return rows;
}

async function completeJob(client, id) {
  await client.query(
    `UPDATE refresh_queue SET status = 'done', completed_at = now(), last_error = NULL
     WHERE id = $1`,
    [id]
  );
}

async function failJob(client, job, err) {
  const giveUp = job.attempts >= MAX_ATTEMPTS;
  await client.query(
    `UPDATE refresh_queue SET status = $2, last_error = $3 WHERE id = $1`,
    [job.id, giveUp ? 'failed' : 'pending', String(err.message || err).slice(0, 500)]
  );
}

async function processJob(client, job) {
  const { rows: [artist] } = await client.query(
    'SELECT id, slug, name FROM artists WHERE id = $1',
    [job.artist_id]
  );
  if (!artist) throw new Error(`artist ${job.artist_id} not found`);

  const result = await fetchArtistData(artist, job.job_type);
  if (result?.stats && Object.keys(result.stats).length) {
    await persistStatsBatch(
      client,
      [{ artist_id: artist.id, stats: result.stats }],
      result.source || 'refresh-worker'
    );
  }
  return artist;
}

async function runCycle() {
  return withClient(async (client) => {
    const jobs = await claimJobs(client);
    for (const job of jobs) {
      try {
        const artist = await processJob(client, job);
        await completeJob(client, job.id);
        console.log(`  done  #${job.id} ${artist.slug} (${job.job_type}, ${job.reason})${DRY ? ' [dry]' : ''}`);
      } catch (err) {
        await failJob(client, job, err);
        console.error(`  ${job.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'retry'} #${job.id} artist=${job.artist_id}: ${err.message}`);
      }
    }
    return jobs.length;
  });
}

async function main() {
  console.log(`refresh worker ${WORKER_ID} (batch=${BATCH}${DRY ? ', dry' : ''}${ONCE ? ', once' : ''})`);

  if (ONCE) {
    let total = 0;
    for (;;) {
      const n = await runCycle();
      total += n;
      if (n < BATCH) break;
    }
    console.log(`processed ${total} job(s)`);
    await pool.end();
    return;
  }

  // Long-running: LISTEN for instant wake, poll as fallback
  let wake = () => {};
  const listener = await pool.connect();
  listener.on('notification', () => wake());
  listener.on('error', (err) => console.error('LISTEN connection error:', err.message));
  await listener.query('LISTEN refresh_jobs');

  for (;;) {
    let n;
    do {
      n = await runCycle();
    } while (n === BATCH); // keep draining while full batches come back
    await new Promise((resolve) => {
      wake = resolve;
      setTimeout(resolve, POLL_SECS * 1000);
    });
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
