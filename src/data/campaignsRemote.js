// Saved campaigns per account (/api/campaigns, Firebase-authed).
import { request } from './metaAds';

/** @returns {Promise<{campaigns: object[]}>} newest first */
export const fetchCampaigns = () => request('/api/campaigns');

export const putCampaign = (campaign) => request('/api/campaigns', { method: 'PUT', body: { campaign } });

/** Campaigns saved in this browser before they were stored per account. @returns {Promise<{added}>} */
export const importCampaigns = (campaigns) => request('/api/campaigns', { method: 'POST', body: { action: 'import', campaigns } });

export const removeCampaign = (id) => request(`/api/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
