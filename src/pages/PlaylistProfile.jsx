import { useParams, Link } from 'react-router';
import { Music, TrendingUp, Users, ListMusic, BarChart3, Disc3 } from 'lucide-react';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import Badge from '../components/shared/Badge';
import { getPlaylist } from '../data/playlistData';
import { formatNumber, formatDelta } from '../utils/formatters';

function PlatformBadge({ platform }) {
  const colors = {
    spotify: 'bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20',
    apple: 'bg-[#FC3C44]/10 text-[#FC3C44] border-[#FC3C44]/20',
    deezer: 'bg-[#A238FF]/10 text-[#A238FF] border-[#A238FF]/20',
    amazon: 'bg-[#25D1DA]/10 text-[#25D1DA] border-[#25D1DA]/20',
    youtube: 'bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20',
  };
  return (
    <span className={`text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${colors[platform] || colors.spotify}`}>
      {platform}
    </span>
  );
}

function TypeBadge({ type }) {
  const colors = {
    editorial: 'bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20',
    algorithmic: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
    user: 'bg-[#9B9590]/10 text-[#9B9590] border-[#9B9590]/20',
  };
  return (
    <span className={`text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${colors[type] || colors.editorial}`}>
      {type}
    </span>
  );
}

export default function PlaylistProfile() {
  const { id } = useParams();
  const profile = getPlaylist(id);

  if (!profile) {
    return (
      <div className="text-center py-20">
        <ListMusic size={32} className="mx-auto text-[#2C2B28] mb-3" />
        <p className="text-sm text-[#9B9590]">Playlist not found</p>
        <p className="text-[11px] text-[#6B6560] mt-1">id: {id}</p>
        <Link to="/dashboard" className="inline-block mt-4 text-xs text-[#DA7756] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <ProfileLayout
      title={profile.name}
      subtitle={`Curated by ${profile.curator}`}
      type="playlist"
      aiSummary={profile.aiSummary}
      headerRight={
        <div className="flex items-center gap-2">
          <PlatformBadge platform={profile.platform} />
          <TypeBadge type={profile.type} />
        </div>
      }
    >
      {/* Overview KPIs */}
      <CollapsibleSection title="Overview" icon={TrendingUp} defaultOpen={true}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Followers" value={profile.followers || 0} index={0} />
          <KpiCard title="Roster Artists" value={profile.rosterTracks} index={1} />
          <KpiCard title="Avg Position" value={profile.avgPosition} prefix="#" index={2} />
          <KpiCard title="Stream Attribution" value={profile.totalStreamAttribution} index={3} />
        </div>
      </CollapsibleSection>

      {/* Roster Artists on this Playlist */}
      {profile.tracks.length > 0 && (
        <CollapsibleSection title="Roster Artists" icon={Users} defaultOpen={true}>
          <ChartCard title={`${profile.tracks.length} roster artist${profile.tracks.length === 1 ? '' : 's'} on this playlist`}>
            <div className="space-y-1">
              {profile.tracks.map((t, i) => {
                const artist = { slug: t.artistSlug, name: t.artistName };
                return (
                  <Link key={`${t.artistSlug}-${i}`} to={`/artist/${artist.slug}`} className="block">
                    <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
                      <span className="text-[10px] font-mono text-[#6B6560] w-6 text-right shrink-0">{i + 1}</span>
                      <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                        <Music size={12} className="text-[#6B6560]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                          {t.artistName}
                        </p>
                        <p className="text-[10px] text-[#6B6560] truncate">
                          Added {t.dateAdded}
                        </p>
                      </div>
                      {t.position && (
                        <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
                          <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Position</span>
                          <span className="text-xs font-mono text-[#9B9590]">#{t.position}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end shrink-0 w-20">
                        <span className="text-[10px] uppercase tracking-wider text-[#6B6560]">Streams</span>
                        <span className="text-xs font-mono text-[#F5F0E8]">{formatNumber(t.streamsFromPlaylist)}</span>
                      </div>
                      <span className={`text-[10px] font-mono w-12 text-right shrink-0 ${t.delta >= 0 ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}`}>
                        {formatDelta(t.delta)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ChartCard>
        </CollapsibleSection>
      )}

      {/* Performance */}
      <CollapsibleSection title="Performance" icon={BarChart3}>
        <ChartCard title="Stream Attribution by Artist">
          <div className="space-y-2 pt-1">
            {profile.tracks.slice(0, 10).map((t) => {
              const maxStreams = profile.tracks[0]?.streamsFromPlaylist || 1;
              const pct = (t.streamsFromPlaylist / maxStreams) * 100;
              return (
                <div key={t.artistSlug} className="flex items-center gap-3">
                  <span className="w-28 text-right text-[10px] text-[#9B9590] truncate shrink-0">{t.artistName}</span>
                  <div className="flex-1 h-5 bg-[#2C2B28] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#DA7756] rounded transition-all duration-500"
                      style={{ width: `${Math.max(pct, 1)}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">
                    {formatNumber(t.streamsFromPlaylist)}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </CollapsibleSection>

      {/* Similar Playlists */}
      {profile.similar.length > 0 && (
        <CollapsibleSection title="Similar Playlists" icon={Disc3}>
          <ChartCard title="Playlists with overlapping roster artists">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {profile.similar.map((pl) => (
                <Link
                  key={pl.id}
                  to={`/playlist/${pl.id}`}
                  className="group block p-3 rounded border border-[#2C2B28] hover:border-[#DA7756]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <PlatformBadge platform={pl.platform} />
                    <TypeBadge type={pl.type} />
                  </div>
                  <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{pl.name}</p>
                  <p className="text-[10px] text-[#6B6560] truncate">{pl.curator}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#9B9590]">
                    {pl.followers && <span>{formatNumber(pl.followers)} followers</span>}
                    <span>{pl.overlap} shared artist{pl.overlap === 1 ? '' : 's'}</span>
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
