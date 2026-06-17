import { PLATFORM_PROFILES } from '../data/campaignMetrics';
import { PLATFORM_LABELS } from '../data/directives';

/**
 * Forecast expected campaign metrics for a single platform.
 * Uses midpoint of PLATFORM_PROFILES ranges for deterministic estimates.
 */
export function forecastCampaign(platform, budget, durationDays) {
  const profile = PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.meta;
  const days = Math.max(1, durationDays);

  const cpm = (profile.cpmRange[0] + profile.cpmRange[1]) / 2;
  const ctr = (profile.ctrRange[0] + profile.ctrRange[1]) / 2;
  const convRate = (profile.conversionRate[0] + profile.conversionRate[1]) / 2;

  const impressions = Math.round((budget / cpm) * 1000);
  const clicks = Math.round(impressions * (ctr / 100));
  const results = Math.max(1, Math.round(clicks * convRate));
  const costPerResult = results > 0 ? Math.round((budget / results) * 100) / 100 : 0;

  return {
    platform,
    platformLabel: PLATFORM_LABELS[platform] || platform,
    budget: Math.round(budget * 100) / 100,
    impressions,
    clicks,
    results,
    costPerResult,
    ctr: Math.round(ctr * 100) / 100,
    resultLabel: profile.resultLabel,
    resultType: profile.resultType,
    dailyBudget: Math.round((budget / days) * 100) / 100,
  };
}

/**
 * Forecast metrics across multiple platforms.
 * @param {Array<{platform: string, amount: number}>} allocations
 * @param {number} durationDays
 */
export function forecastMultiPlatform(allocations, durationDays) {
  const forecasts = allocations
    .filter(a => a.amount > 0)
    .map(a => forecastCampaign(a.platform, a.amount, durationDays));

  const totals = {
    budget: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
  };

  for (const f of forecasts) {
    totals.budget += f.budget;
    totals.impressions += f.impressions;
    totals.clicks += f.clicks;
    totals.results += f.results;
  }

  totals.budget = Math.round(totals.budget * 100) / 100;
  totals.costPerResult = totals.results > 0
    ? Math.round((totals.budget / totals.results) * 100) / 100
    : 0;
  totals.ctr = totals.impressions > 0
    ? Math.round((totals.clicks / totals.impressions) * 10000) / 100
    : 0;

  return { forecasts, totals };
}
