// Campaigns cover Instagram (via Meta), TikTok and YouTube only.
export const CAMPAIGN_PLATFORMS = ['meta', 'tiktok', 'youtube'];
export const isCampaignPlatform = (p) => CAMPAIGN_PLATFORMS.includes(p);

export const PLATFORM_OBJECTIVES = {
  meta: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'conversions', label: 'Conversions' },
  ],
  youtube: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'engagement', label: 'Engagement' },
  ],
  tiktok: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'conversions', label: 'Conversions' },
  ],
};

export const PLATFORM_CONSTRAINTS = {
  meta: { minBudget: 1, authType: 'oauth2', notes: 'Meta Marketing API. Budget stored in cents. Campaign → Ad Set → Ad hierarchy.' },
  youtube: { minBudget: null, authType: 'oauth2', notes: 'YouTube Video Ads via Google Ads API v24. Requires video file upload.' },
  tiktok: { minBudget: 500, authType: 'oauth2', notes: 'TikTok Marketing API. $500 minimum campaign budget. Supports Spark Ads.' },
};

export const PLATFORM_LABELS = {
  meta: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export const CREATIVE_TYPES = {
  meta: ['image', 'video'],
  youtube: ['video'],
  tiktok: ['video', 'spark'],
};

export const OBJECTIVE_LABELS = {
  awareness: 'Brand Awareness',
  engagement: 'Engagement',
  conversions: 'Conversions',
};

export const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6B6560' },
  pending_approval: { label: 'Pending Approval', color: '#D4A574' },
  approved: { label: 'Approved', color: '#7BAF73' },
  executing: { label: 'Executing...', color: '#DA7756' },
  paused: { label: 'Paused on Meta', color: '#D4A574' },
  active: { label: 'Active', color: '#1DB954' },
  completed: { label: 'Completed', color: '#9B9590' },
  failed: { label: 'Failed', color: '#C75F4F' },
  rejected: { label: 'Rejected', color: '#C75F4F' },
};

const DIRECTIVE_TEMPLATES = {
  'meta-engagement': {
    objective: 'engagement',
    budget: { amount: 200, currency: 'USD', period: 'daily' },
    audience: { locations: ['US'], ageRange: [18, 34], interests: [], lookalike: true },
    creative: { type: 'video', headline: '', description: '', callToAction: 'Learn More', trackUrl: '', postId: null },
  },
  'meta-awareness': {
    objective: 'awareness',
    budget: { amount: 300, currency: 'USD', period: 'daily' },
    audience: { locations: ['US', 'UK'], ageRange: [18, 44], interests: [], lookalike: false },
    creative: { type: 'image', headline: '', description: '', callToAction: 'Learn More', trackUrl: '', postId: null },
  },
  'youtube-engagement': {
    objective: 'engagement',
    budget: { amount: 100, currency: 'USD', period: 'daily' },
    audience: { locations: ['US'], ageRange: [18, 34], interests: [], lookalike: false },
    creative: { type: 'video', headline: '', description: '', trackUrl: '', postId: null },
  },
  'youtube-awareness': {
    objective: 'awareness',
    budget: { amount: 200, currency: 'USD', period: 'daily' },
    audience: { locations: ['US', 'UK'], ageRange: [18, 44], interests: [], lookalike: false },
    creative: { type: 'video', headline: '', description: '', trackUrl: '', postId: null },
  },
  'tiktok-engagement': {
    objective: 'engagement',
    budget: { amount: 500, currency: 'USD', period: 'lifetime' },
    audience: { locations: ['US'], ageRange: [18, 24], interests: [], lookalike: true },
    creative: { type: 'spark', headline: '', description: '', callToAction: 'Listen Now', trackUrl: '', postId: null },
  },
  'tiktok-awareness': {
    objective: 'awareness',
    budget: { amount: 500, currency: 'USD', period: 'lifetime' },
    audience: { locations: ['US', 'UK'], ageRange: [18, 34], interests: [], lookalike: false },
    creative: { type: 'video', headline: '', description: '', callToAction: 'Learn More', trackUrl: '', postId: null },
  },
};

function inferPlatformFromAction(action) {
  const p = action.platform;
  if (p === 'youtube') return 'youtube';
  if (p === 'tiktok') return 'tiktok';
  return 'meta'; // Instagram, and the default
}

function inferObjective(action, platform) {
  if (action.insightType === 'warning' || action.insightType === 'danger') return 'awareness';
  if (action.dataType === 'social') return 'engagement';
  const objectives = PLATFORM_OBJECTIVES[platform];
  return objectives?.[0]?.key || 'awareness';
}

function buildRationale(action) {
  const parts = [];
  if (action.text) parts.push(action.text);
  if (action.action) parts.push(`Recommended action: ${action.action}`);
  return parts.join(' ') || '';
}

export function generateDirective(action, platform, options = {}) {
  const p = platform || inferPlatformFromAction(action);
  const objective = options.objective || inferObjective(action, p);
  const templateKey = `${p}-${objective}`;
  const template = DIRECTIVE_TEMPLATES[templateKey] || DIRECTIVE_TEMPLATES[`${p}-${PLATFORM_OBJECTIVES[p]?.[0]?.key}`] || {};

  const today = new Date();
  const startDate = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0];
  const endDate = new Date(today.getTime() + 17 * 86400000).toISOString().split('T')[0];

  return {
    id: `dir-${Date.now()}`,
    actionId: action?.id || null,
    artistSlug: action?.artistSlug || options.artistSlug || '',
    artistName: action?.artistName || options.artistName || '',
    artistImage: action?.artistImage || options.artistImage || null,
    platform: p,
    status: 'draft',
    objective: template.objective || objective,
    budget: { ...template.budget, ...(options.budget || {}) },
    schedule: { startDate, endDate, ...(options.schedule || {}) },
    audience: { ...template.audience, ...(options.audience || {}) },
    creative: { ...template.creative, ...(options.creative || {}) },
    rationale: options.rationale || buildRationale(action || {}),
    result: null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
  };
}
