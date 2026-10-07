// Action plans: the guided-wizard question set, the block library the wizard
// assembles plans from, and conversions between editable drafts and saved
// templates.
//
// Draft action (what the plan editor edits):
//   { key, action, text, dataType, owner, priority: 'high'|'medium'|'low',
//     dueDate: 'YYYY-MM-DD'|null, steps: [{ key, text, category }] }
// Template action (what gets saved — dates are relative to the day it's applied):
//   { action, text, dataType, owner, priority, offsetDays: number|null, steps: [{ text, category }] }
// Text in templates uses {artist} in place of the artist's name.

import { OWNERS } from '../hooks/useActions';

export const PLAN_GOALS = [
  { value: 'release', label: 'Launch a release', desc: 'Roll out a single, EP or album end to end' },
  { value: 'streaming', label: 'Grow streaming', desc: 'Lift listeners, saves and algorithmic reach' },
  { value: 'social', label: 'Build social audience', desc: 'Grow followers and engagement across socials' },
  { value: 'playlists', label: 'Win playlist placements', desc: 'Editorial, algorithmic and curator adds' },
  { value: 'touring', label: 'Support a tour', desc: 'Routing, announce, presales and ticket push' },
  { value: 'revenue', label: 'Grow revenue', desc: 'Royalties, merch, sync and direct-to-fan' },
];

export const GOAL_LABELS = Object.fromEntries(PLAN_GOALS.map(g => [g.value, g.label]));

// Data types whose system insights are worth surfacing for each goal.
export const GOAL_DATA_TYPES = {
  release: ['streaming', 'playlists', 'social'],
  streaming: ['streaming', 'playlists'],
  social: ['social'],
  playlists: ['playlists', 'streaming'],
  touring: ['geography', 'social'],
  revenue: ['revenue', 'streaming'],
};

const BUDGET_LEVEL = { none: 0, low: 1, mid: 2, high: 3 };

export const PLAN_QUESTIONS = [
  {
    key: 'goal',
    title: 'What is this plan for?',
    subtitle: 'Pick the one outcome that matters most. The plan is built around it.',
    type: 'single',
    options: PLAN_GOALS,
  },
  {
    key: 'release',
    title: 'Is there a release in the plan?',
    subtitle: 'Release tasks are scheduled backward from the release date.',
    type: 'single',
    withDate: true,
    options: [
      { value: 'none', label: 'No release', desc: 'Work with the existing catalog' },
      { value: 'single', label: 'Single', desc: 'One track, focused push' },
      { value: 'ep', label: 'EP', desc: 'A short project with a focus track' },
      { value: 'album', label: 'Album', desc: 'Full-length, multi-phase rollout' },
    ],
  },
  {
    key: 'timeline',
    title: 'How long should the plan run?',
    subtitle: 'Due dates are spread across this window.',
    type: 'single',
    options: [
      { value: 14, label: '2 weeks', desc: 'A quick, focused sprint' },
      { value: 30, label: '30 days', desc: 'A standard monthly push' },
      { value: 60, label: '60 days', desc: 'Room to test and iterate' },
      { value: 90, label: '90 days', desc: 'A full quarter' },
    ],
  },
  {
    key: 'platforms',
    title: 'Which platforms should it focus on?',
    subtitle: 'Platform-specific tactics are included only for the ones you pick.',
    type: 'multi',
    options: [
      { value: 'spotify', label: 'Spotify' },
      { value: 'apple', label: 'Apple Music' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'youtube', label: 'YouTube' },
    ],
  },
  {
    key: 'budget',
    title: 'What budget is available?',
    subtitle: 'Paid tactics such as ads, creator seeding and radio are included only if there is budget.',
    type: 'single',
    options: [
      { value: 'none', label: 'No paid budget', desc: 'Organic tactics only' },
      { value: 'low', label: 'Under $1K', desc: 'Small paid tests' },
      { value: 'mid', label: '$1K – $5K', desc: 'Targeted paid campaigns' },
      { value: 'high', label: '$5K+', desc: 'Full paid mix' },
    ],
  },
  {
    key: 'teams',
    title: 'Which teams are working on it?',
    subtitle: 'Each action is assigned to the best-fit team you select.',
    type: 'multi',
    options: OWNERS.map(o => ({ value: o, label: o })),
  },
];

