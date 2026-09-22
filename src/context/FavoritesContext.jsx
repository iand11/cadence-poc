import { createContext, useContext, useCallback } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';

/**
 * The user's favorited artist slugs. Persisted per-account through
 * usePersistedState (/api/user-data with localStorage fallback), so they
 * survive sign-out / sign-in. One shared instance, so a star toggled in the
 * AppBar shows up immediately on the dashboard and profile pages.
 */
const STORAGE_KEY = 'musicspace-favorites';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites, { loaded }] = usePersistedState(STORAGE_KEY, []);

  const toggleFavorite = useCallback((slug) => {
    setFavorites((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, [setFavorites]);

  const addFavorite = useCallback((slug) => {
    setFavorites((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, [setFavorites]);

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter((s) => s !== slug));
  }, [setFavorites]);

  const isFavorite = useCallback((slug) => favorites.includes(slug), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, addFavorite, removeFavorite, isFavorite, loaded }}>
      {children}
    </FavoritesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook pair
export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return ctx;
}
