# Refresh Pipeline — contract for external fetcher services

How an outside service learns which artists users track and keeps their data
fresh. Everything goes through the shared Supabase Postgres — no webhooks or
extra infrastructure.

## How tracking reaches the database

When a user adds/removes artists on their dashboard, the app saves the roster
through `POST /api/user-data` (key `musicspace-tracked-artists-v1`). That
handler mirrors the list into two tables:

- **`tracked_artists`** `(user_id, artist_id, tracked_at)` — who tracks what,
  kept in sync on every save (untracked rows are deleted).
- **`refresh_queue`** — one `'full'` job (priority 1, reason `'tracked'`) is
  enqueued per **newly** tracked artist. A partial unique index guarantees at
  most one pending/in-progress job per `(artist_id, job_type)`, so repeated
  saves don't pile up duplicates.

Every queue insert fires `pg_notify('refresh_jobs', '{"id":..,"artist_id":..,
"job_type":"full","reason":"tracked"}')` — a worker holding `LISTEN
refresh_jobs` wakes instantly.

## What the fetcher service does

**1. Claim jobs** (any number of concurrent workers is safe):

```sql
UPDATE refresh_queue q SET
  status = 'in_progress', claimed_at = now(), claimed_by = $worker, attempts = attempts + 1
WHERE q.id IN (
  SELECT id FROM refresh_queue
  WHERE status = 'pending'
  ORDER BY priority, requested_at
  LIMIT $batch
  FOR UPDATE SKIP LOCKED
)
RETURNING q.id, q.artist_id, q.job_type;
```

**2. Fetch fresh data** from the platforms for that artist
(`SELECT slug, name FROM artists WHERE id = $artist_id` for identifiers).

**3. Persist results** — same paths the rest of the pipeline uses:

- *Metrics*: upsert `artist_stats_current` and append to
  `artist_metric_snapshots` (see `persistStatsBatch` in
  `scripts/refresh-stats.js` — partial payloads merge via jsonb `||`, so a
  TikTok-only fetch never wipes Spotify values; pass a distinct `source`
  per fetcher).
- *Posts*: upsert `social_posts` by `post_id` (see
  `scripts/ingest-social-posts.js`).

**4. Complete**: `UPDATE refresh_queue SET status='done', completed_at=now()
WHERE id=$id` — or `status='pending'` + `last_error` to retry,
`status='failed'` to give up.

A reference implementation of this whole loop (LISTEN + poll fallback,
batched SKIP LOCKED claims, retries, pluggable fetcher) lives at
`scripts/process-refresh-queue.js` (`npm run db:worker`). Run it with
`--once --dry` to exercise the plumbing without a real fetcher.

## Recurring freshness (beyond "just tracked")

The queue handles *react to new tracks now*. For recurring refreshes, the
service periodically enqueues stale tracked artists itself using the
**`tracked_artist_freshness`** view (artist, tracker count, `stats_as_of`,
`posts_fetched_at`, `refresh_in_flight`):

```sql
INSERT INTO refresh_queue (artist_id, job_type, reason, priority, requested_by)
SELECT artist_id, 'stats', 'stale', 5, 'freshness-sweep'
FROM tracked_artist_freshness
WHERE (stats_as_of IS NULL OR stats_as_of < now() - interval '24 hours')
  AND NOT refresh_in_flight
ON CONFLICT (artist_id, job_type) WHERE status IN ('pending','in_progress') DO NOTHING;
```

Tune the interval per job_type (e.g. posts hourly for high-tracker artists,
stats daily). `trackers` in the view supports prioritizing artists more
people watch.

## Notes

- Untracking removes the `tracked_artists` row but does not cancel in-flight
  jobs (a completed refresh is never wasted; the freshness sweep naturally
  stops including untracked artists).
- Job rows are append-only history once done/failed — prune old rows
  periodically if volume warrants (`DELETE FROM refresh_queue WHERE status IN
  ('done','failed') AND completed_at < now() - interval '30 days'`).
