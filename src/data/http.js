// Shared GET cache for the read-only data APIs (/api/artists, /api/playlists, …).
//
//  * In-flight dedupe: components that ask for the same URL at the same time
//    share one request.
//  * Short-lived cache: going back to a page (or another widget asking for the
//    same data) is instant within `ttl`. After that the next call refetches.
//  * Bounded: least-recently-used entries are dropped past MAX_ENTRIES.
//  * Failed requests are never cached.
//
// The browser HTTP cache (Cache-Control max-age on the API) covers reloads;
// this covers navigation within a session without a network round trip.

const MAX_ENTRIES = 200;
const DEFAULT_TTL = 2 * 60_000;
const cache = new Map(); // url → { at, ttl, promise }

export function getJson(url, { ttl = DEFAULT_TTL } = {}) {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.at < hit.ttl) {
    // Re-insert to mark as most recently used.
    cache.delete(url);
    cache.set(url, hit);
    return hit.promise;
  }
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.json();
  });
  cache.set(url, { at: now, ttl, promise });
  promise.catch(() => { if (cache.get(url)?.promise === promise) cache.delete(url); });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return promise;
}

/** Drop cached responses whose URL starts with `prefix` (all when omitted). */
export function invalidate(prefix = '') {
  for (const url of cache.keys()) if (url.startsWith(prefix)) cache.delete(url);
}

/**
 * Query string from an options object. Skips empty values, joins arrays with
 * commas, and sorts `slugs` so the same artist set always maps to the same
 * URL (and cache entry) regardless of follow order.
 */
export function qs(opts) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    const value = Array.isArray(v) ? (k === 'slugs' ? [...v].sort() : v).join(',') : v === true ? '1' : String(v);
    params.set(k, value);
  }
  return params.toString();
}
