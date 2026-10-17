// Stream counts for stream-goal campaigns (/api/streams): a count per streaming service
// per day, from before the campaign until it ends. YouTube and Spotify are read daily;
// a Spotify count can also be entered by hand.
import { request } from './metaAds';

/** { id, title, startDate, endDate, sources: [{ service, externalId, url, auto, baseline, latest, gain, showGain, daily }], youtube } */
export const fetchStreamTracker = (id) => request(`/api/streams?id=${encodeURIComponent(id)}`);

/** Which of a smart link's services can be counted: { tracked: [{ service, url }], skipped: [{ service, reason }] } */
export const previewStreamSources = (linkSlug) => request(`/api/streams?preview=${encodeURIComponent(linkSlug)}`);

/** body: { id, linkSlug?, links?, title?, artistSlug?, artistName?, startDate, endDate } */
export const createStreamTracker = (body) => request('/api/streams', { method: 'POST', body: { action: 'create', ...body } });

export const addStreamSource = (id, url) => request('/api/streams', { method: 'POST', body: { action: 'add', id, url } });

export const recordStreamCount = (id, { service, externalId, day, count }) =>
  request('/api/streams', { method: 'POST', body: { action: 'count', id, service, externalId, day, count } });

export const refreshStreamTracker = (id) => request('/api/streams', { method: 'POST', body: { action: 'refresh', id } });

export const removeStreamSource = (id, service, externalId) =>
  request(`/api/streams?${new URLSearchParams({ id, service, externalId })}`, { method: 'DELETE' });

/** The smart link slug in a Prelude smart link URL (…/l/<slug>), or null. */
export function smartLinkSlug(url) {
  try {
    const m = new URL(url).pathname.match(/^\/l\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
