/**
 * Assisted campaign setup
 *
 * Questions for the guided "New Campaign" wizard and a deterministic, rule-based
 * generator that turns the answers into a campaign plan (objective, platforms,
 * budget split, schedule, audience, creative): one complete campaign per platform
 * that the user reviews and confirms in one step.
 */
import { generateDirective, PLATFORM_LABELS, PLATFORM_OBJECTIVES, PLATFORM_CONSTRAINTS, CAMPAIGN_PLATFORMS, OBJECTIVE_LABELS } from '../data/directives';
import { recommendBudgetAllocation } from './budgetAllocation';
import { buildBoostPayload } from './boostPayload';

export const ASSISTED_QUESTIONS = [
  {
    key: 'goal',
    title: 'What do you want this campaign to do?',
    type: 'single',
    options: [
      { value: 'streams', label: 'Drive streams', hint: 'Send listeners to the music' },
      { value: 'awareness', label: 'Reach new fans', hint: 'Get in front of as many new people as possible' },
      { value: 'engagement', label: 'Grow engagement', hint: 'Likes, comments, shares and follows' },
      { value: 'conversions', label: 'Sell tickets or merch', hint: 'Clicks that turn into purchases' },
    ],
  },
  {
    key: 'promoting',
    title: 'What are you promoting?',
    type: 'single',
    options: [
      { value: 'release', label: 'A new release', hint: 'Single, EP or album' },
      { value: 'catalog', label: 'Existing music', hint: 'Catalog that is already out' },
      { value: 'tour', label: 'A tour or show', hint: 'Dates fans can buy tickets for' },
      { value: 'profile', label: 'The artist in general', hint: 'Profile and channel growth' },
    ],
  },
  {
    key: 'releaseDate',
    title: 'When does it come out?',
    type: 'date',
    hint: 'Ads start a week before release and run three weeks after.',
    showIf: (a) => a.promoting === 'release',
  },
  {
    key: 'duration',
    title: 'How long should it run?',
    type: 'single',
    showIf: (a) => a.promoting !== 'release',
    options: [
      { value: 7, label: '1 week' },
      { value: 14, label: '2 weeks' },
      { value: 30, label: '30 days' },
    ],
  },
  {
    key: 'budget',
    title: 'What is the total budget?',
    type: 'budget',
    presets: [500, 1000, 2500, 5000],
  },
  {
    key: 'locations',
    title: 'Where should the ads run?',
    type: 'multi',
    options: [
      { value: 'US', label: 'United States' },
      { value: 'UK', label: 'United Kingdom' },
      { value: 'CA', label: 'Canada' },
      { value: 'AU', label: 'Australia' },
      { value: 'DE', label: 'Germany' },
      { value: 'FR', label: 'France' },
      { value: 'BR', label: 'Brazil' },
      { value: 'MX', label: 'Mexico' },
    ],
  },
  {
    key: 'age',
    title: 'Who is the core audience?',
    type: 'single',
    options: [
      { value: '18-24', label: '18–24' },
      { value: '18-34', label: '18–34' },
      { value: '25-44', label: '25–44' },
      { value: '18-54', label: 'Everyone 18+' },
    ],
  },
  {
    key: 'platforms',
    title: 'Which platforms?',
    type: 'platforms',
    hint: 'Prelude picks the split and the posts to promote on each.',
  },
];

export const DEFAULT_ANSWERS = {
  goal: null,
  promoting: null,
  releaseDate: '',
  duration: 14,
  budget: 1000,
  locations: ['US'],
  age: '18-34',
  platforms: CAMPAIGN_PLATFORMS,
};

export function visibleQuestions(answers) {
  return ASSISTED_QUESTIONS.filter(q => !q.showIf || q.showIf(answers));
}

export function isAnswered(question, answers) {
  const v = answers[question.key];
  if (question.type === 'multi' || question.type === 'platforms') return Array.isArray(v) && v.length > 0;
  if (question.type === 'budget') return Number(v) > 0;
  if (question.type === 'date') return !!v;
  return v !== null && v !== undefined && v !== '';
}

