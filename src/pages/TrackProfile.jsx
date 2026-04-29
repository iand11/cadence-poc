import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { TrendingUp, ListMusic, Disc3, Users, Tag, Music, ExternalLink } from 'lucide-react';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import Badge from '../components/shared/Badge';
import { getTrackAsync, getArtist, loadArtistDetail, allArtists } from '../data/artists';
import { generateTrackStreamingTrend, generateTrackPerformance, getTrackPlaylists } from '../data/trackData';
import StreamingTrendChart from '../components/charts/StreamingTrendChart';
import { formatNumber, formatDelta } from '../utils/formatters';

function formatDuration(ms) {
  if (!ms) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatReleaseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatVersionFlag(flag) {
  return flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildTrackSummary(track, artist) {
  const parts = [];
  parts.push(`"${track.name}" by ${artist.name} has accumulated ${formatNumber(track.streams)} Spotify streams.`);

  if (track.spotifyPlaylists > 0) {
    parts.push(`The track sits on ${formatNumber(track.spotifyPlaylists)} Spotify playlists${track.spotifyEditorialPlaylists > 0 ? ` (${track.spotifyEditorialPlaylists} editorial)` : ''}, reaching an audience of ${formatNumber(track.spotifyPlaylistReach)} listeners.`);
  }

  if (track.tiktokVideos > 0) {
    parts.push(`Has been used in ${formatNumber(track.tiktokVideos)} TikTok videos.`);
  }

  if (track.isFeature) {
    const others = track.artistNames.filter(n => n && n !== artist.name);
    if (others.length > 0) {
      parts.push(`This is a featured collaboration with ${others.join(', ')}.`);
    }
  }

  if (track.albumName) {
    parts.push(`Released on "${track.albumName}"${track.albumLabel ? ` via ${track.albumLabel}` : ''}.`);
  }

  return {
    text: parts.join(' '),
    keyMetrics: [
      { label: 'Spotify Streams', value: formatNumber(track.streams) },
      { label: 'Playlists', value: formatNumber(track.spotifyPlaylists) },
      { label: 'Editorial', value: String(track.spotifyEditorialPlaylists) },
      { label: 'Playlist Reach', value: formatNumber(track.spotifyPlaylistReach) },
    ],
    suggestions: [
      `Find similar tracks to "${track.name}"`,
      `What makes "${track.name}" perform well?`,
      `Pitch playlists for "${track.name}"`,
    ],
  };
}

function findFeaturingArtists(track) {
  const others = track.artistNames.filter(n => n);
  return others
    .map(name => allArtists.find(a => a.name === name))
    .filter(Boolean);
}

export default function TrackProfile() {
  const { id } = useParams();
  const [track, setTrack] = useState(undefined); // undefined = loading, null = not found
  const [similar, setSimilar] = useState([]);

  useEffect(() => {
    setTrack(undefined);
    setSimilar([]);
    getTrackAsync(id).then(t => {
      setTrack(t);
      if (t) {
        loadArtistDetail(t.artistSlug).then(detail => {
          setSimilar(detail.tracks.filter(x => x.id !== t.id).slice(0, 6));
        });
      }
    });
  }, [id]);

  if (track === undefined) {
    return (
      <div className="text-center py-20">
        <Music size={32} className="mx-auto text-[#2C2B28] mb-3 animate-pulse" />
        <p className="text-sm text-[#9B9590]">Loading track...</p>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="text-center py-20">
        <Music size={32} className="mx-auto text-[#2C2B28] mb-3" />
        <p className="text-sm text-[#9B9590]">Track not found</p>
        <p className="text-[11px] text-[#6B6560] mt-1">id: {id}</p>
        <Link to="/dashboard" className="inline-block mt-4 text-xs text-[#DA7756] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const artist = getArtist(track.artistSlug);
  const aiSummary = buildTrackSummary(track, artist);
  const collabs = findFeaturingArtists(track);
  const releaseDate = formatReleaseDate(track.releaseDate);

  // Cross-platform playlist totals
  const totalPlaylists =
    track.spotifyPlaylists +
    track.applePlaylists +
    track.deezerPlaylists +
    track.youtubePlaylists;

  const totalReach =
    track.spotifyPlaylistReach +
    track.deezerPlaylistReach +
    track.youtubePlaylistReach;

  return (
    <ProfileLayout
      title={track.name}
      subtitle={
        <Link to={`/artist/${artist.slug}`} className="hover:text-[#DA7756] transition-colors">
          by {artist.name}{track.isFeature ? ' (feature)' : ''}
        </Link>
      }
      type="track"
      aiSummary={aiSummary}
    >
      {/* Overview */}
      <CollapsibleSection title="Overview" icon={Music} defaultOpen={true}>
        <div className="flex flex-col md:flex-row gap-6">
          {track.imageUrl && (
            <motion.img
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              src={track.imageUrl}
              alt={track.name}
              className="w-48 h-48 rounded object-cover border border-[#2C2B28] shrink-0"
            />
          )}

          <div className="flex-1 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {releaseDate && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Disc3 size={13} className="text-[#6B6560]" />
                  <span>Released:</span>
                  <span className="text-[#F5F0E8]">{releaseDate}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[#9B9590]">
                <Music size={13} className="text-[#6B6560]" />
                <span>Duration:</span>
                <span className="text-[#F5F0E8] font-mono">{formatDuration(track.durationMs)}</span>
              </div>
              {track.albumName && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <ListMusic size={13} className="text-[#6B6560]" />
                  <span>Album:</span>
                  {track.albumId ? (
                    <Link to={`/album/${track.albumId}`} className="text-[#F5F0E8] hover:text-[#DA7756] truncate">{track.albumName}</Link>
                  ) : (
                    <span className="text-[#F5F0E8] truncate">{track.albumName}</span>
                  )}
                </div>
              )}
              {track.albumLabel && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Tag size={13} className="text-[#6B6560]" />
                  <span>Label:</span>
                  <span className="text-[#F5F0E8] truncate">{track.albumLabel}</span>
                </div>
              )}
              {track.isrc && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Tag size={13} className="text-[#6B6560]" />
                  <span>ISRC:</span>
                  <span className="text-[#F5F0E8] font-mono text-xs">{track.isrc}</span>
                </div>
              )}
              {track.spotifyTrackId && (
                <a
                  href={`https://open.spotify.com/track/${track.spotifyTrackId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#9B9590] hover:text-[#DA7756] transition-colors"
                >
                  <ExternalLink size={13} className="text-[#6B6560]" />
                  <span>Open in Spotify</span>
                </a>
              )}
            </div>

            {/* Version flags + tags */}
            {(track.versionFlags.length > 0 || track.tags) && (
              <div className="flex flex-wrap gap-1.5">
                {track.tags && (
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-[#2C2B28] text-[#9B9590] rounded px-2 py-0.5 border border-[#3D3B37]">
                    {track.tags}
                  </span>
                )}
                {track.versionFlags.map(f => (
                  <span key={f} className="text-[10px] font-mono bg-[#D4A574]/5 text-[#D4A574]/70 rounded px-2 py-0.5 border border-[#D4A574]/15">
                    {formatVersionFlag(f)}
                  </span>
                ))}
              </div>
            )}

            {/* Collaborators */}
            {collabs.length > 1 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1.5 block">Featured Artists</span>
                <div className="flex flex-wrap gap-1.5">
                  {collabs.map(a => (
                    <Link
                      key={a.slug}
                      to={`/artist/${a.slug}`}
                      className="flex items-center gap-1.5 text-xs bg-[#171614] border border-[#2C2B28] hover:border-[#DA7756]/30 rounded px-2 py-1 transition-colors"
                    >
                      {a.imageUrl && (
                        <img src={a.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />
                      )}
                      <span className="text-[#F5F0E8]">{a.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Performance */}
      <CollapsibleSection title="Streaming Performance" icon={TrendingUp} defaultOpen={true}>
        <div className="space-y-6">
          {(() => {
            const perf = generateTrackPerformance(track);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard title="Spotify Streams" value={track.streams} index={0} />
                <KpiCard
                  title="Est. Daily Streams"
                  value={perf.dailyStreams}
                  delta={perf.growthDelta > 0 ? `+${perf.growthDelta}%` : `${perf.growthDelta}%`}
                  index={1}
                />
                <KpiCard title="Spotify Popularity" value={track.popularity} suffix="/100" index={2} />
                <KpiCard title="Est. Weeks Trending" value={perf.weeksTrending} index={3} />
              </div>
            );
          })()}
          <ChartCard title="Streaming Trends" subtitle="Estimated daily streams by platform (90 days)">
            <StreamingTrendChart data={generateTrackStreamingTrend(track)} />
          </ChartCard>
        </div>
      </CollapsibleSection>

      {/* Playlist breakdown across platforms */}
      <CollapsibleSection title="Playlist Distribution" icon={ListMusic}>
        <ChartCard title="Playlists by platform">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            <PlatformPlaylistRow label="Spotify" total={track.spotifyPlaylists} editorial={track.spotifyEditorialPlaylists} reach={track.spotifyPlaylistReach} />
            <PlatformPlaylistRow label="Apple Music" total={track.applePlaylists} editorial={track.appleEditorialPlaylists} />
            <PlatformPlaylistRow label="Deezer" total={track.deezerPlaylists} reach={track.deezerPlaylistReach} />
            <PlatformPlaylistRow label="YouTube" total={track.youtubePlaylists} reach={track.youtubePlaylistReach} />
            <PlatformPlaylistRow label="TikTok Videos" total={track.tiktokVideos} hideEditorial />
          </div>
        </ChartCard>
      </CollapsibleSection>

      {/* Active Playlist Placements */}
      {(() => {
        const placements = getTrackPlaylists(track);
        if (placements.length === 0) return null;
        const shown = placements.slice(0, 10);
        return (
          <CollapsibleSection title="Playlist Placements" icon={ListMusic}>
            <ChartCard title={`${placements.length} playlist${placements.length === 1 ? '' : 's'} featuring ${artist.name}`}>
              <div className="space-y-1">
                {shown.map((p, i) => (
                  <Link key={`${p.playlistId}-${i}`} to={`/playlist/${p.playlistId}`} className="block">
                    <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                      <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{p.playlistName}</p>
                        <p className="text-[10px] text-[#6B6560] truncate">{p.curator}</p>
                      </div>
                      <Badge variant={p.type === 'editorial' ? 'success' : p.type === 'algorithmic' ? 'info' : 'warning'}>{p.type}</Badge>
                      {p.position && (
                        <span className="hidden sm:inline text-[10px] font-mono text-[#9B9590] w-8 text-right shrink-0">#{p.position}</span>
                      )}
                      <span className="text-xs font-mono text-[#F5F0E8] w-16 text-right shrink-0">{formatNumber(p.streamsFromPlaylist)}</span>
                    </div>
                  </Link>
                ))}
              </div>
              {placements.length > 10 && (
                <p className="text-[10px] text-[#6B6560] mt-3 text-center">
                  Showing 10 of {placements.length} playlists
                </p>
              )}
            </ChartCard>
          </CollapsibleSection>
        );
      })()}

      {/* Similar tracks (same artist) */}
      {similar.length > 0 && (
        <CollapsibleSection title={`More from ${artist.name}`} icon={Users}>
          <ChartCard title="Other top tracks">
            <div className="space-y-1">
              {similar.map((t, i) => (
                <Link key={t.id} to={`/track/${t.id}`} className="block">
                  <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                    <span className="text-[10px] font-mono text-[#6B6560] w-6 text-right shrink-0">{i + 1}</span>
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                        <Music size={12} className="text-[#6B6560]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{t.name}</p>
                      <p className="text-[10px] text-[#6B6560] truncate">{t.albumName || '—'}</p>
                    </div>
                    <span className="text-xs font-mono text-[#9B9590] shrink-0">{formatNumber(t.streams)}</span>
                    {t.isFeature && <Badge variant="info">feat</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          </ChartCard>
        </CollapsibleSection>
      )}
    </ProfileLayout>
  );
}

function PlatformPlaylistRow({ label, total, editorial, reach, hideEditorial }) {
  if (!total && !reach && !editorial) {
    return (
      <div className="bg-[#100F0E] border border-[#2C2B28] rounded px-3 py-3 text-xs text-[#6B6560]">
        <span className="font-medium text-[#9B9590]">{label}</span> — no data
      </div>
    );
  }
  return (
    <div className="bg-[#100F0E] border border-[#2C2B28] rounded px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#F5F0E8]">{label}</span>
        <span className="text-[10px] font-mono text-[#9B9590]">{formatNumber(total)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {!hideEditorial && (
          <div>
            <p className="text-[#6B6560] uppercase tracking-wider">Editorial</p>
            <p className="font-mono text-[#F5F0E8]">{formatNumber(editorial || 0)}</p>
          </div>
        )}
        {reach != null && (
          <div>
            <p className="text-[#6B6560] uppercase tracking-wider">Reach</p>
            <p className="font-mono text-[#F5F0E8]">{formatNumber(reach)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