export const DEFAULT_ANSWERS = {
  goal: null,
  release: 'none',
  releaseDate: null,
  timeline: 30,
  platforms: ['spotify', 'tiktok', 'instagram'],
  budget: 'low',
  teams: [...OWNERS],
};

// Options for a question given the answers so far (release goals need a release).
export function questionOptions(q, answers) {
  if (q.key === 'release' && answers.goal === 'release') {
    return q.options.filter(o => o.value !== 'none');
  }
  return q.options;
}

export function isAnswered(q, answers) {
  const v = answers[q.key];
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
  if (q.key === 'release' && answers.goal === 'release' && v === 'none') return false;
  return v !== null && v !== undefined;
}

// ── Block library ───────────────────────────────────────────────────────
// goals: which goals include the block ('all' = every plan).
// platforms: include only if any is selected. minBudget: 0–3.
// needsRelease / releaseTypes: release-only blocks, timed by `rel` (days from release).
// Everything else is timed by `at` (fraction of the plan window).

const T = 'tactical', P = 'playbook', A = 'assignment';

const LIBRARY = [
  // Kickoff / wrap — every plan
  {
    id: 'kickoff', goals: ['all'], at: 0, owner: 'Management', priority: 'high', dataType: 'general',
    action: 'Kickoff: align the team on goals and KPIs',
    text: 'Agree on what success looks like for {artist} before work starts.',
    steps: [
      ['Set 2–3 measurable KPIs with baseline numbers from the artist profile', T],
      ['Confirm owners and weekly check-in cadence', A],
      ['Share the plan with the artist and their management', A],
    ],
  },
  {
    id: 'retro', goals: ['all'], at: 1, owner: 'A&R', priority: 'medium', dataType: 'general',
    action: 'Plan retro: review results against KPIs',
    text: 'Find out what worked so the next plan for {artist} starts from evidence.',
    steps: [
      ['Pull before/after metrics for each KPI', T],
      ['List the top 3 tactics to repeat and 1 to stop', P],
      ['Save this plan as a template if it worked', T],
    ],
  },

  // Release
  {
    id: 'r-assets', goals: ['release'], needsRelease: true, rel: -28, owner: 'A&R', priority: 'high', dataType: 'streaming',
    action: 'Lock release assets and metadata',
    text: 'Distributors need final assets at least 3 weeks before release for editorial eligibility.',
    steps: [
      ['Deliver final masters, ISRCs and UPC to the distributor', T],
      ['Finalize cover art, lyric sheet and credits/splits', T],
      ['Confirm release date and territories', A],
    ],
  },
  {
    id: 'r-calendar', goals: ['release'], needsRelease: true, rel: -24, owner: 'Marketing', priority: 'high', dataType: 'social',
    action: 'Build the release content calendar',
    text: 'Map every teaser, announcement and drop from now through release week.',
    steps: [
      ['Plan the announce, teaser and snippet cadence (3–4 posts/week)', P],
      ['Shoot behind-the-scenes and vertical video assets in one session', T],
      ['Schedule release-day posts across all selected platforms', T],
    ],
  },
  {
    id: 'r-spotify-pitch', goals: ['release'], needsRelease: true, platforms: ['spotify'], rel: -21, owner: 'Digital', priority: 'high', dataType: 'playlists',
    action: 'Pitch to Spotify editorial',
    text: 'Pitch through Spotify for Artists at least 7 days out, ideally 3+ weeks.',
    steps: [
      ['Write the pitch: genre, mood, story, and current traction', T],
      ['Add Canvas and update the artist profile before the pitch', T],
      ['Cross-reference target playlists from the Playlists page', P],
    ],
  },
  {
    id: 'r-apple-pitch', goals: ['release'], needsRelease: true, platforms: ['apple'], rel: -21, owner: 'Digital', priority: 'medium', dataType: 'playlists',
    action: 'Pitch to Apple Music editorial',
    text: 'Pitch through the distributor and Apple Music for Artists with the same narrative as the Spotify pitch.',
    steps: [
      ['Submit the pitch via the distributor\'s Apple Music form', T],
      ['Prepare motion artwork for Apple Music', T],
    ],
  },
  {
    id: 'r-presave', goals: ['release'], needsRelease: true, rel: -14, owner: 'Digital', priority: 'high', dataType: 'streaming',
    action: 'Run a pre-save campaign',
    text: 'Pre-saves feed Release Radar and first-day saves.',
    steps: [
      ['Set up the pre-save link (Spotify Countdown Page / smart link)', T],
      ['Pin the pre-save link in all bios', T],
      ['Marketing: offer a fan incentive (early snippet, signed print)', A],
    ],
  },
  {
    id: 'r-radio', goals: ['release'], needsRelease: true, minBudget: 2, rel: -14, owner: 'Radio', priority: 'medium', dataType: 'streaming',
    action: 'Send the release to radio',
    text: 'Get the release to target formats and specialist shows.',
    steps: [
      ['Pick the target formats and the add date', P],
      ['Send radio edits and the one-sheet to the plugger', A],
      ['Line up station IDs and interviews for release week', T],
    ],
  },
  {
    id: 'r-tiktok', goals: ['release'], needsRelease: true, platforms: ['tiktok'], rel: -7, owner: 'Marketing', priority: 'high', dataType: 'social',
    action: 'Seed the sound on TikTok',
    text: 'Get the hook moving on TikTok before release so it lands on day one with momentum.',
    steps: [
      ['Pick the 15-second hook and upload the sound early', T],
      ['Artist posts 3+ native videos using the sound', P],
      ['Brief 10–30 creators in the artist\'s niche', A],
    ],
  },
  {
    id: 'r-youtube', goals: ['release'], needsRelease: true, platforms: ['youtube'], rel: 0, owner: 'Digital', priority: 'medium', dataType: 'social',
    action: 'YouTube premiere and visualizer',
    text: 'Use a scheduled premiere to make release day an event.',
    steps: [
      ['Schedule the premiere with a countdown and live chat', T],
      ['Cut 3 Shorts from the video or visualizer', T],
    ],
  },
  {
    id: 'r-ads', goals: ['release'], needsRelease: true, minBudget: 1, rel: 0, owner: 'Marketing', priority: 'high', dataType: 'streaming',
    action: 'Release-week paid push',
    text: 'Concentrate paid spend in the first 7 days, when algorithmic signals matter most.',
    steps: [
      ['Run Meta/IG ads to a smart link targeting lookalikes of existing fans', P],
      ['Spotify: book Marquee for release week if eligible', T],
      ['Reallocate budget daily toward the best cost per stream', T],
    ],
  },
  {
    id: 'r-sync', goals: ['release'], needsRelease: true, releaseTypes: ['ep', 'album'], rel: 7, owner: 'Sync', priority: 'low', dataType: 'revenue',
    action: 'Pitch the project for sync',
    text: 'Get the stems and clean versions to music supervisors while the project is new.',
    steps: [
      ['Prepare instrumentals, stems and clean edits', T],
      ['Send a mood-tagged playlist to 10 music supervisors', A],
    ],
  },
  {
    id: 'r-recap', goals: ['release'], needsRelease: true, rel: 14, owner: 'A&R', priority: 'medium', dataType: 'streaming',
    action: 'Post-release performance review',
    text: 'Use the first two weeks of data to decide what to push next.',
    steps: [
      ['Compare first-week streams and save rate against the previous release', T],
      ['Review playlist adds and drops on the track profile', T],
      ['Decide the next focus track or remix', P],
    ],
  },

  // Streaming
  {
    id: 's-profile', goals: ['streaming', 'playlists'], at: 0.05, owner: 'Digital', priority: 'high', dataType: 'streaming',
    action: 'Optimize DSP artist profiles',
    text: 'A complete profile turns casual listeners into followers.',
    steps: [
      ['Refresh the bio, header images and Artist Pick', T],
      ['Add Canvas to the top 5 tracks', T],
      ['Update "This Is" and the artist playlists', T],
    ],
  },
  {
    id: 's-signals', goals: ['streaming'], at: 0.3, owner: 'Digital', priority: 'high', dataType: 'streaming',
    action: 'Drive algorithmic signals',
    text: 'Saves, follows and repeat listens push tracks into Discover Weekly and Radio.',
    steps: [
      ['Pick one focus track and send all traffic to it', P],
      ['Run a "save it" CTA across socials for 2 weeks', T],
      ['Track save rate and listener-to-follower conversion every week', T],
    ],
  },
  {
    id: 's-marquee', goals: ['streaming'], platforms: ['spotify'], minBudget: 1, at: 0.4, owner: 'Marketing', priority: 'medium', dataType: 'streaming',
    action: 'Run a Spotify Marquee / Showcase campaign',
    text: 'Re-engage lapsed listeners on Spotify.',
    steps: [
      ['Check eligibility and pick the target track', T],
      ['Set budget and audience (lapsed and light listeners)', A],
      ['Report the intent rate and post-campaign streams', T],
    ],
  },
  {
    id: 's-catalog', goals: ['streaming', 'revenue'], at: 0.6, owner: 'A&R', priority: 'low', dataType: 'streaming',
    action: 'Re-activate the catalog',
    text: 'Alternate versions and catalog moments bring older tracks back into rotation.',
    steps: [
      ['Release a sped-up, acoustic or live version of a top catalog track', P],
      ['Pitch catalog tracks to mood/activity playlists', T],
    ],
  },
  {
    id: 's-collab', goals: ['streaming', 'social'], at: 0.7, owner: 'A&R', priority: 'medium', dataType: 'streaming',
    action: 'Line up a collaboration',
    text: 'A feature with an adjacent artist puts {artist} in front of a new algorithmic audience.',
    steps: [
      ['Shortlist 5 adjacent artists with overlapping audiences', T],
      ['Reach out to management about a feature or remix', A],
    ],
  },

  // Social
  {
    id: 'so-audit', goals: ['social'], at: 0, owner: 'Digital', priority: 'high', dataType: 'social',
    action: 'Audit top-performing content',
    text: 'Base the content plan on formats that already work for {artist}.',
    steps: [
      ['Pull the top 10 posts per platform by engagement rate', T],
      ['Tag repeatable formats (hooks, lengths, captions)', P],
    ],
  },
  {
    id: 'so-cadence', goals: ['social', 'touring'], at: 0.15, owner: 'Marketing', priority: 'high', dataType: 'social',
    action: 'Launch a weekly content cadence',
    text: 'Consistent posting matters more than any single post.',
    steps: [
      ['Build a 4-week calendar with 4–5 posts/week', P],
      ['Batch-produce 2 weeks of content in one shoot', T],
      ['Review engagement every Friday and adjust', T],
    ],
  },
  {
    id: 'so-tiktok', goals: ['social', 'streaming'], platforms: ['tiktok'], at: 0.3, owner: 'Marketing', priority: 'medium', dataType: 'social',
    action: 'Build a TikTok-native series',
    text: 'A recurring format gives viewers a reason to follow.',
    steps: [
      ['Pick a repeatable series concept (e.g. song stories, covers, studio diaries)', P],
      ['Post daily for 2 weeks, then keep the formats that work', T],
    ],
  },
  {
    id: 'so-instagram', goals: ['social'], platforms: ['instagram'], at: 0.3, owner: 'Digital', priority: 'medium', dataType: 'social',
    action: 'Grow Instagram with Reels and Broadcast',
    text: 'Reels drive reach and Broadcast channels keep core fans close.',
    steps: [
      ['Post 3 Reels/week from the content cadence', T],
      ['Start a Broadcast channel for early news and drops', T],
    ],
  },
  {
    id: 'so-youtube', goals: ['social'], platforms: ['youtube'], at: 0.35, owner: 'Digital', priority: 'medium', dataType: 'social',
    action: 'Build on YouTube with Shorts',
    text: 'Shorts are the cheapest path to new YouTube subscribers.',
    steps: [
      ['Repurpose the top vertical videos as Shorts', T],
      ['Link Shorts to the full video or the channel', T],
    ],
  },
  {
    id: 'so-creators', goals: ['social', 'streaming'], platforms: ['tiktok', 'instagram'], minBudget: 1, at: 0.45, owner: 'Marketing', priority: 'medium', dataType: 'social',
    action: 'Creator seeding campaign',
    text: 'Paid creator posts can start organic momentum.',
    steps: [
      ['Shortlist 20 mid-tier creators in the artist\'s niche', T],
      ['Brief them with the sound, hook and a loose concept', A],
      ['Track UGC count and sound usage every week', T],
    ],
  },
  {
    id: 'so-cross', goals: ['social'], at: 0.6, owner: 'Digital', priority: 'low', dataType: 'social',
    action: 'Cross-promote between platforms',
    text: 'Send followers from the strongest platform to the weakest one.',
    steps: [
      ['Add handles for all platforms in every bio', T],
      ['Post platform-exclusive content teasers to drive follows', P],
    ],
  },

  // Playlists
  {
    id: 'p-targets', goals: ['playlists'], at: 0, owner: 'Digital', priority: 'high', dataType: 'playlists',
    action: 'Build a playlist target list',
    text: 'Focus pitching on playlists where similar artists already get placed.',
    steps: [
      ['Pull current placements and peaks for {artist} from the Playlists page', T],
      ['List 25 target playlists with similar artists (editorial + independent)', T],
      ['Rank them by follower count and fit', P],
    ],
  },
  {
    id: 'p-editorial', goals: ['playlists'], at: 0.25, owner: 'Digital', priority: 'high', dataType: 'playlists',
    action: 'Prepare an editorial pitch package',
    text: 'Editors respond to a story and proof of traction.',
    steps: [
      ['Write a one-paragraph narrative with current numbers', T],
      ['Compile press, social proof and recent placements', A],
      ['Pitch the next release through Spotify for Artists and distributor channels', T],
    ],
  },
  {
    id: 'p-curators', goals: ['playlists'], at: 0.4, owner: 'Digital', priority: 'medium', dataType: 'playlists',
    action: 'Reach out to independent curators',
    text: 'Independent curator adds build the history editors look for.',
    steps: [
      ['Contact 15 independent curators from the target list', T],
      ['Follow up after 7 days with a performance update', T],
    ],
  },
  {
    id: 'p-monitor', goals: ['playlists'], at: 0.85, owner: 'Digital', priority: 'low', dataType: 'playlists',
    action: 'Track placements and follow up',
    text: 'Use add and drop data to decide where to pitch next.',
    steps: [
      ['Review new adds, removals and peak positions', T],
      ['Thank curators and share stream results', A],
    ],
  },

  // Touring
  {
    id: 't-routing', goals: ['touring'], at: 0, owner: 'Management', priority: 'high', dataType: 'geography',
    action: 'Match routing to listener demand',
    text: 'Route the tour through the cities where {artist} is already being streamed.',
    steps: [
      ['Pull the top 20 cities from the geography data', T],
      ['Compare them against the agent\'s proposed routing', A],
      ['Flag high-demand markets that are missing from the routing', P],
    ],
  },
  {
    id: 't-announce', goals: ['touring'], at: 0.2, owner: 'Marketing', priority: 'high', dataType: 'social',
    action: 'Roll out the tour announcement',
    text: 'Stagger the announce, presale and on-sale to keep momentum.',
    steps: [
      ['Design the announce asset and per-city graphics', T],
      ['Schedule announce → presale → general on-sale posts', P],
    ],
  },
  {
    id: 't-fansfirst', goals: ['touring'], platforms: ['spotify'], at: 0.3, owner: 'Digital', priority: 'medium', dataType: 'streaming',
    action: 'Set up a fan presale and Spotify Fans First',
    text: 'Reward top listeners with early ticket access.',
    steps: [
      ['Set up Fans First / presale codes for top listeners', T],
      ['List all dates on the Spotify and Bandsintown profiles', T],
    ],
  },
  {
    id: 't-ads', goals: ['touring'], minBudget: 1, at: 0.5, owner: 'Marketing', priority: 'medium', dataType: 'geography',
    action: 'Run geo-targeted ticket ads',
    text: 'Spend the most on the dates with the weakest ticket sales.',
    steps: [
      ['Set up per-city ad sets with a 25-mile radius', T],
      ['Shift budget weekly based on sell-through', T],
    ],
  },
  {
    id: 't-content', goals: ['touring'], at: 0.8, owner: 'Marketing', priority: 'low', dataType: 'social',
    action: 'Capture on-tour content',
    text: 'Use the tour to produce a month of social content.',
    steps: [
      ['Brief a content capturer for the run', A],
      ['Post a city recap after each show', T],
    ],
  },

  // Revenue
  {
    id: 'v-audit', goals: ['revenue'], at: 0, owner: 'Management', priority: 'high', dataType: 'revenue',
    action: 'Audit royalty registrations',
    text: 'Unregistered works mean royalties are not being collected.',
    steps: [
      ['Confirm PRO, SoundExchange and publishing admin registrations', T],
      ['Reconcile the catalog against distributor statements', T],
    ],
  },
  {
    id: 'v-youtube', goals: ['revenue'], platforms: ['youtube'], at: 0.1, owner: 'Digital', priority: 'medium', dataType: 'revenue',
    action: 'Claim YouTube Content ID',
    text: 'Monetize user-generated videos that use the catalog.',
    steps: [
      ['Make sure the distributor has Content ID enabled for the catalog', T],
      ['Review claims and whitelist partners', T],
    ],
  },
  {
    id: 'v-sync', goals: ['revenue'], at: 0.3, owner: 'Sync', priority: 'medium', dataType: 'revenue',
    action: 'Push the catalog for sync licensing',
    text: 'Sync placements bring in fees and discovery.',
    steps: [
      ['Build a mood-tagged sync playlist with stems available', T],
      ['Pitch to 10 music supervisors and sync agencies', A],
    ],
  },
  {
    id: 'v-merch', goals: ['revenue', 'touring'], minBudget: 1, at: 0.4, owner: 'Marketing', priority: 'medium', dataType: 'revenue',
    action: 'Plan a merch drop',
    text: 'A limited drop creates urgency with the core fanbase.',
    steps: [
      ['Design 2–3 limited items tied to the current era', P],
      ['Set up the store and connect it to Spotify and YouTube merch shelves', T],
    ],
  },
  {
    id: 'v-d2c', goals: ['revenue'], at: 0.55, owner: 'Marketing', priority: 'low', dataType: 'revenue',
    action: 'Launch direct-to-fan bundles',
    text: 'Bundles convert the most engaged fans into higher-value buyers.',
    steps: [
      ['Bundle signed physical copies, merch and exclusive content', P],
      ['Email and SMS the bundle to the fan list', T],
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function todayISO() {
  return toISO(new Date());
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function daysBetween(fromISO, toISOStr) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISOStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

let keySeq = 0;
export const newKey = (prefix = 'k') => `${prefix}${Date.now().toString(36)}${(keySeq++).toString(36)}`;

const fill = (s, artistName) => (s || '').replaceAll('{artist}', artistName || 'the artist');
const unfill = (s, artistName) => (artistName ? (s || '').replaceAll(artistName, '{artist}') : s || '');

const OWNER_FALLBACK = ['Management', 'Marketing', 'Digital', 'A&R'];

function pickOwner(preferred, teams) {
  if (!teams || teams.length === 0) return null;
  if (teams.includes(preferred)) return preferred;
  return OWNER_FALLBACK.find(o => teams.includes(o)) || teams[0];
}

export function blankDraftAction() {
  return {
    key: newKey('a'),
    action: '',
    text: '',
    dataType: 'general',
    owner: null,
    priority: 'medium',
    dueDate: null,
    steps: [],
  };
}

// Build a draft plan for an artist from wizard answers.
export function generatePlan(artist, answers) {
  const a = { ...DEFAULT_ANSWERS, ...answers };
  const today = todayISO();
  const budget = BUDGET_LEVEL[a.budget] ?? 0;
  const hasRelease = a.release && a.release !== 'none';
  const releaseDate = hasRelease ? (a.releaseDate || addDaysISO(today, Math.max(28, a.timeline))) : null;

  const blocks = LIBRARY.filter(b => {
    if (!b.goals.includes('all') && !b.goals.includes(a.goal)) return false;
    if (b.needsRelease && !hasRelease) return false;
    if (b.releaseTypes && !b.releaseTypes.includes(a.release)) return false;
    if (b.platforms && !b.platforms.some(p => a.platforms.includes(p))) return false;
    if ((b.minBudget || 0) > budget) return false;
    return true;
  });

  // With a release, the window must reach past release week.
  const windowDays = releaseDate ? Math.max(a.timeline, daysBetween(today, releaseDate) + 14) : a.timeline;

  const dueFor = (b) => {
    let due;
    if (b.rel !== undefined && releaseDate) due = addDaysISO(releaseDate, b.rel);
    else due = addDaysISO(today, Math.round((b.at ?? 0.5) * windowDays));
    return due < today ? today : due;
  };

  const actions = blocks.map(b => ({
    key: newKey('a'),
    action: fill(b.action, artist?.name),
    text: fill(b.text, artist?.name),
    dataType: b.dataType,
    owner: pickOwner(b.owner, a.teams),
    priority: b.priority,
    dueDate: dueFor(b),
    steps: b.steps.map(([text, category]) => ({ key: newKey('s'), text: fill(text, artist?.name), category })),
  }));
  actions.sort((x, y) => (x.dueDate || '').localeCompare(y.dueDate || ''));

  return {
    name: `${GOAL_LABELS[a.goal] || 'Custom plan'}${releaseDate ? ` · ${releaseDate}` : ''}`,
    goal: a.goal,
    actions,
  };
}

// Template → draft for a specific artist, with dates relative to today.
export function draftFromTemplate(template, artist) {
  const today = todayISO();
  return {
    name: template.name,
    goal: template.goal || null,
    templateId: template.id,
    actions: (template.actions || []).map(t => ({
      key: newKey('a'),
      action: fill(t.action, artist?.name),
      text: fill(t.text, artist?.name),
      dataType: t.dataType || 'general',
      owner: t.owner || null,
      priority: t.priority || 'medium',
      dueDate: t.offsetDays === null || t.offsetDays === undefined ? null : addDaysISO(today, t.offsetDays),
      steps: (t.steps || []).map(s => ({ key: newKey('s'), text: fill(s.text, artist?.name), category: s.category || 'tactical' })),
    })),
  };
}

// Draft → template. Dates become offsets from today; the artist name becomes {artist}.
export function templateFromDraft(draft, { name, description, artistName } = {}) {
  const today = todayISO();
  return {
    id: `tpl-${Date.now().toString(36)}`,
    name: name || draft.name || 'Untitled template',
    description: description || '',
    goal: draft.goal || null,
    createdAt: new Date().toISOString(),
    actions: draft.actions
      .filter(x => x.action.trim())
      .map(x => ({
        action: unfill(x.action.trim(), artistName),
        text: unfill(x.text, artistName),
        dataType: x.dataType || 'general',
        owner: x.owner || null,
        priority: x.priority || 'medium',
        offsetDays: x.dueDate ? Math.max(0, daysBetween(today, x.dueDate)) : null,
        steps: x.steps
          .filter(s => s.text.trim())
          .map(s => ({ text: unfill(s.text.trim(), artistName), category: s.category || 'tactical' })),
      })),
  };
}

// Live actions (from useActions) → a draft, so an artist's checklist can be saved as a template.
export function draftFromActions(actions, name) {
  return {
    name,
    goal: null,
    actions: actions.map(a => ({
      key: newKey('a'),
      action: a.action || '',
      text: a.text || '',
      dataType: a.dataType || 'general',
      owner: a.owner || null,
      priority: a.priority >= 3 ? 'high' : a.priority >= 2 ? 'medium' : 'low',
      dueDate: a.dueDate || null,
      steps: (a.steps || []).map(s => ({ key: newKey('s'), text: s.text, category: s.category || 'tactical' })),
    })),
  };
}

// Numeric priority score for a draft priority level (see getPriorityLevel in actions.js).
export const PRIORITY_SCORE = { high: 3.5, medium: 2.5, low: 1.5 };
