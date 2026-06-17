export const PLATFORM_OBJECTIVES = {
  spotify: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'streams', label: 'Drive Streams' },
  ],
  meta: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'conversions', label: 'Conversions' },
  ],
  google: [
    { key: 'awareness', label: 'Awareness (Performance Max)' },
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
  x: [
    { key: 'awareness', label: 'Brand Awareness' },
    { key: 'engagement', label: 'Engagement' },
  ],
};

export const PLATFORM_CONSTRAINTS = {
  spotify: { minBudget: null, authType: 'oauth2', notes: 'Spotify Ads API v3. Budget in USD.' },
  meta: { minBudget: 1, authType: 'oauth2', notes: 'Meta Marketing API. Budget stored in cents. Campaign → Ad Set → Ad hierarchy.' },
  google: { minBudget: null, authType: 'oauth2', notes: 'Google Ads API v24. Performance Max campaigns — Search only.' },
  youtube: { minBudget: null, authType: 'oauth2', notes: 'YouTube Video Ads via Google Ads API v24. Requires video file upload.' },
  tiktok: { minBudget: 500, authType: 'oauth2', notes: 'TikTok Marketing API. $500 minimum campaign budget. Supports Spark Ads.' },
  x: { minBudget: null, authType: 'oauth1a', notes: 'X Ads API. OAuth 1.0a. Requires approved developer account.' },
};

export const PLATFORM_LABELS = {
  spotify: 'Spotify',
  meta: 'Meta / Instagram',
  google: 'Google Search',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
};

export const CREATIVE_TYPES = {
  spotify: ['audio'],
  meta: ['image', 'video'],
  google: ['video', 'image'],
  youtube: ['video'],
  tiktok: ['video', 'spark'],
  x: ['image', 'video'],
};

export const OBJECTIVE_LABELS = {
  awareness: 'Brand Awareness',
  engagement: 'Engagement',
  conversions: 'Conversions',
  streams: 'Drive Streams',
};

export const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6B6560' },
  pending_approval: { label: 'Pending Approval', color: '#D4A574' },
  approved: { label: 'Approved', color: '#7BAF73' },
  executing: { label: 'Executing...', color: '#DA7756' },
  active: { label: 'Active', color: '#1DB954' },
  completed: { label: 'Completed', color: '#9B9590' },
  failed: { label: 'Failed', color: '#C75F4F' },
  rejected: { label: 'Rejected', color: '#C75F4F' },
};

const DIRECTIVE_TEMPLATES = {
  'spotify-streams': {
    objective: 'streams',
    budget: { amount: 500, currency: 'USD', period: 'lifetime' },
    audience: { locations: ['US'], ageRange: [18, 34], interests: [], lookalike: true },
    creative: { type: 'audio', headline: '', description: '', callToAction: 'Listen Now', trackUrl: '', postId: null },
  },
  'spotify-awareness': {
    objective: 'awareness',
    budget: { amount: 300, currency: 'USD', period: 'lifetime' },
    audience: { locations: ['US', 'UK'], ageRange: [18, 44], interests: [], lookalike: true },
    creative: { type: 'audio', headline: '', description: '', callToAction: 'Listen Now', trackUrl: '', postId: null },
  },
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
  'google-awareness': {
    objective: 'awareness',
    budget: { amount: 500, currency: 'USD', period: 'daily' },
    audience: { locations: ['US'], ageRange: [18, 44], interests: [], lookalike: false },
    creative: { type: 'video', headline: '', description: '', callToAction: 'Watch Now', trackUrl: '', postId: null },
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
  'x-engagement': {
    objective: 'engagement',
    budget: { amount: 200, currency: 'USD', period: 'daily' },
    audience: { locations: ['US'], ageRange: [18, 34], interests: [], lookalike: false },
    creative: { type: 'image', headline: '', description: '', callToAction: 'Listen Now', trackUrl: '', postId: null },
  },
};

function inferPlatformFromAction(action) {
  const p = action.platform;
  if (p === 'spotify') return 'spotify';
  if (p === 'instagram') return 'meta';
  if (p === 'youtube') return 'youtube';
  if (p === 'tiktok') return 'tiktok';
  if (p === 'twitter') return 'x';
  return 'spotify'; // default
}

function inferObjective(action, platform) {
  if (platform === 'spotify' && (action.dataType === 'streaming' || action.text?.toLowerCase().includes('stream'))) return 'streams';
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
