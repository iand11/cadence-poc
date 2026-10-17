// Platform benchmark ranges (industry averages) used only for pre-launch estimates
const PLATFORM_PROFILES = {
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
