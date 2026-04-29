// --- Spotify Comparison (Artist vs Genre Benchmark) ---
export const spotifyComparison = {
  dimensions: [
    'Monthly Listeners',
    'Save Rate',
    'Playlist Reach',
    'Skip Rate',
    'Completion Rate',
    'Discovery Rate',
  ],
  artist: {
    monthlyListeners: 8400000,
    saveRate: 4.2,
    playlistReach: 34000000,
    skipRate: 22,
    completionRate: 78,
    discoveryRate: 41,
    // Normalized values (0-100 scale) for radar chart
    normalized: [84, 74, 81, 78, 78, 72],
  },
  benchmark: {
    monthlyListeners: 5200000,
    saveRate: 3.1,
    playlistReach: 21000000,
    skipRate: 31,
    completionRate: 68,
    discoveryRate: 33,
    // Normalized values (0-100 scale) for radar chart
    normalized: [52, 55, 50, 52, 68, 58],
  },
};

// --- Audience Demographics ---
export const audienceDemographics = {
  age: [
    { group: '18-24', percentage: 38 },
    { group: '25-34', percentage: 31 },
    { group: '35-44', percentage: 18 },
    { group: '45+', percentage: 13 },
  ],
  gender: {
    male: 44,
    female: 48,
    other: 8,
  },
};

// --- Release History ---
export const releaseHistory = [
  {
    title: 'Midnight Frequency',
    releaseDate: '2024-06-14',
    firstWeekStreams: 12400000,
    saveRate: 4.8,
    playlistAdds: 1840,
    skipRate: 19,
  },
  {
    title: 'Neon Pulse',
    releaseDate: '2024-03-22',
    firstWeekStreams: 9800000,
    saveRate: 4.1,
    playlistAdds: 1420,
    skipRate: 21,
  },
  {
    title: 'Glass Cathedral',
    releaseDate: '2025-01-31',
    firstWeekStreams: 15200000,
    saveRate: 5.3,
    playlistAdds: 2180,
    skipRate: 17,
  },
  {
    title: 'Velvet Thunder',
    releaseDate: '2023-11-10',
    firstWeekStreams: 7600000,
    saveRate: 3.6,
    playlistAdds: 980,
    skipRate: 24,
  },
  {
    title: 'Starlight Drive',
    releaseDate: '2025-03-07',
    firstWeekStreams: 11800000,
    saveRate: 5.8,
    playlistAdds: 1960,
    skipRate: 16,
  },
];
