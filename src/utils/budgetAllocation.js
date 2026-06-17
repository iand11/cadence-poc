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
    };
  }

  const objWeights = OBJECTIVE_WEIGHTS[objective] || OBJECTIVE_WEIGHTS.awareness;

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

  // Sort by percentage descending, compute amounts and reasons
  allocations = allocations
    .sort((a, b) => b.percentage - a.percentage)
    .map(a => {
      const amount = Math.round((a.percentage / 100) * totalBudget * 100) / 100;
      const reason = generateReason(a.platform, objective, a.percentage, strengthScores[a.platform]);
      return { platform: a.platform, percentage: a.percentage, amount, reason };
    });

  const topPlatform = allocations[0];
  const summary = `Recommended: ${topPlatform.percentage}% to ${platformLabel(topPlatform.platform)} based on ${objective} objective and artist audience strength.`;

  return { allocations, summary };
}

function platformLabel(p) {
  const labels = { spotify: 'Spotify', meta: 'Meta', google: 'Google Search', youtube: 'YouTube', tiktok: 'TikTok', x: 'X' };
  return labels[p] || p;
}

function generateReason(platform, objective, pct, strength) {
  const label = platformLabel(platform);

  if (pct >= 35) {
    if (objective === 'streams' && platform === 'spotify') return `Primary channel for driving streams`;
    if (strength > 0.7) return `Strong audience presence on ${label} + aligned with ${objective} goal`;
    return `Best fit for ${objective} campaigns`;
  }
  if (pct >= 20) {
    if (strength > 0.5) return `Good audience base on ${label}`;
    return `Supports ${objective} with broad reach`;
  }
  if (pct >= 10) {
    return `Supplementary reach on ${label}`;
  }
  return `Minimum allocation for testing on ${label}`;
}
