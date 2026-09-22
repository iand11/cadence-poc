# Campaign Feature — v1 Plan (client-ready)

**Decided 2026-08-27:** v1 does *real* campaign execution on 1–2 platforms (Meta first,
TikTok second), stays on localStorage (no database), and remains single-user — the
draft → pending_approval → approved flow is personal organization, not multi-user roles.
Everything else in this doc follows from those three decisions.

## Where we are

The UI is done to demo quality: wizard (AI strategy via `api/campaign/generate.js`),
DirectiveBuilder, status lifecycle, dashboard, detail page with charts and optimization
suggestions. Below the UI everything is mocked:

- `useDirectives` → localStorage (`musicspace-directives-v2`), `apiAvailable: false`
- `connectedPlatforms` hardcoded to all 6; AccountConnector is theater
- "Execute" flips status to `active`; metrics are seeded-random (`campaignMetrics.js`)

## Target architecture (no-DB constraint)

**Principle: the ad platform is the source of truth for anything involving money.**
localStorage holds drafts and references (platform campaign IDs); once a campaign is
launched, its budget/status/metrics live on Meta and we read them back. Clearing the
browser loses drafts, never live campaigns — and a "sync from Meta" import makes even
that recoverable.

### 1. Account connection (Meta OAuth)

- New serverless endpoints (same style as `api/auth.js`):
  - `api/connect/meta.js` — OAuth start + callback. Token exchange happens server-side
    (needs the app secret), then we store the long-lived user token (~60 days) in an
    HMAC-signed **HttpOnly cookie**, exactly the pattern `api/auth.js` already uses.
    No DB needed; token never touches client JS or localStorage.
  - `api/connect/status.js` — which platforms are connected + selected ad account.
- `AccountConnector.jsx` becomes real for Meta. All other platforms show **"coming
  soon"** instead of pretending to be connected. `useDirectives.connectedPlatforms`
  derives from `api/connect/status`.
- Selected ad account ID + page ID stored in localStorage (not secret).

### 2. Execution (directive → real Meta campaign)

- `api/campaign/execute.js` — takes a directive + the auth cookie, creates
  Campaign → Ad Set → Ad via the Meta Marketing API, **always paused**, returns
  `{platformCampaignId, platformAdSetId, platformAdId}` which get merged onto the
  directive in localStorage.
- Field mapping:
  - objective: awareness → `OUTCOME_AWARENESS`, engagement → `OUTCOME_ENGAGEMENT`,
    conversions → `OUTCOME_TRAFFIC` (sales needs pixel — out of scope v1)
  - budget: dollars → cents; `period` → daily_budget vs lifetime_budget on the ad set
  - schedule/audience: map directly (geo codes, age range)
  - **creative: v1 = boost an existing post** (`creative.postId` is already in the
    directive schema and ContentFeed already has the Boost flow). Uploading new
    image/video assets to Meta is a later phase — boosting sidesteps asset upload,
    creative review headaches, and most of the mapping surface.
- **Go-live is a separate explicit step**: after execute succeeds, the detail page
  shows the paused campaign with a spend summary and a "Go live" confirm that calls
  `api/campaign/activate.js`. Real money never moves on a single click.
- New directive fields: `platformCampaignId`, `platformAdSetId`, `platformAdId`,
  `executionError`, `lastSyncedAt`, `metricsSource`. Update `docs/DATA_SCHEMA.md` §2.4.

### 3. Real metrics

- `api/campaign/metrics.js` — Insights API proxy: daily breakdown (spend, impressions,
  clicks, results) for a platform campaign ID.
- `CampaignDetail.jsx` already has the seam for this (`metricsSource`,
  `platformStatus`, mock fallback) — wire it up: real data for Meta-executed
  campaigns, simulated for everything else with a visible **"Simulated"** badge.
  Never show fake numbers as real to a paying client.
- Status sync: on detail-page load, pull live status from Meta and reconcile
  (platform paused/rejected/completed wins over local status).

### 4. Safety rails

- Campaigns always created paused; separate activate step with spend confirm.
- Client-side budget cap warning (configurable ceiling, default e.g. $10k).
- Rate limiting on the new endpoints (mirror the chat endpoint's IP limiter).
- "Import from Meta" sync so a cleared browser can rebuild campaign records.

## The long pole: Meta App Review

`ads_management` + `ads_read` require **Advanced Access via App Review, plus Business
Verification** — typically 2–6 weeks. Start immediately, in parallel with dev:

1. Create the Meta app + business account now; submit for review with a screencast.
2. Development proceeds meanwhile in dev mode against our own test ad account
   (dev-mode apps can manage ad accounts owned by app admins/testers).
3. Client onboarding before approval: add the client's ad account user as an app
   tester (works for early clients; not scalable, but fine for v1).

TikTok Marketing API has its own developer approval and a **$500 minimum campaign
budget** — that's why it's phase 5, not phase 1.

## Phases

| Phase | Deliverable | Depends on |
|---|---|---|
| 0 | Meta app created, App Review submitted, test ad account wired | — |
| 1 | Real Meta OAuth connect; honest `connectedPlatforms`; "coming soon" for the rest | 0 (dev mode ok) |
| 2 | Execute pipeline: directive → paused Meta campaign (boost-post creative); go-live confirm; error surfacing | 1 |
| 3 | Real metrics + status sync in CampaignDetail; "Simulated" badges elsewhere; import-from-Meta | 2 |
| 4 | Image-upload creative (new assets, not just boosts) | 2 |
| 5 | TikTok: connect + execute + metrics (Spark Ads mirror the boost-post model) | TikTok approval |

Client-demoable milestone is end of phase 3: connect a real ad account, launch a real
(paused) campaign from the wizard, go live, watch real numbers in the dashboard.

## Known tensions (accepted, not forgotten)

- **Real spend, browser-only records.** Mitigated by platform-as-source-of-truth +
  import sync, but a client using two browsers sees two draft sets. When this bites,
  the fix is the DB migration already sketched in DATA_SCHEMA.md — the directive
  shape is designed for it.
- **Single shared app password** (`api/auth.js`) + per-client ad tokens in per-browser
  cookies is fine for a handful of clients, not for general availability.
- **Non-Meta platforms stay simulated.** The demo stays impressive, but every
  simulated surface must be labeled once real data exists side-by-side.
