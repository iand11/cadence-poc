/**
 * Analyze whether a content item is a boost candidate by comparing its
 * performance against the artist's average for that platform/content type.
 *
 * Thresholds:
 * - >1.5x average views  OR
 * - >2x average engagement rate (likes+comments+shares)
 * - Requires min 5 posts in the average window (enforced server-side)
 */
export function analyzeBoostPotential(item, artistAverage) {
  if (!artistAverage || artistAverage.postCount < 5) {
    return { isBoostCandidate: false, viewsMultiplier: 0, engagementMultiplier: 0, reason: null };
  }

  const itemViews = item.views || 0;
  const itemEngagement = (item.likes || 0) + (item.comments || 0) + (item.shares || 0);
  const avgViews = artistAverage.avgViews || 1;
  const avgEngagement = artistAverage.avgEngagement || 1;

  const viewsMultiplier = avgViews > 0 ? Math.round((itemViews / avgViews) * 10) / 10 : 0;
  const engagementMultiplier = avgEngagement > 0 ? Math.round((itemEngagement / avgEngagement) * 10) / 10 : 0;

  const isViewsBoost = viewsMultiplier >= 1.5;
  const isEngagementBoost = engagementMultiplier >= 2;
  const isBoostCandidate = isViewsBoost || isEngagementBoost;

  let reason = null;
  if (isViewsBoost && isEngagementBoost) {
    reason = `${viewsMultiplier}x views and ${engagementMultiplier}x engagement above average`;
  } else if (isViewsBoost) {
    reason = `${viewsMultiplier}x views above average`;
  } else if (isEngagementBoost) {
    reason = `${engagementMultiplier}x engagement above average`;
  }

  return { isBoostCandidate, viewsMultiplier, engagementMultiplier, reason };
}

/**
 * From a list of content items + artist averages, return boost candidates
 * sorted by highest impact multiplier.
 */
export function generateBoostRecommendations(items, artistAverages) {
  const candidates = [];

  for (const item of items) {
    const avg = artistAverages[item.artistId]?.[item.platform]?.[item.contentType];
    if (!avg) continue;

    const analysis = analyzeBoostPotential(item, avg);
    if (!analysis.isBoostCandidate) continue;

    const multiplier = Math.max(analysis.viewsMultiplier, analysis.engagementMultiplier);
    candidates.push({ item, ...analysis, multiplier });
  }

  return candidates.sort((a, b) => b.multiplier - a.multiplier);
}

/**
 * Generate boost-type action items from boost recommendations.
 * These can be injected into the existing actions system.
 */
export function generateBoostActions(boostRecommendations) {
  const PLATFORM_ACTION_MAP = {
    instagram: 'meta',
    tiktok: 'tiktok',
    youtube: 'youtube',
    twitter: 'x',
  };

  return boostRecommendations.slice(0, 10).map(rec => ({
    id: `boost-${rec.item.id}`,
    type: 'boost',
    artistSlug: rec.item.artistSlug,
    artistName: rec.item.artistName,
    platform: rec.item.platform,
    adsPlatform: PLATFORM_ACTION_MAP[rec.item.platform] || rec.item.platform,
    dataType: 'social',
    text: rec.reason,
    action: `Boost ${rec.item.contentType} on ${rec.item.platform} — ${rec.multiplier}x above average performance`,
    impact: rec.multiplier >= 3 ? 'high' : rec.multiplier >= 2 ? 'medium' : 'low',
    contentItem: rec.item,
    source: 'auto-detection',
  }));
}
