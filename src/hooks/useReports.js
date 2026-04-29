import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cadence-reports-v1';

const DEFAULT_REPORTS = [
  {
    id: 'default-1',
    name: 'Top 3 Global Overview',
    artists: ['taylor-swift', 'bad-bunny', 'bruno-mars'],
    widgets: ['artist-comparison', 'streaming-trends', 'revenue-breakdown', 'social-growth'],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
  {
    id: 'default-2',
    name: 'Pop Queens',
    artists: ['taylor-swift', 'ariana-grande', 'billie-eilish', 'dua-lipa'],
    widgets: ['artist-comparison', 'social-growth', 'playlists'],
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
  },
  {
    id: 'default-3',
    name: 'Hip-Hop Landscape',
    artists: ['drake', 'kendrick-lamar', 'kanye-west', 'future'],
    widgets: ['artist-comparison', 'streaming-trends', 'revenue-breakdown', 'benchmarks'],
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  },
  {
    id: 'default-4',
    name: 'Latin Music Pulse',
    artists: ['bad-bunny', 'shakira', 'j-balvin', 'karol-g', 'peso-pluma'],
    widgets: ['artist-comparison', 'streaming-trends', 'geography', 'social-growth'],
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-16T00:00:00.000Z',
  },
  {
    id: 'default-5',
    name: 'Taylor Swift Deep Dive',
    artists: ['taylor-swift'],
    widgets: ['streaming-trends', 'revenue-breakdown', 'social-growth', 'geography', 'forecast', 'playlists', 'benchmarks'],
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
  },
  {
    id: 'default-6',
    name: 'K-Pop & Global Crossover',
    artists: ['bts', 'blackpink', 'arijit-singh'],
    widgets: ['artist-comparison', 'social-growth', 'geography', 'playlists'],
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-14T00:00:00.000Z',
  },
  {
    id: 'default-7',
    name: 'R&B Spotlight',
    artists: ['the-weeknd', 'sza', 'beyonc', 'chris-brown'],
    widgets: ['artist-comparison', 'streaming-trends', 'social-growth', 'benchmarks'],
    createdAt: '2026-04-07T00:00:00.000Z',
    updatedAt: '2026-04-13T00:00:00.000Z',
  },
  {
    id: 'default-8',
    name: 'Rising Stars',
    artists: ['sabrina-carpenter', 'peso-pluma', 'tyla', 'doja-cat'],
    widgets: ['artist-comparison', 'streaming-trends', 'forecast', 'social-growth'],
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
  },
];

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_REPORTS;
    return JSON.parse(stored) || [];
  } catch {
    return DEFAULT_REPORTS;
  }
}

function save(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function useReports() {
  const [reports, setReports] = useState(load);

  const createReport = useCallback((report = {}) => {
    const newReport = {
      id: 'report-' + Date.now(),
      name: report.name || 'Untitled Report',
      artists: report.artists || [],
      widgets: report.widgets || ['artist-comparison', 'streaming-trends'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setReports(prev => {
      const next = [newReport, ...prev];
      save(next);
      return next;
    });
    return newReport.id;
  }, []);

  const updateReport = useCallback((id, updates) => {
    setReports(prev => {
      const next = prev.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );
      save(next);
      return next;
    });
  }, []);

  const deleteReport = useCallback((id) => {
    setReports(prev => {
      const next = prev.filter(r => r.id !== id);
      save(next);
      return next;
    });
  }, []);

  const getReport = useCallback((id) => {
    return reports.find(r => r.id === id) || null;
  }, [reports]);

  return { reports, createReport, updateReport, deleteReport, getReport };
}
