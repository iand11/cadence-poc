// Live custom widgets: a widget whose spec has `live` stores the query, not the data.
// The query is re-run each time the widget is shown, against the artists it covers
// ("all" followed artists, a group, or named artists), so newly followed artists
// appear without calling the model again. `hydrateSpec` turns { live, type, title }
// into a spec CustomWidgetView renders.
import { getRoster } from './rosterStore';
import { fetchArtist, fetchArtistsBySlugs, fetchTracks, fetchAlbums, fetchContentFeed } from './artistsRemote';
import { fetchPlacements } from './playlistsRemote';

export const LIVE_QUERIES = ['artists', 'history', 'tracks', 'releases', 'placements', 'posts'];

/** Artist stats a live widget can show: key (as in metric history) → label + current value. */
export const STATS = {
  sp_monthly_listeners: ['Spotify monthly listeners', a => a.spotify?.monthlyListeners],
  sp_followers: ['Spotify followers', a => a.spotify?.followers],
  sp_popularity: ['Spotify popularity', a => a.spotify?.popularity],
  ins_followers: ['Instagram followers', a => a.social?.instagram],
  tiktok_followers: ['TikTok followers', a => a.social?.tiktok],
  tiktok_likes: ['TikTok likes', a => a.social?.tiktokLikes],
  ycs_subscribers: ['YouTube subscribers', a => a.social?.youtube],
  ycs_views: ['YouTube views', a => a.social?.youtubeViews],
  twitter_followers: ['X followers', a => a.social?.twitter],
  num_sp_playlists: ['Spotify playlists', a => a.playlists?.spotify?.total],
  num_sp_editorial_playlists: ['Spotify editorial playlists', a => a.playlists?.spotify?.editorial],
  sp_playlist_total_reach: ['Spotify playlist reach', a => a.playlists?.spotify?.reach],
  shazam_count: ['Shazams', a => a.engagement?.shazam],
  genius_pageviews: ['Genius pageviews', a => a.engagement?.genius],
  pandora_listeners_28_day: ['Pandora listeners (28 days)', a => a.engagement?.pandoraListeners],
};

const clamp = (n, lo, hi, dflt) => Math.min(Math.max(Number.isFinite(Number(n)) ? Number(n) : dflt, lo), hi);
const statKeys = (metrics) => {
  const keys = (Array.isArray(metrics) ? metrics : []).filter(k => STATS[k]).slice(0, 4);
  return keys.length ? keys : ['sp_monthly_listeners'];
};
const stat = (a, key) => Number(STATS[key][1](a)) || 0;
const byStat = (key) => (x, y) => stat(y, key) - stat(x, key);
const field = (key, label, format) => ({ key, label, ...(format ? { format } : {}) });

/** Keep only a well-formed live query (from the model or a saved widget). */
export function cleanLive(live) {
  if (!live || typeof live !== 'object' || !LIVE_QUERIES.includes(live.query)) return null;
  const artists = Array.isArray(live.artists)
    ? live.artists.filter(s => typeof s === 'string').slice(0, 30)
    : typeof live.artists === 'string' && /^group:/.test(live.artists) ? live.artists : 'all';
  const out = { query: live.query, artists };
  if (Array.isArray(live.metrics)) out.metrics = statKeys(live.metrics);
  for (const k of ['days', 'limit']) if (live[k] != null) out[k] = Number(live[k]) || undefined;
  for (const k of ['sort', 'platform', 'status']) if (typeof live[k] === 'string') out[k] = live[k];
  for (const k of ['editorial', 'total', 'combine']) if (live[k]) out[k] = true;
  return out;
}

/** The artists a live widget covers, most-listened first. */
async function scopeArtists(scope, { artists, groups }) {
  if (Array.isArray(scope)) {
    const known = new Map(artists.map(a => [a.slug, a]));
    const missing = scope.filter(s => !known.has(s));
    if (missing.length) for (const a of await fetchArtistsBySlugs(missing)) known.set(a.slug, a);
    return scope.map(s => known.get(s)).filter(Boolean);
  }
  let list = artists;
  if (typeof scope === 'string' && scope.startsWith('group:')) {
    const group = (groups || []).find(g => g.id === scope.slice(6));
    if (!group) throw new Error('This group no longer exists');
    const slugs = new Set(group.slugs);
    list = artists.filter(a => slugs.has(a.slug));
  }
  return [...list].sort(byStat('sp_monthly_listeners'));
}

