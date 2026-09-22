/**
 * AI Budget Allocation
 *
 * Client-side, deterministic algorithm that recommends how to split a total budget
 * across connected platforms based on campaign objective and artist strength.
 */

// Objective-based weight profiles (60% weight)
const OBJECTIVE_WEIGHTS = {
  streams: { spotify: 0.45, meta: 0.12, google: 0.08, youtube: 0.12, tiktok: 0.18, x: 0.05 },
  awareness: { spotify: 0.12, meta: 0.25, google: 0.10, youtube: 0.18, tiktok: 0.22, x: 0.13 },
  engagement: { spotify: 0.08, meta: 0.25, google: 0.05, youtube: 0.17, tiktok: 0.30, x: 0.15 },
  conversions: { spotify: 0.08, meta: 0.30, google: 0.22, youtube: 0.10, tiktok: 0.25, x: 0.05 },
};

// How the end goal steers the whole plan — the strategy behind the weight profile above
const OBJECTIVE_STRATEGY = {
  streams: 'Because the goal is to drive streams, Spotify leads — it’s the only channel where a click becomes a play — with TikTok and YouTube funding discovery. Pure social prospecting (Meta, X) is trimmed back.',
  awareness: 'Because the goal is brand awareness, budget skews to the cheapest-reach channels — Meta, TikTok and YouTube — to maximize new impressions. Spotify is de-emphasized since it mostly re-touches existing fans.',
  engagement: 'Because the goal is engagement, TikTok and Meta lead — duets, comments and shares compound reach there. Search and Spotify play minor supporting roles.',
  conversions: 'Because the goal is conversions, spend concentrates on Meta and Google — the pixel- and intent-driven channels that close ticket and merch sales — while discovery channels stay lean.',
};

// Artist social platform mapping for strength scoring
const PLATFORM_METRIC_MAP = {
  spotify: 'spFollowers',
  meta: 'igFollowers',
  google: 'spFollowers', // Google Search — use Spotify as proxy for general audience size
  youtube: 'ytSubscribers',
  tiktok: 'ttFollowers',
  x: 'xFollowers',
};

const OBJECTIVE_WEIGHT = 0.6;
const STRENGTH_WEIGHT = 0.4;
const MIN_ALLOCATION_PCT = 5; // minimum 5% per platform

/**
 * Recommend how to allocate a budget across platforms.
 *
 * @param {object} artist - Artist data with social metrics
 * @param {string} artist.spFollowers - Spotify followers
 * @param {string} artist.igFollowers - Instagram followers
 * @param {string} artist.ytSubscribers - YouTube subscribers
 * @param {string} artist.ttFollowers - TikTok followers
 * @param {string} artist.xFollowers - X/Twitter followers
 * @param {string} objective - Campaign objective (streams, awareness, engagement, conversions)
 * @param {number} totalBudget - Total budget in USD
 * @param {string[]} connectedPlatforms - List of connected ad platform keys
 * @returns {{ allocations: Array<{platform, percentage, amount, reason}>, summary: string }}
 */
