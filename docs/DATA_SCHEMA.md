# Data Schema Reference (cadence-poc → real DB)

The app currently runs with **no database**: content comes from static JSON built at compile time, and all user state lives in `localStorage`. This document is the data dictionary for standing up a real DB — *exactly what data must exist to run the app*.

Key fact confirmed from the code: **the app stores very little and computes almost everything.** Only three categories need real storage:

1. **Content/seed data** — the artist metrics record, its tracks/albums, and the playlist *templates*. Read by every page.
2. **User-generated state** — reports, actions state, sheets/custom data, directives (campaigns), favorites, dashboard layout/widgets. Currently `localStorage`.
3. Everything else on screen (streaming trends, social timelines, forecasts, revenue splits, benchmarks, insights, actions, playlist *placements*) is **deterministically generated at runtime** from the artist record + a seeded RNG. It does **not** need to be stored — see Appendix C.

Sources: `src/data/artists.js`, `scripts/build-artists.js`, `public/data/artists/{slug}.json`, `src/data/trackData.js`, `src/data/playlistData.js`, `src/data/actions.js`, `src/data/actionSteps.js`, `src/utils/insights.js`, hooks under `src/hooks/` (`useReports`, `useActions`, `useSheets`, `useArtistCustomData`, `useFavorites`, `useDashboardLayout`, `useDirectives`), and `api/chat.js`.

