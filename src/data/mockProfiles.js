import {
  getArtist,
  getTopArtists,
  generateStreamingTrend,
  generateSocialTimeline,
  generateForecast,
  generateRevenue,
  getBenchmarkComparison,
} from './artists';

// --- Helpers ---

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function formatNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCurrency(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n;
}

// Generate plausible top tracks for an artist
function generateTopTracks(artist) {
  const base = artist.spotify.monthlyListeners || 1_000_000;
  const trackNames = [
    'Track 1', 'Track 2', 'Track 3', 'Track 4',
    'Track 5', 'Track 6', 'Track 7', 'Track 8',
  ];
  return trackNames.map((title, i) => {
    const factor = 1 - i * 0.1;
    const noise = 1 + (seededRandom(artist.id * 31 + i * 7) - 0.5) * 0.3;
    const streams = Math.round(base * factor * noise * 2.5);
    const delta = Math.round((seededRandom(artist.id * 17 + i * 13) - 0.3) * 40 * 10) / 10;
    return {
      rank: i + 1,
      title,
      streams,
      delta,
      peakPosition: Math.max(1, Math.round(1 + i * 2.5 + seededRandom(artist.id + i) * 5)),
      weeksOnChart: Math.max(1, Math.round(seededRandom(artist.id * 3 + i * 11) * 40)),
    };
  });
}

// Generate playlist tiers from real playlist data
function generatePlaylistTiers(artist) {
  const sp = artist.playlists.spotify;
  const editorial = sp.editorial || 0;
  const total = sp.total || 0;
  const userGenerated = Math.max(0, total - editorial - Math.round(total * 0.1));
  const algorithmic = Math.round(total * 0.1);
  const genreEditorial = Math.max(0, editorial - Math.min(8, Math.round(editorial * 0.3)));
  const majorEditorial = editorial - genreEditorial;

  return [
    { tier: 'Algorithmic', count: Math.max(1, algorithmic), reach: Math.round(sp.reach * 0.26) },
    { tier: 'Major Editorial', count: Math.max(1, majorEditorial), reach: Math.round(sp.reach * 0.52) },
    { tier: 'Genre Editorial', count: Math.max(1, genreEditorial), reach: Math.round(sp.reach * 0.13) },
    { tier: 'User-Generated', count: Math.max(1, userGenerated), reach: Math.round(sp.reach * 0.09) },
  ];
}

// Generate active playlists
function generateActivePlaylists(artist) {
  const baseStreams = Math.round(artist.spotify.monthlyListeners / 50);
  const playlists = [
    { name: "Today's Top Hits", curator: 'Spotify Editorial', followers: 34200000, position: Math.round(10 + seededRandom(artist.id * 41) * 40) },
    { name: 'New Music Friday', curator: 'Spotify Editorial', followers: 16800000, position: Math.round(5 + seededRandom(artist.id * 43) * 30) },
    { name: 'Pop Rising', curator: 'Spotify Editorial', followers: 11400000, position: Math.round(3 + seededRandom(artist.id * 47) * 25) },
    { name: 'Discover Weekly', curator: 'Spotify Algorithmic', followers: null, position: null },
    { name: 'Release Radar', curator: 'Spotify Algorithmic', followers: null, position: null },
    { name: 'A-List Pop', curator: 'Apple Music Editorial', followers: 6100000, position: Math.round(8 + seededRandom(artist.id * 53) * 20) },
  ];
  return playlists.map((p, i) => ({
    ...p,
    streamsFromPlaylist: Math.round(baseStreams * (1 - i * 0.12) * (1 + (seededRandom(artist.id * 7 + i * 19) - 0.5) * 0.3)),
    dateAdded: '2026-0' + (1 + Math.floor(i / 2)) + '-' + String(10 + i * 3).padStart(2, '0'),
  }));
}

