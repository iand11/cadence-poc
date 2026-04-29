import { allArtists } from '../data/artists';
import { formatNumber, formatCurrency } from './formatters';

// Pre-compute roster averages once
const roster = allArtists.length;
const avg = {
  listeners: allArtists.reduce((s, a) => s + a.spotify.monthlyListeners, 0) / roster,
  followers: allArtists.reduce((s, a) => s + a.spotify.followers, 0) / roster,
  popularity: allArtists.reduce((s, a) => s + a.spotify.popularity, 0) / roster,
  tiktok: allArtists.reduce((s, a) => s + a.social.tiktok, 0) / roster,
  instagram: allArtists.reduce((s, a) => s + a.social.instagram, 0) / roster,
  youtube: allArtists.reduce((s, a) => s + a.social.youtube, 0) / roster,
  twitter: allArtists.reduce((s, a) => s + a.social.twitter, 0) / roster,
  spPlaylists: allArtists.reduce((s, a) => s + a.playlists.spotify.total, 0) / roster,
  spEditorial: allArtists.reduce((s, a) => s + a.playlists.spotify.editorial, 0) / roster,
  spReach: allArtists.reduce((s, a) => s + a.playlists.spotify.reach, 0) / roster,
  editorialRate: (() => {
    const totals = allArtists.filter(a => a.playlists.spotify.total > 0);
    return totals.reduce((s, a) => s + a.playlists.spotify.editorial / a.playlists.spotify.total, 0) / totals.length;
  })(),
  reachPerPlaylist: (() => {
    const valid = allArtists.filter(a => a.playlists.spotify.total > 0);
    return valid.reduce((s, a) => s + a.playlists.spotify.reach / a.playlists.spotify.total, 0) / valid.length;
  })(),
  shazam: allArtists.reduce((s, a) => s + a.engagement.shazam, 0) / roster,
};

const fmt = formatNumber;

function streamingInsights(a) {
  const insights = [];
  const ratio = a.spotify.monthlyListeners > 0
    ? a.spotify.followers / a.spotify.monthlyListeners : 0;

  // Listener-to-follower conversion
  if (ratio > 0.3) {
    insights.push({
      type: 'success',
      text: `Strong fan conversion — ${(ratio * 100).toFixed(1)}% of monthly listeners are followers. This indicates a deeply loyal fanbase that actively seeks out new releases.`,
      action: 'Leverage this loyalty with exclusive content, pre-saves, and fan-first release strategies to maintain high retention.',
    });
  } else if (ratio > 0.1) {
    insights.push({
      type: 'info',
      text: `Moderate fan conversion at ${(ratio * 100).toFixed(1)}% — ${fmt(a.spotify.followers)} followers from ${fmt(a.spotify.monthlyListeners)} monthly listeners. Listeners are engaging but not all committing to follow.`,
      action: 'Use Spotify Canvas, Marquee campaigns, and playlist bio links to convert casual listeners into followers.',
    });
  } else {
    insights.push({
      type: 'warning',
      text: `Low follower conversion at ${(ratio * 100).toFixed(1)}% — ${fmt(a.spotify.monthlyListeners)} monthly listeners but only ${fmt(a.spotify.followers)} followers. Most streams likely come from playlists rather than direct artist follows.`,
      action: 'Focus on artist page optimization, social media call-to-actions, and Spotify "follow" prompts in playlist bios to convert playlist-driven listeners.',
    });
  }

  // Popularity score
  const pop = a.spotify.popularity;
  if (pop >= 75) {
    insights.push({
      type: 'success',
      text: `Popularity score of ${pop}/100 puts this artist in the top tier. Spotify's algorithm is actively boosting discovery through Release Radar, Discover Weekly, and autoplay.`,
      action: 'Maintain momentum with consistent release cadence — the algorithm rewards velocity. Consider strategic single releases every 4-6 weeks.',
    });
  } else if (pop >= 50) {
    insights.push({
      type: 'info',
      text: `Popularity score of ${pop}/100 (roster average: ${Math.round(avg.popularity)}) — strong enough for algorithmic recommendations but below the threshold for top-tier playlist placement.`,
      action: 'Target editorial playlist submissions with strong pitch narratives. Collaborative tracks with higher-popularity artists can boost this score.',
    });
  } else {
    insights.push({
      type: 'warning',
      text: `Popularity score of ${pop}/100 is below the roster average of ${Math.round(avg.popularity)}. Limited algorithmic amplification — streams are likely driven by existing fans and curated playlists.`,
      action: 'Prioritize third-party playlist pitching and social-driven traffic. TikTok campaigns and influencer seeding can create the spike needed to boost algorithmic signals.',
    });
  }

  return insights;
}

