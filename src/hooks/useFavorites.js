import { useState, useCallback } from 'react';

const STORAGE_KEY = 'musicspace-favorites';
// No static default roster any more — favorites start empty until the user
// adds some (the old default was the top 7 of the bundled index).
const DEFAULT_FAVORITES = [];

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
