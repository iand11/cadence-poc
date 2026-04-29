import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Disc3, Music, Tag, ListMusic, Sparkles, ExternalLink } from 'lucide-react';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import KpiCard from '../components/shared/KpiCard';
import { getAlbumAsync, getArtist, getAlbumTracksAsync, loadArtistDetail, allArtists } from '../data/artists';
import { formatNumber } from '../utils/formatters';

function formatReleaseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(ms) {
  if (!ms) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildAlbumSummary(album, tracks, artist) {
  const totalStreams = tracks.reduce((s, t) => s + t.streams, 0);
  const released = formatReleaseDate(album.releaseDate);

  const parts = [];
  parts.push(`"${album.name}"${artist ? ` by ${artist.name}` : ''} is ${album.type ? `a ${album.type}` : 'a release'}${released ? ` released on ${released}` : ''}.`);

  if (album.label) {
    parts.push(`Released via ${album.label}.`);
  }

  if (tracks.length > 0) {
    parts.push(`Tracked tracks total ${formatNumber(totalStreams)} Spotify streams across ${tracks.length} known song${tracks.length === 1 ? '' : 's'}.`);
  } else if (album.numTracks) {
    parts.push(`The release contains ${album.numTracks} tracks.`);
  }

  if (album.popularity) {
    parts.push(`Spotify album popularity score: ${album.popularity}/100.`);
  }

  if (album.moods.length > 0) {
    parts.push(`Tagged moods: ${album.moods.slice(0, 4).join(', ')}.`);
  }

  return {
    text: parts.join(' '),
    keyMetrics: [
      { label: 'Tracks (known)', value: String(tracks.length || album.numTracks || 0) },
      { label: 'Total Streams', value: formatNumber(totalStreams) },
      { label: 'Popularity', value: album.popularity ? `${album.popularity}/100` : '—' },
      { label: 'Type', value: album.type ? album.type.charAt(0).toUpperCase() + album.type.slice(1) : '—' },
    ],
    suggestions: [
      `What were the standout tracks from "${album.name}"?`,
      `Compare "${album.name}" to other ${artist?.name ? artist.name + ' releases' : 'releases'}`,
      `Pitch sync opportunities from "${album.name}"`,
    ],
  };
}

export default function AlbumProfile() {
  const { id } = useParams();
  const [album, setAlbum] = useState(undefined); // undefined = loading, null = not found
  const [tracks, setTracks] = useState([]);
  const [otherAlbums, setOtherAlbums] = useState([]);
  const [collabs, setCollabs] = useState([]);

  useEffect(() => {
    setAlbum(undefined);
    setTracks([]);
    setOtherAlbums([]);
    setCollabs([]);

    getAlbumAsync(id).then(a => {
      setAlbum(a);
      if (a) {
        getAlbumTracksAsync(a.id).then(albumTracks => {
          setTracks(albumTracks);
          // Find roster collaborators from track artists
          const slugs = new Set();
          albumTracks.forEach(t => {
            if (t.artistSlug !== a.artistSlug) slugs.add(t.artistSlug);
          });
          setCollabs([...slugs].map(s => allArtists.find(ar => ar.slug === s)).filter(Boolean));
        });
        loadArtistDetail(a.artistSlug).then(detail => {
          setOtherAlbums(detail.albums.filter(x => x.id !== a.id).slice(0, 6));
        });
      }
    });
  }, [id]);

  if (album === undefined) {
    return (
      <div className="text-center py-20">
        <Disc3 size={32} className="mx-auto text-[#2C2B28] mb-3 animate-pulse" />
        <p className="text-sm text-[#9B9590]">Loading album...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="text-center py-20">
        <Disc3 size={32} className="mx-auto text-[#2C2B28] mb-3" />
        <p className="text-sm text-[#9B9590]">Album not found</p>
        <p className="text-[11px] text-[#6B6560] mt-1">id: {id}</p>
        <Link to="/dashboard" className="inline-block mt-4 text-xs text-[#DA7756] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const artist = getArtist(album.artistSlug);
  const aiSummary = buildAlbumSummary(album, tracks, artist);
  const released = formatReleaseDate(album.releaseDate);

  return (
    <ProfileLayout
      title={album.name}
      subtitle={
        artist ? (
          <Link to={`/artist/${artist.slug}`} className="hover:text-[#DA7756] transition-colors">
            by {artist.name}
          </Link>
        ) : null
      }
      type="album"
      aiSummary={aiSummary}
    >
      {/* Overview */}
      <CollapsibleSection title="Overview" icon={Disc3} defaultOpen={true}>
        <div className="flex flex-col md:flex-row gap-6">
          {album.imageUrl && (
            <motion.img
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              src={album.imageUrl}
              alt={album.name}
              className="w-48 h-48 rounded object-cover border border-[#2C2B28] shrink-0"
            />
          )}

          <div className="flex-1 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {released && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Disc3 size={13} className="text-[#6B6560]" />
                  <span>Released:</span>
                  <span className="text-[#F5F0E8]">{released}</span>
                </div>
              )}
              {album.label && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Tag size={13} className="text-[#6B6560]" />
                  <span>Label:</span>
                  <span className="text-[#F5F0E8] truncate">{album.label}</span>
                </div>
              )}
              {album.type && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <ListMusic size={13} className="text-[#6B6560]" />
                  <span>Type:</span>
                  <span className="text-[#F5F0E8] capitalize">{album.type}</span>
                </div>
              )}
              {album.numTracks > 0 && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Music size={13} className="text-[#6B6560]" />
                  <span>Tracks:</span>
                  <span className="text-[#F5F0E8] font-mono">{album.numTracks}</span>
                </div>
              )}
              {album.upc && (
                <div className="flex items-center gap-2 text-[#9B9590]">
                  <Tag size={13} className="text-[#6B6560]" />
                  <span>UPC:</span>
                  <span className="text-[#F5F0E8] font-mono text-xs">{album.upc}</span>
                </div>
              )}
              {album.spotifyAlbumId && (
                <a
                  href={`https://open.spotify.com/album/${album.spotifyAlbumId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#9B9590] hover:text-[#DA7756] transition-colors"
                >
                  <ExternalLink size={13} className="text-[#6B6560]" />
                  <span>Open in Spotify</span>
                </a>
              )}
            </div>

            {album.description && (
              <p className="text-sm text-[#F5F0E8]/80 leading-relaxed">{album.description}</p>
            )}

            {/* Moods + activities */}
            {(album.moods.length > 0 || album.activities.length > 0) && (
              <div className="space-y-2">
                {album.moods.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1 block">Moods</span>
                    <div className="flex flex-wrap gap-1.5">
                      {album.moods.slice(0, 8).map(m => (
                        <span key={m} className="text-[10px] font-mono bg-[#7BAF73]/5 text-[#7BAF73]/70 rounded px-2 py-0.5 border border-[#7BAF73]/15">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {album.activities.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1 block">Activities</span>
                    <div className="flex flex-wrap gap-1.5">
                      {album.activities.slice(0, 8).map(a => (
                        <span key={a} className="text-[10px] font-mono bg-[#D4A574]/5 text-[#D4A574]/70 rounded px-2 py-0.5 border border-[#D4A574]/15">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Roster collaborators */}
            {collabs.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#9B9590] mb-1.5 block">Roster Collaborators</span>
                <div className="flex flex-wrap gap-1.5">
                  {collabs.map(a => (
                    <Link
                      key={a.slug}
                      to={`/artist/${a.slug}`}
                      className="flex items-center gap-1.5 text-xs bg-[#171614] border border-[#2C2B28] hover:border-[#DA7756]/30 rounded px-2 py-1 transition-colors"
                    >
                      {a.imageUrl && <img src={a.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />}
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
      <CollapsibleSection title="Performance" icon={Sparkles} defaultOpen={true}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Streams" value={tracks.reduce((s, t) => s + t.streams, 0)} index={0} />
          <KpiCard title="Tracks (known)" value={tracks.length} index={1} />
          <KpiCard title="Album Popularity" value={album.popularity} suffix="/100" index={2} />
          <KpiCard title="Total Playlists" value={tracks.reduce((s, t) => s + t.spotifyPlaylists, 0)} index={3} />
        </div>
      </CollapsibleSection>

      {/* Track listing */}
      {tracks.length > 0 && (
        <CollapsibleSection title="Tracklist" icon={ListMusic} defaultOpen={true}>
          <ChartCard title={`${tracks.length} tracked song${tracks.length === 1 ? '' : 's'}`}>
            <div className="space-y-1">
              {tracks.map((t, i) => (
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
                      <p className="text-[10px] text-[#6B6560] truncate">
                        {t.artistNames.length > 1 ? t.artistNames.join(', ') : t.artistNames[0] || ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B6560] shrink-0">{formatDuration(t.durationMs)}</span>
                    <span className="text-xs font-mono text-[#9B9590] shrink-0 w-16 text-right">{formatNumber(t.streams)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </ChartCard>
        </CollapsibleSection>
      )}

      {/* Other releases by same artist */}
      {otherAlbums.length > 0 && (
        <CollapsibleSection title={`More from ${artist.name}`} icon={Disc3}>
          <ChartCard title="Other releases">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {otherAlbums.map(a => (
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
                  <p className="text-[10px] text-[#6B6560]">
                    {a.releaseDate ? new Date(a.releaseDate).getFullYear() : '—'}
                    {a.type ? ` · ${a.type}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          </ChartCard>
        </CollapsibleSection>
      )}
    </ProfileLayout>
  );
}
