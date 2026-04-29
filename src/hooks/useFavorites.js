import { useState, useCallback } from 'react';
import { getTopArtists } from '../data/artists';

const STORAGE_KEY = 'cadence-favorites';
const DEFAULT_FAVORITES = getTopArtists(7).map(a => a.slug);

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_FAVORITES;
    return JSON.parse(stored) || [];
  } catch {
    return DEFAULT_FAVORITES;
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(load);

  const toggleFavorite = useCallback((slug) => {
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback((slug) => favorites.includes(slug), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