function socialInsights(a) {
  const insights = [];
  const platforms = [
    { name: 'TikTok', value: a.social.tiktok },
    { name: 'Instagram', value: a.social.instagram },
    { name: 'YouTube', value: a.social.youtube },
    { name: 'Twitter/X', value: a.social.twitter },
  ].filter(p => p.value > 0);

  if (platforms.length === 0) return insights;

  const sorted = [...platforms].sort((a, b) => b.value - a.value);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  // Strongest platform
  insights.push({
    type: 'info',
    text: `${strongest.name} is the dominant social platform with ${fmt(strongest.value)} followers — ${weakest.value > 0 ? `${(strongest.value / weakest.value).toFixed(1)}x the ${weakest.name} following` : 'significantly ahead of other platforms'}.`,
    action: `Double down on ${strongest.name} content strategy. Use this platform as the primary driver for announcements, teasers, and fan engagement to maximize reach.`,
  });

  // Weakest platform gap
  if (sorted.length >= 2 && weakest.value < strongest.value * 0.1) {
    insights.push({
      type: 'warning',
      text: `${weakest.name} presence is significantly underdeveloped at ${fmt(weakest.value)} followers — only ${(weakest.value / strongest.value * 100).toFixed(1)}% of the ${strongest.name} audience.`,
      action: `Cross-promote ${weakest.name} from ${strongest.name} with platform-native content. Even modest investment here opens a new audience channel and reduces platform dependency.`,
    });
  }

  // TikTok engagement
  if (a.social.tiktok > 0 && a.social.tiktokLikes > 0) {
    const engRate = a.social.tiktokLikes / a.social.tiktok;
    if (engRate > 15) {
      insights.push({
        type: 'success',
        text: `Exceptional TikTok engagement — ${fmt(a.social.tiktokLikes)} likes across content (${engRate.toFixed(1)}x the follower count). Content is resonating well beyond the existing audience.`,
        action: 'Identify which content types drive the most engagement and create a repeatable format. Consider sound-based campaigns to convert TikTok virality into streams.',
      });
    } else if (engRate < 2 && a.social.tiktok > 100000) {
      insights.push({
        type: 'warning',
        text: `TikTok engagement is low relative to follower count — ${fmt(a.social.tiktokLikes)} total likes vs ${fmt(a.social.tiktok)} followers suggests declining content performance or inactive followers.`,
        action: 'Refresh the content strategy: test short behind-the-scenes clips, duet challenges, and trending audio hooks. Consistency (3-5 posts/week) is key to re-engaging the algorithm.',
      });
    }
  }

  // Track posts virality
  if (a.social.tiktokTrackPosts > 5000) {
    insights.push({
      type: 'success',
      text: `${fmt(a.social.tiktokTrackPosts)} TikTok posts use this artist's tracks — strong organic adoption indicates the music is naturally suited for short-form video content.`,
      action: 'Amplify with creator seeding: send the next single to 50-100 mid-tier TikTok creators with suggested clip moments and hashtags to accelerate the trend.',
    });
  }

  return insights.slice(0, 3);
}

