// Small in-process TTL cache for expensive, slow-changing query results
// (facet counts, catalog totals, slug → id lookups). Lives for the life of
// the server process / warm serverless instance; concurrent callers for the
// same key share one in-flight promise. Failures are never cached.

const store = new Map(); // key → { at, ttl, promise }
const MAX_ENTRIES = 500;

export function cached(key, ttlMs, load) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.promise;
  const promise = Promise.resolve().then(load);
  store.set(key, { at: now, ttl: ttlMs, promise });
  promise.catch(() => { if (store.get(key)?.promise === promise) store.delete(key); });
  if (store.size > MAX_ENTRIES) {
    for (const [k, v] of store) {
      if (now - v.at >= v.ttl || store.size > MAX_ENTRIES) store.delete(k);
      if (store.size <= MAX_ENTRIES * 0.8) break;
    }
  }
  return promise;
}