// Generate geography data from top cities
function generateGeography(artist) {
  const topCities = artist.spotify.topCities || [];
  if (topCities.length === 0) {
    return [
      { country: 'United States', streams: Math.round(artist.spotify.monthlyListeners * 0.35), cities: [{ city: 'Los Angeles', streams: Math.round(artist.spotify.monthlyListeners * 0.08) }] },
    ];
  }

  // Group cities by country
  const countryMap = {};
  topCities.forEach(c => {
    const country = c.country || 'Unknown';
    if (!countryMap[country]) countryMap[country] = { streams: 0, cities: [] };
    countryMap[country].streams += c.listeners;
    countryMap[country].cities.push({ city: c.city, streams: c.listeners });
  });

  return Object.entries(countryMap)
    .map(([country, data]) => ({ country, streams: data.streams, cities: data.cities }))
    .sort((a, b) => b.streams - a.streams);
}

// Generate tour dates from artist's top cities
function generateTourDates(artist) {
  const topCities = artist.spotify.topCities || [];
  const cities = topCities.length > 0
    ? topCities.slice(0, 8)
    : [{ city: 'Los Angeles', country: 'US', listeners: 1000000 }, { city: 'New York', country: 'US', listeners: 800000 }];

  const venues = {
    'Los Angeles': { venue: 'The Wiltern', capacity: 1850, lat: 34.0622, lng: -118.3084 },
    'New York': { venue: 'Terminal 5', capacity: 3000, lat: 40.7695, lng: -73.9921 },
    'London': { venue: 'Brixton Academy', capacity: 4921, lat: 51.4613, lng: -0.1156 },
    'Mexico City': { venue: 'Pepsi Center WTC', capacity: 3600, lat: 19.3934, lng: -99.1694 },
    'Berlin': { venue: 'Columbiahalle', capacity: 3500, lat: 52.4851, lng: 13.3587 },
    'Paris': { venue: 'Le Bataclan', capacity: 1500, lat: 48.8631, lng: 2.3708 },
    'Tokyo': { venue: 'Zepp Shinjuku', capacity: 1500, lat: 35.6938, lng: 139.7034 },
    'Seoul': { venue: 'YES24 Live Hall', capacity: 2000, lat: 37.5407, lng: 127.0696 },
    'Sydney': { venue: 'Enmore Theatre', capacity: 1600, lat: -33.8977, lng: 151.1741 },
    'Chicago': { venue: 'Metro Chicago', capacity: 1100, lat: 41.9484, lng: -87.6597 },
    'Toronto': { venue: 'Danforth Music Hall', capacity: 1500, lat: 43.6772, lng: -79.3524 },
    'São Paulo': { venue: 'Audio Club', capacity: 3200, lat: -23.5489, lng: -46.6916 },
    'Jakarta': { venue: 'Tennis Indoor Senayan', capacity: 5000, lat: -6.2190, lng: 106.8019 },
    'Bangkok': { venue: 'Impact Arena', capacity: 12000, lat: 13.9117, lng: 100.5513 },
    'Manila': { venue: 'Araneta Coliseum', capacity: 15000, lat: 14.6207, lng: 121.0531 },
    'Lima': { venue: 'Arena Peru', capacity: 4000, lat: -12.0708, lng: -77.0324 },
    'Bogota': { venue: 'Movistar Arena', capacity: 14000, lat: 4.6486, lng: -74.1017 },
    'Santiago': { venue: 'Movistar Arena', capacity: 9000, lat: -33.4632, lng: -70.6064 },
    'Mumbai': { venue: 'NSCI Dome', capacity: 8000, lat: 19.0402, lng: 72.8409 },
  };
  const defaultVenue = { venue: 'Music Hall', capacity: 2000, lat: 40.0, lng: -74.0 };

  const statuses = ['Sold Out', 'On Sale', 'Announced'];
  const startDate = new Date('2026-05-01');

  return cities.map((c, i) => {
    const v = venues[c.city] || defaultVenue;
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 14);
    const statusIdx = i < 3 ? 0 : i < 6 ? 1 : 2;
    const ticketRatio = statusIdx === 0 ? 1.0 : statusIdx === 1 ? 0.5 + seededRandom(artist.id + i) * 0.4 : 0.1 + seededRandom(artist.id + i * 3) * 0.2;
    const ticketsSold = Math.round(v.capacity * ticketRatio);
    return {
      date: date.toISOString().split('T')[0],
      city: c.city,
      venue: v.venue,
      capacity: v.capacity,
      ticketsSold,
      revenue: Math.round(ticketsSold * 80),
      status: statuses[statusIdx],
      lat: v.lat,
      lng: v.lng,
    };
  });
}

