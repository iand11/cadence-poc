// Turning an organic social post into a boost campaign draft. Shared by the
// Campaigns content feed and the artist profile's top posts, which hands the
// payload to CampaignsPage via router state ({ boost }).

// Content platform → ads platform for the boost CTA
export const ADS_PLATFORM_MAP = {
  instagram: 'meta',
  youtube: 'youtube',
  tiktok: 'tiktok',
  twitter: 'x',
};

/** Boost payload for CampaignsPage's handleBoostContent, or null if the platform can't be boosted. */
export function buildBoostPayload(item, analysis) {
  const adsPlatform = ADS_PLATFORM_MAP[item.platform];
  if (!adsPlatform) return null;

  const rationale = analysis?.reason
    ? `Organic content performing ${analysis.reason}. Auto-detected as boost candidate.`
    : `Boost organic ${item.contentType} from ${item.artistName}`;

  return {
    artistSlug: item.artistSlug,
    artistName: item.artistName,
    artistImage: item.artistImage,
    platform: adsPlatform,
    objective: 'engagement',
    rationale,
    creative: {
      type: item.contentType === 'video' ? 'video' : 'image',
      headline: item.title || '',
      description: '',
      callToAction: 'Listen Now',
      trackUrl: item.permalink || '',
      postId: item.platformId || null,
      postSource: item.platform || null,
      igUserId: item.platform === 'instagram' ? item.ownerPlatformId : null,
      pageId: item.platform === 'facebook' ? item.ownerPlatformId : null,
      imageUrl: item.thumbnailUrl || null,
    },
  };
}
