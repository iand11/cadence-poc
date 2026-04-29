import { useState, useCallback, useRef } from 'react';
import { allArtists, getAggregateStats } from '../data/artists';

const welcomeMessage = {
  role: 'ai',
  text: "Hi, I'm Cadence. I'm tracking 100 artists across all major platforms including Spotify, Apple Music, TikTok, Instagram, and YouTube. Ask me anything about the roster — from breakout signals to tour routing to revenue projections. I can also build custom reports for you.",
  isStreaming: false,
};

const suggestedPrompts = [
  "Which city should we route our next tour?",
  "Show me breakout signals across the roster",
  "Predict streams for the next release cycle",
  "What's our sync licensing opportunity?",
  "Compare engagement across the top artists",
  "Build a report on Drake and Taylor Swift",
];

// Build condensed context string from artist data (runs once)
let cachedContext = null;
function getArtistContext() {
  if (cachedContext) return cachedContext;

  const fmt = n =>
    n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
    n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
    n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);

  const stats = getAggregateStats();
  const lines = allArtists.map(a => {
    const topCities = a.spotify.topCities.slice(0, 3)
      .map(c => `${c.city}(${fmt(c.listeners)})`).join(', ');
    return [
      `#${a.rank} ${a.name}`,
      `${a.genres?.primary?.name || ''} | ${a.label} | ${a.country}/${a.city}`,
      `Spotify:${fmt(a.spotify.monthlyListeners)}mo/${fmt(a.spotify.followers)}fol/pop${a.spotify.popularity}`,
      `IG=${fmt(a.social.instagram)} TT=${fmt(a.social.tiktok)} YT=${fmt(a.social.youtube)} X=${fmt(a.social.twitter)}`,
      `Playlists:${a.playlists.spotify.total}(${a.playlists.spotify.editorial}ed) reach=${fmt(a.playlists.spotify.reach)}`,
      `Shazam:${fmt(a.engagement.shazam)} Cities:${topCities || 'N/A'}`,
    ].join(' | ');
  });

  cachedContext = [
    `ROSTER: ${stats.total} artists, ${fmt(stats.totalListeners)} total monthly listeners, ${fmt(stats.totalFollowers)} followers`,
    '',
    ...lines,
  ].join('\n');

  return cachedContext;
}

function getRandomSuggestions(exclude, count = 3) {
  const filtered = suggestedPrompts.filter(s => s !== exclude);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function useChat() {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [state, setState] = useState('idle'); // idle | streaming
  const [suggestions, setSuggestions] = useState(suggestedPrompts);
  const [pendingAction, setPendingAction] = useState(null);
  const conversationRef = useRef([]); // API-format history
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    // Add user message to display
    setMessages(prev => [...prev, { role: 'user', text }]);
    setState('streaming');
    setSuggestions([]);
    setPendingAction(null);

    // Track in conversation history
    conversationRef.current.push({ role: 'user', content: text });

    // Add empty AI message placeholder
    setMessages(prev => [...prev, { role: 'ai', text: '', isStreaming: true }]);

    let fullResponse = '';
    let toolName = null;
    let toolInputJson = '';
    let rafId = null;
    let dirty = false;

    // Batch UI updates to animation frames (~60fps) instead of every SSE chunk
    const scheduleUpdate = () => {
      if (dirty && !rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          dirty = false;
          const snapshot = fullResponse;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated.length - 1;
            updated[last] = { ...updated[last], text: snapshot };
            return updated;
          });
        });
      }
    };

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationRef.current,
          artistContext: getArtistContext(),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'delta') {
              fullResponse += data.text;
              dirty = true;
              scheduleUpdate();
            } else if (data.type === 'tool_start') {
              toolName = data.name;
            } else if (data.type === 'tool_input_delta') {
              toolInputJson += data.json;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      // Flush any pending rAF
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      // Handle tool use
      if (toolName === 'create_report' && toolInputJson) {
        try {
          const toolInput = JSON.parse(toolInputJson);
          const artistSlugs = toolInput.artistSlugs || [];
          const widgets = toolInput.widgets || ['artist-comparison', 'streaming-trends'];
          const artistLabel = artistSlugs.map(s => s.replace(/-/g, ' ')).join(', ');

          // Create report in localStorage
          const reportId = 'report-' + Date.now();
          const newReport = {
            id: reportId,
            name: artistSlugs.length === 1
              ? `${artistSlugs[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Report`
              : 'Artist Comparison Report',
            artists: artistSlugs,
            widgets,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          try {
            const stored = JSON.parse(localStorage.getItem('cadence-reports-v1') || '[]');
            stored.unshift(newReport);
            localStorage.setItem('cadence-reports-v1', JSON.stringify(stored));
          } catch { /* ignore */ }

          // If no text response, add a message about the report
          if (!fullResponse) {
            fullResponse = `I'm creating a report for ${artistLabel}. Redirecting you to the Report Center now.`;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated.length - 1;
              updated[last] = { ...updated[last], text: fullResponse };
              return updated;
            });
          }

          setPendingAction({ type: 'navigate', url: `/reports/${reportId}` });
        } catch {
          // Failed to parse tool input, ignore
        }
      }

      // Mark streaming complete
      setMessages(prev => {
        const updated = [...prev];
        const last = updated.length - 1;
        updated[last] = { ...updated[last], isStreaming: false };
        return updated;
      });

      // Add to conversation history
      conversationRef.current.push({ role: 'assistant', content: fullResponse });

      setState('idle');
      setSuggestions(getRandomSuggestions(text));

    } catch (error) {
      if (error.name === 'AbortError') return;

      setMessages(prev => {
        const updated = [...prev];
        const last = updated.length - 1;
        updated[last] = {
          role: 'ai',
          text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
          isStreaming: false,
          isError: true,
        };
        return updated;
      });

      setState('idle');
      setSuggestions(getRandomSuggestions(text));
    }
  }, []);

  const clearAction = useCallback(() => setPendingAction(null), []);

  return { messages, state, suggestions, sendMessage, pendingAction, clearAction };
}
