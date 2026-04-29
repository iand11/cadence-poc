import { getTopArtists } from './artists';

const top4 = getTopArtists(4);

export const chartHighlights = top4.map((artist, i) => {
  const charts = ['Billboard Hot 100', 'Spotify Top 50', 'Apple Music 100', 'UK Singles'];
  const changes = ['+6', '+4', '+2', '+33'];
  return {
    chart: charts[i],
    position: artist.rank,
    track: artist.name,
    change: changes[i],
    trend: 'up',
  };
});
