# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server with HMR + /api/chat middleware
npm run build        # Production build to /dist
npm run build:data   # Process responses.json → generated artist JSON files
npm run lint         # ESLint
npm run preview      # Preview production build
```

The `ANTHROPIC_API_KEY` env var is required for the AI chat feature.

## Architecture

MusicSpace is a React 19 + Vite SPA for music industry intelligence. No TypeScript. All artist/track/album/social data lives in Supabase Postgres (200k+ artist scale); nothing is bundled at build time. The legacy static pipeline (`responses.json` → `scripts/build-artists.js` → generated JSON) is retired — the generated files may still exist on disk but nothing imports them.

### Database (Supabase Postgres — replaces the static pipeline at scale)

Schema in `db/schema.sql` (apply with `npm run db:schema`, idempotent). Identity and
metrics are split: `artists` holds slow-moving profile data only (name, genre, career
stage, etc.); volatile metrics live in `artist_stats_current` (one row per artist —
indexed latest values + full `stats` jsonb, a rebuildable cache the list API joins for
sorting) and `artist_metric_snapshots` (append-only history, one row per artist per
refresh per source). `tracks` / `albums` (+ `artist_tracks`, `artist_albums` join tables)
hold the catalog; `social_posts` is the upserted content feed; `ingest_files` makes bulk
loads resumable. Stats refreshes merge partial payloads (jsonb `||`), so a single-platform
fetch never wipes other platforms' values.

- `npm run db:ingest -- --dir <dir>` — bulk-load per-artist JSON dumps (resumable, `--concurrency N`)
- `npm run db:ingest-social` — load social posts (re-run after fresh fetches; upserts by post_id)
- `npm run db:refresh-stats -- --file <json>` — persist fresh social/streaming stats (updates live values + appends snapshot)
- `npm run db:worker -- [--once --dry]` — reference worker for the refresh queue

Tracking → refresh handoff (docs/REFRESH_PIPELINE.md): saving the tracked
roster mirrors it into `tracked_artists` and enqueues `refresh_queue` jobs for
newly tracked artists (pg_notify 'refresh_jobs' on insert). External fetcher
services claim jobs with FOR UPDATE SKIP LOCKED, persist results through the
stats/posts upsert paths, and run staleness sweeps off the
`tracked_artist_freshness` view.

Missing-artist requests: `FollowArtistPicker` is search-first (no catalog
browsing; empty query shows followed artists, filterable by group). When a search comes up short,
the user searches Spotify (`GET /api/artists/spotify-search`, client-credentials
via `api/lib/spotify.js`, needs `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`) and
picks a real artist; `POST /api/artists/requests` (api/artists/requests.js)
takes only `{ spotifyId }`, re-validates it against Spotify, and inserts a
pending `artist_requests` row with Spotify's name/url/snapshot (one open request
per `spotify_id`; per-user open cap; pg_notify 'artist_requests' on insert). An
outside service reads pending rows, ingests the artist, and marks the request
fulfilled (sets `artist_id`).

Request fulfillment → roster + notification: everyone waiting on a request is
in `artist_request_subscribers` (requester + duplicate submitters). The
`on_artist_request_resolved` trigger fires when status changes: on
`fulfilled` it appends the slug to each subscriber's saved roster (`user_data`
+ `tracked_artists`) and inserts an `artist_added` row into `notifications`; on
`rejected` it inserts `artist_request_rejected`. The client
(`NotificationsProvider`, polls `GET /api/notifications` every 60s + on focus)
re-applies `track(slug)` for newly delivered `artist_added` notifications so
the in-memory roster can't overwrite the server add, shows toasts
(`NotificationToasts`), then acks `delivered`. The AppBar bell
(`NotificationBell`) lists them and marks all read on open.

API: `GET /api/artists` (search/filter/sort/paginate), `GET /api/artists/:slug`
(`?include=tracks,albums,history`), `GET /api/feed`. Handlers in `api/artists/` share
`api/lib/artist-shape.js`, which returns the exact same object shapes `src/data/artists.js`
builds, so components need no reshaping. Frontend adapter: `src/data/artistsRemote.js`
(async drop-ins: `fetchArtists`, `fetchArtist`, `loadArtistDetail`, `fetchContentFeed`).
Dev middleware for these routes is `dbApiPlugin()` in `vite.config.js`.

Campaigns cover Instagram (Meta), TikTok and YouTube only (`CAMPAIGN_PLATFORMS` in `src/data/directives.js`; saved campaigns on other platforms are hidden). Meta ads (Campaigns): a user connects their own Meta business with Facebook Login for
Business (`api/connect/meta.js`). The token is stored encrypted in
`ad_platform_connections` and never reaches the client. Each artist's Instagram account is assigned to the ad account its ads run in
(`selection.accountMap`). `api/campaign/meta-launch.js` turns a Meta directive into a paused
Campaign → Ad Set → Ad in that ad account: a boost (`creative.postId`, post found by its
permalink shortcode) or a new image ad (`creative.igUserId` "Run as" account + `creative.images`,
uploaded in the builder via `AdImagesField` → `/api/ad-images` (Postgres `ad_images`), 2–10 make a carousel in that order, + `trackUrl` destination and CTA). `check: true` validates
without creating anything and gates "Submit for Approval". `api/campaign/meta-campaign.js` reads status/insights and goes live or
pauses; its GET report (totals, video, daily series, age/gender/country/placement breakdowns, ad rankings,
budget, rejections) is built in `api/lib/meta-insights.js` and shown by `MetaCampaignInsights`. The client side is `src/data/metaAds.js`, `useMetaConnection`, `AccountConnector`
and `MetaCampaignPanel`. Smart links (Links page `/app/links`, `LinksPage` → `SmartLinksPanel`): public
landing page `/l/:slug` (`api/l.js`) with a button per streaming service, tracked redirect
`/go/:slug/:service` (`api/go.js`), API `api/links/index.js`, helpers `api/lib/smartlinks.js`,
tables `smart_links` / `smart_link_events` (each event stores visitor detail from headers, URL, first-party `pl_vid` cookie and a page beacon; EU/UK consent bar gates cookies, Pixel and CAPI — `api/lib/visitor.js`; the open link's Audience section shows it via `GET /api/links?audience=<slug>`, `api/lib/link-audience.js` — counts only, never IPs or cookie ids). The Links page previews each landing page in a phone frame (`/l/:slug?preview=1` records nothing); service logos come from `api/lib/dsp-icons.js` (shared with `DspIcon`). A new Meta ad whose destination is a smart link
gets `?c=<directive id>` so streaming clicks are attributed per campaign, and clicks go to
Meta as `DSPClick` (Pixel + Conversions API). With fan capture on, the Spotify button opens a consent page
(`/l/:slug/spotify`); "Continue with Spotify" (`api/spotify-fan.js`) logs the fan in, follows
the artist, saves the release and stores them in `smart_link_fans`. Their encrypted refresh token (`spotify_listeners`) lets `api/lib/spotify-sync.js` pull recently-played history into `spotify_plays` (daily cron `/api/cron/spotify-plays` with `CRON_SECRET`, "Sync plays" button, `npm run spotify:sync`), shown as streams per fan, link and campaign. Env: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`,
`AD_TOKEN_KEY` (`META_GRAPH_URL` points at a mock Graph API for local testing). Without
them, Meta campaigns are blocked, not simulated. Prelude-managed ads (artists without an ad account): in Ad Accounts an
Instagram account can be assigned "Prelude's ad account" (`accountMap[ig].managed`); that grants Prelude's
business agency access to the artist's Page and authorizes Prelude's ad account on their IG account
(`grantPreludeAccess` in `api/lib/meta.js`, artist's token). New posts (not boosts) then launch in
Prelude's ad account with Prelude's system-user token, recorded per user in `meta_managed_campaigns`.
Go-live: with `MANAGED_ADS_PREPAY=stripe` the owner pays budget + fee (`MANAGED_ADS_FEE_PERCENT`, default 10)
in Stripe Checkout (`api/lib/stripe.js`), and the webhook `/api/stripe/webhook` (or the next status GET)
turns it on; otherwise a Prelude admin (`PRELUDE_ADMIN_UIDS`) approves it in `ManagedReviewPanel`.
Env: `META_PRELUDE_AD_ACCOUNT_ID`, `META_PRELUDE_BUSINESS_ID`, `META_PRELUDE_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. Details in
docs/CAMPAIGN_PLAN.md.

Stream tracking (stream-goal campaigns): confirming a "Drive streams" guided campaign creates a
`stream_trackers` row from the release's smart link (`api/lib/stream-counts.js`, API `api/streams/index.js`,
client `src/data/streamCounts.js`, UI `StreamCountsPanel` on the campaign page + the confirm step). One
`stream_counts` row per source per day; daily cron `/api/cron/stream-counts` (`npm run streams:snapshot`).
Only services with a public count are tracked: YouTube views via the Data API (`YOUTUBE_API_KEY`; kept 30
days and no "gained" figures unless `YOUTUBE_ANALYTICS_APPROVED=1`, per YouTube Developer Policies III.E.4);
Spotify plays are read from the public web player page in headless Chromium (`api/lib/spotify-playcount.js`:
playwright-core + @sparticuz/chromium on Vercel, `CHROMIUM_PATH` locally; no Spotify credentials;
`SPOTIFY_PLAYCOUNT_SCRAPE=0` turns it off; Spotify's User Guidelines ban this, Ian accepted the risk
2026-10-18; `GET /api/streams?probe=<spotify url>` checks it against the live page) and can be entered by hand. Apple Music, Deezer, Amazon, TIDAL have no public count. Never scrape YouTube.
For later analysis/model training: counts keep being read 30 days after a campaign ends (gain is still
campaign-only), removing a source only hides it (`removed_at`), each tracked campaign's setup is kept in
`stream_tracker_campaigns` (with its Meta campaign id once launched), and Meta reports are copied daily into
`campaign_report_snapshots` (`api/lib/campaign-snapshots.js`; on every report read and by the stream-counts
cron). YouTube counts still expire after 30 days. Meta's Platform Terms 5.b keep each client's Meta data
separate and only used on their behalf, so pooling it across accounts for a shared model needs client consent in Prelude's terms.

Request caching: client GETs go through `src/data/http.js` (`getJson(url, { ttl })` —
in-flight dedupe + bounded TTL cache; `qs()` sorts `slugs` so the same artist set hits
the same cache entry). API responses send `max-age=60` for the browser plus `s-maxage`
for the CDN. Server-side, `api/lib/cache.js` (`cached(key, ttl, load)`) memoizes slow-moving
results (facets, artist totals, slug → id). Playlist endpoints resolve slugs to ids
(`api/lib/artist-ids.js`) and filter with `e.artist_ids && $ids` so the GIN index in
`db/schema.sql` is used — never join `artists ON a.id = ANY(e.artist_ids)` to scope by
artist (it unnests every entry row). `/api/playlists/placements?limit=0` returns only the summary.
Scale (Oct 2026): ~590k artists, ~1.1M playlists, ~9M playlist entries; the stats table is ~3 GB, so
anything that sorts or aggregates the whole catalog per request is too slow. List endpoints walk
indexes for the page and count separately (cached); `/api/artists/facets` reads the stored
`catalog_facets` row (refreshed by cron `/api/cron/refresh-facets` / `npm run db:refresh-facets`);
"similar playlists" is a separate time-boxed request (`/api/playlists/:id?part=similar`).
Followed-artist playlist lists (`/api/playlists?slugs=…&sort=roster`) read `artist_playlists_current`
(artist → playlist rollup with track counts and copied playlist sort/filter columns), kept current by
triggers on `playlist_entries` / `playlists` and built with `npm run db:rebuild-artist-playlists`
(`api/lib/artist-playlists.js`); until built, the handler falls back to the GIN query. The unfiltered
`/api/artists` total comes from the stored facets, not a per-request count.
`npm run db:diagnose [-- --apply-indexes]` checks indexes and times every handler against the DB.

### Data Modules (`src/data/`)

The app is scoped to the artists a user **follows** (user-facing copy never says "roster" or
"tracked artists"; "tracked playlists" still means crawler coverage). `FollowedArtistsProvider`
(`src/context/`, hook `useFollowedArtists`): persisted slugs → one `/api/artists?slugs=` fetch,
pushed into `rosterStore.js` so non-React modules share it. The storage key stays
`musicspace-tracked-artists-v1` because `/api/user-data` mirrors it into `tracked_artists` and the
request trigger appends to it — internal names (`rosterStore`, `tracked_artists`) are unchanged.
Users organize followed artists into named, many-to-many **groups**
(`musicspace-artist-groups-v1`: `[{ id, name, color, slugs }]`; suggestions in
`src/constants/artistGroups.js`; UI in `src/components/groups/ArtistGroups.jsx` —
`GroupMenu`, `GroupChips`, `GroupFilterBar`, `FollowButton`). Dashboard widget selectors accept
a live `__group:<id>` selection, and groups are sent to the AI chat context. There is no
client-side "all artists" array — catalog-wide browsing and search go through the API.

- **`artistsRemote.js`** — HTTP adapter: `fetchArtists` (search/filter/sort/paginate),
  `fetchArtistsBySlugs`, `fetchArtist`, `fetchTracks`, `fetchAlbums`, `fetchTrack`,
  `fetchAlbum`, `fetchFacets`, `fetchContentFeed`. Responses are pre-shaped server-side.
- **`artists.js`** — Core module. Sync `getArtist(slug)` resolves roster/cache and returns
  null on a miss; `searchArtists`, `getTopArtists`, `getTopTracksAcrossRoster`,
  `getRecentReleases`, `getTrackAsync`, `getAlbumAsync` are async (DB). Aggregates and
  benchmarks are roster-scoped. Seeded generators (trends/forecast/revenue) unchanged.
- **`trackData.js`** — `getRosterTrackStats()` / `loadAllRosterTracks()` are async, DB-backed,
  roster-scoped. Per-track generators are sync seeded functions.
- **`playlistsRemote.js`** — Real playlist data crawled by the external `music-scrapers`
  service into `playlists` / `playlist_entries` (one row per track stint: position, peak,
  added/removed dates) / `playlist_snapshots` (daily followers). Async: `fetchPlaylists`,
  `fetchPlaylist`, `fetchPlacements`; API in `api/playlists/` (list, `[id]`, `placements`).
  Shared UI in `src/components/playlists/PlaylistBits.jsx` (`PlaylistPlacements`,
  badges, follower chart); `src/hooks/useAsync.js` for effect-based loading. Coverage:
  Spotify editorial/algorithmic/label/brand, Apple Music + Deezer editorial/charts; the imported
  Chartmetric counts in `artist.playlists.*` are separate (crawl rollups land in
  `*_tracked_*` stats keys).
- **`actionPlans.js`** — Action plans: guided-wizard questions (`PLAN_QUESTIONS`), a block
  library `generatePlan(artist, answers)` assembles from (filtered by goal/platforms/budget/
  release, due dates relative to the release date or plan window), and draft ↔ template
  conversion (`templateFromDraft`, `draftFromTemplate`, `draftFromActions`). UI is
  `PlanBuilder` + `PlanEditor` in `src/components/actions/`; `useActions().addPlan` persists a
  plan as custom actions (`source: 'plan'`); templates persist per account via
  `useActionTemplates` (`musicspace-action-templates`).
- **`userData.js`** — per-user key/value persistence (`/api/user-data`); imported by
  `usePersistedState`. Must never depend on artist modules.

### AI Chat (`/api/chat`)

The chat endpoint is a Vite middleware plugin in `vite.config.js` (dev) and `api/chat.js` (Vercel). It streams SSE responses from Claude; the condensed roster context is built client-side from the tracked roster (useChat) and sent as `artistContext` in the request body. The `create_report` tool lets the AI generate reports that save to localStorage and trigger navigation.

The frontend chat logic lives in `src/hooks/useChat.js` — handles SSE parsing, streaming state, tool execution, and suggestion rotation.

### Routing (`src/main.jsx`)

All routes nested under `<App>` (which renders AppBar + Outlet):
- `/` → Control (AI chat)
- `/dashboard` → Dashboard
- `/artists`, `/tracks`, `/playlists` → List pages with filtering, sorting, pagination, comparison
- `/artist/:id`, `/track/:id`, `/playlist/:id`, `/album/:id`, `/chart/:id` → Profile pages
- `/artist/:id/sheet` → ArtistSheet (custom data entry/editing)
- `/sheets` → SheetsPage (sheet management)
- `/reports`, `/reports/:id` → Report builder/viewer

### State Patterns

- No global state library. Pages manage their own state with `useState` + `useMemo`.
- List pages follow a consistent pattern: query/filter/sort state → `useMemo` for filtered results → `useMemo` for paginated slice. Filter state **must** be in the `useMemo` dependency array or filters won't work.
- Persistence via localStorage: reports (`musicspace-reports-v1`), favorites, dashboard layout.
- Custom hooks: `useChat`, `useReports`, `useFavorites`, `useDashboardLayout`, `useArtistCustomData`, `useSheets`.

### Styling

Tailwind CSS 4 via `@tailwindcss/vite` plugin (no tailwind.config — uses v4 CSS-based config). Dark theme with a brown/tan palette. Key colors: `#0D0C0B` (bg), `#171614` (surface), `#DA7756` (accent), `#7BAF73` (positive), `#C75F4F` (negative), `#F5F0E8` (text). Fonts: Epilogue (body), JetBrains Mono (data), Playfair Display (display). Color constants in `src/constants/colors.js`.

### Shared Components (`src/components/shared/`)

- **FilterBar** — Renders pill buttons for ≤4 options, dropdown selects for 5+. Accepts `filters` array with `{label, options, value, onChange}`.
- **Pagination** — Standard page controls with per-page selector.
- **ChartCard** — Wrapper for chart sections with title/subtitle.
- **DataTable** — Generic table with column definitions and formatters.

### Reports (`src/pages/ReportCenter.jsx`)

Reports are composed of selectable widget components (8 available: artist-comparison, streaming-trends, revenue-breakdown, geography, social-growth, forecast, playlists, benchmarks). The `selected` array controls both visibility and render order. Widget ordering uses drag-and-drop in `WidgetPicker`. Reports auto-save with 500ms debounce. PDF export captures each `[data-pdf-section]` element individually for section-aware pagination.

### Utilities (`src/utils/`)

- **`formatters.js`** — `formatNumber` (1.2M/3.4K), `formatCurrency` ($1.2M), `formatDelta` (+3.5%), `formatDate` (short month/day).
- **`chartTheme.js`** — Shared Recharts styling: `CHART_COLORS`, `AXIS_STYLE`, `GRID_STYLE`, `TOOLTIP_STYLE`. All charts use Recharts.
- **`insights.js`** — Generates contextual insight text for chart cards.
- **`csvParser.js`** — CSV import parsing for sheets.

### Key Libraries

- **Recharts** for all charts (streaming, forecast, revenue, geography, benchmarks)
- **Leaflet / react-leaflet** for geography heat maps
- **html2canvas + jsPDF** for PDF export
- **Motion** (Framer Motion) for animations
- **lucide-react** for icons

### Deployment

Vercel with `vercel.json`. API endpoints are Vercel functions under `api/` hitting Supabase Postgres via `SUPABASE_DB_URL`; in dev the same handlers are mounted as Vite middleware (`dbApiPlugin()` and friends in `vite.config.js`). The chat endpoint is duplicated: `vite.config.js` (dev middleware) and `api/chat.js` (Vercel serverless). Production has IP-based rate limiting (20 req/hour).