export function recommendBudgetAllocation(artist, objective, totalBudget, connectedPlatforms) {
  if (!connectedPlatforms || connectedPlatforms.length < 2) {
    return {
      allocations: connectedPlatforms?.length === 1
        ? [{ platform: connectedPlatforms[0], percentage: 100, amount: totalBudget, reason: 'Only connected platform' }]
        : [],
      summary: connectedPlatforms?.length === 1
        ? 'Single platform — full budget allocated.'
        : 'Connect at least 2 platforms for allocation recommendations.',
      strategy: '',
    };
  }

  const objWeights = OBJECTIVE_WEIGHTS[objective] || OBJECTIVE_WEIGHTS.awareness;
  const strategy = OBJECTIVE_STRATEGY[objective] || OBJECTIVE_STRATEGY.awareness;

  // Compute artist strength per platform (normalized 0-1)
  const metrics = {};
  let maxMetric = 0;
  for (const p of connectedPlatforms) {
    const key = PLATFORM_METRIC_MAP[p];
    const val = key && artist ? (Number(artist[key]) || 0) : 0;
    metrics[p] = val;
    if (val > maxMetric) maxMetric = val;
  }

  const strengthScores = {};
  for (const p of connectedPlatforms) {
    strengthScores[p] = maxMetric > 0 ? metrics[p] / maxMetric : 1 / connectedPlatforms.length;
  }

  // Blend objective weights + artist strength
  const rawScores = {};
  let totalScore = 0;
  for (const p of connectedPlatforms) {
    const objW = objWeights[p] || 0.1;
    const strW = strengthScores[p];
    rawScores[p] = OBJECTIVE_WEIGHT * objW + STRENGTH_WEIGHT * strW;
    totalScore += rawScores[p];
  }

  // Normalize to 100% and enforce minimum
  let allocations = connectedPlatforms.map(p => ({
    platform: p,
    rawPct: totalScore > 0 ? (rawScores[p] / totalScore) * 100 : 100 / connectedPlatforms.length,
  }));

  // Enforce minimum allocation
  let deficit = 0;
  for (const a of allocations) {
    if (a.rawPct < MIN_ALLOCATION_PCT) {
      deficit += MIN_ALLOCATION_PCT - a.rawPct;
      a.rawPct = MIN_ALLOCATION_PCT;
    }
  }

  // Redistribute deficit from highest allocations
  if (deficit > 0) {
    const aboveMin = allocations.filter(a => a.rawPct > MIN_ALLOCATION_PCT);
    const aboveTotal = aboveMin.reduce((s, a) => s + a.rawPct, 0);
    for (const a of aboveMin) {
      a.rawPct -= deficit * (a.rawPct / aboveTotal);
    }
  }

  // Final normalization to exactly 100
  const pctTotal = allocations.reduce((s, a) => s + a.rawPct, 0);
  allocations = allocations.map(a => {
    const percentage = Math.round((a.rawPct / pctTotal) * 100);
    return { ...a, percentage };
  });

  // Fix rounding to exactly 100
  const roundedTotal = allocations.reduce((s, a) => s + a.percentage, 0);
  if (roundedTotal !== 100) {
    // Add/subtract difference from largest allocation
    allocations.sort((a, b) => b.percentage - a.percentage);
    allocations[0].percentage += 100 - roundedTotal;
  }

  // Rank platforms by raw audience size (1 = largest) for evidence in reasons
  const audienceRank = {};
  [...connectedPlatforms]
    .sort((p1, p2) => (metrics[p2] || 0) - (metrics[p1] || 0))
    .forEach((p, i) => { audienceRank[p] = i + 1; });

  // Sort by percentage descending, compute amounts and reasons
  allocations = allocations
    .sort((a, b) => b.percentage - a.percentage)
    .map(a => {
      const amount = Math.round((a.percentage / 100) * totalBudget * 100) / 100;
      const reason = generateReason({
        platform: a.platform,
        objective,
        pct: a.percentage,
        amount,
        strength: strengthScores[a.platform],
        metricValue: metrics[a.platform] || 0,
        rank: audienceRank[a.platform],
        platformCount: connectedPlatforms.length,
      });
      return { platform: a.platform, percentage: a.percentage, amount, reason };
    });

  const topPlatform = allocations[0];
  const summary = `Recommended: ${topPlatform.percentage}% to ${platformLabel(topPlatform.platform)} based on ${objective} objective and artist audience strength.`;

  return { allocations, summary, strategy };
}

function platformLabel(p) {
  const labels = { spotify: 'Spotify', meta: 'Meta', google: 'Google Search', youtube: 'YouTube', tiktok: 'TikTok', x: 'X' };
  return labels[p] || p;
}

// Audience metric each platform's spend is anchored to (Google has no follower graph)
const AUDIENCE_LABELS = {
  spotify: 'Spotify followers',
  meta: 'Instagram followers',
  youtube: 'YouTube subscribers',
  tiktok: 'TikTok followers',
  x: 'X followers',
};