// Generate social metrics snapshot from real data
function generateSocialMetrics(artist) {
  const pop = artist.spotify.popularity || 50;
  const growthMultiplier = pop >= 85 ? 3 : pop >= 70 ? 1.5 : pop >= 40 ? 0.8 : 0.3;
  return {
    tiktok: {
      followers: artist.social.tiktok,
      growth: Math.round(8 * growthMultiplier * 10) / 10,
      engagementRate: Math.round((3 + seededRandom(artist.id * 11) * 8) * 10) / 10,
      postsThisMonth: Math.round(10 + seededRandom(artist.id * 13) * 30),
    },
    instagram: {
      followers: artist.social.instagram,
      growth: Math.round(4 * growthMultiplier * 10) / 10,
      engagementRate: Math.round((2 + seededRandom(artist.id * 17) * 5) * 10) / 10,
      postsThisMonth: Math.round(8 + seededRandom(artist.id * 19) * 20),
    },
    twitter: {
      followers: artist.social.twitter,
      growth: Math.round(2 * growthMultiplier * 10) / 10,
      engagementRate: Math.round((1 + seededRandom(artist.id * 23) * 4) * 10) / 10,
      postsThisMonth: Math.round(15 + seededRandom(artist.id * 29) * 50),
    },
    youtube: {
      followers: artist.social.youtube,
      growth: Math.round(5 * growthMultiplier * 10) / 10,
      engagementRate: Math.round((3 + seededRandom(artist.id * 31) * 6) * 10) / 10,
      postsThisMonth: Math.round(2 + seededRandom(artist.id * 37) * 10),
    },
  };
}

// Generate sync placements
function generateSyncPlacements(artist) {
  const baseFee = Math.max(10000, Math.round(artist.spotify.monthlyListeners * 0.0001));
  const shows = [
    { show: 'Euphoria S3', network: 'HBO', status: 'Placed' },
    { show: 'The Bear S4', network: 'FX / Hulu', status: 'Placed' },
    { show: 'Wednesday S2', network: 'Netflix', status: 'Placed' },
    { show: 'Apple "Shot on iPhone"', network: 'Apple', status: 'In Negotiation' },
    { show: 'BMW iX Campaign', network: 'BMW Global', status: 'Pending' },
    { show: 'FIFA 26 Soundtrack', network: 'EA Sports', status: 'Pending' },
  ];
  return shows.map((s, i) => ({
    ...s,
    song: 'Track ' + (i + 1),
    fee: Math.round(baseFee * (1.2 - i * 0.1) * (1 + (seededRandom(artist.id * 41 + i * 7) - 0.5) * 0.4)),
    date: '2026-0' + (1 + Math.floor(i / 2)) + '-' + String(5 + i * 7).padStart(2, '0'),
  }));
}

// Generate monthly revenue
function generateMonthlyRevenue(artist) {
  const monthlyStreamRev = Math.round(artist.spotify.monthlyListeners * 0.004);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(2025, 4 + i, 1);
    const monthStr = m.toISOString().slice(0, 7);
    const growth = 1 + 0.03 * i;
    const noise = 1 + (seededRandom(artist.id * 7 + i * 13) - 0.5) * 0.15;
    const streaming = Math.round(monthlyStreamRev * growth * noise);
    months.push({
      month: monthStr,
      streaming,
      sync: Math.round(streaming * 0.15 * (1 + (seededRandom(artist.id * 11 + i * 17) - 0.5) * 0.6)),
      live: i % 3 === 0 ? Math.round(streaming * 0.3 * noise) : 0,
      merch: Math.round(streaming * 0.08 * noise),
    });
  }
  return months;
}