function playlistInsights(a) {
  const insights = [];
  const sp = a.playlists.spotify;

  // Editorial rate
  if (sp.total > 0) {
    const rate = sp.editorial / sp.total;
    if (rate > avg.editorialRate * 1.5) {
      insights.push({
        type: 'success',
        text: `Editorial playlist rate of ${(rate * 100).toFixed(2)}% is well above the roster average of ${(avg.editorialRate * 100).toFixed(2)}%. Strong curation support from Spotify editors indicates the artist is on the editorial team's radar.`,
        action: 'Maintain the relationship — submit releases early with compelling pitch narratives, artist story updates, and performance data from previous editorial placements.',
      });
    } else if (rate < avg.editorialRate * 0.5) {
      insights.push({
        type: 'warning',
        text: `Editorial playlist rate of ${(rate * 100).toFixed(2)}% is below the roster average of ${(avg.editorialRate * 100).toFixed(2)}%. Most playlist placements are algorithmic or user-generated rather than editor-curated.`,
        action: 'Strengthen playlist pitching: submit via Spotify for Artists 7+ days before release, include compelling narratives, and provide social proof (press coverage, tour dates, sync placements).',
      });
    } else {
      insights.push({
        type: 'info',
        text: `${fmt(sp.editorial)} editorial placements out of ${fmt(sp.total)} total Spotify playlists — in line with the roster average editorial rate.`,
        action: 'Look for opportunities in underrepresented playlist categories (mood-based, activity-based) and consider releasing music timed to seasonal editorial moments.',
      });
    }
  }

  // Reach efficiency
  if (sp.total > 0) {
    const reachPer = sp.reach / sp.total;
    if (reachPer > avg.reachPerPlaylist * 1.5) {
      insights.push({
        type: 'success',
        text: `Playlist reach efficiency of ${fmt(Math.round(reachPer))} listeners per playlist is ${(reachPer / avg.reachPerPlaylist).toFixed(1)}x the roster average. Placements are on high-traffic playlists.`,
        action: 'This is a competitive advantage. Track which specific playlists drive the most streams and build release strategies around maintaining those placements.',
      });
    } else if (reachPer < avg.reachPerPlaylist * 0.5) {
      insights.push({
        type: 'warning',
        text: `Playlist reach efficiency of ${fmt(Math.round(reachPer))} listeners per playlist is below average — many placements are on low-traffic playlists with limited discovery impact.`,
        action: 'Focus on quality over quantity. Target fewer but larger playlists. Consider using playlist pitching services that specialize in high-reach editorial and algorithmic placements.',
      });
    }
  }

  // Cross-platform gaps
  const appleEd = a.playlists.apple.editorial;
  const spEd = sp.editorial;
  if (spEd > 20 && appleEd < 5) {
    insights.push({
      type: 'warning',
      text: `Apple Music editorial support is minimal (${appleEd} playlists) despite strong Spotify curation (${fmt(spEd)} editorial playlists). Apple Music's audience skews older and more willing to pay — this is untapped revenue.`,
      action: 'Build relationships with Apple Music editorial via MusicKit submissions, Apple Music for Artists, and distributor contacts who pitch to the Apple curation team.',
    });
  }

  return insights.slice(0, 3);
}

function geographyInsights(a) {
  const insights = [];
  const cities = a.spotify.topCities;
  if (cities.length === 0) return insights;

  const totalListeners = cities.reduce((s, c) => s + c.listeners, 0);

  // Concentration
  const topCity = cities[0];
  const topCityPct = totalListeners > 0 ? (topCity.listeners / totalListeners) * 100 : 0;
  if (topCityPct > 30) {
    insights.push({
      type: 'warning',
      text: `High geographic concentration — ${topCity.city} accounts for ${topCityPct.toFixed(0)}% of tracked listeners (${fmt(topCity.listeners)}). Heavy reliance on a single market creates vulnerability if that market shifts.`,
      action: `Diversify with geo-targeted ad campaigns in secondary markets. Consider playlist placements in local editorial playlists and social content in the language/culture of emerging markets.`,
    });
  } else if (topCityPct < 15 && cities.length >= 5) {
    insights.push({
      type: 'success',
      text: `Well-distributed audience — no single city exceeds ${topCityPct.toFixed(0)}% of listeners. This geographic diversity provides resilience and multiple markets to activate for touring.`,
      action: 'Use this breadth strategically: plan multi-city tours, tailor social content for different regions, and leverage local radio/press in each key market.',
    });
  }

  // Country count
  const countries = new Set(cities.map(c => c.country));
  if (countries.size >= 8) {
    insights.push({
      type: 'success',
      text: `Global reach across ${countries.size} countries — the music resonates across cultural boundaries. International audiences are often the fastest-growing segment for established artists.`,
      action: 'Consider localized marketing: translated social posts, region-specific playlists, and partnerships with local influencers in the top 3-4 international markets.',
    });
  } else if (countries.size <= 3) {
    insights.push({
      type: 'info',
      text: `Audience is concentrated in ${countries.size} ${countries.size === 1 ? 'country' : 'countries'}. While this may reflect genre or language specificity, there is significant room for international expansion.`,
      action: 'Test international markets through playlist seeding, translated metadata, and cross-cultural collaborations. Markets like Brazil, Mexico, India, and Indonesia have rapidly growing streaming audiences.',
    });
  }

  // Emerging market presence
  const emergingCodes = new Set(['BR', 'MX', 'ID', 'IN', 'PH', 'NG', 'TH', 'VN', 'CO', 'AR']);
  const emergingCities = cities.filter(c => emergingCodes.has(c.country));
  const emergingListeners = emergingCities.reduce((s, c) => s + c.listeners, 0);
  const emergingPct = totalListeners > 0 ? (emergingListeners / totalListeners) * 100 : 0;

  if (emergingPct > 20) {
    const topEmerging = emergingCities[0];
    insights.push({
      type: 'success',
      text: `Strong emerging market presence — ${emergingPct.toFixed(0)}% of listeners are in high-growth markets like ${topEmerging?.city}. These markets have rapidly expanding streaming populations and less competition for attention.`,
      action: 'Invest in these markets early: local playlist pitching, social media presence in regional platforms, and consider live shows or virtual events targeting these audiences.',
    });
  } else if (emergingPct < 5 && totalListeners > 100000) {
    insights.push({
      type: 'info',
      text: 'Minimal presence in emerging streaming markets (Brazil, Mexico, India, Indonesia, Philippines). These markets represent the fastest-growing listener populations globally.',
      action: 'Test entry with targeted Spotify ad campaigns in 1-2 emerging markets. Collaborate with local artists or create content that bridges cultural contexts.',
    });
  }

  return insights.slice(0, 3);
}

