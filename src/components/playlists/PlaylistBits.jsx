// Shared building blocks for the real (crawled) playlist data.
import { useState } from 'react';
import { Link } from 'react-router';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ListMusic, ChevronRight } from 'lucide-react';
import { fetchPlacements, fetchPlaylists, fmtDate, PLATFORM_LABELS, TYPE_LABELS } from '../../data/playlistsRemote';
import { useAsync } from '../../hooks/useAsync';
import { formatNumber, formatDate } from '../../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';

const PLATFORM_COLORS = {
  spotify: 'bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20',
  apple: 'bg-[#FC3C44]/10 text-[#FC3C44] border-[#FC3C44]/20',
  deezer: 'bg-[#A238FF]/10 text-[#A238FF] border-[#A238FF]/20',
  amazon: 'bg-[#25D1DA]/10 text-[#25D1DA] border-[#25D1DA]/20',
  youtube: 'bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20',
};

const TYPE_COLORS = {
  editorial: 'bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20',
  chart: 'bg-[#7BAF73]/10 text-[#7BAF73] border-[#7BAF73]/20',
  label: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
  brand: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
  algorithmic: 'bg-[#6FA3C7]/10 text-[#6FA3C7] border-[#6FA3C7]/20',
  this_is: 'bg-[#9B9590]/10 text-[#C9C2B8] border-[#9B9590]/30',
  user: 'bg-[#9B9590]/10 text-[#9B9590] border-[#9B9590]/20',
};

export function PlatformBadge({ platform }) {
  return (
    <span className={`text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 whitespace-nowrap ${PLATFORM_COLORS[platform] || PLATFORM_COLORS.spotify}`}>
      {PLATFORM_LABELS[platform] || platform}
    </span>
  );
}

