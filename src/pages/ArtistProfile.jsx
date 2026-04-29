import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Music, TrendingUp, Users, DollarSign, Radio, Globe, Disc3, MapPin, Tag, Star, ListMusic } from 'lucide-react';
import Badge from '../components/shared/Badge';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';

import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import SocialGrowthChart from '../components/charts/SocialGrowthChart';
import RevenueDonutChart from '../components/charts/RevenueDonutChart';
import GeographyHeatMap from '../components/charts/GeographyHeatMap';
import BenchmarkRadarChart from '../components/charts/BenchmarkRadarChart';
import ForecastChart from '../components/charts/ForecastChart';
import PlaylistDistributionChart from '../components/charts/PlaylistDistributionChart';
import {
  allArtists,
  getArtist,
  loadArtistDetail,
  generateStreamingTrend,
  generateSocialTimeline,
  generateForecast,
  generateRevenue,
  getBenchmarkComparison,
} from '../data/artists';
import { getArtistPlaylists } from '../data/playlistData';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { generateInsights } from '../utils/insights';
import InsightCallout from '../components/shared/InsightCallout';
import { useFavorites } from '../hooks/useFavorites';

// Country code to name mapping
const countryNames = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', BR: 'Brazil', MX: 'Mexico', JP: 'Japan',
  KR: 'South Korea', IN: 'India', ID: 'Indonesia', PH: 'Philippines',
  TH: 'Thailand', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden',
  NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', TR: 'Turkey',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru', ZA: 'South Africa',
  NZ: 'New Zealand', IE: 'Ireland', PT: 'Portugal', AT: 'Austria', CH: 'Switzerland',
  BE: 'Belgium', RU: 'Russia', UA: 'Ukraine', TW: 'Taiwan', SG: 'Singapore',
  MY: 'Malaysia', VN: 'Vietnam', NG: 'Nigeria', EG: 'Egypt', SA: 'Saudi Arabia',
  AE: 'United Arab Emirates', IL: 'Israel', CZ: 'Czech Republic', RO: 'Romania',
  HU: 'Hungary', GR: 'Greece', HR: 'Croatia', PR: 'Puerto Rico', DO: 'Dominican Republic',
  GT: 'Guatemala', EC: 'Ecuador', VE: 'Venezuela', PK: 'Pakistan', BD: 'Bangladesh',
  LK: 'Sri Lanka', KE: 'Kenya', GH: 'Ghana', TZ: 'Tanzania', HK: 'Hong Kong',
};

function getCountryName(code) {
  return countryNames[code] || code || 'Unknown';
}

