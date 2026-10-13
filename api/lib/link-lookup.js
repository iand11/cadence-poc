// Finds one release (track or album) on every streaming service from a single URL.
//
// song.link/Odesli used to do this, but its keyless API was retired on 2026-07-31
// and now answers every call with 401 PUBLIC_API_ACCESS_DEPRECATED. So the lookup
// asks the services directly:
//   1. Read the pasted link: Spotify and Deezer return the ISRC (track) or UPC
//      (album); Apple Music and YouTube only give a title and artist.
//   2. Find the same release elsewhere: by ISRC/UPC where the service supports it
//      (exact match), otherwise by title + artist search with a name check.
// Spotify needs SPOTIFY_CLIENT_ID/SECRET; Apple Music (iTunes Search API), Deezer
// and YouTube oEmbed need no key. Services without a keyless API (Amazon, TIDAL,
// YouTube Music for a non-YouTube link, …) are added by hand.
//
// ODESLI_API_KEY — optional; with a key, Odesli is used instead (covers more services).
import { spotifyGet } from './spotify.js';

const ITUNES = 'https://itunes.apple.com';
const DEEZER = 'https://api.deezer.com';
const ODESLI = process.env.ODESLI_API_URL || 'https://api.song.link/v1-alpha.1';

const lookupError = (message) => Object.assign(new Error(message), { status: 400 });

/** Which service a URL points at, and the track/album id on it. */
export function parseSourceUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'open.spotify.com') {
    const i = parts.findIndex(p => p === 'track' || p === 'album');
    if (i >= 0 && parts[i + 1]) return { service: 'spotify', kind: parts[i], id: parts[i + 1] };
  }
  if (host === 'music.apple.com' || host === 'itunes.apple.com') {
    const country = /^[a-z]{2}$/.test(parts[0]) ? parts[0] : 'us';
    const last = parts[parts.length - 1]?.replace(/^id/, '');
    const trackId = u.searchParams.get('i');
    if (trackId) return { service: 'appleMusic', kind: 'track', id: trackId, country };
    if (parts.includes('song') && /^\d+$/.test(last)) return { service: 'appleMusic', kind: 'track', id: last, country };
    if (parts.includes('album') && /^\d+$/.test(last)) return { service: 'appleMusic', kind: 'album', id: last, country };
  }
  if (host === 'deezer.com') {
    const i = parts.findIndex(p => p === 'track' || p === 'album');
    if (i >= 0 && /^\d+$/.test(parts[i + 1] || '')) return { service: 'deezer', kind: parts[i], id: parts[i + 1] };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? parts[0] : u.searchParams.get('v');
    if (id) return { service: host === 'music.youtube.com' ? 'youtubeMusic' : 'youtube', kind: 'track', id };
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).hostname} ${res.status}`), { status: res.status });
  return res.json();
}

// Loose name comparison: case, punctuation, "(feat. …)", "- Remastered" and "(Official Video)" don't matter
export const norm = (s) => String(s || '').toLowerCase()
  .replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '')
  .normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const sameName = (a, b) => !!norm(a) && norm(a) === norm(b);
const sameArtist = (a, b) => !!norm(a) && !!norm(b) && (norm(a).includes(norm(b)) || norm(b).includes(norm(a)));
const matches = (seed, title, artist) => sameName(seed.title, title) && sameArtist(seed.artistName, artist);

// ── Reading the pasted link ─────────────────────────────────────────────────

async function readSpotify({ kind, id }) {
  const res = await spotifyGet(`/${kind}s/${encodeURIComponent(id)}`);
  if (!res.ok) throw Object.assign(new Error(`Spotify ${res.status}`), { status: res.status });
  const r = await res.json();
  return {
    title: r.name, artistName: r.artists?.[0]?.name || null,
    imageUrl: (r.album || r).images?.[0]?.url || null,
    isrc: r.external_ids?.isrc || null, upc: r.external_ids?.upc || null,
    url: r.external_urls?.spotify,
  };
}

const appleUrl = (url) => url?.replace(/[?&]uo=\d+/, '').replace(/\?$/, '') || null;
const appleArtwork = (r) => r.artworkUrl100?.replace('100x100bb', '600x600bb') || null;

async function readApple({ kind, id, country }) {
  const body = await getJson(`${ITUNES}/lookup?id=${encodeURIComponent(id)}&country=${country}`);
  const r = body.results?.[0];
  if (!r) throw Object.assign(new Error('Apple Music: not found'), { status: 404 });
  return {
    title: kind === 'album' ? r.collectionName : r.trackName, artistName: r.artistName,
    imageUrl: appleArtwork(r), url: appleUrl(kind === 'album' ? r.collectionViewUrl : r.trackViewUrl),
  };
}

async function readDeezer({ kind, id }) {
  const r = await getJson(`${DEEZER}/${kind}/${id}`);
  if (r.error) throw Object.assign(new Error('Deezer: not found'), { status: 404 });
  return {
    title: r.title, artistName: r.artist?.name || null, imageUrl: (r.album || r).cover_xl || null,
    isrc: r.isrc || null, upc: r.upc || null, url: r.link,
  };
}

// YouTube has no keyless search API, but oEmbed gives the video title and channel.
async function readYouTube({ service, id }) {
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const r = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
  const channel = String(r.author_name || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const dash = String(r.title || '').split(/\s+[-–—]\s+/);
  const [artistName, title] = dash.length >= 2 ? [dash[0], dash.slice(1).join(' - ')] : [channel, r.title];
  return {
    title: title.replace(/\s*[([][^)\]]*(official|video|audio|lyric|visuali[sz]er|\bhd\b|4k)[^)\]]*[)\]]/gi, '').trim(),
    artistName, imageUrl: r.thumbnail_url || null,
    url: service === 'youtubeMusic' ? `https://music.youtube.com/watch?v=${id}` : watch,
  };
}

