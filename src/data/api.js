// App-facing API facade — everything is served by the database now.
// The old version built the content feed from a bundled social_posts.json and
// keyed it off the static roster; both now come from /api/feed and /api/artists.
import { getUserData, setUserData } from './userData';
import { fetchContentFeed, loadArtistDetail } from './artistsRemote';

export const api = {
  getUserData,
  setUserData,

  /**
   * Social content feed from the database.
   * Same call signature and response shape as before:
   * { items, artistAverages, total }
   */
  getContentFeed(opts = {}) {
    return fetchContentFeed(opts);
  },

  /** Tracks/albums detail for one artist ({ tracks, albums }). */
  getArtist(slug) {
    return loadArtistDetail(slug);
  },
};
