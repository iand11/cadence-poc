/**
 * Assisted campaign setup
 *
 * Questions for the guided "New Campaign" wizard and a deterministic, rule-based
 * generator that turns the answers into a campaign plan (objective, platforms,
 * budget split, schedule, audience, creative). The plan is shaped like a campaign
 * suggestion so the wizard's plan step and launch queue can use it unchanged.
 */
import { generateDirective, PLATFORM_LABELS, PLATFORM_OBJECTIVES, PLATFORM_CONSTRAINTS, CAMPAIGN_PLATFORMS, OBJECTIVE_LABELS } from '../data/directives';
import { recommendBudgetAllocation } from './budgetAllocation';

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
    key: 'creative',
    title: 'What content do you have for the ads?',
    type: 'multi',
    hint: 'YouTube and TikTok need video.',
    options: [
      { value: 'video', label: 'Video' },
      { value: 'images', label: 'Photos or artwork' },
      { value: 'posts', label: 'Posts that are already doing well' },
    ],
  },
  {
    key: 'platforms',
    title: 'Which platforms?',
    type: 'platforms',
    hint: 'Leave all selected to let Prelude pick the split.',
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
  creative: ['video'],
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

/**
 * Build a campaign plan from the wizard answers.
 *
 * Rules, in order:
 * - Only video lets YouTube and TikTok run; with photos or posts only, Instagram carries it.
 * - The chosen platforms are split with the same objective + audience-size weighting
 *   the manual allocator recommends.
 * - TikTok is dropped when its share falls under TikTok's $500 campaign minimum.
 * - Boostable posts make Instagram ads boosts by default; otherwise a new ad.
 */
export function generateAssistedPlan(artist, answers, now = new Date()) {
  const goal = answers.goal || 'awareness';
  const budget = Math.max(1, Math.round(Number(answers.budget) || 0));
  const creative = answers.creative || [];
  const hasVideo = creative.includes('video');
  const notes = [];

  let platforms = (answers.platforms?.length ? answers.platforms : CAMPAIGN_PLATFORMS)
    .filter(p => CAMPAIGN_PLATFORMS.includes(p));
  if (!hasVideo) {
    const dropped = platforms.filter(p => p !== 'meta');
    if (dropped.length) notes.push(`${dropped.map(p => PLATFORM_LABELS[p]).join(' and ')} left out because they need video.`);
    platforms = ['meta'];
  }

  const metrics = artistMetrics(artist);
  let allocation = recommendBudgetAllocation(metrics, goal, budget, platforms);
  const tiktokMin = PLATFORM_CONSTRAINTS.tiktok.minBudget;
  const tiktok = allocation.allocations.find(a => a.platform === 'tiktok');
  if (tiktok && tiktok.amount < tiktokMin && platforms.length > 1) {
    notes.push(`TikTok left out because its share ($${tiktok.amount}) is under TikTok's $${tiktokMin} minimum.`);
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

  const primary = [...allocation.allocations].sort((a, b) => b.amount - a.amount)[0]?.platform || platforms[0] || 'meta';
  const name = artist?.name || 'the artist';
  const goalLabel = ASSISTED_QUESTIONS[0].options.find(o => o.value === goal)?.label || OBJECTIVE_LABELS[goal];
  const creativeFor = (platform) => {
    const base = { headline: '', description: '', trackUrl: '', postId: null };
    if (platform === 'meta') {
      return {
        ...base,
        type: hasVideo && !creative.includes('images') ? 'video' : 'image',
        callToAction: CTA_BY_GOAL[goal],
      };
    }
    if (platform === 'tiktok') return { ...base, type: creative.includes('posts') ? 'spark' : 'video', callToAction: CTA_BY_GOAL[goal] };
    return { ...base, type: 'video' };
  };

  const rationale = [
    `${goalLabel} for ${name} over ${days} days with $${budget.toLocaleString('en-US')}.`,
    answers.promoting === 'release' && answers.releaseDate ? `Starts a week before the ${answers.releaseDate} release and keeps going for three weeks after.` : null,
    `Targeting ${audience.locations.join(', ')}, ages ${ageMin}–${ageMax}.`,
    ...notes,
  ].filter(Boolean).join(' ');

  const action = creative.includes('posts')
    ? 'Boost the posts already performing best on Instagram, and point new ads at the release smart link.'
    : goal === 'streams' || answers.promoting === 'release'
      ? 'Point every ad at the release smart link so streaming clicks are tracked per campaign.'
      : 'Lead with the strongest visual and a single clear call to action.';

  const directiveOptions = Object.fromEntries(platforms.map(p => [p, {
    objective: objectiveFor(p, goal),
    schedule,
    audience,
    creative: creativeFor(p),
  }]));

  return {
    id: `assisted-${now.getTime()}`,
    title: `${PROMOTING_TITLES[answers.promoting] || 'Campaign'}: ${goalLabel}`,
    platform: primary,
    objective: goal,
    impact: 'high',
    insightType: 'info',
    suggestedBudget: budget,
    rationale,
    action,
    dataType: 'social',
    source: 'assisted',
    answers,
    platforms,
    directiveOptions,
    directive: generateDirective({
      artistSlug: artist?.slug,
      artistName: artist?.name,
      artistImage: artist?.imageUrl,
      platform: primary,
    }, primary, { ...directiveOptions[primary], budget: { amount: budget, currency: 'USD', period: 'lifetime' }, rationale }),
  };
}
