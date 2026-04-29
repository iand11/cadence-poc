import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cadence-dashboard-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'top-artists',           x: 0, y: 0,  w: 5, h: 8, minW: 4, minH: 6 },
  { i: 'streaming',             x: 5, y: 0,  w: 7, h: 8, minW: 4, minH: 6 },
  { i: 'revenue',               x: 0, y: 8,  w: 5, h: 8, minW: 4, minH: 6 },
  { i: 'social',                x: 5, y: 8,  w: 7, h: 8, minW: 4, minH: 6 },
  { i: 'leaderboard-listeners', x: 0, y: 16, w: 6, h: 8, minW: 3, minH: 5 },
  { i: 'leaderboard-social',    x: 6, y: 16, w: 6, h: 8, minW: 3, minH: 5 },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.length > 0 ? saved : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useDashboardLayout() {
  const [layout, setLayoutState] = useState(load);

  const setLayout = useCallback((newLayout) => {
    setLayoutState(newLayout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT));
  }, []);

  return { layout, setLayout, resetLayout, DEFAULT_LAYOUT };
}
