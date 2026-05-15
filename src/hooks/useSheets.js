import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cadence-sheets-v1';

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [];
    return JSON.parse(stored) || [];
  } catch {
    return [];
  }
}

function save(sheets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
}

export function useSheets() {
  const [sheets, setSheets] = useState(load);

  const createSheet = useCallback((artistSlug) => {
    const now = new Date().toISOString();
    const newSheet = {
      id: 'sheet-' + Date.now(),
      artistSlug,
      createdAt: now,
      updatedAt: now,
    };
    setSheets(prev => {
      const next = [newSheet, ...prev];
      save(next);
      return next;
    });
    return newSheet.id;
  }, []);

  const deleteSheet = useCallback((id) => {
    setSheets(prev => {
      const next = prev.filter(s => s.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { sheets, createSheet, deleteSheet };
}
