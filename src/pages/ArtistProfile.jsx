import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Music, TrendingUp, Users, DollarSign, Radio, Globe, Disc3, MapPin, Tag, Star, ListMusic, FileText } from 'lucide-react';
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
import { getCountryName } from '../utils/countryNames';
import { buildAISummary } from '../utils/buildAISummary';


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
        <div className="flex items-center gap-2">
          <Link
            to={`/artist/${artist.slug}/sheet`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-[#DA7756]/20 bg-[#DA7756]/10 text-[#DA7756] hover:bg-[#DA7756]/20 transition-colors"
          >
            <FileText size={14} />
            Create an Artist Sheet
          </Link>
          <button
            onClick={() => toggleFavorite(artist.slug)}
            className="p-1.5 rounded hover:bg-[#2C2B28] transition-colors cursor-pointer"
          >
            <Star
              size={20}
              className={isFavorite(artist.slug) ? 'fill-[#DA7756] text-[#DA7756]' : 'text-[#6B6560] hover:text-[#9B9590]'}
            />
          </button>
        </div>
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
                  className="w-48 h-48 rounded object-cover border border-[#2C2B28]"
                />
              </motion.div>
            )}

            {/* Details */}
            <div className="flex-1 space-y-4">
              {/* Meta grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {artist.label && (
                  <div className="flex items-center gap-2 text-[#9B9590]">
                    <Tag size={13} className="text-[#6B6560]" />
                    <span>Label:</span>
                    <span className="text-[#F5F0E8]">{artist.label}</span>
                  </div>
                )}
                {(artist.city || artist.country) && (
                  <div className="flex items-center gap-2 text-[#9B9590]">
                    <MapPin size={13} className="text-[#6B6560]" />
                    <span>Location:</span>
                    <span className="text-[#F5F0E8]">
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
                      className="text-[10px] font-mono uppercase tracking-wider bg-[#2C2B28] text-[#9B9590] rounded px-2 py-0.5 border border-[#3D3B37]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Collaborators */}
              {artist.collaborators?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1 block">Top Collaborators</span>
                  <div className="flex flex-wrap gap-1.5">
                    {artist.collaborators.slice(0, 8).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] font-mono bg-[#D4A574]/5 text-[#D4A574]/70 rounded px-2 py-0.5 border border-[#D4A574]/10"
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
                  <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                    <span className="text-[10px] font-mono text-[#6B6560] w-6 text-right shrink-0">{i + 1}</span>
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                        <Music size={12} className="text-[#6B6560]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{t.name}</p>
                        {t.isFeature && <Badge variant="info">feat</Badge>}
                      </div>
                      <p className="text-[10px] text-[#6B6560] truncate">
                        {t.albumName || '—'}{t.releaseDate ? ` · ${new Date(t.releaseDate).getFullYear()}` : ''}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Playlists</span>
                      <span className="text-xs font-mono text-[#9B9590]">{formatNumber(t.spotifyPlaylists)}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 w-20">
                      <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Streams</span>
                      <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(t.streams)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {tracks.length > 12 && (
              <p className="text-[10px] text-[#6B6560] mt-3 text-center">
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
                  <div className="aspect-square rounded overflow-hidden bg-[#2C2B28] border border-[#2C2B28] group-hover:border-[#DA7756]/30 transition-colors mb-2">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc3 size={24} className="text-[#6B6560]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{a.name}</p>
                  <p className="text-[10px] text-[#6B6560] truncate">
                    {a.releaseDate ? new Date(a.releaseDate).getFullYear() : '—'}
                    {a.type ? ` · ${a.type}` : ''}
                    {a.numTracks ? ` · ${a.numTracks} tracks` : ''}
                  </p>
                </Link>
              ))}
            </div>
            {albums.length > 24 && (
              <p className="text-[10px] text-[#6B6560] mt-4 text-center">
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
                      <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                        <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="w-7 h-7 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                          <ListMusic size={11} className="text-[#6B6560]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{p.playlistName}</p>
                          <p className="text-[10px] text-[#6B6560] truncate">{p.curator}</p>
                        </div>
                        <Badge variant={p.type === 'editorial' ? 'success' : p.type === 'algorithmic' ? 'info' : 'warning'}>{p.type}</Badge>
                        {p.position && (
                          <span className="hidden sm:inline text-[10px] font-mono text-[#9B9590] w-8 text-right shrink-0">#{p.position}</span>
                        )}
                        <div className="flex flex-col items-end shrink-0 w-16">
                          <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(p.streamsFromPlaylist)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {activePlaylists.length > 15 && (
                  <p className="text-[10px] text-[#6B6560] mt-3 text-center">
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
              <div className="mt-4 pt-4 border-t border-[#2C2B28]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {geographyData.map((c, i) => {
                    const pct = geographyData[0]?.listeners > 0
                      ? (c.listeners / geographyData[0].listeners) * 100 : 0;
                    return (
                      <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 py-2 border-b border-[#2C2B28]/50 last:border-0">
                        <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-[#F5F0E8] truncate">{c.city}</span>
                            <span className="text-[10px] text-[#6B6560]">{getCountryName(c.country)}</span>
                          </div>
                          <div className="mt-1 h-1 bg-[#2C2B28] rounded-full overflow-hidden">
                            <div className="h-full bg-[#DA7756] rounded-full" style={{ width: `${Math.max(pct, 2)}%`, opacity: 0.4 + (pct / 100) * 0.6 }} />
                          </div>
                        </div>
                        <span className="text-xs font-mono text-[#9B9590] shrink-0">{formatNumber(c.listeners)}</span>
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
