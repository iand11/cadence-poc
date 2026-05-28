// Step templates keyed by dataType + insightType pattern.
// Each step has a category: 'tactical' | 'playbook' | 'assignment'
// Templates use {artist}, {platform}, {weakPlatform}, {strongPlatform} placeholders.

const STEP_TEMPLATES = {
  // ── Streaming ──────────────────────────────────────────
  'streaming:success:conversion': [
    { text: 'Set up pre-save campaign for the next release using Spotify fan-first access', category: 'tactical' },
    { text: 'Create exclusive content drops (demos, acoustic versions) for followers only', category: 'playbook' },
    { text: 'Marketing: Build D2C landing page for merch + ticket bundles to monetize loyal base', category: 'assignment' },
    { text: 'Launch fan-first ticket allocation via Spotify Fans First for upcoming shows', category: 'playbook' },
  ],
  'streaming:info:conversion': [
    { text: 'Add animated Spotify Canvas to top 5 tracks with follow CTA', category: 'tactical' },
    { text: 'Run Spotify Marquee campaign targeting playlist listeners who haven\'t followed', category: 'playbook' },
    { text: 'Social team: Post weekly "follow on Spotify" Stories with direct link sticker', category: 'assignment' },
    { text: 'Add "Follow {artist} on Spotify" link in playlist bio submissions', category: 'tactical' },
  ],
  'streaming:warning:conversion': [
    { text: 'Audit and optimize Spotify artist profile: bio, images, Canvas, and pinned content', category: 'tactical' },
    { text: 'Run Marquee + Showcase ads targeting playlist-sourced listeners', category: 'playbook' },
    { text: 'Social team: Create "follow on Spotify" CTA template for all social posts', category: 'assignment' },
    { text: 'Add follow prompts to playlist pitch narratives submitted via Spotify for Artists', category: 'tactical' },
    { text: 'Marketing: Allocate budget for a 2-week follower conversion ad campaign', category: 'assignment' },
  ],
  'streaming:success:popularity': [
    { text: 'Plan single releases every 4-6 weeks to maintain algorithmic velocity', category: 'tactical' },
    { text: 'Submit to Spotify editorial 10+ days pre-release with performance data', category: 'playbook' },
    { text: 'A&R: Identify collaboration partners in adjacent genres to expand algorithmic reach', category: 'assignment' },
    { text: 'Test Release Radar and Discover Weekly performance for each single', category: 'playbook' },
  ],
  'streaming:info:popularity': [
    { text: 'Submit next release to Spotify editorial with compelling artist narrative and social proof', category: 'tactical' },
    { text: 'Target features with higher-popularity artists to boost algorithmic signals', category: 'playbook' },
    { text: 'Marketing: Compile press coverage and social metrics for playlist pitch deck', category: 'assignment' },
    { text: 'A&R: Schedule collaborative single with artist ranked 20+ spots higher', category: 'assignment' },
  ],
  'streaming:warning:popularity': [
    { text: 'Pitch to 10+ third-party playlist curators in the artist\'s genre', category: 'tactical' },
    { text: 'Launch TikTok sound seeding campaign with 50 mid-tier creators', category: 'playbook' },
    { text: 'Social team: Run 2-week influencer seeding push to create algorithmic spike', category: 'assignment' },
    { text: 'Marketing: Allocate $2K test budget for Spotify Ad Studio discovery campaign', category: 'assignment' },
    { text: 'Identify 3-5 trending TikTok audio hooks that match the artist\'s sound', category: 'tactical' },
  ],

  // ── Social ──────────────────────────────────────────────
  'social:info:dominant': [
    { text: 'Audit top 10 performing posts on {strongPlatform} and identify repeatable formats', category: 'tactical' },
    { text: 'Create content calendar with 4-5 posts/week on {strongPlatform}', category: 'playbook' },
    { text: 'Social team: Use {strongPlatform} as primary channel for all announcements and teasers', category: 'assignment' },
    { text: 'Set up {strongPlatform} analytics dashboard to track engagement weekly', category: 'playbook' },
  ],
  'social:warning:underdeveloped': [
    { text: 'Cross-promote {weakPlatform} handle in {strongPlatform} bio and weekly Stories/posts', category: 'tactical' },
    { text: 'Set up {weakPlatform} Ads account and allocate $500/month test budget', category: 'playbook' },
    { text: 'Social team: Draft 30-day {weakPlatform} content calendar with platform-native formats', category: 'assignment' },
    { text: 'PR: Pitch {weakPlatform}-exclusive content or interview to drive follows', category: 'assignment' },
    { text: 'Repurpose top 5 {strongPlatform} posts into {weakPlatform}-native format', category: 'tactical' },
  ],
  'social:success:tiktok_engagement': [
    { text: 'Identify top 5 content formats driving engagement and create repeatable templates', category: 'tactical' },
    { text: 'Launch sound-based campaign to convert TikTok virality into Spotify streams', category: 'playbook' },
    { text: 'Social team: Compile weekly TikTok engagement report tracking top-performing content', category: 'assignment' },
    { text: 'Seed next release audio to 100 TikTok creators with suggested clip moments', category: 'tactical' },
  ],
  'social:warning:tiktok_engagement': [
    { text: 'Test 3-5 new content formats: behind-the-scenes, duet challenges, trending hooks', category: 'tactical' },
    { text: 'Increase posting cadence to 4-5x/week with A/B testing on post times', category: 'playbook' },
    { text: 'Social team: Research top 10 trending audio hooks and create artist versions', category: 'assignment' },
    { text: 'Marketing: Allocate budget for TikTok creator partnerships to re-engage algorithm', category: 'assignment' },
  ],
  'social:success:virality': [
    { text: 'Seed next single to 50-100 mid-tier TikTok creators with suggested clip moments', category: 'tactical' },
    { text: 'Create official sound page and branded hashtag challenge for the track', category: 'playbook' },
    { text: 'Marketing: Fast-track UGC compilation ad creative using top fan-made videos', category: 'assignment' },
    { text: 'Social team: Engage with top 20 creator videos using the sound (comment, duet)', category: 'assignment' },
  ],

  // ── Playlists ──────────────────────────────────────────
  'playlists:success:editorial': [
    { text: 'Submit next release 10+ days early with updated artist narrative and tour dates', category: 'tactical' },
    { text: 'Track which editorial playlists drive the most streams and build retention strategy', category: 'playbook' },
    { text: 'Marketing: Prepare Spotify for Artists pitch deck with editorial placement history', category: 'assignment' },
    { text: 'Build personal relationship with assigned Spotify editor via label contacts', category: 'tactical' },
  ],
  'playlists:warning:editorial': [
    { text: 'Submit via Spotify for Artists 7+ days before release with press, social proof, tour dates', category: 'tactical' },
    { text: 'Hire playlist PR specialist to pitch alongside label submissions', category: 'playbook' },
    { text: 'Marketing: Create one-sheet with streaming data, press highlights, and audience demo', category: 'assignment' },
    { text: 'PR: Secure 2-3 press features timed with release to strengthen editorial pitch', category: 'assignment' },
    { text: 'Target mood-based and activity-based playlists, not just genre playlists', category: 'tactical' },
  ],
  'playlists:info:editorial': [
    { text: 'Explore underrepresented playlist categories: workout, focus, chill, cooking', category: 'tactical' },
    { text: 'Time next release to align with seasonal editorial moments (summer, holiday)', category: 'playbook' },
    { text: 'Marketing: Research which editorial playlists competitors appear on but artist doesn\'t', category: 'assignment' },
  ],
  'playlists:success:reach': [
    { text: 'Identify top 5 playlists by stream contribution and track position weekly', category: 'tactical' },
    { text: 'Build release strategy around maintaining placement on high-traffic lists', category: 'playbook' },
    { text: 'Marketing: Create playlist performance dashboard tracking adds, removes, and position', category: 'assignment' },
  ],
  'playlists:warning:reach': [
    { text: 'Audit current placements and remove low-traffic playlist pitches from strategy', category: 'tactical' },
    { text: 'Focus on 10 high-reach target playlists rather than 50 low-reach ones', category: 'playbook' },
    { text: 'Marketing: Subscribe to playlist analytics tool (Chartmetric/Soundcharts) for targeting', category: 'assignment' },
    { text: 'Use playlist pitching service specializing in editorial and algorithmic placements', category: 'tactical' },
  ],
  'playlists:warning:apple': [
    { text: 'Register on Apple Music for Artists and submit profile/editorial content', category: 'tactical' },
    { text: 'Connect with distributor\'s Apple Music editorial contacts for pitch support', category: 'playbook' },
    { text: 'Marketing: Create Apple Music-specific pitch deck highlighting older/premium audience', category: 'assignment' },
    { text: 'PR: Target Apple Music editorial blogs and curators with upcoming release', category: 'assignment' },
  ],

  // ── Geography ──────────────────────────────────────────
  'geography:warning:concentration': [
    { text: 'Launch geo-targeted Spotify ad campaigns in top 3 secondary markets', category: 'tactical' },
    { text: 'Pitch to local editorial playlists in 5 underrepresented cities', category: 'playbook' },
    { text: 'Marketing: Allocate 30% of ad budget to geographic diversification campaigns', category: 'assignment' },
    { text: 'Social team: Create location-tagged content for emerging markets', category: 'assignment' },
  ],
  'geography:success:diversity': [
    { text: 'Plan multi-city tour routing based on listener concentration data', category: 'tactical' },
    { text: 'Create region-specific social content (local references, language, culture)', category: 'playbook' },
    { text: 'Touring: Price and hold dates for top 8 listener cities', category: 'assignment' },
    { text: 'PR: Build city-specific press lists for each major market', category: 'assignment' },
  ],
  'geography:success:global': [
    { text: 'Translate social media bios and key posts for top 3 international markets', category: 'tactical' },
    { text: 'Partner with local influencers in top international cities for cross-promotion', category: 'playbook' },
    { text: 'Marketing: Research local playlist curators and press contacts in each country', category: 'assignment' },
    { text: 'Licensing: Explore sub-publishing deals in territories with strong listener base', category: 'assignment' },
  ],
  'geography:info:limited': [
    { text: 'Run test Spotify ad campaigns in 2 emerging markets (Brazil, Mexico, India)', category: 'tactical' },
    { text: 'Add translated metadata (song descriptions, bios) for target international markets', category: 'playbook' },
    { text: 'A&R: Identify collaboration opportunity with artist from target market', category: 'assignment' },
  ],
  'geography:success:emerging': [
    { text: 'Invest in local playlist pitching for top emerging market cities', category: 'tactical' },
    { text: 'Set up social media presence on regional platforms (e.g. VK, Line, Weibo)', category: 'playbook' },
    { text: 'Touring: Research festival opportunities in emerging market countries', category: 'assignment' },
    { text: 'Marketing: Allocate dedicated budget for emerging market growth campaigns', category: 'assignment' },
  ],
  'geography:info:emerging': [
    { text: 'Run $500 test Spotify ad campaign in Brazil and Mexico targeting genre fans', category: 'tactical' },
    { text: 'Collaborate with artist from target emerging market to test audience crossover', category: 'playbook' },
    { text: 'Marketing: Research streaming trends and platform preferences in top 3 emerging markets', category: 'assignment' },
  ],

  // ── Revenue ────────────────────────────────────────────
  'revenue:info:overview': [
    { text: 'Audit current revenue split and identify the single largest growth opportunity', category: 'tactical' },
    { text: 'Set up quarterly revenue review cadence with management team', category: 'playbook' },
    { text: 'Finance: Build 12-month revenue projection model with scenario analysis', category: 'assignment' },
    { text: 'Mgmt: Evaluate current distribution deal terms against market benchmarks', category: 'assignment' },
  ],
  'revenue:warning:live': [
    { text: 'Research festival submission deadlines for the next 6 months', category: 'tactical' },
    { text: 'Book 3-5 headline shows in cities with highest listener concentration', category: 'playbook' },
    { text: 'Touring: Get quotes from 2-3 booking agents for support slot opportunities', category: 'assignment' },
    { text: 'Mgmt: Evaluate live revenue potential — target 2-3x streaming revenue within 12 months', category: 'assignment' },
    { text: 'Marketing: Create live show announcement strategy tied to Spotify listening data', category: 'assignment' },
  ],
  'revenue:success:sync': [
    { text: 'Pitch top 5 Shazam-performing tracks to sync agencies with one-sheet', category: 'tactical' },
    { text: 'Create instrumental and clean versions of high-Shazam tracks for sync readiness', category: 'playbook' },
    { text: 'Licensing: Register catalog with 3+ sync placement agencies', category: 'assignment' },
    { text: 'A&R: Brief upcoming releases with sync potential in mind (tempo, mood, lyric themes)', category: 'assignment' },
  ],
  'revenue:info:sync': [
    { text: 'Ensure full catalog is registered with sync licensing agencies and libraries', category: 'tactical' },
    { text: 'Create instrumental, clean, and stems versions for top 10 catalog tracks', category: 'playbook' },
    { text: 'A&R: Write 2-3 tracks specifically targeting TV/film sync briefs', category: 'assignment' },
    { text: 'Licensing: Attend sync networking events or submit to Music Supervisors Collective', category: 'assignment' },
  ],
};