// The objective a platform's ad is created with. "Drive streams" has no platform
// objective of its own: it sends traffic to the smart link where the platform
// supports it, and optimizes for engagement elsewhere.
export function objectiveFor(platform, goal) {
  const supported = (PLATFORM_OBJECTIVES[platform] || []).map(o => o.key);
  const wanted = goal === 'streams' ? 'conversions' : goal;
  if (supported.includes(wanted)) return wanted;
  if (supported.includes('engagement')) return 'engagement';
  return supported[0] || 'awareness';
}

const DAY = 86400000;
const iso = (d) => d.toISOString().split('T')[0];

export function scheduleFor(answers, now = new Date()) {
  const tomorrow = new Date(now.getTime() + DAY);
  if (answers.promoting === 'release' && answers.releaseDate) {
    const release = new Date(`${answers.releaseDate}T00:00:00Z`);
    const start = new Date(Math.max(tomorrow.getTime(), release.getTime() - 7 * DAY));
    const end = new Date(Math.max(start.getTime() + 7 * DAY, release.getTime() + 21 * DAY));
    return { startDate: iso(start), endDate: iso(end) };
  }
  const days = Number(answers.duration) || 14;
  return { startDate: iso(tomorrow), endDate: iso(new Date(tomorrow.getTime() + days * DAY)) };
}

function artistMetrics(artist) {
  return {
    spFollowers: artist?.spotify?.followers || 0,
    igFollowers: artist?.social?.instagram || 0,
    ytSubscribers: artist?.social?.youtube || 0,
    ttFollowers: artist?.social?.tiktok || 0,
    xFollowers: artist?.social?.twitter || 0,
  };
}

const PROMOTING_TITLES = {
  release: 'Release campaign',
  catalog: 'Catalog campaign',
  tour: 'Tour campaign',
  profile: 'Artist growth campaign',
};

const CTA_BY_GOAL = {
  streams: 'Listen Now',
  awareness: 'Learn More',
  engagement: 'Learn More',
  conversions: 'Shop Now',
};

// Feed platform the boost candidates come from, per ads platform
export const POST_SOURCE = { meta: 'instagram', tiktok: 'tiktok', youtube: 'youtube' };

export const postEngagement = (p) => (p?.likes || 0) + (p?.comments || 0) + (p?.shares || 0);

/** Creative for boosting one organic post (same fields the builder writes for a boost). */
export function boostCreative(post, platform, goal) {
  const payload = buildBoostPayload(post);
  const creative = { ...(payload?.creative || {}), callToAction: CTA_BY_GOAL[goal] || 'Learn More' };
  if (platform === 'tiktok') creative.type = 'spark';
  if (platform === 'youtube') creative.type = 'video';
  return creative;
}

/** Empty "new post" fields for a campaign; filled in on the confirm screen. */
export function newPostDraft(artist) {
  return { headline: artist?.name ? `New music from ${artist.name}` : '', images: [], runAsIgUserId: null, videoFile: null };
}