// Each query returns rows plus what they hold:
//   { rows, label (row key naming the row), values [field], extra [field], x?, totals? }
const QUERIES = {
  async artists(live, scope) {
    const keys = statKeys(live.metrics);
    const rows = [...scope].sort(byStat(keys[0])).slice(0, clamp(live.limit, 1, 30, 15)).map(a => ({
      name: a.name,
      link: `/app/artist/${a.slug}`,
      ...Object.fromEntries(keys.map(k => [k, stat(a, k)])),
    }));
    return {
      rows,
      label: 'name',
      values: keys.map(k => field(k, STATS[k][0])),
      totals: keys.map(k => ({ label: STATS[k][0], value: scope.reduce((s, a) => s + stat(a, k), 0) })),
    };
  },

  async history(live, scope) {
    const key = statKeys(live.metrics)[0];
    const days = clamp(live.days, 7, 365, 90);
    const picked = [...scope].sort(byStat(key)).slice(0, live.combine ? 30 : clamp(live.limit, 1, 10, 6));
    const series = await Promise.all(picked.map(async (a) => {
      const { history = [] } = await fetchArtist(a.slug, { history: true, days });
      const points = new Map();
      for (const h of history) {
        const v = h.metrics?.[key];
        if (typeof v === 'number') points.set(String(h.capturedAt).slice(0, 10), v);
      }
      return { name: a.name, points };
    }));
    const dates = [...new Set(series.flatMap(s => [...s.points.keys()]))].sort();
    // Carry each artist's last value forward so a day one source missed doesn't dip
    const last = new Map();
    let rows = dates.map(date => {
      const row = { date };
      for (const s of series) {
        if (s.points.has(date)) last.set(s.name, s.points.get(date));
        if (last.has(s.name)) row[s.name] = last.get(s.name);
      }
      return row;
    });
    const sum = (row) => series.reduce((t, s) => t + (row[s.name] || 0), 0);
    const first = rows[0] ? sum(rows[0]) : 0;
    const latest = rows.length ? sum(rows[rows.length - 1]) : 0;
    if (live.combine) rows = rows.map(r => ({ date: r.date, total: sum(r) }));
    if (rows.length > 60) {
      const step = (rows.length - 1) / 59;
      rows = Array.from({ length: 60 }, (_, i) => rows[Math.round(i * step)]);
    }
    return {
      rows,
      label: 'date',
      x: 'date',
      values: live.combine ? [field('total', STATS[key][0])] : series.map(s => field(s.name, s.name)),
      totals: [{ label: STATS[key][0], value: latest, ...(first ? { change: ((latest - first) / first) * 100 } : {}) }],
    };
  },

  async tracks(live, scope, names) {
    const sort = ['streams', 'recent', 'popularity'].includes(live.sort) ? live.sort : 'streams';
    const { tracks = [] } = await fetchTracks({ slugs: scope.slice(0, 100).map(a => a.slug), sort, dedupe: true, perPage: clamp(live.limit, 1, 30, 10) });
    return {
      rows: tracks.map(t => ({
        name: t.name, link: `/app/track/${t.id}`, artist: names.get(t.artistSlug) || t.artistNames?.[0] || '',
        streams: t.streams || 0, popularity: t.popularity || 0, releaseDate: t.releaseDate,
      })),
      label: 'name',
      extra: [field('artist', 'Artist'), ...(sort === 'recent' ? [field('releaseDate', 'Released', 'date')] : [])],
      values: [sort === 'popularity' ? field('popularity', 'Popularity') : field('streams', 'Spotify streams')],
    };
  },

  async releases(live, scope, names) {
    const sort = live.sort === 'popularity' ? 'popularity' : 'recent';
    const { albums = [] } = await fetchAlbums({ slugs: scope.slice(0, 100).map(a => a.slug), sort, perPage: clamp(live.limit, 1, 30, 10) });
    return {
      rows: albums.map(r => ({
        name: r.name, link: `/app/album/${r.id}`, artist: names.get(r.artistSlug) || '',
        releaseDate: r.releaseDate, popularity: r.popularity || 0,
      })),
      label: 'name',
      extra: [field('artist', 'Artist'), field('releaseDate', 'Released', 'date')],
      values: [field('popularity', 'Popularity')],
    };
  },

  async placements(live, scope, names) {
    const { placements = [], summary = {} } = await fetchPlacements({
      slugs: scope.slice(0, 100).map(a => a.slug),
      status: ['current', 'past', 'all'].includes(live.status) ? live.status : 'current',
      platform: live.platform, editorial: live.editorial ? 1 : undefined,
      limit: clamp(live.limit, 1, 30, 10),
    });
    return {
      rows: placements.map(p => ({
        name: p.playlist?.name || 'Playlist', link: p.playlist?.id ? `/app/playlist/${p.playlist.id}` : null,
        artist: names.get(p.artistSlug) || '', track: p.trackName, followers: p.playlist?.followers || 0,
        position: p.position, addedAt: p.addedAt,
      })),
      label: 'name',
      extra: [field('track', 'Track'), field('artist', 'Artist'), field('position', 'Position', 'number')],
      values: [field('followers', 'Playlist followers')],
      totals: [
        { label: 'Playlists', value: summary.playlists || 0 },
        { label: 'Playlist reach', value: summary.reach || 0 },
        { label: 'Editorial playlists', value: summary.editorialPlaylists || 0 },
        { label: 'Added in 30 days', value: summary.added30d || 0 },
      ],
    };
  },

  async posts(live, scope, names) {
    const { items = [] } = await fetchContentFeed({
      artists: scope.slice(0, 100).map(a => a.slug),
      platform: ['instagram', 'tiktok', 'youtube'].includes(live.platform) ? live.platform : undefined,
      sort: live.sort === 'engagement' ? 'engagement' : 'recent',
      limit: clamp(live.limit, 1, 30, 10),
    });
    return {
      rows: items.map(p => ({
        name: p.title || `${p.platform} ${p.contentType || 'post'}`, artist: names.get(p.artistSlug) || '',
        platform: p.platform, views: p.views || 0, likes: p.likes || 0, publishedAt: p.publishedAt,
      })),
      label: 'name',
      extra: [field('artist', 'Artist'), field('publishedAt', 'Posted', 'date')],
      values: [field('views', 'Views'), field('likes', 'Likes')],
    };
  },
};