// Maps insight content patterns to template keys
function getTemplateKey(action) {
  const { dataType, insightType, text } = action;

  if (dataType === 'streaming') {
    if (text.includes('conversion') || text.includes('follower')) {
      return `streaming:${insightType}:conversion`;
    }
    if (text.includes('opularity')) {
      return `streaming:${insightType}:popularity`;
    }
  }

  if (dataType === 'social') {
    if (text.includes('underdeveloped') || text.includes('significantly')) {
      return 'social:warning:underdeveloped';
    }
    if (text.includes('dominant') || text.includes('is the dominant')) {
      return 'social:info:dominant';
    }
    if (text.includes('Exceptional TikTok')) {
      return 'social:success:tiktok_engagement';
    }
    if (text.includes('TikTok engagement is low')) {
      return 'social:warning:tiktok_engagement';
    }
    if (text.includes('posts use this artist')) {
      return 'social:success:virality';
    }
  }

  if (dataType === 'playlists') {
    if (text.includes('Apple Music')) {
      return 'playlists:warning:apple';
    }
    if (text.includes('ditorial playlist rate')) {
      return `playlists:${insightType}:editorial`;
    }
    if (text.includes('reach efficiency') || text.includes('Reach')) {
      return `playlists:${insightType}:reach`;
    }
  }

  if (dataType === 'geography') {
    if (text.includes('concentration') || text.includes('Heavy reliance')) {
      return 'geography:warning:concentration';
    }
    if (text.includes('Well-distributed') || text.includes('diversity')) {
      return 'geography:success:diversity';
    }
    if (text.includes('Global reach') || text.includes('countries')) {
      if (insightType === 'success') return 'geography:success:global';
      return 'geography:info:limited';
    }
    if (text.includes('emerging market')) {
      return `geography:${insightType}:emerging`;
    }
    if (text.includes('concentrated in')) {
      return 'geography:info:limited';
    }
  }

  if (dataType === 'revenue') {
    if (text.includes('live revenue') || text.includes('touring')) {
      return 'revenue:warning:live';
    }
    if (text.includes('Shazam count') && insightType === 'success') {
      return 'revenue:success:sync';
    }
    if (text.includes('Sync licensing') || text.includes('sync')) {
      return 'revenue:info:sync';
    }
    return 'revenue:info:overview';
  }

  return null;
}

