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

Missing-artist requests: `TrackedArtistPicker` is search-first (no catalog
browsing; empty query shows the current roster). When a search comes up short,
the user submits `POST /api/artists/requests` (api/artists/requests.js), which
inserts a pending `artist_requests` row (one open request per normalized name;
pg_notify 'artist_requests' on insert). An outside service reads pending rows,
ingests the artist, and marks the request fulfilled (sets `artist_id`).

API: `GET /api/artists` (search/filter/sort/paginate), `GET /api/artists/:slug`
(`?include=tracks,albums,history`), `GET /api/feed`. Handlers in `api/artists/` share
`api/lib/artist-shape.js`, which returns the exact same object shapes `src/data/artists.js`
builds, so components need no reshaping. Frontend adapter: `src/data/artistsRemote.js`
(async drop-ins: `fetchArtists`, `fetchArtist`, `loadArtistDetail`, `fetchContentFeed`).
Dev middleware for these routes is `dbApiPlugin()` in `vite.config.js`.

### Data Modules (`src/data/`)

The app is roster-scoped: users track artists (`TrackedArtistsProvider` in `src/context/`,
persisted slugs → one `/api/artists?slugs=` fetch, pushed into `rosterStore.js` so non-React
modules share it). There is no client-side "all artists" array — catalog-wide browsing and
search go through the API.

- **`artistsRemote.js`** — HTTP adapter: `fetchArtists` (search/filter/sort/paginate),
  `fetchArtistsBySlugs`, `fetchArtist`, `fetchTracks`, `fetchAlbums`, `fetchTrack`,
  `fetchAlbum`, `fetchFacets`, `fetchContentFeed`. Responses are pre-shaped server-side.
- **`artists.js`** — Core module. Sync `getArtist(slug)` resolves roster/cache and returns
  null on a miss; `searchArtists`, `getTopArtists`, `getTopTracksAcrossRoster`,
  `getRecentReleases`, `getTrackAsync`, `getAlbumAsync` are async (DB). Aggregates and
  benchmarks are roster-scoped. Seeded generators (trends/forecast/revenue) unchanged.
- **`trackData.js`** — `getRosterTrackStats()` / `loadAllRosterTracks()` are async, DB-backed,
  roster-scoped. Per-track generators are sync seeded functions.
- **`playlistData.js`** — Synthetic playlist placements generated from the tracked roster
  (sync API, caches invalidate on roster change via `subscribeRoster`).
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
