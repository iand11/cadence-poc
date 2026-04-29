// Seeded random for consistent procedural data
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- Social Metrics (current snapshot) ---
export const socialMetrics = {
  tiktok: {
    followers: 4820000,
    growth: 18.4,
    engagementRate: 8.7,
    postsThisMonth: 24,
  },
  instagram: {
    followers: 2310000,
    growth: 6.2,
    engagementRate: 4.3,
    postsThisMonth: 18,
  },
  twitter: {
    followers: 890000,
    growth: 3.1,
    engagementRate: 2.8,
    postsThisMonth: 42,
  },
  youtube: {
    followers: 1640000,
    growth: 9.7,
    engagementRate: 6.1,
    postsThisMonth: 6,
  },
};

// --- Social Timeline (90 days of follower snapshots) ---
function generateSocialTimeline() {
  const startDate = new Date('2025-01-15');
  const days = 90;

  const platforms = {
    tiktok: { base: 3200000, growthRate: 0.50 },
    instagram: { base: 2040000, growthRate: 0.13 },
    twitter: { base: 840000, growthRate: 0.06 },
    youtube: { base: 1380000, growthRate: 0.19 },
  };

  const timeline = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const entry = { date: dateStr };

    Object.keys(platforms).forEach((platform, pIdx) => {
      const { base, growthRate } = platforms[platform];
      const trend = 1 + growthRate * (i / days);
      const noise = 1 + (seededRandom(i * 11 + pIdx * 97 + 7) - 0.5) * 0.03;
      entry[platform] = Math.round(base * trend * noise);
    });

    timeline.push(entry);
  }

  return timeline;
}

export const socialTimeline = generateSocialTimeline();

// --- Viral Posts ---
export const viralPosts = [
  {
    platform: 'TikTok',
    content: '"Glass Cathedral" choreography trend — user-generated dance goes viral after @dancewithkai posts tutorial',
    views: 48200000,
    date: '2025-03-28',
    engagementRate: 12.4,
    soundUses: 284000,
  },
  {
    platform: 'TikTok',
    content: '"Midnight Frequency" used as audio in 30-second transition trend — creators syncing outfit changes to the drop',
    views: 31600000,
    date: '2025-02-14',
    engagementRate: 9.8,
    soundUses: 176000,
  },
  {
    platform: 'Instagram',
    content: 'Behind-the-scenes Reel of "Neon Pulse" music video shoot — raw, unfiltered studio footage with the band',
    views: 8900000,
    date: '2025-03-05',
    engagementRate: 7.2,
    soundUses: null,
  },
  {
    platform: 'YouTube',
    content: '"Velvet Thunder" official music video premiere — cinematic sci-fi narrative directed by Hiro Murai',
    views: 22400000,
    date: '2025-01-22',
    engagementRate: 6.8,
    soundUses: null,
  },
  {
    platform: 'Twitter',
    content: 'Luna Vega tweets "the album is lying to you" — cryptic message sparks fan theory thread with 14K quote tweets',
    views: 5200000,
    date: '2025-03-18',
    engagementRate: 11.3,
    soundUses: null,
  },
];