// Generate alerts
function generateAlerts(artist) {
  const genre = artist.genres?.primary?.name || 'music';
  return [
    {
      id: 'alert-001',
      type: 'viral',
      severity: 'high',
      title: `${artist.name} is trending on TikTok`,
      description: `TikTok sound uses for ${artist.name} tracks have surged in the past 48 hours. The trend is driven by organic creator engagement across multiple markets.`,
      timestamp: '2026-03-28T14:23:00Z',
      actionable: `Pitch ${artist.name}'s trending tracks to Spotify editorial team. Boost creator campaign budget to capitalize on organic momentum.`,
    },
    {
      id: 'alert-002',
      type: 'growth',
      severity: artist.spotify.popularity >= 70 ? 'high' : 'medium',
      title: `Streaming velocity increasing across key markets`,
      description: `${artist.name}'s daily streams are showing strong upward velocity across multiple territories with a ${artist.spotify.popularity}/100 popularity score.`,
      timestamp: '2026-03-26T09:15:00Z',
      actionable: `Evaluate tour routing opportunities in growing markets. Consider upgrading venue sizes based on demand signals.`,
    },
  ];
}

// --- Main Profile Functions ---

export function getArtistProfile(id) {
  const artist = getArtist(id);
  const genre = artist.genres?.primary?.name || 'Music';
  const listeners = artist.spotify.monthlyListeners;
  const totalStreams = Math.round(listeners * 12.5);
  const revenue = generateRevenue(artist);
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const pop = artist.spotify.popularity || 50;

  return {
    id: artist.slug,
    name: artist.name,
    type: 'artist',
    genre,
    monthlyListeners: listeners,
    totalStreams,
    followers: artist.spotify.followers,
    aiSummary: {
      text: `${artist.name} is a ${genre} artist${artist.country ? ' from ' + artist.country : ''} with a ${pop}/100 popularity score. ${artist.description ? artist.description.slice(0, 200) : ''} Monthly listeners are at ${formatNum(listeners)} with ${formatNum(artist.spotify.followers)} Spotify followers. ${artist.name} ranks #${artist.rank} overall with a score of ${artist.score.toFixed(1)}. Playlist reach spans ${formatNum(artist.playlists.spotify.reach)} listeners across ${artist.playlists.spotify.total} Spotify playlists.`,
      keyMetrics: [
        { label: 'Monthly Listeners', value: formatNum(listeners), delta: pop >= 70 ? '+12.4%' : '+3.1%' },
        { label: 'Rank', value: '#' + artist.rank },
        { label: 'Revenue Est.', value: formatCurrency(totalRevenue), delta: '+18.2%' },
        { label: 'Active Playlists', value: String(artist.playlists.spotify.total), delta: '+' + Math.round(artist.playlists.spotify.total * 0.08) },
      ],
      suggestions: [
        'When should we release the next single?',
        'Which playlists should we target?',
        'Show breakout signals',
      ],
    },
    streaming: {
      dailyStreams: generateStreamingTrend(artist),
      topTracks: generateTopTracks(artist),
    },
    social: {
      socialMetrics: generateSocialMetrics(artist),
      socialTimeline: generateSocialTimeline(artist),
      viralPosts: [],
    },
    revenue: {
      revenueBreakdown: revenue,
      monthlyRevenue: generateMonthlyRevenue(artist),
      syncPlacements: generateSyncPlacements(artist),
    },
    playlists: {
      playlistTiers: generatePlaylistTiers(artist),
      activePlaylists: generateActivePlaylists(artist),
    },
    audience: {
      audienceDemographics: {
        age: [
          { group: '18-24', percentage: 38 },
          { group: '25-34', percentage: 31 },
          { group: '35-44', percentage: 18 },
          { group: '45+', percentage: 13 },
        ],
        gender: { male: 44, female: 48, other: 8 },
      },
      geographyData: generateGeography(artist),
    },
    benchmarks: {
      spotifyComparison: getBenchmarkComparison(artist),
    },
    forecasting: {
      streamForecast: generateForecast(artist),
    },
    touring: {
      tourDates: generateTourDates(artist),
      tourRecommendations: [],
    },
    releases: { releaseHistory: [] },
    alerts: generateAlerts(artist),
    physical: [],
    airplay: [],
  };
}