Legend: **Req?** = ✅ always present / ⬜ optional-nullable. Types are logical (map to your DB's equivalents). "app path" = where the running code reads it.

---

## 1. Content tables (must be stored to render the app)

### 1.1 `artists`
The normalized record the app reads everywhere (`allArtists`, `getArtist(slug)`). Built by `build-artists.js` from raw Chartmetric fields (raw→normalized mapping in Appendix A). Nested groups below are flattened to columns; `top_cities` is split to a child table (1.2). Sorted by `rank` ascending in-app.

| Column | Type | Req? | Example | app path |
|---|---|---|---|---|
| `id` | bigint (PK) | ✅ | 3707881 | `id` |
| `slug` | text (unique) | ✅ | `taylor-swift` | `slug` (slugified name; primary lookup key) |
| `name` | text | ✅ | Taylor Swift | `name` |
| `spotify_url` | text | ⬜ | https://open.spotify.com/artist/… | `spotifyUrl` |
| `image_url` | text | ⬜ | https://i.scdn.co/… | `imageUrl` |
| `cover_url` | text | ⬜ | https://… | `coverUrl` |
| `description` | text | ✅ (default `''`) | "Singer-songwriter…" | `description` |
| `country` | text (ISO code2) | ⬜ | US | `country` |
| `city` | text | ✅ (default `''`) | Nashville | `city` (current ?? hometown) |
| `is_band` | boolean | ⬜ | false | `isBand` |
| `label` | text | ✅ (default `Independent`) | Republic Records | `label` |
| `gender` | text | ⬜ | female | `gender` |
| `pronouns` | text | ⬜ | she/her | `pronouns` |
| `rank` | int | ✅ | 3 | `rank` / `rankings.overall` |
| `score` | numeric | ✅ (default 0) | 82.4 | `score` |
| `track_count` | int | ✅ (default 0) | 47 | `trackCount` |
| `album_count` | int | ✅ (default 0) | 12 | `albumCount` |
| `genres` | jsonb | ✅ (default `{}`) | `{primary:{name:"pop"},secondary:[…],sub:[]}` | `genres`; app mostly reads `genres.primary.name` |
| `moods` | text[] | ✅ (default `[]`) | {confident, upbeat} | `moods` |
| `activities` | text[] | ✅ (default `[]`) | {workout, party} | `activities` |
| `collaborators` | text[] | ✅ (default `[]`) | {Jack Antonoff, Max Martin} | `collaborators` |
| **Spotify** |||||
| `spotify_followers` | bigint | ✅ (0) | 92000000 | `spotify.followers` |
| `spotify_monthly_listeners` | bigint | ✅ (0) | 82000000 | `spotify.monthlyListeners` |
| `spotify_popularity` | int (0–100) | ✅ (0) | 98 | `spotify.popularity` |
| `spotify_followers_rank` | int | ⬜ | 4 | `spotify.followersRank` |
| `spotify_listeners_rank` | int | ⬜ | 3 | `spotify.listenersRank` |
| `spotify_popularity_rank` | int | ⬜ | 1 | `spotify.popularityRank` |
| **Social** |||||
| `ig_followers` | bigint | ✅ (0) | 280000000 | `social.instagram` |
| `ig_followers_rank` | int | ⬜ | 5 | `social.instagramRank` |
| `yt_subscribers` | bigint | ✅ (0) | 56000000 | `social.youtube` |
| `yt_subscribers_rank` | int | ⬜ | 8 | `social.youtubeRank` |
| `yt_views` | bigint | ✅ (0) | 45000000000 | `social.youtubeViews` |
| `yt_daily_views` | bigint | ✅ (0) | 12000000 | `social.youtubeDaily` |
| `yt_monthly_views` | bigint | ✅ (0) | 360000000 | `social.youtubeMonthly` |
| `tiktok_followers` | bigint | ✅ (0) | 30000000 | `social.tiktok` |
| `tiktok_followers_rank` | int | ⬜ | 12 | `social.tiktokRank` |
| `tiktok_likes` | bigint | ✅ (0) | 500000000 | `social.tiktokLikes` |
| `tiktok_top_video_views` | bigint | ✅ (0) | 45000000 | `social.tiktokTopVideoViews` |
| `tiktok_track_posts` | bigint | ✅ (0) | 2300000 | `social.tiktokTrackPosts` |
| `twitter_followers` | bigint | ✅ (0) | 95000000 | `social.twitter` |
| **Playlists (per platform: editorial/total/reach/editorialReach)** |||||
| `sp_pl_editorial` / `sp_pl_total` / `sp_pl_reach` / `sp_pl_editorial_reach` | bigint | ✅ (0) | 1200 / 45000 / 88000000 / 30000000 | `playlists.spotify.*` |
| `am_pl_editorial` / `am_pl_total` | bigint | ✅ (0) | 300 / 5000 | `playlists.apple.*` (no reach fields) |
| `de_pl_editorial` / `de_pl_total` / `de_pl_reach` / `de_pl_editorial_reach` | bigint | ✅ (0) | … | `playlists.deezer.*` |
| `az_pl_editorial` / `az_pl_total` | bigint | ✅ (0) | … | `playlists.amazon.*` (no reach fields) |
| `yt_pl_editorial` / `yt_pl_total` / `yt_pl_reach` / `yt_pl_editorial_reach` | bigint | ✅ (0) | … | `playlists.youtube.*` |
| **Rankings** |||||
| `rank_country` | int | ⬜ | 1 | `rankings.country` |
| `rank_engagement` | int | ⬜ | 6 | `rankings.engagement` |
| `rank_fanbase` | int | ⬜ | 4 | `rankings.fanBase` |
| **Engagement** |||||
| `shazam_count` | bigint | ✅ (0) | 120000000 | `engagement.shazam` |
| `genius_pageviews` | bigint | ✅ (0) | 45000000 | `engagement.genius` |
| `pandora_listeners_28d` | bigint | ✅ (0) | 8000000 | `engagement.pandoraListeners` |
| `pandora_lifetime_streams` | bigint | ✅ (0) | 3000000000 | `engagement.pandoraLifetimeStreams` |

> Note: nested groups (`spotify`, `social`, `playlists`, `rankings`, `engagement`) are presentation-only; a single flat `artists` table is fine. Alternatively keep them as `jsonb` groups — the app reads dotted paths either way.

### 1.2 `artist_top_cities` (child of `artists`)
From `spotify.topCities` (raw `sp_where_people_listen`). Drives the geography map/insights.

| Column | Type | Req? | Example |
|---|---|---|---|
| `artist_slug` | text (FK→artists.slug) | ✅ | taylor-swift |
| `city` | text | ✅ | London |
| `country` | text (UPPER code2) | ✅ | GB |
| `listeners` | bigint | ✅ | 4200000 |
| `position` | int (ordering) | ⬜ | 1 |

### 1.3 `tracks`
Per-artist detail (`public/data/artists/{slug}.json` → `normalizeTrack`). Loaded lazily via `loadArtistDetail(slug)`; **the app filters to `streams > 0 OR spotifyPlaylists > 0`** and sorts by streams desc.

| Column | Type | Req? | Example | app path |
|---|---|---|---|---|
| `id` | text (PK, = cm_track) | ✅ | "84521563" | `id` |
| `artist_slug` | text (FK→artists) | ✅ | post-malone | `artistSlug` |
| `name` | text | ✅ (default "Untitled") | rockstar | `name` |
| `isrc` | text | ⬜ | USUM71708968 | `isrc` |
| `image_url` | text | ⬜ | https://… | `imageUrl` |
| `duration_ms` | int | ⬜ | 218147 | `durationMs` |
| `preview_url` | text | ⬜ | https://… | `previewUrl` |
| `is_feature` | boolean | ✅ | false | `isFeature` (artist_type==='featured') |
| `artist_names` | text[] | ✅ (`[]`) | {Post Malone, 21 Savage} | `artistNames` |
| `spotify_track_id` | text | ⬜ | 0e7ipj… | `spotifyTrackId` |
| `spotify_album_id` | text | ⬜ | 6trNtQ… | `spotifyAlbumId` |
| `release_date` | date/text | ⬜ | 2017-09-15 | `releaseDate` |
| `album_name` | text | ⬜ | beerbongs & bentleys | `albumName` |
| `album_ids` | text[] | ✅ (`[]`) | {"111", "222"} | `albumIds`; `albumId` = first element |
| `album_label` | text | ⬜ | Republic | `albumLabel` |
| `streams` | bigint | ✅ (0) | 3370000000 | `streams` |
| `popularity` | int (0–100) | ✅ (0) | 84 | `popularity` |
| `sp_playlists` / `sp_editorial_playlists` / `sp_playlist_reach` | bigint | ✅ (0) | 12000 / 400 / 88000000 | `spotifyPlaylists`/`spotifyEditorialPlaylists`/`spotifyPlaylistReach` |
| `yt_playlists` / `yt_playlist_reach` | bigint | ✅ (0) | … | `youtubePlaylists`/`youtubePlaylistReach` |
| `am_playlists` / `am_editorial_playlists` | bigint | ✅ (0) | … | `applePlaylists`/`appleEditorialPlaylists` |
| `de_playlists` / `de_playlist_reach` | bigint | ✅ (0) | … | `deezerPlaylists`/`deezerPlaylistReach` |
| `tiktok_videos` | bigint | ✅ (0) | 1200000 | `tiktokVideos` |
| `tags` | text | ⬜ | "trap,hip hop" | `tags` |
| `version_flags` | text[] | ✅ (`[]`) | {explicit, feat_or_collab} | `versionFlags` |
| `track_types` | text[] | ✅ (`[]`) | {re_release, explicit} | `trackTypes` |

> `trackIndex` in the build (cm_track → slug) is just a lookup; a FK/index on `tracks.id` + `tracks.artist_slug` replaces it. `getAlbumTracksAsync` joins tracks by `album_ids @> [albumId]`.

### 1.4 `albums`
Per-artist detail → `normalizeAlbum`. App filters to `name AND releaseDate`, sorts by release desc.

| Column | Type | Req? | Example | app path |
|---|---|---|---|---|
| `id` | text (PK, = cm_album ?? upc) | ✅ | "556677" | `id` |
| `artist_slug` | text (FK→artists) | ✅ | post-malone | `artistSlug` |
| `name` | text | ✅ (default "Untitled Album") | beerbongs & bentleys | `name` |
| `image_url` | text | ⬜ | https://… | `imageUrl` |
| `release_date` | date/text | ⬜ (but app requires it) | 2018-04-27 | `releaseDate` |
| `label` | text | ⬜ | Republic | `label` |
| `popularity` | int (0–100) | ✅ (0) | 71 | `popularity` (spotify_popularity) |
| `type` | text enum | ⬜ | album | `type` — `album`\|`ep`\|`single`\|`compilation` |
| `num_tracks` | int | ✅ (0) | 18 | `numTracks` |
| `upc` | text | ⬜ | 00602… | `upc` |
| `spotify_album_id` | text | ⬜ | 6trNtQ… | `spotifyAlbumId` |
| `moods` | text[] | ✅ (`[]`) | {confident, hype} | `moods` |
| `activities` | text[] | ✅ (`[]`) | {urban, late-night} | `activities` |
| `description` | text | ⬜ | … | `description` |

### 1.5 `playlist_templates`
**Currently hardcoded (~40 rows) in `src/data/playlistData.js`, not from `responses.json`.** Placements are generated at runtime by matching artist genre → template (see Appendix C). Seed these rows into a table.

| Column | Type | Req? | Example |
|---|---|---|---|
| `id` | text (PK, slug of name) | ✅ | todays-top-hits |
| `name` | text | ✅ | Today's Top Hits |
| `curator` | text | ✅ | Spotify Editorial |
| `type` | text enum | ✅ | `editorial`\|`algorithmic`\|`user` |
| `platform` | text enum | ✅ | `spotify`\|`apple`\|`deezer`\|`amazon`\|`youtube` |
| `followers` | bigint | ⬜ (null for algorithmic) | 34000000 |
| `genre` | text | ⬜ (null = all genres) | pop |
| `sort_index` | int | ✅ | 0 |

---

## 2. User-state tables (replace localStorage; all rows scoped by `user_id`)

Add `user_id` to every table below. Current `localStorage` keys noted for migration.

### 2.1 `reports` — key `musicspace-reports-v1`
| Column | Type | Req? | Example |
|---|---|---|---|
| `id` | text (PK) | ✅ | report-1712000000000 |
| `user_id` | fk | ✅ | … |
| `name` | text | ✅ | Top 3 Global Overview |
| `artist_slugs` | text[] | ✅ | {taylor-swift, bad-bunny} |
| `widgets` | text[] (enum) | ✅ | {streaming-trends, revenue-breakdown} |
| `created_at` / `updated_at` | timestamptz | ✅ | … |

Widget enum: `artist-comparison, streaming-trends, revenue-breakdown, social-growth, geography, forecast, playlists, benchmarks`.

### 2.2 Actions — key `musicspace-actions-v1`
System actions are **generated at runtime** (Appendix C); the DB stores only the user overlay. Split the single blob into four tables keyed by the generated `action_id` / `step_id`.

**`custom_actions`** (user- or AI-created full actions; `source` = `ai`|`system`):
| Column | Type | Req? | Example |
|---|---|---|---|
| `id` | text (PK) | ✅ | action-ai-1712000000000 |
| `user_id` | fk | ✅ | … |
| `artist_slug` | text | ✅ | taylor-swift |
| `artist_name` | text | ✅ | Taylor Swift |
| `artist_image` | text | ⬜ | https://… |
| `platform` | text enum | ✅ | spotify |
| `data_type` | text enum | ✅ | streaming |
| `insight_type` | text enum | ✅ | warning |
| `text` | text | ✅ | "Album momentum declining after wk 2" |
| `action` | text | ✅ | "Launch playlist seeding campaign" |
| `priority` | numeric | ✅ | 4 |
| `source` | text enum | ✅ | ai |
| `created_at` | timestamptz | ✅ | … |

**`action_overrides`** — user edits/state on ANY action (system or custom), keyed by `(user_id, action_id)`:
| Column | Type | Req? | Notes |
|---|---|---|---|
| `action_id` | text | ✅ | the generated or custom id |
| `status` | text enum | ⬜ | `active`\|`completed`\|`ignored`\|`deleted` (from `statuses`) |
| `selected` | boolean | ⬜ | from `selected` map (curated/pinned) |
| `owner` | text enum | ⬜ | from `owners` map — see OWNERS |
| `due_date` | date | ⬜ | from `edits[id].dueDate` |
| `action_override` | text | ⬜ | from `edits[id].action` |
| `text_override` | text | ⬜ | from `edits[id].text` |

**`step_state`** — per-step state keyed by `(user_id, step_id)` (covers `completedSteps` + `stepEdits`):
| Column | Type | Req? | Notes |
|---|---|---|---|
| `step_id` | text | ✅ | e.g. `action-…-s2` |
| `completed` | boolean | ✅ (default false) | from `completedSteps` |
| `text_override` | text | ⬜ | from `stepEdits` |

**`extra_steps`** — user-added steps (`extraSteps[actionId][]`):
| Column | Type | Req? | Notes |
|---|---|---|---|
| `id` | text (PK) | ✅ | `{actionId}-x{ts}` |
| `user_id` / `action_id` | fk / text | ✅ | parent action |
| `text` | text | ✅ | step text |
| `category` | text enum | ✅ | default `tactical` |

### 2.3 Sheets — keys `musicspace-sheets-v1` + `musicspace-artist-custom-{slug}`
**`artist_sheets`** (metadata): `id` (PK, sheet-{ts}), `user_id`, `artist_slug`, `created_at`, `updated_at`.

**`artist_custom_data`** — composite key `(user_id, artist_slug)`:
| Column | Type | Req? | Notes |
|---|---|---|---|
| `bio` | text | ⬜ | user bio |
| `notes` | text | ⬜ | internal notes |
| `spotify_embed_url` | text | ⬜ | embed player |
| `custom_fields` | jsonb | ⬜ | `[{id,label,value}]` |
| `sheets_url` | text | ⬜ | Google Sheets link |
| `sheets_data` | jsonb | ⬜ | `[{label,value}]` (≤200 rows, from CSV proxy) |
| `sheets_synced_at` | timestamptz | ⬜ | last sync |
| `block_settings` | jsonb | ⬜ | `{bio,customFields,sheetsData: bool}` |
| `visibility` | text enum | ⬜ | `private`\|`public` |

> `custom_fields`/`sheets_data` can be child tables if you want relational access; JSON matches current shape.

### 2.4 `directives` (Campaigns) — key `musicspace-directives-v2`
| Column | Type | Req? | Example / enum |
|---|---|---|---|
| `id` | text (PK) | ✅ | seed-1 |
| `user_id` | fk | ✅ | … |
| `artist_slug` / `artist_name` / `artist_image` | text | ✅/✅/⬜ | bruno-mars / Bruno Mars / … |
| `platform` | text enum | ✅ | `tiktok`\|`youtube`\|`meta`\|`spotify`\|`google`\|`x` |
| `status` | text enum | ✅ | `draft`\|`pending_approval`\|`approved`\|`executing`\|`active`\|`completed`\|`failed`\|`rejected` |
| `objective` | text enum | ✅ | `followers`\|`views`\|`engagement`\|`streams` |
| `budget` | jsonb | ✅ | `{amount, currency, period}` |
| `schedule` | jsonb | ✅ | `{startDate, endDate}` (YYYY-MM-DD) |
| `audience` | jsonb | ✅ | `{locations:[code], ageRange:[min,max]}` |
| `creative` | jsonb | ✅ | `{type: video\|image\|audio\|carousel, headline}` |
| `rationale` | text | ⬜ | reason |
| `created_at` | timestamptz | ✅ | … |
| `approved_at` | timestamptz | ⬜ | … |

### 2.5 `user_preferences` — one row per user
Consolidates the singleton stores:
| Column | Type | Req? | Source key |
|---|---|---|---|
| `favorites` | text[] (artist slugs) | ⬜ | `musicspace-favorites` (default = top 7) |
| `dashboard_layout` | jsonb | ⬜ | `musicspace-dashboard-layout-v2` — react-grid-layout `[{i,x,y,w,h,minW,minH}]` |
| `dashboard_widgets` | text[] (enum) | ⬜ | `musicspace-widgets-v3` |

Dashboard widget enum: `top-artists, top-tracks, recent-releases, streaming, revenue, social, forecast, geography, platform-breakdown, benchmark, trending, genre-distribution, leaderboard-listeners, leaderboard-social, playlist-overview, track-intelligence`.

---

## Appendix A — Raw → normalized field mapping (artist ingestion)
`build-artists.js` reads Chartmetric `cm_statistics.*` (raw) and emits the normalized columns in §1.1. Representative pairs (full list mirrors §1.1 rows):
`sp_followers→spotify_followers`, `sp_monthly_listeners→spotify_monthly_listeners`, `sp_popularity→spotify_popularity`, `ins_followers→ig_followers`, `ycs_subscribers→yt_subscribers`, `tiktok_followers→tiktok_followers`, `num_sp_editorial_playlists→sp_pl_editorial`, `sp_playlist_total_reach→sp_pl_reach`, `shazam_count→shazam_count`, `cm_artist_rank→rank`, `cm_artist_score→score`, `code2→country`, `current_city ?? hometown_city→city`, `record_label ?? 'Independent'→label`, `sp_where_people_listen[]→artist_top_cities`. Defaults: numeric metrics default to 0; strings to null except `description=''`, `city=''`, `label='Independent'`.

## Appendix B — Controlled vocabularies (enums)
- **action.platform**: spotify, apple, youtube, tiktok, instagram, twitter, social, revenue, general
- **action.data_type**: streaming, social, playlists, geography, revenue, general
- **action.insight_type**: success, info, warning, danger
- **action.source**: system, ai · **action.status**: active, completed, ignored, deleted
- **step.category**: tactical, playbook, assignment
- **action owners (OWNERS)**: A&R, Marketing, Digital, Radio, Sync, Management
- **album.type**: album, ep, single, compilation
- **playlist.type**: editorial, algorithmic, user · **playlist.platform**: spotify, apple, deezer, amazon, youtube
- Directive/report/dashboard enums: see §2.1, §2.4, §2.5.

## Appendix C — Computed at runtime (do NOT store; documented for reference)
All deterministic (seeded by `artist.id`/`track.id`), regenerated on each load. A DB does not need these tables; keep the generator functions.
- **`generateStreamingTrend(artist, days=90)`** → `[{date, spotify, apple, youtube, amazon, tidal}]` (from `monthlyListeners`, `popularity`).
- **`generateSocialTimeline(artist, days=90)`** → `[{date, tiktok, instagram, twitter, youtube}]`.
- **`generateForecast(artist, 90, 60)`** → `[{date, actual, forecast, upper, lower}]`.
- **`generateRevenue(artist)`** → `[{source, amount, percentage}]` for Streaming/Live/Sync/Merch (streaming = `monthlyListeners*0.004*12`).
- **`getBenchmarkComparison(artist)`** → `{dimensions[6], artist.normalized[6], benchmark.normalized[6]}`.
- **`trackData.js`**: `generateTrackPerformance(track)` → `{dailyStreams, growthDelta, estimatedPeak, weeksTrending, playlistConversion}`; `getRosterTrackStats()`, `loadAllRosterTracks()` aggregate over `tracks`.
- **`playlistData.js`**: `generateArtistPlacements(artist)` → placement rows `{playlistId, playlistName, curator, type, platform, followers, position, streamsFromPlaylist, dateAdded, delta, artistSlug, artistName}` (matched from `playlist_templates` by genre). `getPlaylist(id)` also synthesizes `aiSummary`, `similar`, aggregates.
- **`insights.js`**: `generateInsights(artist)` → `{streaming[], social[], playlists[], geography[], revenue[]}`, each `{type, text, action}` — computed from artist metrics vs roster averages.
- **`actions.js` / `actionSteps.js`**: `generateAllActions()` builds actions from insights; `generateSteps(action)` builds `{id, text, category, completed:false}`. Persist only the user overlay (§2.2).
- **AI chat** (`api/chat.js`): reads the artist index for context; `create_report`/`create_action` tools write into §2.1/§2.2. Chat messages are transient — not stored.

---

## Verification
1. **Coverage check** — for each page (`/dashboard`, `/artists`, `/artist/:id`, `/tracks`, `/playlists`, `/reports`, `/sheets`, actions/campaigns), confirm every field it reads maps to a §1 column or a §2 row, or is a §C generator. Cross-check against the `app path` column.
2. **Round-trip a real artist** — pick one `public/data/artists/{slug}.json` + its index record, hand-map into the §1 tables, and confirm no app-read field is missing (grep `artist.` / `track.` / `album.` accessors in `src/`).
3. **User-state migration** — dump the seven `localStorage` keys from a browser session and confirm each JSON field lands in a §2 column.
