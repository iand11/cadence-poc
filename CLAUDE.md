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

MusicSpace is a React 19 + Vite SPA for music industry intelligence. No TypeScript, no database — all data is static JSON processed at build time.

### Data Pipeline

`responses.json` (2.3GB raw API dump) → `scripts/build-artists.js` → two outputs:
- `src/data/artists-index.generated.json` — artist metadata index bundled into the app (~9MB)
- `public/data/artists/{slug}.json` — per-artist track/album detail files loaded lazily via `fetch`

### Data Modules (`src/data/`)

- **`artists.js`** — Core data module. Exports `allArtists` (static array), `getArtist(slug)`, `loadArtistDetail(slug)` (async, fetches per-artist JSON). Also exports generators for streaming trends, social timelines, forecasts, revenue breakdowns, and benchmarks — all use seeded randomization for deterministic demo data.
- **`trackData.js`** — Track analytics. `getRosterTrackStats()` for dashboard, `loadAllRosterTracks()` for async full roster load, `generateTrackPerformance()` for per-track metrics.
- **`playlistData.js`** — Generates playlist placements by matching artist genres to a universe of ~40 real playlist templates. Builds reverse index of playlist→artist mappings.

### AI Chat (`/api/chat`)

The chat endpoint is a Vite middleware plugin in `vite.config.js` (dev) and `api/chat.js` (Vercel). It streams SSE responses from Claude with a system prompt containing condensed roster context. The `create_report` tool lets the AI generate reports that save to localStorage and trigger navigation.

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

Vercel with `vercel.json`. The `api/chat.js` function includes `responses.json` for building artist context at the edge. The chat endpoint is duplicated: `vite.config.js` (dev middleware) and `api/chat.js` (Vercel serverless). Production has IP-based rate limiting (20 req/hour).