/** Lay a query result out as the widget's type. */
function shape(spec, result) {
  const { rows, label, values, extra = [], x, totals } = result;
  const out = { title: spec.title, subtitle: spec.subtitle, type: spec.type, live: spec.live, unit: spec.unit };
  const [v0] = values;
  switch (spec.type) {
    case 'metric':
      out.metrics = totals && (spec.live.total || spec.live.query !== 'artists')
        ? totals.slice(0, 4)
        : rows.slice(0, 4).map(r => ({ label: r[label], value: r[v0.key] }));
      return out;
    case 'pie':
      return { ...out, data: rows.slice(0, 8), series: [{ key: label }, { key: v0.key, name: v0.label }] };
    case 'table':
      return {
        ...out,
        data: rows,
        columns: [{ key: label, label: label === 'date' ? 'Date' : 'Name', ...(x ? { format: 'date' } : { link: 'link' }) }, ...extra, ...values],
      };
    case 'list':
      return {
        ...out,
        items: rows.map(r => ({
          title: String(r[label] ?? ''), subtitle: extra[0] ? String(r[extra[0].key] ?? '') : undefined,
          value: r[v0.key], link: r.link || undefined,
        })),
      };
    default:
      // bar / line / area; radar has no live layout and shows as bars
      return {
        ...out,
        type: ['bar', 'line', 'area'].includes(spec.type) ? spec.type : 'bar',
        data: rows,
        xKey: x || label,
        series: values.map(v => ({ key: v.key, name: v.label })),
      };
  }
}

/**
 * Fill a live widget's spec with current data. `artists` are the followed artists
 * (default: the shared roster), `groups` the user's groups.
 */
export async function hydrateSpec(spec, { artists = getRoster(), groups = [] } = {}) {
  const live = cleanLive(spec?.live);
  if (!live) return spec;
  const scope = await scopeArtists(live.artists, { artists, groups });
  if (!scope.length) {
    return { title: spec.title, subtitle: spec.subtitle, type: 'text', live, text: live.artists === 'all' ? 'Follow artists to fill this widget.' : 'No artists to show yet.' };
  }
  const names = new Map(scope.map(a => [a.slug, a.name]));
  const result = await QUERIES[live.query](live, scope, names);
  if (!result.rows.length && !(spec.type === 'metric' && result.totals)) {
    return { title: spec.title, subtitle: spec.subtitle, type: 'text', live, text: 'No data yet for these artists.' };
  }
  return shape({ ...spec, live }, result);
}