// Why a platform matters for a given objective — the strategic role that justifies its weight
const PLATFORM_ROLES = {
  streams: {
    spotify: 'is the shortest path to streams — impressions convert directly into plays, saves and algorithmic playlist adds',
    meta: 'feeds streams by pushing Reels and short-form clips straight to the release link',
    google: 'captures high-intent search ("artist + track name") and routes it to the streaming link',
    youtube: 'turns music-video and Shorts viewers into repeat streamers',
    tiktok: 'is the #1 discovery engine — sound adoption is what actually moves stream counts',
    x: 'keeps core fans active through the release cycle',
  },
  awareness: {
    spotify: 'reinforces an existing streaming footprint more than it finds net-new fans',
    meta: 'is the workhorse for awareness — the most precise demo/interest targeting at the lowest cost per reach',
    google: 'extends reach across Display and the wider web',
    youtube: 'buys cheap, skippable video impressions to build recognition at scale',
    tiktok: 'delivers organic-style reach that introduces the artist to new audiences fast',
    x: 'adds conversational reach around cultural moments',
  },
  engagement: {
    spotify: 'is a light engagement lever — mostly saves and follows',
    meta: 'drives comments, shares and saves through interactive creative',
    google: 'plays a minor role here — search rarely produces social engagement',
    youtube: 'earns watch-time and subscribers, the stickiest engagement signal',
    tiktok: 'is the strongest engagement engine — duets, stitches and comments compound reach',
    x: 'sparks replies and reposts in real time',
  },
  conversions: {
    spotify: 'converts to follows and pre-saves but carries limited purchase intent',
    meta: 'is the primary conversion driver — pixel-optimized for ticket and merch sales',
    google: 'captures bottom-funnel search intent that is ready to act',
    youtube: 'retargets warm viewers toward the conversion',
    tiktok: 'drives impulse conversions through shoppable short-form',
    x: 'has a narrow conversion role, best for announcements',
  },
};

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

function fmtMoney(n) {
  return '$' + Math.round(n || 0).toLocaleString('en-US');
}

/**
 * Build a substantive, evidence-backed rationale for a platform's allocation:
 * strategic role for the objective + the artist's actual audience there + the concrete spend.
 */
function generateReason({ platform, objective, pct, amount, strength, metricValue, rank, platformCount }) {
  const label = platformLabel(platform);
  const obj = PLATFORM_ROLES[objective] ? objective : 'awareness';
  const role = PLATFORM_ROLES[obj][platform] || `contributes to the ${obj} goal`;

  // Audience evidence — the data behind the weight
  let evidence;
  if (platform === 'google') {
    evidence = 'Search demand scales with total fanbase size, so it earns budget alongside the social channels.';
  } else if (metricValue > 0) {
    const rankNote = rank === 1
      ? ' — the largest of your connected audiences'
      : rank === platformCount
        ? ' — the smallest of your connected audiences'
        : '';
    const quality = rank === 1
      ? 'the deepest warm audience to retarget'
      : strength > 0.5
        ? 'a strong warm audience to retarget'
        : strength > 0.25
          ? 'a solid audience to build on'
          : 'a smaller but usable audience';
    evidence = `At ${fmtNum(metricValue)} ${AUDIENCE_LABELS[platform]}${rankNote}, it gives ${quality}.`;
  } else {
    evidence = 'There’s no connected audience signal here yet, so this spend is exploratory.';
  }

  // Spend justification — ties role + evidence to the dollars
  let spend;
  if (pct >= 30) {
    spend = `That makes it the lead channel: ${fmtMoney(amount)} (${pct}%).`;
  } else if (pct >= 15) {
    spend = `Funded as a core channel at ${fmtMoney(amount)} (${pct}%).`;
  } else if (pct >= 8) {
    spend = `Funded as a support channel at ${fmtMoney(amount)} (${pct}%).`;
  } else {
    spend = `Held at the ${pct}% floor (${fmtMoney(amount)}) as a test cell — prove it out before scaling.`;
  }

  return `${label} ${role}. ${evidence} ${spend}`;
}