const READERS = { spotify: readSpotify, appleMusic: readApple, deezer: readDeezer, youtube: readYouTube, youtubeMusic: readYouTube };

// ── Finding it on the other services ────────────────────────────────────────

async function findSpotify(seed, kind) {
  const q = seed.isrc ? `isrc:${seed.isrc}` : seed.upc ? `upc:${seed.upc}`
    : `${kind === 'album' ? 'album' : 'track'}:${seed.title} artist:${seed.artistName}`;
  const res = await spotifyGet(`/search?${new URLSearchParams({ q, type: kind, limit: '5' })}`);
  if (!res.ok) throw Object.assign(new Error(`Spotify ${res.status}`), { status: res.status });
  const items = (await res.json())[`${kind}s`]?.items || [];
  const hit = (seed.isrc || seed.upc) ? items[0] : items.find(i => matches(seed, i.name, i.artists?.[0]?.name));
  if (!hit) return null;
  return { url: hit.external_urls?.spotify, isrc: hit.external_ids?.isrc || null, imageUrl: (hit.album || hit).images?.[0]?.url };
}

async function findDeezer(seed, kind) {
  if (seed.isrc || seed.upc) {
    const r = await getJson(`${DEEZER}/${kind}/${seed.isrc ? `isrc:${seed.isrc}` : `upc:${seed.upc}`}`);
    if (!r.error && r.link) return { url: r.link };
  }
  // Deezer's field filters (artist:"…") are unreliable, so search plain text and check names
  const body = await getJson(`${DEEZER}/search/${kind}?q=${encodeURIComponent(`${seed.artistName} ${seed.title}`)}&limit=10`);
  const hit = (body.data || []).find(i => matches(seed, i.title, i.artist?.name));
  return hit ? { url: hit.link } : null;
}

async function findApple(seed, kind) {
  if (kind === 'album' && seed.upc) {
    const body = await getJson(`${ITUNES}/lookup?upc=${encodeURIComponent(seed.upc)}`);
    const r = body.results?.find(x => x.collectionViewUrl);
    if (r) return { url: appleUrl(r.collectionViewUrl) };
  }
  const entity = kind === 'album' ? 'album' : 'song';
  const body = await getJson(`${ITUNES}/search?${new URLSearchParams({ term: `${seed.artistName} ${seed.title}`, entity, limit: '10', country: 'US' })}`);
  const hit = (body.results || []).find(r => matches(seed, kind === 'album' ? r.collectionName : r.trackName, r.artistName));
  return hit ? { url: appleUrl(kind === 'album' ? hit.collectionViewUrl : hit.trackViewUrl) } : null;
}

const FINDERS = { spotify: findSpotify, appleMusic: findApple, deezer: findDeezer };

async function resolveWithOdesli(sourceUrl) {
  const res = await fetch(`${ODESLI}/links?url=${encodeURIComponent(sourceUrl)}&userCountry=US&key=${encodeURIComponent(process.env.ODESLI_API_KEY)}`);
  if (!res.ok) {
    throw lookupError(res.status === 404
      ? "Couldn't find that release. Check the link, or add the service links yourself."
      : `Link lookup failed (${res.status}). Add the service links yourself.`);
  }
  const body = await res.json();
  const entity = body.entitiesByUniqueId?.[body.entityUniqueId] || {};
  return {
    title: entity.title || null, artistName: entity.artistName || null, imageUrl: entity.thumbnailUrl || null,
    links: Object.entries(body.linksByPlatform || {}).map(([service, v]) => ({ service, url: v.url })),
  };
}

/** { title, artistName, imageUrl, links: [{ service, url }] } — links not yet cleaned. */
export async function lookupRelease(sourceUrl) {
  if (process.env.ODESLI_API_KEY) return resolveWithOdesli(sourceUrl);

  const src = parseSourceUrl(sourceUrl);
  if (!src) throw lookupError('Paste a Spotify, Apple Music, Deezer or YouTube link to the release, or add the service links yourself.');

  let seed;
  try {
    seed = await READERS[src.service](src);
  } catch (err) {
    if (err.status === 503) throw lookupError('Spotify lookup is not configured. Paste an Apple Music or Deezer link, or add the service links yourself.');
    throw lookupError(err.status === 404 || err.status === 400
      ? "Couldn't find that release. Check the link, or add the service links yourself."
      : `Link lookup failed (${err.message}). Add the service links yourself.`);
  }

  const kind = src.kind;
  const found = { [src.service]: seed.url || sourceUrl };
  const run = async (service) => {
    if (found[service]) return;
    try {
      const hit = await FINDERS[service](seed, kind);
      if (hit?.url) found[service] = hit.url;
      if (hit?.isrc && !seed.isrc) seed.isrc = hit.isrc;
      if (hit?.imageUrl && !seed.imageUrl) seed.imageUrl = hit.imageUrl;
    } catch (err) {
      console.warn(`[link-lookup] ${service}: ${err.message}`);
    }
  };
  // Spotify first: for Apple/YouTube links it supplies the ISRC that makes Deezer exact
  await run('spotify');
  await Promise.all(['appleMusic', 'deezer'].map(run));

  return {
    title: seed.title || null, artistName: seed.artistName || null, imageUrl: seed.imageUrl || null,
    links: Object.entries(found).map(([service, url]) => ({ service, url })),
  };
}
