// Mock campaign tracking data generator
// Uses seededRandom for deterministic, render-stable results

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seedFromId(id) {
  // Extract numeric portion from directive ID like "dir-1717012345678"
  const match = id.match(/\d+/);
  return match ? parseInt(match[0], 10) % 100000 : 42;
}

// Platform-specific ad performance profiles
export const PLATFORM_PROFILES = {
  spotify: {
    cpmRange: [3, 8],
    ctrRange: [0.8, 2.5],
    resultType: 'streams',
    resultLabel: 'Streams',
    conversionRate: [0.15, 0.40],
  },
  meta: {
    cpmRange: [5, 15],
    ctrRange: [0.5, 2.0],
    resultType: 'followers',
    resultLabel: 'Followers',
    conversionRate: [0.05, 0.15],
  },
  google: {
    cpmRange: [4, 12],
    ctrRange: [0.3, 1.5],
    resultType: 'clicks',
    resultLabel: 'Clicks',
    conversionRate: [0.10, 0.30],
  },
  youtube: {
    cpmRange: [3, 10],
    ctrRange: [0.5, 2.0],
    resultType: 'views',
    resultLabel: 'Video Views',
    conversionRate: [0.10, 0.30],
  },
  tiktok: {
    cpmRange: [2, 6],
    ctrRange: [1.0, 3.5],
    resultType: 'followers',
    resultLabel: 'Followers',
    conversionRate: [0.08, 0.20],
  },
  x: {
    cpmRange: [6, 18],
    ctrRange: [0.3, 1.2],
    resultType: 'followers',
    resultLabel: 'Followers',
    conversionRate: [0.03, 0.10],
  },
};

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function daysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Generate daily tracking metrics for a campaign directive.
 * Returns deterministic data seeded from the directive ID.
 */
export function generateCampaignMetrics(directive) {
  if (!directive || !directive.schedule?.startDate || !directive.schedule?.endDate) {
    return { daily: [], totals: null, resultLabel: 'Results' };
  }

  const profile = PLATFORM_PROFILES[directive.platform] || PLATFORM_PROFILES.meta;
  const seed = seedFromId(directive.id);
  const totalDays = daysBetween(directive.schedule.startDate, directive.schedule.endDate);
  const today = new Date().toISOString().split('T')[0];
  const isCompleted = directive.status === 'completed';

  // How many days of data to generate
  const endDate = isCompleted ? directive.schedule.endDate : today;
  const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(directive.schedule.startDate, endDate)));

  // If campaign hasn't started yet, return empty
  if (directive.schedule.startDate > today && !isCompleted) {
    return { daily: [], totals: null, resultLabel: profile.resultLabel };
  }

  // Calculate total budget
  const budgetAmount = directive.budget?.amount || 100;
  const isDaily = directive.budget?.period === 'daily';
  const totalBudget = isDaily ? budgetAmount * totalDays : budgetAmount;
  const dailyTarget = totalBudget / totalDays;

  // Seed-derived platform performance
  const cpm = lerp(profile.cpmRange[0], profile.cpmRange[1], seededRandom(seed * 3));
  const baseCtr = lerp(profile.ctrRange[0], profile.ctrRange[1], seededRandom(seed * 7));
  const convRate = lerp(profile.conversionRate[0], profile.conversionRate[1], seededRandom(seed * 11));

  let cumulativeSpend = 0;
  let cumulativeResults = 0;
  let cumulativeImpressions = 0;
  let cumulativeClicks = 0;
  const daily = [];

  for (let i = 0; i < elapsedDays; i++) {
    const date = addDays(directive.schedule.startDate, i);

    // Spend with ramp-up, steady, and taper curve
    let spendMultiplier = 1;
    if (i < 3) {
      spendMultiplier = 0.6 + i * 0.15; // ramp: 0.6, 0.75, 0.9
    } else if (i >= totalDays - 2) {
      spendMultiplier = 0.85; // slight taper
    }

    // Daily variance ±15%
    const variance = 1 + (seededRandom(seed + i * 17) - 0.5) * 0.3;
    const spend = Math.round(dailyTarget * spendMultiplier * variance * 100) / 100;

    // Derive metrics from spend
    const impressions = Math.round((spend / cpm) * 1000);
    const ctrNoise = 1 + (seededRandom(seed + i * 23) - 0.5) * 0.2;
    const ctr = Math.round(baseCtr * ctrNoise * 100) / 100;
    const clicks = Math.round(impressions * (ctr / 100));
    const convNoise = 1 + (seededRandom(seed + i * 31) - 0.5) * 0.25;
    const results = Math.max(1, Math.round(clicks * convRate * convNoise));
    const costPerResult = results > 0 ? Math.round((spend / results) * 100) / 100 : 0;

    cumulativeSpend += spend;
    cumulativeResults += results;
    cumulativeImpressions += impressions;
    cumulativeClicks += clicks;

    daily.push({
      date,
      spend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      ctr,
      results,
      costPerResult,
      cumulativeSpend: Math.round(cumulativeSpend * 100) / 100,
      cumulativeResults,
    });
  }

  const avgCtr = cumulativeImpressions > 0
    ? Math.round((cumulativeClicks / cumulativeImpressions) * 10000) / 100
    : 0;

  return {
    daily,
    totals: {
      spend: Math.round(cumulativeSpend * 100) / 100,
      budget: totalBudget,
      impressions: cumulativeImpressions,
      clicks: cumulativeClicks,
      results: cumulativeResults,
      avgCTR: avgCtr,
      costPerResult: cumulativeResults > 0
        ? Math.round((cumulativeSpend / cumulativeResults) * 100) / 100
        : 0,
      budgetUsedPercent: totalBudget > 0
        ? Math.round((cumulativeSpend / totalBudget) * 1000) / 10
        : 0,
      daysElapsed: elapsedDays,
      daysTotal: totalDays,
      daysRemaining: Math.max(0, totalDays - elapsedDays),
    },
    platform: directive.platform,
    resultType: profile.resultType,
    resultLabel: profile.resultLabel,
  };
}