export function getTrackProfile(id) {
  const top = getTopArtists(5);
  const artist = top[0];
  const topTracks = generateTopTracks(artist);
  const track = topTracks[0];

  const activePlaylists = generateActivePlaylists(artist);
  const trackPlaylists = activePlaylists.filter((_, i) => i % 2 === 0 || track.rank <= 3);

  return {
    id: id || 'track-1',
    name: track.title,
    type: 'track',
    artist: artist.name,
    artistId: artist.slug,
    streams: track.streams,
    delta: track.delta,
    peakPosition: track.peakPosition,
    weeksOnChart: track.weeksOnChart,
    rank: track.rank,
    aiSummary: {
      text: `"${track.title}" by ${artist.name} has accumulated ${formatNum(track.streams)} total streams with a current growth rate of ${track.delta > 0 ? '+' : ''}${track.delta}%. ${track.delta > 15 ? 'This track is showing strong viral momentum.' : track.delta > 0 ? 'Steady growth trajectory.' : 'Slight decline in velocity.'}`,
      keyMetrics: [
        { label: 'Total Streams', value: formatNum(track.streams) },
        { label: 'Growth', value: `${track.delta > 0 ? '+' : ''}${track.delta}%`, delta: track.delta > 0 ? 'up' : 'down' },
        { label: 'Peak Position', value: `#${track.peakPosition}` },
        { label: 'Weeks on Chart', value: `${track.weeksOnChart}` },
      ],
      suggestions: [
        `What playlists feature "${track.title}"?`,
        'Show sync licensing opportunities',
        'Compare to similar tracks',
      ],
    },
    playlists: trackPlaylists,
    audience: {
      age: [
        { group: '18-24', percentage: 38 },
        { group: '25-34', percentage: 31 },
        { group: '35-44', percentage: 18 },
        { group: '45+', percentage: 13 },
      ],
      gender: { male: 44, female: 48, other: 8 },
    },
    geography: generateGeography(artist).slice(0, 5),
    syncOpportunities: generateSyncPlacements(artist).filter((_, i) => i < 3),
  };
}