// Extract platform names from insight text for template filling
function extractPlatforms(text) {
  const platforms = ['TikTok', 'Instagram', 'YouTube', 'Twitter/X', 'Twitter', 'Spotify', 'Apple Music'];
  const found = platforms.filter(p => text.includes(p));
  return { strongPlatform: found[0] || '', weakPlatform: found[1] || found[0] || '' };
}

function fillTemplate(stepText, action) {
  const { strongPlatform, weakPlatform } = extractPlatforms(action.text);
  return stepText
    .replace(/\{artist\}/g, action.artistName)
    .replace(/\{strongPlatform\}/g, strongPlatform)
    .replace(/\{weakPlatform\}/g, weakPlatform)
    .replace(/\{platform\}/g, strongPlatform || action.platform);
}

export function generateSteps(action) {
  const key = getTemplateKey(action);
  const templates = key ? STEP_TEMPLATES[key] : null;

  if (!templates) {
    // Fallback: generic steps based on dataType
    return [
      { id: `${action.id}-s0`, text: `Review current ${action.dataType} metrics and identify specific gaps`, category: 'tactical', completed: false },
      { id: `${action.id}-s1`, text: `Marketing: Draft action plan addressing this ${action.dataType} insight`, category: 'assignment', completed: false },
      { id: `${action.id}-s2`, text: `Set up tracking dashboard to measure progress over next 30 days`, category: 'playbook', completed: false },
    ];
  }

  return templates.map((step, i) => ({
    id: `${action.id}-s${i}`,
    text: fillTemplate(step.text, action),
    category: step.category,
    completed: false,
  }));
}

export const STEP_CATEGORY_LABELS = {
  tactical: 'Tactical',
  playbook: 'Playbook',
  assignment: 'Team',
};

export const STEP_CATEGORY_COLORS = {
  tactical: '#DA7756',
  playbook: '#7BAF73',
  assignment: '#D4A574',
};