/** What still blocks a campaign from being confirmed, or null. */
export function campaignIssue(c, destination) {
  if (c.mode !== 'new') return null;
  if (c.platform === 'meta') {
    if (!c.draft.runAsIgUserId) return 'Choose the Instagram account the ad runs as.';
    if (!c.draft.images.length) return 'Add at least one image.';
  } else if (!c.draft.videoFile) {
    return 'Add a video.';
  }
  if (!destination) return 'Choose where the ad sends people.';
  return null;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The directive to save for a confirmed campaign: boosts as planned, new posts built from their fields. */
export async function finalizeCampaign(c, destination, artist) {
  if (c.mode !== 'new') return c.directive;
  const { headline, images, runAsIgUserId, videoFile } = c.draft;
  const callToAction = c.directive.creative?.callToAction || 'Learn More';
  const creative = c.platform === 'meta'
    ? {
        type: 'image', assetUrl: null, headline, description: '', callToAction, trackUrl: destination,
        postId: null, postSource: null, igUserId: runAsIgUserId, pageId: null,
        images, imageUrl: images[0] || artist?.imageUrl || null,
      }
    : {
        type: 'video', headline, description: '', callToAction, trackUrl: destination, postId: null,
        videoFile: videoFile ? await readAsDataUrl(videoFile) : undefined,
      };
  return { ...c.directive, creative };
}

/**
 * Build complete, ready-to-confirm campaigns from the wizard answers.
 *
 * `posts` maps each ads platform to the artist's posts there, best first.
 * Rules, in order:
 * - Each campaign boosts the artist's best-performing post on its platform; a
 *   platform with no posts to boost starts as a new post the user fills in.
 * - The remaining platforms are split with the same objective + audience-size
 *   weighting the manual allocator recommends.
 * - TikTok is left out when its share falls under TikTok's $500 campaign minimum.
 * - Schedule, audience and objective come straight from the answers.
 */
export function generateAssistedPlan(artist, answers, posts = {}, now = new Date()) {
  const goal = answers.goal || 'awareness';
  const budget = Math.max(1, Math.round(Number(answers.budget) || 0));
  const notes = [];

  let platforms = (answers.platforms?.length ? answers.platforms : CAMPAIGN_PLATFORMS)
    .filter(p => CAMPAIGN_PLATFORMS.includes(p));
  const noPosts = platforms.filter(p => !posts[p]?.length);
  if (noPosts.length) {
    notes.push(`No ${noPosts.map(p => PLATFORM_LABELS[p]).join(' or ')} posts to boost, so ${noPosts.length > 1 ? 'those are' : 'that one is'} set up as a new post.`);
  }

  const metrics = artistMetrics(artist);
  let allocation = recommendBudgetAllocation(metrics, goal, budget, platforms);
  const tiktokMin = PLATFORM_CONSTRAINTS.tiktok.minBudget;
  const tiktok = allocation.allocations.find(a => a.platform === 'tiktok');
  if (tiktok && tiktok.amount < tiktokMin && platforms.length > 1) {
    notes.push(`TikTok left out: its share ($${tiktok.amount}) is under TikTok's $${tiktokMin} minimum.`);
    platforms = platforms.filter(p => p !== 'tiktok');
    allocation = recommendBudgetAllocation(metrics, goal, budget, platforms);
  }

  const [ageMin, ageMax] = String(answers.age || '18-34').split('-').map(Number);
  const audience = {
    locations: answers.locations?.length ? answers.locations : ['US'],
    ageRange: [ageMin, ageMax],
    interests: [],
    lookalike: goal !== 'awareness',
  };
  const schedule = scheduleFor(answers, now);
  const days = Math.max(1, Math.round((new Date(schedule.endDate) - new Date(schedule.startDate)) / DAY));
  const goalLabel = ASSISTED_QUESTIONS[0].options.find(o => o.value === goal)?.label || OBJECTIVE_LABELS[goal];

  const campaigns = allocation.allocations.map(alloc => {
    const platform = alloc.platform;
    const post = posts[platform]?.[0];
    const mode = post ? 'boost' : 'new';
    const directive = generateDirective({
      artistSlug: artist?.slug,
      artistName: artist?.name,
      artistImage: artist?.imageUrl,
      platform,
    }, platform, {
      objective: objectiveFor(platform, goal),
      budget: { amount: alloc.amount, currency: 'USD', period: 'lifetime' },
      schedule,
      audience,
      creative: post ? boostCreative(post, platform, goal) : { callToAction: CTA_BY_GOAL[goal] || 'Learn More' },
      rationale: `${goalLabel}: ${post ? `boosts ${artist?.name || 'the artist'}'s best-performing ${PLATFORM_LABELS[platform]} post` : `a new ${PLATFORM_LABELS[platform]} post`}. ${alloc.reason}`,
    });
    // generateDirective ids are time-based; keep them unique within one plan
    directive.id = `${directive.id}-${platform}`;
    return { platform, directive, postIndex: 0, mode, draft: newPostDraft(artist) };
  });

  return {
    title: `${PROMOTING_TITLES[answers.promoting] || 'Campaign'}: ${goalLabel}`,
    goal,
    goalLabel,
    answers,
    budget,
    days,
    schedule,
    audience,
    notes,
    campaigns,
    releaseNote: answers.promoting === 'release' && answers.releaseDate
      ? `Starts a week before the ${answers.releaseDate} release and runs three weeks after.`
      : null,
  };
}
