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

/** Spotify fans a link captured: { fans: [{ name, email, country, product, followed, saved, topArtists, campaign, fromAd, createdAt }] } */
export const fetchLinkFans = (slug) => request(`/api/links?fans=${encodeURIComponent(slug)}`);

/** Who visits a link: { totals, countries, cities, sources, apps, devices, os, models, languages, byHour, recent } */

/** Pull the latest Spotify plays for a link's fans now (normally a daily job). */
export const fetchFanPlays = (slug, fan) => request(`/api/links?plays=${encodeURIComponent(slug)}&fan=${encodeURIComponent(fan)}`);
export const syncLinkFans = (slug) => request('/api/links', { method: 'POST', body: { action: 'sync', slug } });

/** Meta Pixels in the user's assigned ad accounts. */
export const fetchPixels = () => request('/api/links?pixels=1');

/** Find a release on every service without creating a link: { title, artistName, imageUrl, links: [{ service, url }] } */
export const lookupSmartLinks = (sourceUrl) => request('/api/links', { method: 'POST', body: { action: 'lookup', sourceUrl } });

/** A followed artist's streaming pages from the catalog, same shape as lookupSmartLinks. */
export const artistPageSmartLinks = (artistSlug) => request('/api/links', { method: 'POST', body: { action: 'artist', artistSlug } });

/** body: { sourceUrl, artistSlug?, artistName?, title?, imageUrl?, links?, pixelId?, fanCapture? } */
export const createSmartLink = (body) => request('/api/links', { method: 'POST', body });

/** { service: url } → [{ service, url }] with empty rows dropped, for createSmartLink. */
export const linksList = (links) => Object.entries(links).filter(([, url]) => url.trim()).map(([service, url]) => ({ service, url: url.trim() }));

/** [{ service, url }] → { service: url } */
export const linksMap = (list) => Object.fromEntries((list || []).map(l => [l.service, l.url]));

/** "Found "Hey Ya!" by Outkast on 3 services…" for a lookup result (an artist page has no title). */
export function foundSummary(release, n) {
  const what = release?.title ? `"${release.title}"${release.artistName ? ` by ${release.artistName}` : ''} `
    : release?.artistName ? `${release.artistName}'s artist page ` : '';
  return `Found ${what}on ${n} service${n === 1 ? '' : 's'}. Check the links, then add any that are missing.`;
}

/** A link's name for lists: its title, else the artist (titles are optional). */
export const linkTitle = (l) => l?.title || l?.artistName || 'Untitled link';

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
