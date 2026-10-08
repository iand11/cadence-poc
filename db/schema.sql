-- MusicSpace database schema (Supabase Postgres)
-- Applied idempotently by `npm run db:schema` (scripts/apply-schema.js).
--
-- Design notes:
--  * Artist/track/album source of truth is the gathered JSON dumps.
--    Hot fields the UI filters/sorts on are real columns; everything else the
--    UI reads lives in jsonb so the API can serve the exact shapes
--    src/data/artists.js produces today.
--  * Identity vs. metrics are split: `artists` holds slow-moving profile data
--    only. Volatile social/streaming metrics live in `artist_stats_current`
--    (one row per artist — the indexed "latest" used for list sorting) and
--    every refresh also appends to `artist_metric_snapshots` (append-only
--    history for trend charts). artist_stats_current is a rebuildable cache:
--    it can always be reconstructed from the newest snapshot per artist.
--  * social_posts persists the per-post content feed (api.getContentFeed).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Artists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artists (
  id                   bigint PRIMARY KEY,          -- canonical artist id (from source dump)
  slug                 text UNIQUE NOT NULL,
  name                 text NOT NULL,
  image_url            text,
  cover_url            text,
  country              text,                        -- code2
  city                 text,                        -- current_city || hometown_city
  hometown             text,
  is_band              boolean DEFAULT false,
  gender               text,
  pronouns             text,
  record_label         text,
  description          text,
  isni                 text,
  spotify_url          text,

  -- Career status (slow-moving, from the profile fetch)
  career_stage         text,
  career_stage_score   integer,
  career_trend         text,
  career_trend_score   integer,

  -- Genre (primary as a column for filtering; full object in jsonb)
  primary_genre        text,
  secondary_genres     text[] DEFAULT '{}',
  genres               jsonb,                       -- {primary, secondary, sub}
  moods                text[] DEFAULT '{}',
  activities           text[] DEFAULT '{}',
  collaborators        text[] DEFAULT '{}',         -- topSongwriterCollaborators

  track_count          integer DEFAULT 0,
  album_count          integer DEFAULT 0,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artists_name_trgm_idx  ON artists USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS artists_genre_idx      ON artists (primary_genre);
CREATE INDEX IF NOT EXISTS artists_country_idx    ON artists (country);
CREATE INDEX IF NOT EXISTS artists_stage_idx      ON artists (career_stage);

-- ---------------------------------------------------------------------------
-- Latest metrics per artist (volatile — refreshed frequently)
-- A rebuildable cache of the newest snapshot: hot values as indexed columns
-- for list sorting, the full payload in `stats`. Never the only copy of
-- anything — history lives in artist_metric_snapshots.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artist_stats_current (
  artist_id            bigint PRIMARY KEY REFERENCES artists (id) ON DELETE CASCADE,
  rank                 integer,
  score                double precision,
  sp_monthly_listeners bigint,
  sp_followers         bigint,
  sp_popularity        integer,
  ins_followers        bigint,
  tiktok_followers     bigint,
  ycs_subscribers      bigint,
  stats                jsonb NOT NULL DEFAULT '{}',
  where_people_listen  jsonb,
  as_of                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stats_current_rank_idx      ON artist_stats_current (rank ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS stats_current_listeners_idx ON artist_stats_current (sp_monthly_listeners DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS stats_current_followers_idx ON artist_stats_current (sp_followers DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS stats_current_score_idx     ON artist_stats_current (score DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- Albums (shared across artists via artist_albums)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
  id                 bigint PRIMARY KEY,            -- canonical album id (from source dump)
  upc                text,
  name               text NOT NULL,
  image_url          text,
  release_date       date,
  label              text,
  spotify_popularity integer DEFAULT 0,
  album_type         text,
  num_track          integer DEFAULT 0,
  spotify_album_id   text,
  moods              text[] DEFAULT '{}',
  activities         text[] DEFAULT '{}',
  description        text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS albums_release_idx ON albums (release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS albums_name_trgm_idx ON albums USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS artist_albums (
  artist_id bigint NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  album_id  bigint NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  PRIMARY KEY (artist_id, album_id)
);
CREATE INDEX IF NOT EXISTS artist_albums_album_idx ON artist_albums (album_id);

-- ---------------------------------------------------------------------------
-- Tracks (shared across artists — features — via artist_tracks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracks (
  id               bigint PRIMARY KEY,              -- canonical track id (from source dump)
  isrc             text,
  name             text NOT NULL,
  image_url        text,
  duration_ms      integer,
  preview_url      text,
  spotify_track_id text,
  spotify_album_id text,
  release_date     date,
  album_name       text,
  album_ids        bigint[] DEFAULT '{}',
  album_label      text,
  artist_names     text[] DEFAULT '{}',
  tags             text,
  version_flags    text[] DEFAULT '{}',
  track_types      text[] DEFAULT '{}',

  -- Hot metrics for sorting/filtering
  sp_streams       bigint DEFAULT 0,
  sp_popularity    integer DEFAULT 0,

  stats            jsonb NOT NULL DEFAULT '{}',     -- full track stats blob
  audio_features   jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracks_streams_idx   ON tracks (sp_streams DESC);
CREATE INDEX IF NOT EXISTS tracks_release_idx   ON tracks (release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS tracks_name_trgm_idx ON tracks USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tracks_isrc_idx      ON tracks (isrc);
CREATE INDEX IF NOT EXISTS tracks_album_ids_idx ON tracks USING gin (album_ids);

CREATE TABLE IF NOT EXISTS artist_tracks (
  artist_id   bigint NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  track_id    bigint NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  artist_type text NOT NULL DEFAULT 'main',         -- 'main' | 'featured'
  PRIMARY KEY (artist_id, track_id)
);
CREATE INDEX IF NOT EXISTS artist_tracks_track_idx ON artist_tracks (track_id);

-- ---------------------------------------------------------------------------
-- Time-series: social & streaming metric snapshots
-- One row per artist per refresh. `metrics` holds the full stats payload for
-- that capture so new metrics never require a migration. Trend charts read
-- e.g.  metrics->>'sp_monthly_listeners' ordered by captured_at.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artist_metric_snapshots (
  artist_id   bigint NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'import',       -- import | spotify | tiktok | ...
  captured_at timestamptz NOT NULL DEFAULT now(),
  metrics     jsonb NOT NULL,
  PRIMARY KEY (artist_id, source, captured_at)
);
CREATE INDEX IF NOT EXISTS snapshots_artist_time_idx
  ON artist_metric_snapshots (artist_id, captured_at DESC);

-- ---------------------------------------------------------------------------
-- Social posts (content feed) — refreshed frequently, upserted by post_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  post_id           text PRIMARY KEY,               -- platform post id
  artist_id         bigint REFERENCES artists (id) ON DELETE CASCADE,
  platform          text NOT NULL,                  -- instagram | tiktok | youtube | twitter
  content_type      text NOT NULL DEFAULT 'posts',  -- posts | video
  title             text,
  thumbnail_url     text,
  permalink         text,
  owner_platform_id text,
  views             bigint DEFAULT 0,
  likes             bigint DEFAULT 0,
  comments          bigint DEFAULT 0,
  shares            bigint DEFAULT 0,
  duration          integer,
  published_at      timestamptz,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  raw               jsonb
);
CREATE INDEX IF NOT EXISTS social_posts_artist_idx
  ON social_posts (artist_id, platform, published_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_published_idx
  ON social_posts (published_at DESC);

-- ---------------------------------------------------------------------------
-- Tracked artists — first-class rows for who tracks what.
-- Synced by /api/user-data whenever a user saves their roster (the UI's
-- source of truth stays the ordered slug list in user_data). External
-- fetcher services read this table to know which artists need fresh data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_artists (
  user_id    text   NOT NULL,
  artist_id  bigint NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  tracked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);
CREATE INDEX IF NOT EXISTS tracked_artists_artist_idx ON tracked_artists (artist_id);

-- ---------------------------------------------------------------------------
-- Refresh queue — the handoff point to outside fetcher services.
-- The app INSERTs a job when an artist is newly tracked (and can for other
-- reasons); workers claim with FOR UPDATE SKIP LOCKED, fetch fresh platform
-- data, persist it (artist_stats_current + artist_metric_snapshots /
-- social_posts), and mark the job done. A pg_notify('refresh_jobs', ...)
-- fires on every insert so LISTENing workers wake without polling.
-- At most one pending/in-progress job per (artist, job_type).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_queue (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id    bigint NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  job_type     text NOT NULL DEFAULT 'full',     -- full | stats | posts
  reason       text NOT NULL DEFAULT 'tracked',  -- tracked | stale | manual
  status       text NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | failed
  priority     integer NOT NULL DEFAULT 5,       -- lower = sooner
  attempts     integer NOT NULL DEFAULT 0,
  requested_by text,                             -- user id or service name
  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz,
  claimed_by   text,                             -- worker id
  completed_at timestamptz,
  last_error   text
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_queue_active_uniq
  ON refresh_queue (artist_id, job_type) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS refresh_queue_claim_idx
  ON refresh_queue (status, priority, requested_at);

CREATE OR REPLACE FUNCTION notify_refresh_job() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('refresh_jobs', json_build_object(
    'id', NEW.id, 'artist_id', NEW.artist_id, 'job_type', NEW.job_type, 'reason', NEW.reason
  )::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_queue_notify ON refresh_queue;
CREATE TRIGGER refresh_queue_notify
  AFTER INSERT ON refresh_queue
  FOR EACH ROW EXECUTE FUNCTION notify_refresh_job();

-- Convenience view for fetcher services: every tracked artist with data
-- freshness and queue state — drives both "refresh new artists now" and
-- recurring staleness sweeps.
CREATE OR REPLACE VIEW tracked_artist_freshness AS
SELECT a.id AS artist_id,
       a.slug,
       a.name,
       count(DISTINCT ta.user_id)                         AS trackers,
       min(ta.tracked_at)                                 AS first_tracked_at,
       sc.as_of                                           AS stats_as_of,
       (SELECT max(sp.fetched_at) FROM social_posts sp
         WHERE sp.artist_id = a.id)                       AS posts_fetched_at,
       EXISTS (SELECT 1 FROM refresh_queue q
         WHERE q.artist_id = a.id
           AND q.status IN ('pending', 'in_progress'))    AS refresh_in_flight
FROM tracked_artists ta
JOIN artists a ON a.id = ta.artist_id
LEFT JOIN artist_stats_current sc ON sc.artist_id = a.id
GROUP BY a.id, a.slug, a.name, sc.as_of;

-- ---------------------------------------------------------------------------
-- Artist requests — users ask for artists missing from the catalog.
-- The app INSERTs a row when a search comes up empty and the user submits a
-- request; an outside service reads pending rows, gathers the artist's data,
-- ingests it, then marks the request fulfilled (setting artist_id). A
-- pg_notify('artist_requests', ...) fires on insert so LISTENing services
-- wake without polling. At most one open request per Spotify artist.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artist_requests (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,                    -- artist name as the user typed it
  spotify_url  text,                             -- canonical open.spotify.com/artist/<id> url
  notes        text,                             -- optional free-text context
  status       text NOT NULL DEFAULT 'pending',  -- pending | in_progress | fulfilled | rejected
  requested_by text,                             -- user id
  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz,
  claimed_by   text,                             -- fulfilling service id
  completed_at timestamptz,
  artist_id    bigint REFERENCES artists (id) ON DELETE SET NULL,  -- set on fulfillment
  last_error   text
);
-- Requests are picked from Spotify search, so they're keyed by Spotify id
-- (two different artists can share a name). Older free-text rows have no
-- spotify_id and are exempt from the uniqueness rule.
ALTER TABLE artist_requests ADD COLUMN IF NOT EXISTS spotify_id   text;
ALTER TABLE artist_requests ADD COLUMN IF NOT EXISTS spotify_data jsonb;  -- image/followers/popularity/genres snapshot at request time
DROP INDEX IF EXISTS artist_requests_open_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS artist_requests_open_spotify_uniq
  ON artist_requests (spotify_id)
  WHERE status IN ('pending', 'in_progress') AND spotify_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS artist_requests_claim_idx
  ON artist_requests (status, requested_at);
CREATE INDEX IF NOT EXISTS artist_requests_user_idx
  ON artist_requests (requested_by, requested_at DESC);

CREATE OR REPLACE FUNCTION notify_artist_request() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('artist_requests', json_build_object(
    'id', NEW.id, 'name', NEW.name, 'spotify_id', NEW.spotify_id, 'spotify_url', NEW.spotify_url
  )::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS artist_requests_notify ON artist_requests;
CREATE TRIGGER artist_requests_notify
  AFTER INSERT ON artist_requests
  FOR EACH ROW EXECUTE FUNCTION notify_artist_request();

-- Everyone waiting on a request: the original requester plus anyone whose
-- submit hit the already-open request. All of them get the artist added to
-- their roster (and a notification) when it's fulfilled.
CREATE TABLE IF NOT EXISTS artist_request_subscribers (
  request_id    bigint NOT NULL REFERENCES artist_requests (id) ON DELETE CASCADE,
  user_id       text   NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS artist_request_subscribers_user_idx
  ON artist_request_subscribers (user_id);
-- Backfill requests made before this table existed
INSERT INTO artist_request_subscribers (request_id, user_id)
SELECT id, requested_by FROM artist_requests WHERE requested_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notifications — per-user in-app notifications (bell + toasts).
-- delivered_at: the client has seen it and applied any side effect (e.g.
--   added the artist to its in-memory roster) — set once, drives toasts.
-- read_at: the user opened the notification list.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      text NOT NULL,
  type         text NOT NULL,          -- artist_added | artist_request_rejected
  title        text NOT NULL,
  body         text,
  data         jsonb,                  -- type-specific payload (slug, name, imageUrl, requestId)
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at      timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- When the fulfillment service resolves a request, act for every subscriber:
--   fulfilled → add the artist to their saved roster (user_data + the
--               tracked_artists mirror) and notify them;
--   rejected  → notify them.
-- Done in the DB so it happens whether or not the user is online, and no
-- matter which service flips the status.
CREATE OR REPLACE FUNCTION on_artist_request_resolved() RETURNS trigger AS $$
DECLARE
  roster_key constant text := 'musicspace-tracked-artists-v1';
  a record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'fulfilled' AND NEW.artist_id IS NOT NULL THEN
    SELECT id, slug, name, image_url INTO a FROM artists WHERE id = NEW.artist_id;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO user_data (user_id, key, data, updated_at)
    SELECT s.user_id, roster_key, jsonb_build_array(a.slug), now()
    FROM artist_request_subscribers s WHERE s.request_id = NEW.id
    ON CONFLICT (user_id, key) DO UPDATE SET
      data = CASE
        WHEN jsonb_typeof(user_data.data) <> 'array' OR user_data.data IS NULL
          THEN jsonb_build_array(a.slug)
        WHEN user_data.data @> jsonb_build_array(a.slug)
          THEN user_data.data
        ELSE user_data.data || jsonb_build_array(a.slug)
      END,
      updated_at = now();

    INSERT INTO tracked_artists (user_id, artist_id)
    SELECT s.user_id, a.id FROM artist_request_subscribers s WHERE s.request_id = NEW.id
    ON CONFLICT DO NOTHING;

    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT s.user_id, 'artist_added',
           a.name || ' is ready',
           'The artist you requested is ready — you are now following them.',
           jsonb_build_object('slug', a.slug, 'name', a.name, 'imageUrl', a.image_url, 'requestId', NEW.id)
    FROM artist_request_subscribers s WHERE s.request_id = NEW.id;

  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT s.user_id, 'artist_request_rejected',
           'Couldn''t add ' || NEW.name,
           'We weren''t able to gather data for this artist.',
           jsonb_build_object('name', NEW.name, 'spotifyUrl', NEW.spotify_url, 'requestId', NEW.id)
    FROM artist_request_subscribers s WHERE s.request_id = NEW.id;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS artist_requests_resolved ON artist_requests;
CREATE TRIGGER artist_requests_resolved
  AFTER UPDATE OF status ON artist_requests
  FOR EACH ROW EXECUTE FUNCTION on_artist_request_resolved();

-- ---------------------------------------------------------------------------
-- Ingest bookkeeping — makes the 200k-file bulk load resumable
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_files (
  filename    text PRIMARY KEY,
  artist_id   bigint,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Per-user data (already created lazily by api/lib/db.js — kept here so the
-- schema file is the single source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_data (
  user_id    text NOT NULL,
  key        text NOT NULL,
  data       jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Ad platform connections — one row per user per platform. The access token
-- is AES-256-GCM encrypted by api/lib/meta.js (AD_TOKEN_KEY) and never leaves
-- the server. `selection` holds the chosen ad account ({ adAccountId }).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_platform_connections (
  user_id        text NOT NULL,
  platform       text NOT NULL,          -- meta
  token_enc      text NOT NULL,
  token_type     text,                   -- system_user | user (from debug_token)
  expires_at     timestamptz,            -- null = never expires
  scopes         text[],
  meta_user_id   text,                   -- the Meta user/system user behind the token
  selection      jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, platform)
);
