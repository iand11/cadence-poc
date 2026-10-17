import { useEffect, useMemo, useState } from 'react';
import { fetchMetaCampaign } from '../data/metaAds';
import { metricsFromMetaReport } from '../data/campaignMetrics';

// Reports are shared across the list, dashboard and detail page for a minute
const TTL = 60_000;
const cache = new Map(); // campaignId → { at, promise }

function loadReport(campaignId) {
  const hit = cache.get(campaignId);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = fetchMetaCampaign(campaignId).catch(() => null);
  cache.set(campaignId, { at: Date.now(), promise });
  return promise;
}

/**
 * Real delivery metrics for campaigns running on an ad platform (Meta today).
 * Returns { metricsById, loading }; campaigns without a platform campaign get none.
 */
export function useCampaignReports(directives) {
  const live = useMemo(
    () => directives.filter(d => d.platform === 'meta' && d.platformCampaignId),
    [directives],
  );
  const key = live.map(d => d.platformCampaignId).join(',');
  const [reports, setReports] = useState({});
  const [loadedKey, setLoadedKey] = useState('');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(',');
    Promise.all(ids.map(loadReport)).then(results => {
      if (cancelled) return;
      setReports(Object.fromEntries(ids.map((id, i) => [id, results[i]])));
      setLoadedKey(key);
    });
    return () => { cancelled = true; };
  }, [key]);

  const metricsById = useMemo(() => {
    const out = {};
    for (const d of live) {
      const m = metricsFromMetaReport(d, reports[d.platformCampaignId]);
      if (m) out[d.id] = m;
    }
    return out;
  }, [live, reports]);

  return { metricsById, loading: !!key && loadedKey !== key };
}
