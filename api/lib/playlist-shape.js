// Shared row → UI shapes for the playlist endpoints (data from the
// music-scrapers playlist crawl: playlists / playlist_entries / playlist_snapshots).

export const PLAYLIST_COLUMNS = `
  p.id, p.platform, p.platform_id, p.name, p.description, p.curator_name, p.type,
  p.is_editorial, p.followers, p.track_count, p.image_url, p.url, p.categories,
  p.last_crawled_at, p.last_changed_at`;

const CURATOR_LABEL = { editorial: 'Editorial', chart: 'Chart', algorithmic: 'Algorithmic', this_is: 'This Is', label: 'Major label', brand: 'Brand', user: 'User' };

// Platform descriptions arrive with HTML tags / entities — return plain text.
export function plainText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();
}

export function playlistRowToUI(r) {
  return {
    id: String(r.id),
    platform: r.platform,
    platformId: r.platform_id,
    name: r.name,
    description: plainText(r.description),
    curator: r.curator_name || CURATOR_LABEL[r.type] || '',
    type: r.type,
    typeLabel: CURATOR_LABEL[r.type] || r.type,
    isEditorial: !!r.is_editorial,
    followers: r.followers == null ? null : Number(r.followers),
    trackCount: r.track_count == null ? null : Number(r.track_count),
    imageUrl: r.image_url || '',
    url: r.url || '',
    categories: r.categories || [],
    lastCrawledAt: r.last_crawled_at || null,
    lastChangedAt: r.last_changed_at || null,
    ...(r.followers_7d_ago != null ? { followers7dDelta: Number(r.followers) - Number(r.followers_7d_ago) } : {}),
    ...(r.roster_tracks != null ? { rosterTracks: Number(r.roster_tracks) } : {}),
    ...(r.roster_artists != null ? { rosterArtists: Number(r.roster_artists) } : {}),
  };
}

const days = (from, to) => (from ? Math.max(0, Math.round((new Date(to || Date.now()) - new Date(from)) / 86_400_000)) : null);

export function entryRowToUI(r) {
  const since = r.added_at || r.first_seen_at;
  return {
    entryId: String(r.entry_id ?? r.id),
    trackId: r.track_id == null ? null : String(r.track_id),
    platformTrackId: r.platform_track_id,
    trackName: r.track_name || '',
    artistNames: r.artist_names || [],
    artists: (r.artists || []).filter(Boolean), // [{ slug, name }] catalog-linked
    position: r.position,
    peakPosition: r.peak_position,
    addedAt: r.added_at || null,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    removedAt: r.removed_at || null,
    current: !r.removed_at,
    daysOn: days(since, r.removed_at),
  };
}

export const intParam = (v, d, min, max) => Math.min(Math.max(Number(v) || d, min), max);

export function list(p, name) {
  return (p.get(name) || '').split(',').map((s) => s.trim()).filter(Boolean);
}
