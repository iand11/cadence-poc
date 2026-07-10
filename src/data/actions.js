import { allArtists } from './artists';
import { generateInsights } from '../utils/insights';
import { generateSteps } from './actionSteps';

const PLATFORM_MAP = {
  streaming: 'spotify',
  geography: 'spotify',
  revenue: 'revenue',
};

const SOCIAL_KEYWORDS = {
  TikTok: 'tiktok',
  Instagram: 'instagram',
  YouTube: 'youtube',
  'Twitter/X': 'twitter',
  Twitter: 'twitter',
};

const PLAYLIST_KEYWORDS = {
  'Apple Music': 'apple',
};

function derivePlatform(dataType, text) {
  if (PLATFORM_MAP[dataType]) return PLATFORM_MAP[dataType];

  if (dataType === 'social') {
    for (const [keyword, platform] of Object.entries(SOCIAL_KEYWORDS)) {
      if (text.includes(keyword)) return platform;
    }
    return 'social';
  }

  if (dataType === 'playlists') {
    for (const [keyword, platform] of Object.entries(PLAYLIST_KEYWORDS)) {
      if (text.includes(keyword)) return platform;
    }
    return 'spotify';
  }

  return 'general';
}

const PRIORITY_WEIGHT = { warning: 3, info: 2, success: 1 };

let cached = null;

export function generateAllActions() {
  if (cached) return cached;

  const actions = [];
  const totalArtists = allArtists.length;

  for (const artist of allArtists) {
    const insights = generateInsights(artist);
    const rankBoost = (totalArtists - (artist.rank || totalArtists)) / totalArtists;

    for (const [dataType, items] of Object.entries(insights)) {
      items.forEach((insight, index) => {
        const platform = derivePlatform(dataType, insight.text);
        const actionItem = {
          id: `action-${artist.slug}-${dataType}-${index}`,
          artistSlug: artist.slug,
          artistName: artist.name,
          artistImage: artist.imageUrl,
          platform,
          dataType,
          insightType: insight.type,
          text: insight.text,
          action: insight.action,
          priority: (PRIORITY_WEIGHT[insight.type] || 1) + rankBoost,
          source: 'system',
        };
        actionItem.steps = generateSteps(actionItem);
        actions.push(actionItem);
      });
    }
  }

  actions.sort((a, b) => b.priority - a.priority);
  cached = actions;
  return actions;
}

export const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_COLORS = {
  high: '#C75F4F',
  medium: '#D4A574',
  low: '#7BAF73',
};

// Order used for sorting/grouping (high first)
export const PRIORITY_ORDER = ['high', 'medium', 'low'];

// Bucket the numeric priority score into a high/medium/low level.
// Scores combine insight severity (warning 3 / info 2 / success 1) with a rank boost (0–1),
// so warnings land in high, info in medium, and opportunities in low.
export function getPriorityLevel(action) {
  const p = action?.priority ?? 0;
  if (p >= 3) return 'high';
  if (p >= 2) return 'medium';
  return 'low';
}

export const DATA_TYPE_LABELS = {
  streaming: 'Streaming',
  social: 'Social',
  playlists: 'Playlists',
  geography: 'Geography',
  revenue: 'Revenue',
  general: 'General',
};

export const PLATFORM_LABELS = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  social: 'Social',
  revenue: 'Revenue',
  general: 'General',
};