export function TypeBadge({ type }) {
  return (
    <span className={`text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 whitespace-nowrap ${TYPE_COLORS[type] || TYPE_COLORS.user}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded border border-[#2C2B28] bg-[#171614]">
      <p className="text-[9px] uppercase tracking-wider text-[#6B6560]">{label}</p>
      <p className="text-sm font-mono text-[#F5F0E8] mt-0.5">{value}</p>
    </div>
  );
}

// Collapse placements into one row per song (same catalog track, else same name).
function groupBySong(rows) {
  const map = new Map();
  for (const p of rows) {
    const key = p.trackId || p.trackName.toLowerCase();
    const g = map.get(key) || { key, trackId: p.trackId, trackName: p.trackName, artistNames: p.artistNames, placements: [], playlistIds: new Set() };
    g.placements.push(p);
    g.playlistIds.add(p.playlist.id);
    map.set(key, g);
  }
  return [...map.values()].map((g) => {
    const uniq = [...new Map(g.placements.map((p) => [p.playlist.id, p.playlist])).values()];
    const positions = g.placements.map((p) => p.position).filter((x) => x != null);
    return {
      ...g,
      playlists: uniq.length,
      editorial: uniq.filter((pl) => pl.isEditorial).length,
      reach: uniq.reduce((n, pl) => n + (pl.followers || 0), 0),
      bestPosition: positions.length ? Math.min(...positions) : null,
      platforms: [...new Set(uniq.map((pl) => pl.platform))],
    };
  }).sort((a, b) => (b.playlists - a.playlists) || (b.reach - a.reach));
}

function SongGroups({ rows, limit, showAll, current }) {
  const [open, setOpen] = useState(null);
  const songs = groupBySong(rows);
  const visible = showAll ? songs : songs.slice(0, limit);
  return (
    <div className="space-y-1">
      {visible.map((g) => (
        <div key={g.key} className="rounded border border-transparent hover:border-[#2C2B28]">
          <button onClick={() => setOpen(open === g.key ? null : g.key)} className="w-full text-left flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors">
            <ChevronRight size={12} className={`text-[#6B6560] shrink-0 transition-transform ${open === g.key ? 'rotate-90' : ''}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F5F0E8] truncate">{g.trackName}</p>
              <p className="text-[10px] text-[#6B6560] truncate">{g.artistNames.join(', ')}</p>
            </div>
            <div className="hidden md:flex items-center gap-1 shrink-0">{g.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}</div>
            <div className="flex flex-col items-end shrink-0 w-16">
              <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Playlists</span>
              <span className="text-xs font-mono text-[#F5F0E8]">{g.playlists}</span>
            </div>
            <div className="flex flex-col items-end shrink-0 w-14">
              <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Editorial</span>
              <span className="text-xs font-mono text-[#9B9590]">{g.editorial}</span>
            </div>
            <div className="hidden sm:flex flex-col items-end shrink-0 w-16">
              <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Reach</span>
              <span className="text-xs font-mono text-[#9B9590]">{g.reach ? formatNumber(g.reach) : '—'}</span>
            </div>
            <div className="flex flex-col items-end shrink-0 w-12">
              <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Best</span>
              <span className="text-xs font-mono text-[#9B9590]">{g.bestPosition != null ? `#${g.bestPosition}` : '—'}</span>
            </div>
          </button>
          {open === g.key && (
            <div className="pl-7 pb-2 space-y-0.5">
              {g.trackId && <Link to={`/app/track/${g.trackId}`} className="inline-block text-[10px] text-[#DA7756] hover:underline mb-1 ml-2">Open track →</Link>}
              {g.placements.map((p) => (
                <Link key={p.entryId} to={`/app/playlist/${p.playlist.id}`} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#1C1B18] group">
                  <p className="flex-1 min-w-0 text-xs text-[#9B9590] truncate group-hover:text-[#DA7756]">{p.playlist.name} <span className="text-[#6B6560]">· {p.playlist.curator}</span></p>
                  <TypeBadge type={p.playlist.type} />
                  <span className="text-[10px] font-mono text-[#9B9590] w-14 text-right">{p.playlist.followers != null ? formatNumber(p.playlist.followers) : '—'}</span>
                  <span className="text-[10px] font-mono text-[#F5F0E8] w-10 text-right">{p.position != null ? `#${p.position}` : '—'}</span>
                  <span className="text-[10px] font-mono text-[#6B6560] w-20 text-right">{current ? fmtDate(p.addedAt || p.firstSeenAt) : fmtDate(p.removedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Placements panel for one or more artists (slugs) or a catalog track (track).
 * Current / past tabs, platform filter, summary stats, linked rows.
 */
export function PlaylistPlacements({ slugs, track, limit = 15, compact = false, showArtist = false, defaultView }) {
  const [status, setStatus] = useState('current');
  const [platform, setPlatform] = useState('');
  const [editorialOnly, setEditorialOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Artist scope defaults to one row per song; a single track is already one song.
  const [view, setView] = useState(defaultView || (track ? 'playlist' : 'song'));
  const key = (slugs || []).join(',');
  const { data, loading, error } = useAsync(
    () => fetchPlacements({ slugs, track, status, platform, editorial: editorialOnly, limit: 500 }),
    [key, track, status, platform, editorialOnly],
  );

  if (error) return <p className="text-xs text-[#C75F4F] py-4">Couldn&apos;t load playlist placements.</p>;
  const s = data?.summary;
  const rows = data?.placements || [];
  const visible = showAll ? rows : rows.slice(0, limit);
  const platforms = Object.keys(s?.byPlatform || {});

  return (
    <div className="space-y-3">
      {!compact && s && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Playlists" value={formatNumber(s.playlists)} />
          <Stat label="Editorial / chart" value={formatNumber(s.editorialPlaylists)} />
          <Stat label="Reach" value={s.reach ? formatNumber(s.reach) : '—'} />
          <Stat label="Added · 30d" value={`+${formatNumber(s.added30d)}`} />
          <Stat label="Dropped · 30d" value={`−${formatNumber(s.removed30d)}`} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        {!compact && ['current', 'past', 'all'].map((v) => (
          <button key={v} onClick={() => setStatus(v)}
            className={`px-2 py-1 rounded border uppercase tracking-wider ${status === v ? 'border-[#DA7756] text-[#DA7756]' : 'border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8]'}`}>
            {v}
          </button>
        ))}
        {!track && (
          <div className="flex rounded border border-[#2C2B28] overflow-hidden">
            {[['song', 'By song'], ['playlist', 'By playlist']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2 py-1 uppercase tracking-wider ${view === v ? 'bg-[#DA7756] text-[#0D0C0B]' : 'text-[#9B9590] hover:text-[#F5F0E8]'}`}>{l}</button>
            ))}
          </div>
        )}
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#171614] border border-[#2C2B28] rounded px-2 py-1 text-[#9B9590]">
          <option value="">All platforms</option>
          {['spotify', 'apple', 'deezer'].map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}{s?.byPlatform?.[p] ? ` (${s.byPlatform[p].playlists})` : ''}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[#9B9590] cursor-pointer">
          <input type="checkbox" checked={editorialOnly} onChange={(e) => setEditorialOnly(e.target.checked)} />
          Editorial / chart only
        </label>
        {loading && <span className="text-[#6B6560]">Loading…</span>}
      </div>

      {!loading && rows.length === 0 && (
        <div className="text-center py-8">
          <ListMusic size={24} className="mx-auto text-[#2C2B28] mb-2" />
          <p className="text-xs text-[#9B9590]">
            {status === 'past' ? 'No past placements in tracked playlists.' : 'Not on any tracked playlist right now.'}
          </p>
          {!platforms.length && status === 'current' && (
            <p className="text-[10px] text-[#6B6560] mt-1">Tracked: Spotify, Apple Music &amp; Deezer editorial and chart playlists, plus major-label and brand playlists.</p>
          )}
        </div>
      )}

      {view === 'song' && <SongGroups rows={rows} limit={limit} showAll={showAll} current={status !== 'past'} />}
      {view === 'playlist' && <div className="space-y-1">
        {visible.map((p) => (
          <Link key={p.entryId} to={`/app/playlist/${p.playlist.id}`} className="block">
            <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
              {p.playlist.imageUrl
                ? <img src={p.playlist.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" loading="lazy" />
                : <div className="w-9 h-9 rounded bg-[#2C2B28] flex items-center justify-center shrink-0"><ListMusic size={12} className="text-[#6B6560]" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{p.playlist.name}</p>
                <p className="text-[10px] text-[#6B6560] truncate">
                  {showArtist && p.artistSlug ? `${p.artistNames.join(', ')} — ` : ''}{p.trackName} · {p.playlist.curator}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-1 shrink-0">
                <PlatformBadge platform={p.playlist.platform} />
                <TypeBadge type={p.playlist.type} />
              </div>
              <div className="flex flex-col items-end shrink-0 w-16">
                <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Followers</span>
                <span className="text-xs font-mono text-[#9B9590]">{p.playlist.followers != null ? formatNumber(p.playlist.followers) : '—'}</span>
              </div>
              <div className="flex flex-col items-end shrink-0 w-12">
                <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Pos</span>
                <span className="text-xs font-mono text-[#F5F0E8]">{p.position != null ? `#${p.position}` : '—'}</span>
              </div>
              {!compact && (
                <div className="hidden sm:flex flex-col items-end shrink-0 w-12">
                  <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Peak</span>
                  <span className="text-xs font-mono text-[#9B9590]">{p.peakPosition != null ? `#${p.peakPosition}` : '—'}</span>
                </div>
              )}
              <div className="hidden sm:flex flex-col items-end shrink-0 w-20">
                <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">{p.current ? 'Added' : 'Removed'}</span>
                <span className="text-xs font-mono text-[#9B9590]">{fmtDate(p.current ? (p.addedAt || p.firstSeenAt) : p.removedAt)}</span>
              </div>
              {!compact && (
                <div className="hidden lg:flex flex-col items-end shrink-0 w-12">
                  <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Days</span>
                  <span className="text-xs font-mono text-[#9B9590]">{p.daysOn ?? '—'}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>}
      {(view === 'song' ? groupBySong(rows).length : rows.length) > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="text-[10px] text-[#DA7756] hover:underline">
          {showAll ? 'Show fewer' : `Show all ${view === 'song' ? groupBySong(rows).length + ' songs' : rows.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * Spotify "Discovered On" for an artist — the playlists where listeners found
 * them, in Spotify's own rank order. Links to our playlist page once the
 * playlist is tracked/crawled, otherwise out to Spotify.
 */
export function DiscoveredOn({ discoveredOn, limit = 10 }) {
  const [showAll, setShowAll] = useState(false);
  const list = discoveredOn?.playlists || [];
  const ids = list.map((p) => p.id);
  const { data } = useAsync(
    () => (ids.length ? fetchPlaylists({ platform: 'spotify', platformIds: ids, perPage: 100 }) : Promise.resolve(null)),
    [ids.join(',')],
  );
  if (!list.length) return null;
  const tracked = new Map((data?.playlists || []).map((pl) => [pl.platformId, pl]));
  const visible = showAll ? list : list.slice(0, limit);

  return (
    <div className="space-y-1">
      {visible.map((p) => {
        const pl = tracked.get(p.id);
        const row = (
          <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1C1B18] transition-colors group">
            <span className="text-[10px] font-mono text-[#6B6560] w-5 text-right shrink-0">{p.rank}</span>
            {pl?.imageUrl
              ? <img src={pl.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
              : <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0"><ListMusic size={11} className="text-[#6B6560]" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{p.name}</p>
              <p className="text-[10px] text-[#6B6560] truncate">{p.curator || '—'}{!pl && ' · opens on Spotify'}</p>
            </div>
            <TypeBadge type={p.type} />
            <div className="flex flex-col items-end shrink-0 w-16">
              <span className="text-[9px] uppercase tracking-wider text-[#6B6560]">Followers</span>
              <span className="text-xs font-mono text-[#9B9590]">{pl?.followers != null ? formatNumber(pl.followers) : '—'}</span>
            </div>
          </div>
        );
        return pl
          ? <Link key={p.id} to={`/app/playlist/${pl.id}`} className="block">{row}</Link>
          : <a key={p.id} href={`https://open.spotify.com/playlist/${p.id}`} target="_blank" rel="noreferrer" className="block">{row}</a>;
      })}
      {list.length > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="text-[10px] text-[#DA7756] hover:underline">
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}

export function FollowerHistoryChart({ history }) {
  const points = (history || []).filter((h) => h.followers != null);
  if (points.length < 2) {
    return <p className="text-xs text-[#6B6560] py-6 text-center">Follower history builds up with each daily crawl.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="plFollowers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DA7756" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#DA7756" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={formatDate} minTickGap={30} />
        <YAxis tick={AXIS_STYLE} tickFormatter={formatNumber} width={48} domain={['auto', 'auto']} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatNumber(v), 'Followers']} labelFormatter={formatDate} />
        <Area type="monotone" dataKey="followers" stroke="#DA7756" strokeWidth={2} fill="url(#plFollowers)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