function revenueInsights(a) {
  const insights = [];
  const streamingRev = Math.round(a.spotify.monthlyListeners * 0.004 * 12);
  const syncRev = Math.round(streamingRev * 0.15);
  const liveRev = Math.round(streamingRev * 0.25);
  const merchRev = Math.round(streamingRev * 0.08);
  const total = streamingRev + syncRev + liveRev + merchRev;
  const streamingPct = total > 0 ? (streamingRev / total * 100) : 0;

  // Revenue per listener
  const revPerListener = a.spotify.monthlyListeners > 0
    ? total / a.spotify.monthlyListeners : 0;
  insights.push({
    type: 'info',
    text: `Estimated annual revenue of ${formatCurrency(total)} — approximately ${formatCurrency(revPerListener)} per monthly listener. Streaming accounts for ${streamingPct.toFixed(0)}% of total estimated revenue.`,
    action: streamingPct > 75
      ? 'Revenue is heavily streaming-dependent. Diversify through sync licensing, live performances, and merchandise to build a more resilient income base.'
      : 'Revenue mix is reasonably balanced. Continue strengthening the weaker revenue channels.',
  });

  // Live revenue opportunity
  if (a.spotify.popularity > 60 && liveRev < total * 0.3) {
    insights.push({
      type: 'warning',
      text: `With a popularity score of ${a.spotify.popularity}/100, live revenue potential is likely underutilized. Live/touring typically generates 2-3x streaming revenue for artists at this popularity level.`,
      action: 'Explore touring opportunities: festival bookings, support slots for larger acts, and headline shows in cities with the highest listener concentration. Live events also boost streaming through setlist discovery.',
    });
  }

  // Sync opportunity
  if (a.engagement.shazam > avg.shazam) {
    insights.push({
      type: 'success',
      text: `Shazam count of ${fmt(a.engagement.shazam)} exceeds the roster average — this indicates the music is being discovered in real-world contexts (TV, shops, venues). Sync supervisors use Shazam data as a signal for placement potential.`,
      action: 'Pitch actively to sync agencies and music supervisors. Package a sync reel highlighting the tracks with highest Shazam activity and any existing placements.',
    });
  } else if (total > 0 && syncRev / total < 0.12) {
    insights.push({
      type: 'info',
      text: `Sync licensing represents only ${(syncRev / total * 100).toFixed(0)}% of estimated revenue. For many artists, a single film/TV placement can equal months of streaming revenue.`,
      action: 'Ensure the catalog is registered with sync agencies. Create instrumental and clean versions of key tracks. Consider writing with sync briefs in mind for upcoming releases.',
    });
  }

  return insights.slice(0, 3);
}

export function generateInsights(artist) {
  return {
    streaming: streamingInsights(artist),
    social: socialInsights(artist),
    playlists: playlistInsights(artist),
    geography: geographyInsights(artist),
    revenue: revenueInsights(artist),
  };
}
