// Stream counts for stream-goal campaigns (/api/streams): a count per streaming service
// per day, from before the campaign until it ends. YouTube and Spotify are read daily;
// a Spotify count can also be entered by hand. The same trackers hold the artist's
// Instagram followers, TikTok followers and YouTube subscribers (FollowersPanel).
import { request } from './metaAds';

// unit: the count's name; perDay: what a day's change is; how: where the count comes from
export const SERVICE_INFO = {
  spotify: { unit: 'Plays', perDay: 'streams', how: 'Read daily from the Spotify page' },
  youtube: { unit: 'Views', perDay: 'views', how: 'Read daily from the YouTube API' },
  instagram: { unit: 'Followers', perDay: 'followers', how: 'Read daily', label: 'Instagram', color: '#E1306C' },
  tiktok: { unit: 'Followers', perDay: 'followers', how: 'Read daily from the TikTok page', label: 'TikTok', color: '#ff0050' },
  youtubeChannel: { unit: 'Subscribers', perDay: 'subscribers', how: 'Read daily from the YouTube API', label: 'YouTube', icon: 'youtube' },
};
export const STREAM_SERVICES = ['spotify', 'youtube'];

/** { id, title, startDate, endDate, sources: [{ service, externalId, url, auto, baseline, latest, gain, showGain, daily }], youtube } */
export const fetchStreamTracker = (id) => request(`/api/streams?id=${encodeURIComponent(id)}`);

/** Which of a smart link's services can be counted: { tracked: [{ service, url }], skipped: [{ service, reason }] } */
export const previewStreamSources = (linkSlug) => request(`/api/streams?preview=${encodeURIComponent(linkSlug)}`);

/** body: { id, linkSlug?, links?, title?, artistSlug?, artistName?, startDate, endDate, campaigns? (directives) } */
export const createStreamTracker = (body) => request('/api/streams', { method: 'POST', body: { action: 'create', ...body } });

export const addStreamSource = (id, url) => request('/api/streams', { method: 'POST', body: { action: 'add', id, url } });

export const recordStreamCount = (id, { service, externalId, day, count }) =>
  request('/api/streams', { method: 'POST', body: { action: 'count', id, service, externalId, day, count } });

/** Read the automatic counts now; `services` limits it (e.g. ['instagram', 'tiktok', 'youtubeChannel']). */
export const refreshStreamTracker = (id, services) => request('/api/streams', { method: 'POST', body: { action: 'refresh', id, services } });

/** Look up the artist's Instagram, TikTok and YouTube channel and read their followers. */
export const startFollowerTracking = (id) => request('/api/streams', { method: 'POST', body: { action: 'followers', id } });

/** Keep the campaigns' setup with the counts (for comparing results with how campaigns were run). */
export const saveStreamCampaigns = (id, campaigns) => request('/api/streams', { method: 'POST', body: { action: 'campaigns', id, campaigns } });

/** The Meta campaign a tracked campaign launched as; its daily report is then saved too. */
export const linkStreamMetaCampaign = (id, directiveId, campaignId) =>
  request('/api/streams', { method: 'POST', body: { action: 'meta', id, directiveId, campaignId } });

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