// Pre-compute roster averages for comparison
const rosterSize = allArtists.length;
const rosterAvg = {
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

function buildAISummary(artist) {
  const a = artist;
  const fmt = formatNumber;
  const listeners = a.spotify.monthlyListeners;
  const followers = a.spotify.followers;
  const pop = a.spotify.popularity;
  const conversionRate = listeners > 0 ? (followers / listeners * 100) : 0;
  const listenerMultiple = rosterAvg.listeners > 0 ? (listeners / rosterAvg.listeners) : 1;

  // Build analysis paragraphs based on what's notable
  const parts = [];

  // Opening — rank + competitive position
  if (a.rank <= 10) {
    parts.push(`${a.name} ranks #${a.rank} in the roster, placing them in the top tier with ${fmt(listeners)} monthly Spotify listeners — ${listenerMultiple.toFixed(1)}x the roster average.`);
  } else if (listenerMultiple > 2) {
    parts.push(`${a.name} significantly outperforms the roster average with ${fmt(listeners)} monthly listeners (${listenerMultiple.toFixed(1)}x average), though ranked #${a.rank} by composite score.`);
  } else if (listenerMultiple < 0.3) {
    parts.push(`${a.name} is an emerging presence at ${fmt(listeners)} monthly listeners, currently below the roster average. Ranked #${a.rank} with significant growth runway ahead.`);
  } else {
    parts.push(`${a.name} holds rank #${a.rank} with ${fmt(listeners)} monthly Spotify listeners, performing ${listenerMultiple >= 1 ? `${listenerMultiple.toFixed(1)}x above` : `at ${(listenerMultiple * 100).toFixed(0)}% of`} the roster average.`);
  }

  // Fan conversion analysis
  if (conversionRate > 30) {
    parts.push(`Fan loyalty is exceptional — ${conversionRate.toFixed(1)}% follower conversion indicates a deeply committed audience that actively seeks out releases rather than passively consuming via playlists.`);
  } else if (conversionRate < 5 && listeners > 1000000) {
    parts.push(`Despite strong listener numbers, follower conversion is only ${conversionRate.toFixed(1)}%, suggesting most streams are playlist-driven rather than from direct fans — a key vulnerability if playlist placements shift.`);
  }

  // Popularity momentum
  if (pop >= 80) {
    parts.push(`A ${pop}/100 popularity score places this artist in Spotify's top algorithmic tier — the platform is actively amplifying discovery through Release Radar, Discover Weekly, and autoplay.`);
  } else if (pop < 30 && listeners > 500000) {
    parts.push(`Despite decent listener numbers, a ${pop}/100 popularity score suggests waning algorithmic support — strategic releases and playlist pitching are needed to re-engage Spotify's recommendation engine.`);
  }

  // Social standout or gap
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

  // Playlist + reach position
  const reachMult = rosterAvg.reach > 0 ? a.playlists.spotify.reach / rosterAvg.reach : 1;
  const editorialRate = a.playlists.spotify.total > 0
    ? (a.playlists.spotify.editorial / a.playlists.spotify.total * 100) : 0;

  if (reachMult > 3 && editorialRate > 0.5) {
    parts.push(`Playlist infrastructure is strong with ${fmt(a.playlists.spotify.reach)} reach across ${fmt(a.playlists.spotify.total)} playlists (${a.playlists.spotify.editorial} editorial) — this catalog has significant algorithmic and editorial support.`);
  } else if (reachMult < 0.3 && listeners > 500000) {
    parts.push(`Playlist reach of ${fmt(a.playlists.spotify.reach)} is underweight relative to listener count — there's significant upside in securing additional editorial placements to convert casual discovery into sustained streams.`);
  }

  // Geography insight
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

  // Key metrics with comparative deltas
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


export default function ArtistProfile() {
  const { id } = useParams();
  const artist = getArtist(id);
  const { toggleFavorite, isFavorite } = useFavorites();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setDetail(null);
    loadArtistDetail(artist.slug).then(setDetail);
  }, [artist.slug]);

  const tracks = detail?.tracks || [];
  const albums = detail?.albums || [];

  // Generate all data from real artist metrics
  const streamingData = generateStreamingTrend(artist);
  const socialData = generateSocialTimeline(artist);
  const forecastData = generateForecast(artist);
  const revenueData = generateRevenue(artist);
  const benchmarkData = getBenchmarkComparison(artist);
  const geographyData = artist.spotify.topCities;
  const totalRevenue = revenueData.reduce((sum, r) => sum + r.amount, 0);
  const aiSummary = buildAISummary(artist);
  const insights = generateInsights(artist);

  const primaryGenre = artist.genres?.primary?.name || 'Artist';
  const secondaryGenres = artist.genres?.secondary || [];
  const allGenres = [primaryGenre, ...secondaryGenres.map(g => typeof g === 'string' ? g : g.name)].filter(Boolean);

  return (
    <ProfileLayout
      title={artist.name}
      subtitle={primaryGenre}
      type="artist"
      aiSummary={aiSummary}
      headerRight={
        <button
          onClick={() => toggleFavorite(artist.slug)}
          className="p-1.5 rounded hover:bg-[#1E1E1E] transition-colors cursor-pointer"
        >
          <Star
            size={20}
            className={isFavorite(artist.slug) ? 'fill-[#00D4FF] text-[#00D4FF]' : 'text-[#444444] hover:text-[#888888]'}
          />
        </button>
      }
    >
      {/* Overview */}
      <CollapsibleSection title="Overview" icon={Music} defaultOpen={true}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Artist Image */}
            {artist.imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex-shrink-0"
              >
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="w-48 h-48 rounded object-cover border border-[#1E1E1E]"
                />
              </motion.div>
            )}

            {/* Details */}
            <div className="flex-1 space-y-4">
              {/* Meta grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {artist.label && (
                  <div className="flex items-center gap-2 text-[#888888]">
                    <Tag size={13} className="text-[#444444]" />
                    <span>Label:</span>
                    <span className="text-[#F4F0EA]">{artist.label}</span>
                  </div>
                )}
                {(artist.city || artist.country) && (
                  <div className="flex items-center gap-2 text-[#888888]">
                    <MapPin size={13} className="text-[#444444]" />
                    <span>Location:</span>
                    <span className="text-[#F4F0EA]">
                      {[artist.city, getCountryName(artist.country)].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Genres (max 3) */}
              {allGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allGenres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="text-[10px] font-mono uppercase tracking-wider bg-[#1E1E1E] text-[#888888] rounded px-2 py-0.5 border border-[#2A2A2A]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Collaborators */}
              {artist.collaborators?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#888888] mb-1 block">Top Collaborators</span>
                  <div className="flex flex-wrap gap-1.5">
                    {artist.collaborators.slice(0, 8).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] font-mono bg-[#5b9bd5]/5 text-[#5b9bd5]/70 rounded px-2 py-0.5 border border-[#5b9bd5]/10"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Streaming Performance */}
      <CollapsibleSection title="Streaming Performance" icon={TrendingUp}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Monthly Listeners"
              value={artist.spotify.monthlyListeners}
              delta={artist.spotify.listenersRank ? `Rank #${formatNumber(artist.spotify.listenersRank)}` : undefined}
              index={0}
            />
            <KpiCard
              title="Spotify Followers"
              value={artist.spotify.followers}
              delta={artist.spotify.followersRank ? `Rank #${formatNumber(artist.spotify.followersRank)}` : undefined}
              index={1}
            />
            <KpiCard
              title="Popularity Score"
              value={artist.spotify.popularity}
              suffix="/100"
              index={2}
            />
            <KpiCard
              title="Shazam Count"
              value={artist.engagement.shazam}
              index={3}
            />
          </div>
          <ChartCard title="Streaming Trends" subtitle="Daily streams by platform (90 days)">
            <StreamingTrendChart data={streamingData} />
            <InsightCallout insights={insights.streaming} />
          </ChartCard>
        </div>
      </CollapsibleSection>

      {/* Top Tracks */}
      {tracks.length > 0 && (
        <CollapsibleSection title="Top Tracks" icon={ListMusic} defaultOpen={true}>
          <ChartCard title={`${tracks.length} tracked song${tracks.length === 1 ? '' : 's'} — sorted by Spotify streams`}>
            <div className="space-y-1">
              {tracks.slice(0, 12).map((t, i) => (
                <Link key={t.id} to={`/track/${t.id}`} className="block">
                  <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#141414] transition-colors group">
                    <span className="text-[10px] font-mono text-[#444444] w-6 text-right shrink-0">{i + 1}</span>
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                        <Music size={12} className="text-[#444444]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{t.name}</p>
                        {t.isFeature && <Badge variant="info">feat</Badge>}
                      </div>
                      <p className="text-[10px] text-[#444444] truncate">
                        {t.albumName || '—'}{t.releaseDate ? ` · ${new Date(t.releaseDate).getFullYear()}` : ''}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#444444]">Playlists</span>
                      <span className="text-xs font-mono text-[#888888]">{formatNumber(t.spotifyPlaylists)}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 w-20">
                      <span className="text-[10px] uppercase tracking-wider text-[#444444]">Streams</span>
                      <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(t.streams)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {tracks.length > 12 && (
              <p className="text-[10px] text-[#444444] mt-3 text-center">
                Showing 12 of {tracks.length} tracks
              </p>
            )}
          </ChartCard>
        </CollapsibleSection>
      )}

      {/* Albums & Releases */}
      {albums.length > 0 && (
        <CollapsibleSection title="Discography" icon={Disc3}>
          <ChartCard title={`${albums.length} release${albums.length === 1 ? '' : 's'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 pt-2">
              {albums.slice(0, 24).map(a => (
                <Link key={a.id} to={`/album/${a.id}`} className="group block">
                  <div className="aspect-square rounded overflow-hidden bg-[#1E1E1E] border border-[#1E1E1E] group-hover:border-[#00D4FF]/30 transition-colors mb-2">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc3 size={24} className="text-[#444444]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{a.name}</p>
                  <p className="text-[10px] text-[#444444] truncate">
                    {a.releaseDate ? new Date(a.releaseDate).getFullYear() : '—'}
                    {a.type ? ` · ${a.type}` : ''}
                    {a.numTracks ? ` · ${a.numTracks} tracks` : ''}
                  </p>
                </Link>
              ))}
            </div>
            {albums.length > 24 && (
              <p className="text-[10px] text-[#444444] mt-4 text-center">
                Showing 24 of {albums.length} releases
              </p>
            )}
          </ChartCard>
        </CollapsibleSection>
      )}

      {/* Social & Engagement */}
      <CollapsibleSection title="Social & Engagement" icon={Users}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="TikTok"
              value={artist.social.tiktok}
              delta={artist.social.tiktokRank ? `Rank #${formatNumber(artist.social.tiktokRank)}` : undefined}
              index={0}
            />
            <KpiCard
              title="Instagram"
              value={artist.social.instagram}
              delta={artist.social.instagramRank ? `Rank #${formatNumber(artist.social.instagramRank)}` : undefined}
              index={1}
            />
            <KpiCard
              title="Twitter / X"
              value={artist.social.twitter}
              index={2}
            />
            <KpiCard
              title="YouTube"
              value={artist.social.youtube}
              delta={artist.social.youtubeRank ? `Rank #${formatNumber(artist.social.youtubeRank)}` : undefined}
              index={3}
            />
          </div>
          <ChartCard title="Social Growth" subtitle="Follower trends over time (90 days)">
            <SocialGrowthChart data={socialData} />
            <InsightCallout insights={insights.social} />
          </ChartCard>
        </div>
      </CollapsibleSection>

      {/* Platform Analytics */}
      <CollapsibleSection title="Platform Analytics" icon={Radio}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Spotify Playlists"
              value={artist.playlists.spotify.total}
              delta={`${artist.playlists.spotify.editorial} editorial`}
              index={0}
            />
            <KpiCard
              title="Playlist Reach"
              value={artist.playlists.spotify.reach}
              index={1}
            />
            <KpiCard
              title="Editorial Reach"
              value={artist.playlists.spotify.editorialReach}
              index={2}
            />
            <KpiCard
              title="Total Cross-Platform"
              value={
                artist.playlists.spotify.total +
                artist.playlists.apple.total +
                artist.playlists.deezer.total +
                artist.playlists.amazon.total +
                artist.playlists.youtube.total
              }
              index={3}
            />
          </div>
          <ChartCard title="Playlist Distribution by Platform" subtitle="Editorial vs user/algorithmic across platforms">
            <PlaylistDistributionChart playlists={artist.playlists} />
            <InsightCallout insights={insights.playlists} />
          </ChartCard>
          {(() => {
            const activePlaylists = getArtistPlaylists(artist.slug);
            if (activePlaylists.length === 0) return null;
            const shown = activePlaylists.slice(0, 15);
            return (
              <ChartCard title="Active Playlists" subtitle={`${activePlaylists.length} playlist placement${activePlaylists.length === 1 ? '' : 's'}`}>
                <div className="space-y-1">
                  {shown.map((p, i) => (
                    <Link key={`${p.playlistId}-${i}`} to={`/playlist/${p.playlistId}`} className="block">
                      <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#141414] transition-colors group">
                        <span className="text-[10px] font-mono text-[#444444] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="w-7 h-7 rounded bg-[#1E1E1E] flex items-center justify-center shrink-0">
                          <ListMusic size={11} className="text-[#444444]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F4F0EA] truncate group-hover:text-[#00D4FF] transition-colors">{p.playlistName}</p>
                          <p className="text-[10px] text-[#444444] truncate">{p.curator}</p>
                        </div>
                        <Badge variant={p.type === 'editorial' ? 'success' : p.type === 'algorithmic' ? 'info' : 'warning'}>{p.type}</Badge>
                        {p.position && (
                          <span className="hidden sm:inline text-[10px] font-mono text-[#888888] w-8 text-right shrink-0">#{p.position}</span>
                        )}
                        <div className="flex flex-col items-end shrink-0 w-16">
                          <span className="text-xs font-mono text-[#F4F0EA]">{formatNumber(p.streamsFromPlaylist)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {activePlaylists.length > 15 && (
                  <p className="text-[10px] text-[#444444] mt-3 text-center">
                    Showing 15 of {activePlaylists.length} playlists
                  </p>
                )}
              </ChartCard>
            );
          })()}
        </div>
      </CollapsibleSection>

      {/* Audience & Geography */}
      <CollapsibleSection title="Audience & Geography" icon={Globe}>
        <div className="space-y-6">
          {geographyData.length > 0 && (
            <ChartCard title="Geographic Distribution" subtitle="Listeners by city">
              <GeographyHeatMap data={geographyData} />
              {/* City list */}
              <div className="mt-4 pt-4 border-t border-[#1E1E1E]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {geographyData.map((c, i) => {
                    const pct = geographyData[0]?.listeners > 0
                      ? (c.listeners / geographyData[0].listeners) * 100 : 0;
                    return (
                      <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 py-2 border-b border-[#1E1E1E]/50 last:border-0">
                        <span className="text-[10px] font-mono text-[#444444] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-[#F4F0EA] truncate">{c.city}</span>
                            <span className="text-[10px] text-[#444444]">{getCountryName(c.country)}</span>
                          </div>
                          <div className="mt-1 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
                            <div className="h-full bg-[#00D4FF] rounded-full" style={{ width: `${Math.max(pct, 2)}%`, opacity: 0.4 + (pct / 100) * 0.6 }} />
                          </div>
                        </div>
                        <span className="text-xs font-mono text-[#888888] shrink-0">{formatNumber(c.listeners)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ChartCard>
          )}
          <ChartCard title="Benchmark Comparison" subtitle="vs average across all artists">
            <BenchmarkRadarChart
              artist={benchmarkData.artist}
              benchmark={benchmarkData.benchmark}
              dimensions={benchmarkData.dimensions}
              artistName={artist.name}
            />
            <InsightCallout insights={insights.geography} />
          </ChartCard>
        </div>
      </CollapsibleSection>

      {/* AI Forecasting */}
      <CollapsibleSection title="AI Forecasting" icon={Disc3}>
        <ChartCard title="Stream Forecast" subtitle="60-day actual + 30-day prediction">
          <ForecastChart data={forecastData} todayIndex={59} />
        </ChartCard>
      </CollapsibleSection>

      {/* Revenue Estimate */}
      <CollapsibleSection title="Revenue Estimate" icon={DollarSign}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {revenueData.map((r, i) => (
              <KpiCard
                key={r.source}
                title={r.source}
                value={r.amount}
                prefix="$"
                delta={`${r.percentage}%`}
                index={i}
              />
            ))}
          </div>
          <ChartCard title="Revenue Breakdown" subtitle={`Estimated annual: ${formatCurrency(totalRevenue)}`}>
            <RevenueDonutChart data={revenueData} totalRevenue={totalRevenue} />
            <InsightCallout insights={insights.revenue} />
          </ChartCard>
        </div>
      </CollapsibleSection>
    </ProfileLayout>
  );
}
