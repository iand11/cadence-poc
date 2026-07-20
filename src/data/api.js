// Stub API for demo — serves real social posts from social_posts.json
import socialPostsRaw from './social_posts.json';
import { allArtists, loadArtistDetail } from './artists';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Platform name mapping: social_posts uses 'instagram'/'tiktok'/'youtube',
// but DirectiveBuilder maps meta→instagram, google→youtube
const FEED_PLATFORM_MAP = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  twitter: 'twitter',
};

// Build a flat, normalized content feed from social_posts.json (once)
let _feedCache = null;
function buildFeed() {
  if (_feedCache) return _feedCache;

  const items = [];
  const rosterSlugs = new Set(allArtists.map(a => a.slug));
  const seen = new Set();
  for (const entry of socialPostsRaw) {
    const artistSlug = slugify(entry.name);
    if (!rosterSlugs.has(artistSlug)) continue;
    const artistData = allArtists.find(a => a.slug === artistSlug);

    for (const [platform, posts] of Object.entries(entry.posts)) {
      if (!FEED_PLATFORM_MAP[platform]) continue;

      for (const post of posts) {
        if (seen.has(post.post_id)) continue;
        seen.add(post.post_id);

        const stat = post.stat || {};
        items.push({
          id: post.post_id,
          artistId: artistData?.id || artistSlug,
          artistSlug,
          artistName: entry.name,
          artistImage: post.user_picture || artistData?.imageUrl || '',
          platform,
          contentType: post.type === 'video' ? 'video' : 'posts',
          title: post.title || post.text || '',
          thumbnailUrl: post.thumbnail || post.image || '',
          views: stat.views || stat.plays || 0,
          likes: stat.likes || 0,
          comments: stat.comments || 0,
          shares: stat.shares || 0,
          duration: post.duration || null,
          publishedAt: post.created || '',
          permalink: post.link || '',
          platformId: post.post_id,
          ownerPlatformId: post.user_id || '',
        });
      }
    }
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  _feedCache = items;
  return items;
}

// Compute per-artist per-platform per-type averages for boost detection
let _avgCache = null;
function buildAverages() {
  if (_avgCache) return _avgCache;
  const items = buildFeed();
  const map = {};
  for (const item of items) {
    if (!map[item.artistId]) map[item.artistId] = {};
    if (!map[item.artistId][item.platform]) map[item.artistId][item.platform] = {};
    const key = item.contentType;
    if (!map[item.artistId][item.platform][key]) {
      map[item.artistId][item.platform][key] = { totalViews: 0, totalEngagement: 0, count: 0 };
    }
    const b = map[item.artistId][item.platform][key];
    b.totalViews += item.views;
    b.totalEngagement += item.likes + item.comments + item.shares;
    b.count++;
  }
  for (const artistId in map) {
    for (const platform in map[artistId]) {
      for (const type in map[artistId][platform]) {
        const b = map[artistId][platform][type];
        map[artistId][platform][type] = {
          views: Math.round(b.totalViews / b.count),
          engagement: Math.round(b.totalEngagement / b.count),
          count: b.count,
        };
      }
    }
  }
  _avgCache = map;
  return map;
}

export const api = {
  getUserData(key) {
    return Promise.resolve(null);
  },

  setUserData(key, value) {
    return Promise.resolve();
  },

  getContentFeed({ platform, type, sort = 'recent', artist, artists, limit = 20, offset = 0 } = {}) {
    let items = buildFeed();

    if (platform) items = items.filter(i => i.platform === platform);
    if (type) items = items.filter(i => i.contentType === type);
    if (artist) items = items.filter(i => i.artistSlug === artist);
    else if (artists && artists.length) {
      const set = new Set(artists);
      items = items.filter(i => set.has(i.artistSlug));
    }

    if (sort === 'engagement') {
      items = [...items].sort((a, b) =>
        (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)
      );
    }

    const total = items.length;
    const page = items.slice(offset, offset + limit);

    return Promise.resolve({ items: page, artistAverages: buildAverages(), total });
  },

  getArtist(slug) {
    return loadArtistDetail(slug);
  },
};
