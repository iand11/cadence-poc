// --- Chat Responses keyed by topic ---
export const chatResponses = {
  tour: {
    thinking: 'Analyzing streaming velocity, social sentiment, and venue data across 47 markets for your roster of 100 artists...',
    response: 'Based on streaming growth and social signals across your roster, Latin America is the strongest opportunity right now. Bad Bunny and Peso Pluma are driving massive engagement in Mexico City and São Paulo. Bruno Mars and The Weeknd show strong demand in London and Berlin. Taylor Swift and Billie Eilish are trending in Tokyo and Seoul. I recommend prioritizing these markets for upcoming tour routing.',
    dataType: 'tourRecommendations',
    followUp: 'Want me to model revenue scenarios for different venue sizes in these markets?',
  },
  viral: {
    thinking: 'Scanning breakout signals across TikTok, Instagram, Twitter, and streaming platforms for all 100 tracked artists...',
    response: 'Multiple breakout signals detected across the roster. Sabrina Carpenter is experiencing a TikTok surge with sound uses up 340% in 48 hours. Dua Lipa has a viral Instagram Reel driving discovery. Bad Bunny\'s latest release is trending on Spotify Viral 50 in 12 markets simultaneously. These are critical windows for playlist pitching and creator campaign investment.',
    dataType: 'breakoutAlerts',
    followUp: 'Should I prioritize which artist needs the most immediate action?',
  },
  revenue: {
    thinking: 'Pulling revenue data across streaming, sync, live, and merch channels for the full roster...',
    response: 'Total roster revenue is trending at $2.4B annually across all 100 artists. Streaming is the backbone at 67%, but sync is the fastest-growing segment. Taylor Swift, Drake, and The Weeknd lead in overall revenue. Bruno Mars and Bad Bunny show the strongest year-over-year growth. There are 15 active sync negotiations worth a combined $4.2M across the roster.',
    dataType: 'revenueBreakdown',
    followUp: 'Want me to break down per-artist revenue trends or focus on the sync pipeline?',
  },
  playlist: {
    thinking: 'Analyzing playlist positions, add rates, and stream attribution across DSPs for the full roster...',
    response: 'Your roster has a combined playlist reach of 8.2B listeners across all major DSPs. The top performers this week: Taylor Swift holds positions on 12,400+ Spotify playlists, Drake is on 9,800+, and The Weeknd on 8,500+. Emerging artists like Sabrina Carpenter and Chappell Roan are gaining editorial support rapidly. Algorithmic playlists are driving the strongest conversion rates across the board.',
    dataType: 'playlistTiers',
    followUp: 'Want me to identify which playlists are driving the highest conversion to followers?',
  },
  release: {
    thinking: 'Modeling release timing based on playlist cycles, social momentum, and competitive landscape...',
    response: 'Based on current roster activity, the next 2-3 weeks present a strong release window. The competitive landscape is relatively clear with no major releases scheduled from similar artists. Spotify\'s New Music Friday editorial deadline is Tuesday — coordinating submissions could maximize impact. Artists with the strongest momentum right now include Billie Eilish, Doja Cat, and SZA.',
    dataType: 'streamForecast',
    followUp: 'Should I model the impact of different release dates on first-week streams?',
  },
  sync: {
    thinking: 'Reviewing active sync pipeline, placement history, and licensing opportunities across the roster...',
    response: 'The roster sync pipeline is robust with 23 active opportunities worth $8.4M combined. Top pending deals include placements for The Weeknd (HBO series, $320K), Billie Eilish (Apple campaign, $450K), and Dua Lipa (BMW global, $275K). Historical data shows sync placements drive 15-25% streaming lifts for 6+ months. Prioritize closing the premium brand deals this quarter.',
    dataType: 'syncPlacements',
    followUp: 'Want me to estimate the streaming impact of each pending sync deal?',
  },
  audience: {
    thinking: 'Analyzing demographic data, listening patterns, and geographic distribution across the roster...',
    response: 'Your roster spans a diverse global audience. The US is the largest market (35% of total streams), followed by Brazil (12%), Mexico (10%), and the UK (8%). The 18-34 demographic represents 69% of combined listeners. Fastest-growing territories: Nigeria (+89%), India (+72%), and Indonesia (+54%). Bad Bunny and Peso Pluma drive Latin America, while BTS and BLACKPINK dominate Asia-Pacific.',
    dataType: 'audienceDemographics',
    followUp: 'Want me to identify which artists resonate most in each geographic market?',
  },
  growth: {
    thinking: 'Calculating growth trajectories across all metrics and projecting 90-day outlook for the roster...',
    response: 'The roster shows strong overall growth. Combined monthly listeners increased 18% quarter-over-quarter. Top growth artists: Sabrina Carpenter (+45%), Chappell Roan (+38%), and Peso Pluma (+34%). Established acts like Taylor Swift and Drake maintain steady trajectories. The forecast model projects combined daily streams reaching 850M within 30 days if current trends hold.',
    dataType: 'streamForecast',
    followUp: 'Want me to compare growth rates across different artist tiers?',
  },
};

// --- Suggested Prompts ---
export const suggestedPrompts = [
  'Which city should we route our next tour?',
  'Show me breakout signals from the last 48 hours',
  'How is the sync pipeline looking across the roster?',
  'Which artists are driving the streaming spike this week?',
  'When should we schedule the next release?',
  'Break down audience demographics across the roster',
];

// --- Welcome Message ---
export const welcomeMessage = {
  role: 'ai',
  text: "Hi, I'm Cadence. I'm tracking 100 artists across all major platforms including Spotify, Apple Music, TikTok, Instagram, and YouTube. What would you like to know?",
};
