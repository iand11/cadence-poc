// Campaign metrics from real ad-platform reports. Only Meta reports delivery today
// (GET /api/campaign/meta-campaign); other platforms have no metrics, never simulated ones.

const RESULT_LABEL = 'Link Clicks';

function daysBetween(start, end) {
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Shapes a Meta campaign report ({ insights, daily, budget }) into
 * { daily, totals, resultLabel }. Null until Meta has delivery.
 */
export function metricsFromMetaReport(directive, report) {
  const ins = report?.insights;
  if (!ins) return null;

  const { startDate, endDate } = directive.schedule || {};
  const daysTotal = startDate && endDate ? daysBetween(startDate, endDate) : null;
  const today = new Date().toISOString().split('T')[0];
  const daysElapsed = daysTotal && startDate <= today
    ? Math.min(daysTotal, daysBetween(startDate, today < endDate ? today : endDate))
    : 0;

  // Meta's ad set budget wins over the saved one
  const amount = report.budget?.amount ?? directive.budget?.amount ?? 0;
  const period = report.budget?.period || directive.budget?.period;
  const budget = period === 'daily' && daysTotal ? amount * daysTotal : amount;

  const results = ins.linkClicks;
  return {
    daily: (report.daily || []).map(d => ({ date: d.date, spend: d.spend, results: d.linkClicks })),
    totals: {
      spend: round2(ins.spend),
      budget,
      impressions: ins.impressions,
      clicks: ins.linkClicks,
      results,
      avgCTR: round2(ins.linkCtr),
      costPerResult: results > 0 ? round2(ins.spend / results) : 0,
      budgetUsedPercent: budget > 0 ? Math.round((ins.spend / budget) * 1000) / 10 : 0,
      daysElapsed,
      daysTotal,
      daysRemaining: daysTotal ? Math.max(0, daysTotal - daysElapsed) : null,
    },
    resultLabel: RESULT_LABEL,
  };
}

/**
 * Aggregates campaigns that have real metrics.
 * `campaigns`: [{ directive, metrics }] where metrics came from metricsFromMetaReport.
 */
export function aggregateCampaignMetrics(campaigns) {
  campaigns = campaigns.filter(c => c.metrics?.totals);
  if (campaigns.length === 0) {
    return { campaigns: [], dailyTotal: [], dayAlignedTotal: [], platformBreakdown: [], totals: null };
  }

  // Combined timeline by calendar date
  const dateMap = {};
  for (const { directive, metrics } of campaigns) {
    for (const day of metrics.daily) {
      if (!dateMap[day.date]) dateMap[day.date] = { date: day.date, totalSpend: 0 };
      dateMap[day.date].totalSpend += day.spend;
      dateMap[day.date][directive.id] = (dateMap[day.date][directive.id] || 0) + day.spend;
    }
  }
  const dailyTotal = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  // Day-aligned timeline: Day 1 = each campaign's first day of delivery
  const dayMap = {};
  for (const { directive, metrics } of campaigns) {
    metrics.daily.forEach((day, i) => {
      const dayNum = i + 1;
      if (!dayMap[dayNum]) dayMap[dayNum] = { day: dayNum, label: `Day ${dayNum}`, totalSpend: 0 };
      dayMap[dayNum].totalSpend += day.spend;
      dayMap[dayNum][directive.id] = (dayMap[dayNum][directive.id] || 0) + day.spend;
    });
  }
  const dayAlignedTotal = Object.values(dayMap).sort((a, b) => a.day - b.day);

  const platformMap = {};
  for (const { directive, metrics } of campaigns) {
    const p = directive.platform;
    if (!platformMap[p]) {
      platformMap[p] = { platform: p, spend: 0, results: 0, impressions: 0, clicks: 0, campaigns: 0, budget: 0 };
    }
    const t = metrics.totals;
    platformMap[p].spend += t.spend;
    platformMap[p].results += t.results;
    platformMap[p].impressions += t.impressions;
    platformMap[p].clicks += t.clicks;
    platformMap[p].budget += t.budget;
    platformMap[p].campaigns += 1;
  }
  const platformBreakdown = Object.values(platformMap).map(p => ({
    ...p,
    costPerResult: p.results > 0 ? round2(p.spend / p.results) : 0,
    ctr: p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 100 : 0,
  }));

  const sum = (k) => campaigns.reduce((s, c) => s + (c.metrics.totals[k] || 0), 0);
  const totalSpend = sum('spend');
  const totalResults = sum('results');
  const totalImpressions = sum('impressions');
  const totalClicks = sum('clicks');

  return {
    campaigns,
    dailyTotal,
    dayAlignedTotal,
    platformBreakdown,
    totals: {
      spend: round2(totalSpend),
      budget: round2(sum('budget')),
      results: totalResults,
      impressions: totalImpressions,
      clicks: totalClicks,
      activeCampaigns: campaigns.filter(c => ['active', 'executing'].includes(c.directive.status)).length,
      avgCostPerResult: totalResults > 0 ? round2(totalSpend / totalResults) : 0,
      avgCTR: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
    },
  };
}
