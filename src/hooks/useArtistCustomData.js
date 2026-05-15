import { useState, useCallback } from 'react';
import { toCSVUrl, parseCSV } from '../utils/csvParser';

const STORAGE_PREFIX = 'cadence-artist-custom-';

const DEFAULT_DATA = {
  bio: '',
  notes: '',
  spotifyEmbedUrl: '',
  customFields: [],
  sheetsUrl: '',
  sheetsData: [],
  sheetsSyncedAt: null,
  blockSettings: {},
  visibility: 'private',
};

function load(slug) {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + slug);
    if (!stored) return { ...DEFAULT_DATA };
    return { ...DEFAULT_DATA, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function save(slug, data) {
  localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(data));
}

export function useArtistCustomData(slug) {
  const [data, setData] = useState(() => load(slug));

  const updateField = useCallback((field, value) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      save(slug, next);
      return next;
    });
  }, [slug]);

  const addCustomField = useCallback(() => {
    setData(prev => {
      const id = 'field-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const next = {
        ...prev,
        customFields: [...prev.customFields, { id, label: '', value: '' }],
      };
      save(slug, next);
      return next;
    });
  }, [slug]);

  const removeCustomField = useCallback((id) => {
    setData(prev => {
      const next = {
        ...prev,
        customFields: prev.customFields.filter(f => f.id !== id),
      };
      save(slug, next);
      return next;
    });
  }, [slug]);

  const updateCustomField = useCallback((id, field, value) => {
    setData(prev => {
      const next = {
        ...prev,
        customFields: prev.customFields.map(f =>
          f.id === id ? { ...f, [field]: value } : f
        ),
      };
      save(slug, next);
      return next;
    });
  }, [slug]);

  const syncSheets = useCallback(async () => {
    if (!data.sheetsUrl.trim()) return;
    const csvUrl = toCSVUrl(data.sheetsUrl.trim());
    const res = await fetch(csvUrl, { headers: { Accept: 'text/csv,text/plain,*/*' } });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? 'Sheet not found. Make sure it is published to the web.'
          : `Failed to fetch sheet (${res.status})`
      );
    }
    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      throw new Error('No data found. Make sure Column A has labels and Column B has values.');
    }
    const syncedAt = new Date().toISOString();
    setData(prev => {
      const next = { ...prev, sheetsData: rows.slice(0, 200), sheetsSyncedAt: syncedAt };
      save(slug, next);
      return next;
    });
    return rows;
  }, [slug, data.sheetsUrl]);

  return { data, updateField, addCustomField, removeCustomField, updateCustomField, syncSheets };
}
