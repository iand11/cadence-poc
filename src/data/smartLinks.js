// Smart links (/api/links): Prelude landing pages with a button per streaming
// service. Views and clicks are tracked per link and per campaign.
import { request } from './metaAds';

/** @returns {Promise<{links: Array<{slug, url, title, artistName, links, pixelId, views, clicks}>}>} */
export const fetchSmartLinks = () => request('/api/links');

/** @returns {Promise<{link, stats: {views, clicks, adClicks, clickRate, byService}, daily, byCampaign}>} */
export const fetchSmartLink = (slug) => request(`/api/links?slug=${encodeURIComponent(slug)}`);

/** Streaming clicks for one Prelude campaign (directive id). */
export const fetchCampaignLinkStats = (campaignId) =>
  request(`/api/links?campaign=${encodeURIComponent(campaignId)}`);

/** Meta Pixels in the user's assigned ad accounts. */
export const fetchPixels = () => request('/api/links?pixels=1');

/** body: { sourceUrl, artistSlug?, artistName?, title?, imageUrl?, links?, pixelId? } */
export const createSmartLink = (body) => request('/api/links', { method: 'POST', body });

export const updateSmartLink = (slug, patch) =>
  request('/api/links', { method: 'PATCH', body: { slug, ...patch } });

export const deleteSmartLink = (slug) =>
  request(`/api/links?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });

export const SERVICE_LABELS = {
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  youtubeMusic: 'YouTube Music',
  youtube: 'YouTube',
  amazonMusic: 'Amazon Music',
  deezer: 'Deezer',
  tidal: 'TIDAL',
  soundcloud: 'SoundCloud',
  pandora: 'Pandora',
};

export const SERVICE_COLORS = {
  spotify: '#1DB954',
  appleMusic: '#FA243C',
  youtubeMusic: '#FF0000',
  youtube: '#FF0000',
  amazonMusic: '#25D1DA',
  deezer: '#A238FF',
  tidal: '#F5F0E8',
  soundcloud: '#FF5500',
  pandora: '#3668FF',
};
