import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { TrendingUp, ListMusic, Disc3, History, LineChart, ExternalLink } from 'lucide-react';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import { PlatformBadge, TypeBadge, FollowerHistoryChart } from '../components/playlists/PlaylistBits';
import { fetchPlaylist, fmtDate } from '../data/playlistsRemote';
import { useAsync } from '../hooks/useAsync';
import { useFollowedArtists } from '../hooks/useFollowedArtists';
import { formatNumber } from '../utils/formatters';

function ArtistLinks({ entry }) {
  if (!entry.artists?.length) return <span>{entry.artistNames.join(', ')}</span>;
  return entry.artists.map((a, i) => (
    <span key={a.slug}>
      {i > 0 && ', '}
      <Link to={`/app/artist/${a.slug}`} className="hover:text-[#DA7756]" onClick={(e) => e.stopPropagation()}>{a.name}</Link>
    </span>
  ));
}

function TrackRow({ t, index }) {
  return (
    <div className={`flex items-center gap-3 px-2 py-1.5 rounded ${t.roster ? 'bg-[#DA7756]/5 border-l-2 border-[#DA7756]' : 'hover:bg-[#1C1B18]'}`}>
      <span className="text-[10px] font-mono text-[#6B6560] w-7 text-right shrink-0">{t.position ?? index + 1}</span>
      <div className="flex-1 min-w-0">
        {t.trackId
          ? <Link to={`/app/track/${t.trackId}`} className="text-sm text-[#F5F0E8] truncate block hover:text-[#DA7756]">{t.trackName}</Link>
          : <p className="text-sm text-[#F5F0E8] truncate">{t.trackName}</p>}
        <p className="text-[10px] text-[#6B6560] truncate"><ArtistLinks entry={t} /></p>
      </div>
      <div className="hidden sm:flex flex-col items-end shrink-0 w-12">
        <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Peak</span>
        <span className="text-xs font-mono text-[#9B9590]">{t.peakPosition != null ? `#${t.peakPosition}` : '—'}</span>
      </div>
      <div className="flex flex-col items-end shrink-0 w-20">
        <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Added</span>
        <span className="text-xs font-mono text-[#9B9590]">{fmtDate(t.addedAt || t.firstSeenAt)}</span>
      </div>
      <div className="hidden md:flex flex-col items-end shrink-0 w-12">
        <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Days</span>
        <span className="text-xs font-mono text-[#9B9590]">{t.daysOn ?? '—'}</span>
      </div>
    </div>
  );
}