/**
 * Aggregate metrics across multiple campaign directives.
 * Only includes active and completed campaigns.
 */
export function aggregateCampaignMetrics(directives) {
  const eligible = directives.filter(d =>
    ['active', 'completed', 'executing'].includes(d.status)
  );

  if (eligible.length === 0) {
    return { campaigns: [], dailyTotal: [], platformBreakdown: [], totals: null };
  }

  // Generate metrics for each campaign
  const campaigns = eligible.map(d => ({
    directive: d,
    metrics: generateCampaignMetrics(d),
  }));

  // Merge daily data into a combined timeline
  const dateMap = {};
  for (const { directive, metrics } of campaigns) {
    for (const day of metrics.daily) {
      if (!dateMap[day.date]) {
        dateMap[day.date] = { date: day.date, totalSpend: 0 };
      }
      dateMap[day.date].totalSpend += day.spend;
      // Add per-campaign spend column
      const key = directive.id;
      dateMap[day.date][key] = (dateMap[day.date][key] || 0) + day.spend;
    }
  }
  const dailyTotal = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  // Platform breakdown
  const platformMap = {};
  for (const { directive, metrics } of campaigns) {
    const p = directive.platform;
    if (!platformMap[p]) {
      platformMap[p] = { platform: p, spend: 0, results: 0, impressions: 0, clicks: 0, campaigns: 0, budget: 0 };
    }
    if (metrics.totals) {
      platformMap[p].spend += metrics.totals.spend;
      platformMap[p].results += metrics.totals.results;
      platformMap[p].impressions += metrics.totals.impressions;
      platformMap[p].clicks += metrics.totals.clicks;
      platformMap[p].budget += metrics.totals.budget;
    }
    platformMap[p].campaigns += 1;
  }
  const platformBreakdown = Object.values(platformMap).map(p => ({
    ...p,
    costPerResult: p.results > 0 ? Math.round((p.spend / p.results) * 100) / 100 : 0,
    ctr: p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 100 : 0,
  }));

  // Overall totals
  const totalSpend = campaigns.reduce((s, c) => s + (c.metrics.totals?.spend || 0), 0);
  const totalResults = campaigns.reduce((s, c) => s + (c.metrics.totals?.results || 0), 0);
  const totalBudget = campaigns.reduce((s, c) => s + (c.metrics.totals?.budget || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.metrics.totals?.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.metrics.totals?.clicks || 0), 0);

  // Find best performing platform (lowest cost per result)
  const bestPlatform = platformBreakdown.length > 0
    ? platformBreakdown.reduce((best, p) =>
        p.costPerResult > 0 && (best.costPerResult === 0 || p.costPerResult < best.costPerResult) ? p : best
      )
    : null;

  return {
    campaigns,
    dailyTotal,
    platformBreakdown,
    totals: {
      spend: Math.round(totalSpend * 100) / 100,
      budget: Math.round(totalBudget * 100) / 100,
      results: totalResults,
      impressions: totalImpressions,
      clicks: totalClicks,
      activeCampaigns: eligible.length,
      avgCostPerResult: totalResults > 0
        ? Math.round((totalSpend / totalResults) * 100) / 100
        : 0,
      avgCTR: totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 10000) / 100
        : 0,
      bestPlatform: bestPlatform?.platform || null,
    },
  };
}
