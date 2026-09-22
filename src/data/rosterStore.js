// Tiny module-level store for the user's tracked-artist roster.
//
// TrackedArtistsProvider is the single writer (setRoster on fetch/refresh).
// Non-React data modules (playlistData, insights, buildAISummary, actions,
// useChat context) read the roster from here instead of the old static
// `allArtists` bundle, and can subscribe to invalidate their caches when the
// roster changes.

let roster = [];
const listeners = new Set();

export function setRoster(artists) {
  roster = artists || [];
  for (const fn of listeners) fn(roster);
}

export function getRoster() {
  return roster;
}

export function getRosterArtist(slug) {
  return roster.find((a) => a.slug === slug) || null;
}

export function subscribeRoster(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
