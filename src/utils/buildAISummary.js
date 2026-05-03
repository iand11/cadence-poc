import { allArtists } from '../data/artists';
import { formatNumber } from './formatters';

const rosterSize = allArtists.length;
export const rosterAvg = {
  listeners: allArtists.reduce((s, a) => s + a.spotify.monthlyListeners, 0) / rosterSize,
  followers: allArtists.reduce((s, a) => s + a.spotify.followers, 0) / rosterSize,
  popularity: allArtists.reduce((s, a) => s + a.spotify.popularity, 0) / rosterSize,
  tiktok: allArtists.reduce((s, a) => s + a.social.tiktok, 0) / rosterSize,
  instagram: allArtists.reduce((s, a) => s + a.social.instagram, 0) / rosterSize,
  youtube: allArtists.reduce((s, a) => s + a.social.youtube, 0) / rosterSize,
  playlists: allArtists.reduce((s, a) => s + a.playlists.spotify.total, 0) / rosterSize,
  reach: allArtists.reduce((s, a) => s + a.playlists.spotify.reach, 0) / rosterSize,
  shazam: allArtists.reduce((s, a) => s + a.engagement.shazam, 0) / rosterSize,
};

export function buildAISummary(artist) {
  const a = artist;
  const fmt = formatNumber;
  const listeners = a.spotify.monthlyListeners;
  const followers = a.spotify.followers;
  const pop = a.spotify.popularity;
  const conversionRate = listeners > 0 ? (followers / listeners * 100) : 0;
  const listenerMultiple = rosterAvg.listeners > 0 ? (listeners / rosterAvg.listeners) : 1;

  const parts = [];

  if (a.rank <= 10) {
    parts.push(`${a.name} ranks #${a.rank} in the roster, placing them in the top tier with ${fmt(listeners)} monthly Spotify listeners — ${listenerMultiple.toFixed(1)}x the roster average.`);
  } else if (listenerMultiple > 2) {
    parts.push(`${a.name} significantly outperforms the roster average with ${fmt(listeners)} monthly listeners (${listenerMultiple.toFixed(1)}x average), though ranked #${a.rank} by composite score.`);
  } else if (listenerMultiple < 0.3) {
    parts.push(`${a.name} is an emerging presence at ${fmt(listeners)} monthly listeners, currently below the roster average. Ranked #${a.rank} with significant growth runway ahead.`);
  } else {
    parts.push(`${a.name} holds rank #${a.rank} with ${fmt(listeners)} monthly Spotify listeners, performing ${listenerMultiple >= 1 ? `${listenerMultiple.toFixed(1)}x above` : `at ${(listenerMultiple * 100).toFixed(0)}% of`} the roster average.`);
  }

  if (conversionRate > 30) {
    parts.push(`Fan loyalty is exceptional — ${conversionRate.toFixed(1)}% follower conversion indicates a deeply committed audience that actively seeks out releases rather than passively consuming via playlists.`);
  } else if (conversionRate < 5 && listeners > 1000000) {
    parts.push(`Despite strong listener numbers, follower conversion is only ${conversionRate.toFixed(1)}%, suggesting most streams are playlist-driven rather than from direct fans — a key vulnerability if playlist placements shift.`);
  }

  if (pop >= 80) {
    parts.push(`A ${pop}/100 popularity score places this artist in Spotify's top algorithmic tier — the platform is actively amplifying discovery through Release Radar, Discover Weekly, and autoplay.`);
  } else if (pop < 30 && listeners > 500000) {
    parts.push(`Despite decent listener numbers, a ${pop}/100 popularity score suggests waning algorithmic support — strategic releases and playlist pitching are needed to re-engage Spotify's recommendation engine.`);
  }

  const socials = [
    { name: 'TikTok', val: a.social.tiktok, avg: rosterAvg.tiktok },
    { name: 'Instagram', val: a.social.instagram, avg: rosterAvg.instagram },
    { name: 'YouTube', val: a.social.youtube, avg: rosterAvg.youtube },
  ].filter(s => s.val > 0).sort((x, y) => (y.val / y.avg) - (x.val / x.avg));

  if (socials.length > 0) {
    const strongest = socials[0];
    const weakest = socials[socials.length - 1];
    const strongMult = strongest.avg > 0 ? strongest.val / strongest.avg : 0;
    const weakMult = weakest.avg > 0 ? weakest.val / weakest.avg : 0;

    if (strongMult > 3) {
      parts.push(`${strongest.name} is a standout channel at ${fmt(strongest.val)} followers (${strongMult.toFixed(1)}x roster average)${weakMult < 0.5 && socials.length > 1 ? `, while ${weakest.name} at ${fmt(weakest.val)} represents an underdeveloped opportunity` : ''}.`);
    } else if (weakMult < 0.3 && socials.length > 1) {
      parts.push(`Social presence is uneven — ${weakest.name} at ${fmt(weakest.val)} is significantly behind the roster average and represents a gap in audience reach.`);
    }
  }

  const reachMult = rosterAvg.reach > 0 ? a.playlists.spotify.reach / rosterAvg.reach : 1;
  const editorialRate = a.playlists.spotify.total > 0
    ? (a.playlists.spotify.editorial / a.playlists.spotify.total * 100) : 0;

  if (reachMult > 3 && editorialRate > 0.5) {
    parts.push(`Playlist infrastructure is strong with ${fmt(a.playlists.spotify.reach)} reach across ${fmt(a.playlists.spotify.total)} playlists (${a.playlists.spotify.editorial} editorial) — this catalog has significant algorithmic and editorial support.`);
  } else if (reachMult < 0.3 && listeners > 500000) {
    parts.push(`Playlist reach of ${fmt(a.playlists.spotify.reach)} is underweight relative to listener count — there's significant upside in securing additional editorial placements to convert casual discovery into sustained streams.`);
  }

  const cities = a.spotify.topCities || [];
  if (cities.length > 0) {
    const countries = new Set(cities.map(c => c.country));
    const topCity = cities[0];
    const totalCityListeners = cities.reduce((s, c) => s + c.listeners, 0);
    const topCityPct = totalCityListeners > 0 ? (topCity.listeners / totalCityListeners * 100) : 0;

    if (countries.size >= 8 && topCityPct < 20) {
      parts.push(`Audience spans ${countries.size} countries with no single city exceeding ${topCityPct.toFixed(0)}% — strong geographic diversification that supports international touring and reduces market risk.`);
    } else if (countries.size <= 2) {
      parts.push(`Audience is geographically concentrated in ${countries.size === 1 ? '1 market' : '2 markets'}, led by ${topCity.city} — international expansion could unlock significant new listener growth.`);
    }
  }

  const text = parts.join(' ');

  const keyMetrics = [
    {
      label: 'Monthly Listeners',
      value: fmt(listeners),
      delta: listenerMultiple >= 1 ? `+${((listenerMultiple - 1) * 100).toFixed(0)}% vs avg` : `${((listenerMultiple - 1) * 100).toFixed(0)}% vs avg`,
    },
    {
      label: 'Follower Conversion',
      value: `${conversionRate.toFixed(1)}%`,
      delta: conversionRate > 20 ? '+strong' : conversionRate < 5 ? 'low' : undefined,
    },
    {
      label: 'Popularity',
      value: `${pop}/100`,
      delta: pop > rosterAvg.popularity ? `+${(pop - rosterAvg.popularity).toFixed(0)} vs avg` : `${(pop - rosterAvg.popularity).toFixed(0)} vs avg`,
    },
    {
      label: 'Playlist Reach',
      value: fmt(a.playlists.spotify.reach),
      delta: reachMult >= 1 ? `+${((reachMult - 1) * 100).toFixed(0)}% vs avg` : `${((reachMult - 1) * 100).toFixed(0)}% vs avg`,
    },
  ];

  const suggestions = [
    `Compare ${a.name} to similar artists`,
    'Identify playlist growth opportunities',
    'Analyze social engagement gaps',
  ];

  return { text, keyMetrics, suggestions };
}
