// Chart profile mock — the only surviving export of the old mockProfiles
// module (the artist/track/playlist profile builders were dead code and the
// static roster they leaned on is gone). Charts aren't in the database yet,
// so this page renders a plausible chart from the user's tracked roster.
import { getRoster } from './rosterStore';

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

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

export function getChartProfile(id) {
  // Chart entries come from the tracked roster, best-ranked first
  const top = [...getRoster()]
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, 10);
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
      change: change > 0 ? `+${change}` : change === 0 ? '—' : String(change),
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
      text: topArtist
        ? `The ${chart.name} features ${chartEntries.length} tracked artists this week. ${topArtist.name} leads at #1 with strong streaming velocity. The roster has multiple entries showing positive movement across the chart.`
        : `No tracked artists to map onto the ${chart.name} yet — track some artists to see their chart footprint here.`,
      keyMetrics: [
        { label: 'Roster Entries', value: String(chartEntries.length) },
        { label: 'Highest Position', value: chartEntries.length ? '#1' : '—' },
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
