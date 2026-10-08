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

### 1. Account connection (Meta OAuth) — built

**Decided 2026-10-08:** each Prelude user connects their *own* Meta business with
**Facebook Login for Business**. Ads run in their ad account and Meta bills their card.
Prelude makes money with its own per-boost fee and subscription, charged separately
(Stripe, not built yet). A "Prelude-managed" mode comes later for indie artists without
an ad account: Prelude's Business Manager gets partner access to the artist's Page + IG
account and runs the ads from Prelude's own ad account. Same Meta app, same App Review.

What a connection can see: everything the person shares in the login dialog, within
the granted permissions. Ad accounts are all-or-nothing, so if one ad account runs ads for
several artists, Prelude can read all of those campaigns. Pages and IG accounts are
chosen individually.

- `api/connect/meta.js` handles the OAuth start and callback, status, the asset list, the
  ad-account choice and disconnect. The browser redirect is bound to the Prelude user by
  an HMAC-signed `state`. The token is exchanged server-side, checked with `debug_token`,
  and stored AES-256-GCM encrypted in `ad_platform_connections` (db/schema.sql). It never
  reaches the browser. Use a **system-user token** login configuration: it doesn't expire,
  so status and metrics sync keep working. A plain user token is swapped for the ~60-day one.
- **Multiple ad accounts:** a user running campaigns for several artists shares all of
  their ad accounts and artists' Instagram accounts/Pages in one Meta login, then assigns
  each Instagram account to the ad account its boosts run (and bill) in
  (`selection.accountMap: { [igUserId]: { adAccountId, … } }`, `action: 'assign'`).
- `AccountConnector.jsx` ("Ad Accounts" on the Campaigns page) is real for Meta: connect,
  "Add or change accounts" (re-runs the login to share more), assign an ad account per
  Instagram account, disconnect. The other
  platforms say "Simulated · coming soon". `connectedPlatforms` is left as-is so the
  simulated multi-platform demo keeps working.
- Env: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `AD_TOKEN_KEY`, plus
  optional `META_REDIRECT_URI`, `META_GRAPH_VERSION` (default v24.0), `META_GRAPH_URL`
  (Graph API base override, for a local mock) and
  `META_MAX_BUDGET` (default 10000). The login config needs `ads_management`, `ads_read`,
  `business_management`, `pages_show_list`, `pages_read_engagement` and `instagram_basic`.

### 2. Execution (directive → real Meta campaign) — built for boosts and new image ads

- `api/campaign/meta-launch.js` takes a Meta directive. **Boost** (`creative.postId` set):
  1. finds the post among the shared IG accounts' media by the shortcode in its
     permalink (our feed stores the scraper's post id, not Meta's media id), which also
     gives the linked Facebook Page,
  2. checks the post's `boost_eligibility_info` (posts with copyrighted music, IGTV and
     some others can't be boosted) and picks the ad account assigned to that IG account,
  3. creates Campaign → Ad Set → Ad Creative (`source_instagram_media_id` +
     `instagram_user_id`, `object_id` = Page) → Ad, **all paused**,
  4. rolls back (deletes) anything already created if a step fails.
