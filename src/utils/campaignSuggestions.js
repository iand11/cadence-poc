import { generateInsights } from './insights';
import { generateDirective, PLATFORM_OBJECTIVES } from '../data/directives';
import { formatNumber } from './formatters';

const IMPACT_BY_TYPE = { warning: 'high', info: 'medium', success: 'low' };
const SORT_ORDER = { warning: 0, info: 1, success: 2 };

function formatAudience(audience) {
  if (!audience) return '';
  const parts = [];
  if (audience.ageRange) parts.push(`Ages ${audience.ageRange[0]}–${audience.ageRange[1]}`);
  if (audience.locations?.length) parts.push(audience.locations.join(', '));
  if (audience.lookalike) parts.push('Lookalike');
  return parts.join(' · ');
}

export function mapInsightToCampaign(insight, dataType, artist) {
  const text = insight.text.toLowerCase();
  const type = insight.type;

  // --- Streaming insights ---
  if (dataType === 'streaming') {
    // Low follower conversion
    if (text.includes('follower conversion') && type === 'warning') {
      return {
        title: 'Convert Listeners to Followers',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
          `${formatNumber(artist.spotify?.followers)} followers`,
          `${(artist.spotify?.followers / (artist.spotify?.monthlyListeners || 1) * 100).toFixed(1)}% conversion`,
        ],
      };
    }

    // Strong follower conversion
    if (text.includes('fan conversion') && type === 'success') {
      return {
        title: 'Accelerate Loyal Fanbase',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${(artist.spotify?.followers / (artist.spotify?.monthlyListeners || 1) * 100).toFixed(1)}% conversion rate`,
          `${formatNumber(artist.spotify?.followers)} loyal followers`,
        ],
      };
    }

    // Moderate fan conversion
    if (text.includes('fan conversion') && type === 'info') {
      return {
        title: 'Strengthen Listener Loyalty',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
          `${(artist.spotify?.followers / (artist.spotify?.monthlyListeners || 1) * 100).toFixed(1)}% conversion`,
        ],
      };
    }

    // Low popularity
    if (text.includes('popularity score') && type === 'warning') {
      return {
        title: 'Boost Discovery',
        platform: 'spotify',
        objective: 'awareness',
        dataPoints: [
          `Popularity: ${artist.spotify?.popularity}/100`,
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
        ],
      };
    }

    // Moderate or high popularity
    if (text.includes('popularity score') && (type === 'info' || type === 'success')) {
      return {
        title: 'Amplify Momentum',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `Popularity: ${artist.spotify?.popularity}/100`,
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
        ],
      };
    }
  }

  // --- Social insights ---
  if (dataType === 'social') {
    // Dominant platform — amplify the strongest channel
    if (text.includes('dominant social platform') && type === 'info') {
      const platformMap = [
        { name: 'tiktok', ad: 'tiktok', objective: 'engagement' },
        { name: 'instagram', ad: 'meta', objective: 'engagement' },
        { name: 'youtube', ad: 'youtube', objective: 'awareness' },
        { name: 'twitter/x', ad: 'x', objective: 'engagement' },
      ];
      const match = platformMap.find(p => text.includes(p.name));
      if (match) {
        return {
          title: `Amplify ${match.name === 'twitter/x' ? 'X' : match.name.charAt(0).toUpperCase() + match.name.slice(1)} Reach`,
          platform: match.ad,
          objective: match.objective,
          dataPoints: extractSocialDataPoints(artist, match.name === 'tiktok' ? 'TikTok' : match.name === 'instagram' ? 'Instagram' : match.name === 'youtube' ? 'YouTube' : 'Twitter/X'),
        };
      }
    }

    // Weak platform gap
    if (text.includes('underdeveloped') && type === 'warning') {
      const weakPlatforms = [
        { name: 'TikTok', ad: 'tiktok' },
        { name: 'Instagram', ad: 'meta' },
        { name: 'YouTube', ad: 'youtube' },
        { name: 'Twitter/X', ad: 'x' },
      ];
      for (const wp of weakPlatforms) {
        if (text.includes(`${wp.name.toLowerCase()} presence`)) {
          return {
            title: `Grow ${wp.name} Presence`,
            platform: wp.ad,
            objective: 'awareness',
            dataPoints: extractSocialDataPoints(artist, wp.name),
          };
        }
      }
    }

    // Low TikTok engagement
    if (text.includes('tiktok engagement is low') && type === 'warning') {
      return {
        title: 'Re-engage TikTok Audience',
        platform: 'tiktok',
        objective: 'engagement',
        dataPoints: [
          `${formatNumber(artist.social?.tiktok)} TikTok followers`,
          `${formatNumber(artist.social?.tiktokLikes)} total likes`,
        ],
      };
    }

    // Strong TikTok virality
    if (text.includes('tiktok posts use') && type === 'success') {
      return {
        title: 'Amplify TikTok Momentum',
        platform: 'tiktok',
        objective: 'engagement',
        dataPoints: [
          `${formatNumber(artist.social?.tiktokTrackPosts)} UGC posts`,
          `${formatNumber(artist.social?.tiktok)} followers`,
        ],
      };
    }

    // Exceptional TikTok engagement
    if (text.includes('exceptional tiktok engagement') && type === 'success') {
      return {
        title: 'Amplify TikTok Momentum',
        platform: 'tiktok',
        objective: 'engagement',
        dataPoints: [
          `${formatNumber(artist.social?.tiktokLikes)} total likes`,
          `${(artist.social?.tiktokLikes / (artist.social?.tiktok || 1)).toFixed(1)}x engagement ratio`,
        ],
      };
    }
  }

  // --- Playlist insights ---
  if (dataType === 'playlists') {
    // Editorial rate (any type)
    if (text.includes('editorial playlist rate') || text.includes('editorial placements out of')) {
      return {
        title: type === 'warning' ? 'Drive Playlist Traction' : 'Boost Playlist Reach',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${artist.playlists?.spotify?.editorial || 0} editorial playlists`,
          `${formatNumber(artist.playlists?.spotify?.total || 0)} total playlists`,
        ],
      };
    }

    // Reach efficiency
    if (text.includes('playlist reach efficiency')) {
      return {
        title: type === 'warning' ? 'Improve Playlist Quality' : 'Scale Playlist Strategy',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${formatNumber(artist.playlists?.spotify?.reach || 0)} playlist reach`,
          `${formatNumber(artist.playlists?.spotify?.total || 0)} total playlists`,
        ],
      };
    }

    // Apple Music gap
    if (text.includes('apple music editorial')) {
      return {
        title: 'Expand Apple Music Presence',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `${artist.playlists?.apple?.editorial || 0} Apple Music editorial`,
          `${artist.playlists?.spotify?.editorial || 0} Spotify editorial`,
        ],
      };
    }
  }

  // --- Geography insights ---
  if (dataType === 'geography') {
    // High concentration
    if (text.includes('geographic concentration') && type === 'warning') {
      const topCity = artist.spotify?.topCities?.[0];
      return {
        title: 'Expand to New Markets',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: topCity
          ? [`${topCity.city} dominates listenership`, `${formatNumber(topCity.listeners)} listeners in top city`]
          : ['High geographic concentration'],
      };
    }

    // Well-distributed audience
    if (text.includes('well-distributed audience') && type === 'success') {
      return {
        title: 'Activate Multi-Market Strategy',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `${artist.spotify?.topCities?.length || 0} cities tracked`,
          'Well-distributed audience',
        ],
      };
    }

    // Global reach
    if (text.includes('global reach') && type === 'success') {
      const countries = new Set(artist.spotify?.topCities?.map(c => c.country) || []);
      return {
        title: 'Scale International Growth',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `${countries.size} countries`,
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
        ],
      };
    }

    // Concentrated in few countries
    if (text.includes('concentrated in') && type === 'info') {
      return {
        title: 'Expand International Reach',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
          'Limited international presence',
        ],
      };
    }

    // Emerging market presence
    if (text.includes('emerging market') && (type === 'success' || type === 'info')) {
      return {
        title: type === 'success' ? 'Invest in Emerging Markets' : 'Enter Emerging Markets',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
          'Target: Brazil, Mexico, India, Indonesia',
        ],
      };
    }
  }

  // --- Revenue insights ---
  if (dataType === 'revenue') {
    // High Shazam
    if (text.includes('shazam count') && type === 'success') {
      return {
        title: 'Capitalize on Sync Discovery',
        platform: 'google',
        objective: 'awareness',
        dataPoints: [
          `${formatNumber(artist.engagement?.shazam || 0)} Shazam tags`,
          'High sync placement potential',
        ],
      };
    }

    // Revenue overview / streaming-dependent
    if (text.includes('estimated annual revenue') || text.includes('streaming-dependent')) {
      return {
        title: 'Diversify Revenue Streams',
        platform: 'spotify',
        objective: 'streams',
        dataPoints: [
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
          `Popularity: ${artist.spotify?.popularity}/100`,
        ],
      };
    }

    // Live revenue opportunity
    if (text.includes('live revenue potential')) {
      return {
        title: 'Drive Awareness for Live Events',
        platform: 'meta',
        objective: 'awareness',
        dataPoints: [
          `Popularity: ${artist.spotify?.popularity}/100`,
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
        ],
      };
    }

    // Sync licensing
    if (text.includes('sync licensing')) {
      return {
        title: 'Boost Sync Discoverability',
        platform: 'google',
        objective: 'awareness',
        dataPoints: [
          `${formatNumber(artist.engagement?.shazam || 0)} Shazam tags`,
          `${formatNumber(artist.spotify?.monthlyListeners)} monthly listeners`,
        ],
      };
    }
  }

  // --- Fallback: map dataType to a sensible default ---
  const fallbacks = {
    streaming: { title: 'Boost Streams', platform: 'spotify', objective: 'streams' },
    social: { title: 'Grow Social Following', platform: 'meta', objective: 'awareness' },
    playlists: { title: 'Increase Playlist Reach', platform: 'spotify', objective: 'streams' },
    geography: { title: 'Expand Audience Reach', platform: 'meta', objective: 'awareness' },
    revenue: { title: 'Drive Revenue Growth', platform: 'spotify', objective: 'streams' },
  };
  return fallbacks[dataType] || null;
}

function extractSocialDataPoints(artist, weakPlatformName) {
  const platforms = [
    { name: 'TikTok', value: artist.social?.tiktok || 0 },
    { name: 'Instagram', value: artist.social?.instagram || 0 },
    { name: 'YouTube', value: artist.social?.youtube || 0 },
    { name: 'Twitter/X', value: artist.social?.twitter || 0 },
  ].filter(p => p.value > 0);

  const sorted = [...platforms].sort((a, b) => b.value - a.value);
  const weak = platforms.find(p => p.name === weakPlatformName);
  const strongest = sorted[0];

  const points = [];
  if (weak) points.push(`${formatNumber(weak.value)} ${weakPlatformName} followers`);
  if (strongest && strongest.name !== weakPlatformName) {
    points.push(`${formatNumber(strongest.value)} on ${strongest.name}`);
  }
  return points;
}

export function generateCampaignSuggestions(artist) {
  if (!artist) return [];

  const insights = generateInsights(artist);
  const suggestions = [];
  let idCounter = 0;

  for (const [dataType, items] of Object.entries(insights)) {
    for (const insight of items) {
      const campaign = mapInsightToCampaign(insight, dataType, artist);
      if (!campaign) continue;

      // Verify the platform supports the objective
      const platformObjectives = PLATFORM_OBJECTIVES[campaign.platform];
      if (!platformObjectives?.some(o => o.key === campaign.objective)) continue;

      // Build a pre-filled action object for generateDirective
      const action = {
        id: `suggestion-${artist.slug}-${idCounter}`,
        artistSlug: artist.slug,
        artistName: artist.name,
        artistImage: artist.imageUrl,
        platform: campaign.platform,
        dataType,
        insightType: insight.type,
        text: insight.text,
        action: insight.action,
      };

      const directive = generateDirective(action, campaign.platform, {
        objective: campaign.objective,
      });

      suggestions.push({
        id: `suggestion-${artist.slug}-${dataType}-${idCounter++}`,
        title: campaign.title,
        platform: campaign.platform,
        objective: campaign.objective,
        impact: IMPACT_BY_TYPE[insight.type] || 'medium',
        insightType: insight.type,
        dataType,
        dataPoints: campaign.dataPoints,
        rationale: insight.text,
        action: insight.action,
        suggestedBudget: directive.budget?.amount || 500,
        suggestedAudience: formatAudience(directive.audience),
        directive,
      });
    }
  }

  // Sort: warnings first → info → success
  suggestions.sort((a, b) => (SORT_ORDER[a.insightType] ?? 1) - (SORT_ORDER[b.insightType] ?? 1));

  // Cap at 6
  return suggestions.slice(0, 6);
}
