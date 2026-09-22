/**
 * Mid-Campaign Optimization
 *
 * Compares cost-per-result (CPR) across campaigns for the same artist.
 * When worst/best CPR ratio >= 1.8x, suggests reallocating budget
 * from the underperformer to the better performer.
 */

const CPR_RATIO_THRESHOLD = 1.8; // trigger when worst is 1.8x the best
const MAX_SHIFT_PERCENT = 0.5;   // cap shift at 50% of underperformer's remaining budget
const MIN_BUDGET_PER_PLATFORM = 20; // don't go below $20

/**
 * Detect optimization opportunities from campaigns with metrics.
 *
 * @param {Array<{directive, metrics}>} campaignsWithMetrics
 *   Each item: { directive: { id, artistSlug, platform, budget, status }, metrics: { totals: { spend, results, costPerResult, budgetUsedPercent } } }
 * @returns {Array<{id, fromCampaign, toCampaign, fromPlatform, toPlatform, shiftAmount, ratio, message, impact}>}
 */
export function detectOptimizations(campaignsWithMetrics) {
  const suggestions = [];

  // Group active campaigns by artist
  const byArtist = {};
  for (const c of campaignsWithMetrics) {
    if (!c.directive || !['active', 'executing'].includes(c.directive.status)) continue;
    if (!c.metrics?.totals || c.metrics.totals.results === 0) continue;

    const slug = c.directive.artistSlug;
    if (!byArtist[slug]) byArtist[slug] = [];
    byArtist[slug].push(c);
  }

  // Compare CPR within each artist group
  for (const [, campaigns] of Object.entries(byArtist)) {
    if (campaigns.length < 2) continue;

    // Sort by CPR ascending (best first)
    const sorted = [...campaigns].sort(
      (a, b) => a.metrics.totals.costPerResult - b.metrics.totals.costPerResult
    );

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const bestCPR = best.metrics.totals.costPerResult;
    const worstCPR = worst.metrics.totals.costPerResult;

    if (bestCPR <= 0) continue;

    const ratio = Math.round((worstCPR / bestCPR) * 10) / 10;

    if (ratio < CPR_RATIO_THRESHOLD) continue;

    // Calculate shift amount
    const worstBudget = worst.directive.budget?.amount || 0;
    const worstSpent = worst.metrics.totals.spend || 0;
    const remaining = Math.max(0, worstBudget - worstSpent);
    const shiftAmount = Math.min(
      remaining * MAX_SHIFT_PERCENT,
      remaining - MIN_BUDGET_PER_PLATFORM,
    );

    if (shiftAmount < MIN_BUDGET_PER_PLATFORM) continue;

    const roundedShift = Math.round(shiftAmount);

    suggestions.push({
      id: `opt-${worst.directive.id}-${best.directive.id}`,
      fromCampaign: worst.directive,
      toCampaign: best.directive,
      fromPlatform: worst.directive.platform,
      toPlatform: best.directive.platform,
      shiftAmount: roundedShift,
      ratio,
      message: `${worst.directive.platform} CPR is ${ratio}x higher than ${best.directive.platform}. Shift $${roundedShift} to improve ROI.`,
      impact: ratio >= 3 ? 'high' : ratio >= 2 ? 'medium' : 'low',
    });
  }

  return suggestions.sort((a, b) => b.ratio - a.ratio);
}