export default function PlaylistProfile() {
  const { id } = useParams();
  const { followedArtists } = useFollowedArtists();
  const slugs = useMemo(() => followedArtists.map((a) => a.slug), [followedArtists]);
  const { data: profile, loading } = useAsync(() => fetchPlaylist(id, { slugs }), [id, slugs.join(',')]);
  const [rosterOnly, setRosterOnly] = useState(false);

  if (loading && !profile) {
    return <div className="text-center py-20 text-sm text-[#6B6560]">Loading playlist…</div>;
  }
  if (!profile) {
    return (
      <div className="text-center py-20">
        <ListMusic size={32} className="mx-auto text-[#2C2B28] mb-3" />
        <p className="text-sm text-[#9B9590]">Playlist not found</p>
        <p className="text-[11px] text-[#6B6560] mt-1">id: {id}</p>
        <Link to="/app/playlists" className="inline-block mt-4 text-xs text-[#DA7756] hover:underline">Back to Playlists</Link>
      </div>
    );
  }

  const tracks = rosterOnly ? profile.tracks.filter((t) => t.roster) : profile.tracks;
  const added = profile.changes.filter((c) => c.change === 'added');
  const removed = profile.changes.filter((c) => c.change === 'removed');
  const hist = profile.followerHistory.filter((h) => h.followers != null);
  const followerDelta = hist.length > 1 ? hist[hist.length - 1].followers - hist[0].followers : null;

  return (
    <ProfileLayout
      title={profile.name}
      subtitle={`Curated by ${profile.curator}`}
      type="playlist"
      headerRight={
        <div className="flex items-center gap-2">
          <PlatformBadge platform={profile.platform} />
          <TypeBadge type={profile.type} />
          {profile.url && (
            <a href={profile.url} target="_blank" rel="noreferrer" className="text-[#9B9590] hover:text-[#DA7756]" title="Open on platform">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      }
    >
      <CollapsibleSection title="Overview" icon={TrendingUp} defaultOpen={true}>
        <div className="flex gap-4 items-start">
          {profile.imageUrl && <img src={profile.imageUrl} alt="" className="hidden sm:block w-28 h-28 rounded object-cover shrink-0" />}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {profile.followers != null
              ? <KpiCard title="Followers" value={profile.followers} delta={followerDelta != null && hist[0].followers ? (followerDelta / hist[0].followers) * 100 : undefined} index={0} />
              : <KpiCard title="Changes · 90d" value={added.length + removed.length} index={0} />}
            <KpiCard title="Tracks" value={profile.tracks.length} index={1} />
            <KpiCard title="Tracks You Follow" value={profile.rosterTracks ?? 0} index={2} />
            <KpiCard title="Best Followed Position" value={profile.bestRosterPosition ?? 0} prefix={profile.bestRosterPosition ? '#' : ''} index={3} />
          </div>
        </div>
        {profile.description && (
          <p className="text-xs text-[#9B9590] mt-3 line-clamp-2">
            {profile.description}
          </p>
        )}
        <p className="text-[10px] text-[#6B6560] mt-2">
          Last crawled {fmtDate(profile.lastCrawledAt)} · last change {fmtDate(profile.lastChangedAt)}
          {profile.platform === 'apple' && ' · Apple Music does not publish follower counts'}
        </p>
      </CollapsibleSection>

      {profile.followers != null && (
        <CollapsibleSection title="Followers" icon={LineChart} defaultOpen={true}>
          <ChartCard title="Follower history">
            <FollowerHistoryChart history={profile.followerHistory} />
          </ChartCard>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Tracklist" icon={ListMusic} defaultOpen={true}>
        <ChartCard
          title={`${tracks.length} track${tracks.length === 1 ? '' : 's'}${rosterOnly ? ' from artists you follow' : ''}`}
          subtitle={profile.rosterTracks ? `${profile.rosterTracks} from artists you follow, highlighted${profile.avgRosterPosition ? ` · avg position #${profile.avgRosterPosition}` : ''}` : undefined}
        >
          {profile.rosterTracks > 0 && (
            <label className="flex items-center gap-1 text-[10px] text-[#9B9590] mb-2 cursor-pointer">
              <input type="checkbox" checked={rosterOnly} onChange={(e) => setRosterOnly(e.target.checked)} /> Followed artists only
            </label>
          )}
          <div className="space-y-0.5 max-h-[640px] overflow-y-auto">
            {tracks.map((t, i) => <TrackRow key={t.entryId} t={t} index={i} />)}
          </div>
        </ChartCard>
      </CollapsibleSection>

      <CollapsibleSection title="Recent changes" icon={History} defaultOpen={added.length + removed.length > 0}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard title={`Added · ${added.length}`}>
            {added.length === 0 && <p className="text-xs text-[#6B6560] py-3">No adds seen in the last 90 days of crawling.</p>}
            <div className="space-y-0.5">{added.slice(0, 30).map((t, i) => <TrackRow key={t.entryId} t={t} index={i} />)}</div>
          </ChartCard>
          <ChartCard title={`Removed · ${removed.length}`}>
            {removed.length === 0 && <p className="text-xs text-[#6B6560] py-3">No removals seen in the last 90 days of crawling.</p>}
            <div className="space-y-0.5">
              {removed.slice(0, 30).map((t, i) => (
                <div key={t.entryId} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#1C1B18]">
                  <span className="text-[10px] font-mono text-[#6B6560] w-7 text-right shrink-0">{t.peakPosition ? `#${t.peakPosition}` : i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F5F0E8] truncate">{t.trackName}</p>
                    <p className="text-[10px] text-[#6B6560] truncate"><ArtistLinks entry={t} /></p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 w-20">
                    <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Removed</span>
                    <span className="text-xs font-mono text-[#9B9590]">{fmtDate(t.removedAt)}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 w-12">
                    <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Days</span>
                    <span className="text-xs font-mono text-[#9B9590]">{t.daysOn ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </CollapsibleSection>

      {profile.similar.length > 0 && (
        <CollapsibleSection title="Similar Playlists" icon={Disc3}>
          <ChartCard title="Playlists sharing the most artists">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {profile.similar.map((pl) => (
                <Link key={pl.id} to={`/app/playlist/${pl.id}`}
                  className="group block p-3 rounded border border-[#2C2B28] hover:border-[#DA7756]/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <PlatformBadge platform={pl.platform} />
                    <TypeBadge type={pl.type} />
                  </div>
                  <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{pl.name}</p>
                  <p className="text-[10px] text-[#6B6560] truncate">{pl.curator}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#9B9590]">
                    {pl.followers != null && <span>{formatNumber(pl.followers)} followers</span>}
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
