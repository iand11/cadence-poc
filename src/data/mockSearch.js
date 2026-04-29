import { allArtists, searchArtists } from './artists';

function formatListeners(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// Build searchable entities from real artist data
const artistEntities = allArtists.map(a => ({
  type: 'artist',
  id: a.slug,
  name: a.name,
  subtitle: (a.genres?.primary?.name || 'Music') + ' \u00b7 ' + (a.label || 'Independent'),
  path: '/artist/' + a.slug,
  metrics: {
    listeners: formatListeners(a.spotify.monthlyListeners),
    rank: '#' + a.rank,
  },
}));

// Static playlist and chart entries
const staticEntities = [
  // Playlists
  { type: 'playlist', id: 'todays-top-hits', name: "Today's Top Hits", subtitle: 'Spotify Editorial', path: '/playlist/todays-top-hits', metrics: { followers: '34.2M', tracks: 50 } },
  { type: 'playlist', id: 'new-music-friday', name: 'New Music Friday', subtitle: 'Spotify Editorial', path: '/playlist/new-music-friday', metrics: { followers: '15.8M', tracks: 100 } },
  { type: 'playlist', id: 'pop-rising', name: 'Pop Rising', subtitle: 'Spotify Editorial', path: '/playlist/pop-rising', metrics: { followers: '8.4M', tracks: 50 } },
  { type: 'playlist', id: 'discover-weekly', name: 'Discover Weekly', subtitle: 'Spotify Algorithmic', path: '/playlist/discover-weekly', metrics: { followers: 'Personalized', tracks: 30 } },
  { type: 'playlist', id: 'alt-pop-essentials', name: 'Alt Pop Essentials', subtitle: 'Apple Music', path: '/playlist/alt-pop-essentials', metrics: { followers: '2.1M', tracks: 75 } },

  // Charts
  { type: 'chart', id: 'billboard-hot-100', name: 'Billboard Hot 100', subtitle: 'Weekly Singles Chart', path: '/chart/billboard-hot-100', metrics: { entries: 100 } },
  { type: 'chart', id: 'spotify-top-50-global', name: 'Spotify Top 50 Global', subtitle: 'Daily Chart', path: '/chart/spotify-top-50-global', metrics: { entries: 50 } },
  { type: 'chart', id: 'apple-music-top-100', name: 'Apple Music Top 100', subtitle: 'Daily Chart', path: '/chart/apple-music-top-100', metrics: { entries: 100 } },
  { type: 'chart', id: 'uk-singles-chart', name: 'UK Official Singles Chart', subtitle: 'Weekly Chart', path: '/chart/uk-singles-chart', metrics: { entries: 100 } },
];

export const searchableEntities = [...artistEntities, ...staticEntities];

export function searchEntities(query, category = 'all') {
  if (!query || query.trim().length === 0) return [];
  const lower = query.toLowerCase();
  return searchableEntities
    .filter(e => {
      if (category !== 'all' && !e.type.startsWith(category.replace(/s$/, ''))) return false;
      return e.name.toLowerCase().includes(lower) || e.subtitle.toLowerCase().includes(lower);
    })
    .slice(0, 8);
}