- **New image ad** (no `postId`, builder's "Create New"): the user picks a "Run as"
  Instagram account (`creative.igUserId`, from the shared accounts) and uploads 1–10
  images (`AdImagesField`: resized to 1440px JPEG in the browser, stored in `ad_images`
  via `/api/ad-images`, reordered by drag or arrows; `creative.images` keeps the order).
  The server reads each image, uploads it to `act_x/adimages` for an `image_hash`, and
  builds the creative from `object_story_spec` (`page_id`, `instagram_user_id`,
  `link_data` with one image, or `child_attachments` in order for a carousel with
  `multi_share_optimized: false` so Meta keeps that order, `trackUrl` as the link, headline → `name`, description → `message`, CTA Listen
  Now / Learn More / Watch Now / Shop Now → `LISTEN_NOW` / `LEARN_MORE` / `WATCH_MORE` /
  `SHOP_NOW`). Video ads are rejected for now (boost an existing video post instead).
  The directive gets `platformCampaignId`, `platformAdSetId`, `platformAdId`,
  `platformCreativeId`, `adAccountId`, `igUsername` and status `paused`.
- Field mapping: awareness → `OUTCOME_AWARENESS`/`REACH`; otherwise a boost is
  `OUTCOME_ENGAGEMENT`/`POST_ENGAGEMENT` (`destination_type: ON_POST`) and a new ad is
  `OUTCOME_TRAFFIC`/`LINK_CLICKS` (`destination_type: WEBSITE`). Budget dollars →
  cents in the ad account's currency, `period` → daily vs lifetime budget. Locations go
  out as ISO countries (UK → GB), ages are clamped to 18–65, and placements are
  Instagram only.
- **Confirm gate:** "Submit for Approval" on any Meta directive calls the same endpoint with
  `check: true`, which creates nothing. Submission is blocked, with an "Open Ad Accounts"
  button, until Meta is connected, the IG account is shared, an ad account is assigned to
  it, and the post is eligible (boost) or the image and destination URL are set (new ad).
  Execute re-checks the same way.
- **Go-live is a separate explicit step:** `api/campaign/meta-campaign.js` (POST
  `{ id, status: 'ACTIVE' | 'PAUSED' }`) is driven by `MetaCampaignPanel` on the detail
  page, with a spend confirm. It only touches campaigns in the user's selected ad account.
- Meta campaigns always run for real. With no Meta credentials on the server they're
  blocked, not simulated. Other platforms are still simulated.
- Video upload for new ads is still a later phase.

### 2b. Smart links (streaming-service clicks) — built

Goal: measure, and later optimize for, clicks from an ad through to a streaming service,
the way feature.fm does, without depending on it.

- A **smart link** is a Prelude landing page, `/l/<slug>` (`api/l.js`, rewritten in
  `vercel.json`), with a button per streaming service. It's created in Campaigns → Links
  from one release URL. `api/lib/smartlinks.js` looks up the other services through the
  song.link/Odesli API (`ODESLI_API_URL` overrides it), or the user adds links by hand.
  Tables: `smart_links`, `smart_link_events`.
- Buttons go through `/go/<slug>/<service>` (`api/go.js`), which records the click and
  302s to the service, so tracking works without JavaScript. Views and clicks store the
  campaign (`?c=`), country (Vercel header), device, and whether the visitor came from a
  Meta ad (`fbclid`). Bots and link-preview crawlers are not counted.
- When a new Meta ad's destination is a smart link (picked in the builder),
  `meta-launch` adds `?c=<directive id>` to it, so clicks are attributed per campaign.
  The campaign page shows link views, streaming clicks, click rate, cost per streaming
  click and clicks by service. The Links tab shows the same per link, by day and by
  campaign.
- **Meta events:** if the link has a Meta Pixel (chosen from the pixels in the user's
  assigned ad accounts), the page fires `PageView` and a custom `DSPClick` event, and the
  redirect sends the same `DSPClick` through the Conversions API with the link owner's
  Meta token (`event_id` shared, so Meta deduplicates; `fbc` from `fbclid` or the `_fbc`
  cookie). `META_TEST_EVENT_CODE` routes them to Test Events.
- **Spotify fan capture** (per link, "Ask Spotify listeners to follow and save"): the
  Spotify button opens a consent page (`/l/<slug>/spotify`) with "Continue with Spotify"
  and "Just listen". Continue runs Spotify's authorization code flow
  (`api/spotify-fan.js`, `api/lib/spotify-fans.js`; scopes `user-read-email`,
  `user-read-private`, `user-follow-modify`, `user-library-modify`, `user-top-read`,
  `user-read-recently-played`):
  we read the profile and top artists, follow the release's artist, save the release,
  upsert the fan into `smart_link_fans` (name, email, country, plan, followed/saved, top
  artists, campaign, from-ad) and redirect to the release. Declining, errors and a missing config all still land the fan on Spotify. The
  click's Conversions API event carries the hashed email and country for better
  matching. Links tab shows fans, "fans also listen to", and a CSV export; the campaign
  page shows fans captured. Needs the existing `SPOTIFY_CLIENT_ID`/`SECRET` app with
  `<origin>/api/spotify-fan` (or `SPOTIFY_REDIRECT_URI`) added as a redirect URI.
  Caveats: Spotify's development mode only allows allow-listed test users, so real fans
  need the app's extended quota approved; Spotify's developer terms limit how user data
  may be used; and fans who tap from Instagram's in-app browser usually aren't logged in
  to Spotify there, so they'll see a login form rather than a one-tap Agree.
- **Listening sync** (`api/lib/spotify-sync.js`): the fan's refresh token is stored
  AES-256-GCM encrypted (`AD_TOKEN_KEY`) in `spotify_listeners`. Their recently-played
  history is pulled into `spotify_plays` at capture, by a Vercel cron
  (`/api/cron/spotify-plays`, daily at 07:00 UTC, `CRON_SECRET` bearer auth), by the
  "Sync plays" button on a link, and by `npm run spotify:sync` (`--force`). A listener is
  due after `SPOTIFY_RESYNC_INTERVAL` (default 2h). A revoked token marks the fan
  "access removed". Per link and per campaign we show fans who streamed the release after
  their click, streams by fans, streams per streaming fan, and fans who had already
  listened to the artist before clicking; per fan, release and artist plays.
  Limits: Spotify only returns the last 50 plays (30s+) per call, so a once-a-day sync
  misses plays for heavy listeners (Vercel Pro allows an hourly or 2-hourly cron); only
  fans who logged in are measured, not all streams; and fans captured before this change
  must reconnect to grant `user-read-recently-played`.
- Next: once a Pixel has enough `DSPClick` volume, create a custom conversion on it and
  launch new ads with `OFFSITE_CONVERSIONS` optimization (`promoted_object` = pixel +
  custom event), so Meta optimizes for streaming clicks rather than link clicks. Also
  next: pre-saves for unreleased tracks and a custom short domain
  (`SMART_LINK_BASE_URL`).
- Vercel Deployment Protection, if on, blocks public visitors on preview URLs. Smart links
  need to be served from production or an unprotected domain.

### 3. Real metrics

- `api/campaign/meta-campaign.js` GET already returns status + lifetime insights (spend,
  impressions, reach, clicks, post engagements), shown in `MetaCampaignPanel`, which also
  reconciles local status with Meta's on load. Still to do: daily breakdown for the charts.
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
| 1 | Real Meta OAuth connect; "coming soon" for the rest. **Code done; needs the Meta app + login config** | 0 (dev mode ok) |
| 2 | Execute pipeline: directive → paused Meta campaign (boost-post creative); go-live confirm; error surfacing. **Code done** | 1 |
| 3 | Real metrics + status sync in CampaignDetail (lifetime totals + status sync done; daily charts, "Simulated" badges, import-from-Meta left) | 2 |
| 3b | Prelude per-boost fee + subscription billing (Stripe) | 2 |
| 6 | Prelude-managed boosting (partner access + Prelude's ad account) for artists without an ad account | 2 |
| 4 | Image-upload creative (new assets, not just boosts) | 2 |
| 5 | TikTok: connect + execute + metrics (Spark Ads mirror the boost-post model) | TikTok approval |

Client-demoable milestone is end of phase 3: connect a real ad account, launch a real
(paused) campaign from the wizard, go live, watch real numbers in the dashboard.

## Known tensions (accepted, not forgotten)

- **Real spend, browser-only records.** Mitigated by platform-as-source-of-truth +
  import sync, but a client using two browsers sees two draft sets. When this bites,
  the fix is the DB migration already sketched in DATA_SCHEMA.md — the directive
  shape is designed for it.
- Meta tokens are stored per Prelude (Firebase) user in Postgres, but directives are still
  per-browser localStorage. A campaign launched from one browser can't be seen from
  another until directives move to the DB.
- **Non-Meta platforms stay simulated.** The demo stays impressive, but every
  simulated surface must be labeled once real data exists side-by-side.