export function getPlaylistProfile(id) {
  const top = getTopArtists(8);
  const topTracks = top.slice(0, 5).map((a, i) => {
    const t = generateTopTracks(a)[0];
    return { ...t, rank: i + 1, title: `${a.name} — ${t.title}` };
  });

  const playlistMap = {
    'todays-top-hits': { name: "Today's Top Hits", curator: 'Spotify Editorial', followers: 34200000, description: 'The biggest hits right now.' },
    'new-music-friday': { name: 'New Music Friday', curator: 'Spotify Editorial', followers: 15800000, description: 'The best new releases.' },
    'pop-rising': { name: 'Pop Rising', curator: 'Spotify Editorial', followers: 8400000, description: 'Pop music on the rise.' },
    'discover-weekly': { name: 'Discover Weekly', curator: 'Spotify Algorithmic', followers: null, description: 'Your weekly mixtape of fresh music.' },
    'alt-pop-essentials': { name: 'Alt Pop Essentials', curator: 'Apple Music', followers: 2100000, description: 'Essential alt-pop tracks.' },
  };
  const playlist = playlistMap[id] || playlistMap['todays-top-hits'];
  const topArtistName = top[0].name;

  return {
    id: id || 'todays-top-hits',
    name: playlist.name,
    type: 'playlist',
    curator: playlist.curator,
    followers: playlist.followers,
    description: playlist.description,
    aiSummary: {
      text: `"${playlist.name}" by ${playlist.curator} ${playlist.followers ? `reaches ${formatNum(playlist.followers)} followers` : 'delivers personalized recommendations'}. Tracks from your roster including ${topArtistName} are performing well on this playlist with strong stream attribution.`,
      keyMetrics: [
        { label: 'Followers', value: playlist.followers ? formatNum(playlist.followers) : 'Personalized' },
        { label: 'Roster Tracks', value: `${topTracks.length}` },
        { label: 'Avg Position', value: '#14' },
        { label: 'Stream Attribution', value: '4.8M' },
      ],
      suggestions: [
        'What tracks should we pitch next?',
        'Compare to similar playlists',
        'Show listener demographics',
      ],
    },
    tracks: topTracks,
    performance: { streamsFromPlaylist: 4800000, avgPosition: 14, peakPosition: 8 },
    audience: {
      age: [
        { group: '18-24', percentage: 38 },
        { group: '25-34', percentage: 31 },
        { group: '35-44', percentage: 18 },
        { group: '45+', percentage: 13 },
      ],
      gender: { male: 44, female: 48, other: 8 },
    },
  };
}

export function getChartProfile(id) {
  const top = getTopArtists(10);
  const chartEntries = top.map((a, i) => {
    const tracks = generateTopTracks(a);
    const track = tracks[0];
    const position = i + 1;
    const lastWeek = Math.max(1, position + Math.round((seededRandom(a.id * 7) - 0.5) * 10));
    const change = lastWeek - position;
    return {
      position,
      title: `${a.name} — ${track.title}`,
      artist: a.name,
      lastWeek,
      peakPosition: Math.max(1, position - Math.round(seededRandom(a.id * 11) * 5)),
      weeksOn: Math.max(1, Math.round(seededRandom(a.id * 13) * 52)),
      change: change > 0 ? `+${change}` : change === 0 ? '\u2014' : String(change),
    };
  });

  const chartMap = {
    'billboard-hot-100': { name: 'Billboard Hot 100', publisher: 'Billboard', frequency: 'Weekly', region: 'United States' },
    'spotify-top-50-global': { name: 'Spotify Top 50 Global', publisher: 'Spotify', frequency: 'Daily', region: 'Global' },
    'apple-music-top-100': { name: 'Apple Music Top 100', publisher: 'Apple Music', frequency: 'Daily', region: 'Global' },
    'uk-singles-chart': { name: 'UK Official Singles Chart', publisher: 'Official Charts Company', frequency: 'Weekly', region: 'United Kingdom' },
  };
  const chart = chartMap[id] || chartMap['billboard-hot-100'];
  const topArtist = top[0];

  return {
    id: id || 'billboard-hot-100',
    name: chart.name,
    type: 'chart',
    publisher: chart.publisher,
    frequency: chart.frequency,
    region: chart.region,
    aiSummary: {
      text: `The ${chart.name} features ${chartEntries.length} tracked artists this week. ${topArtist.name} leads at #1 with strong streaming velocity. The roster has multiple entries showing positive movement across the chart.`,
      keyMetrics: [
        { label: 'Roster Entries', value: String(chartEntries.length) },
        { label: 'Highest Position', value: '#1' },
        { label: 'Biggest Mover', value: chartEntries.reduce((best, e) => { const c = parseInt(e.change) || 0; return c > (parseInt(best) || 0) ? e.change : best; }, '0') },
        { label: 'Artists Tracked', value: String(chartEntries.length) },
      ],
      suggestions: [
        'What drives chart movement this week?',
        "Compare to last week's performance",
        'Show streaming vs chart correlation',
      ],
    },
    entries: chartEntries,
    lunaVegaEntries: chartEntries.slice(0, 5),
  };
}
