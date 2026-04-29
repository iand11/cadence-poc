import { useState, useRef, useEffect } from 'react';
import { Search, X, Music } from 'lucide-react';
import { allArtists, searchArtists } from '../../data/artists';
import { formatNumber } from '../../utils/formatters';

export default function ArtistSelector({ selected, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const results = query.length >= 1
    ? searchArtists(query).filter(a => !selected.some(s => s.slug === a.slug))
    : allArtists.filter(a => !selected.some(s => s.slug === a.slug)).slice(0, 8);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addArtist = (artist) => {
    onChange([...selected, artist]);
    setQuery('');
    setOpen(false);
  };

  const removeArtist = (slug) => {
    onChange(selected.filter(a => a.slug !== slug));
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips + search input */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0F0F0F] border border-[#1E1E1E] rounded px-3 py-2.5 focus-within:border-[#00D4FF]/30 transition-colors">
        {selected.map((artist) => (
          <span
            key={artist.slug}
            className="flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#F4F0EA] rounded px-2.5 py-1 text-xs"
          >
            {artist.imageUrl ? (
              <img src={artist.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />
            ) : (
              <Music size={10} className="text-[#00D4FF]" />
            )}
            {artist.name}
            <button
              onClick={() => removeArtist(artist.slug)}
              className="text-[#888888] hover:text-[#F4F0EA] ml-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <Search size={14} className="text-[#444444] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? 'Search artists to add...' : 'Add more...'}
            className="flex-1 bg-transparent text-xs text-[#F4F0EA] placeholder-[#444444] outline-none py-0.5"
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onChange(allArtists.slice(0, 5))}
          className="text-[10px] text-[#888888] hover:text-[#F4F0EA] transition-colors cursor-pointer"
        >
          Top 5
        </button>
        <button
          onClick={() => onChange(allArtists.slice(0, 10))}
          className="text-[10px] text-[#888888] hover:text-[#F4F0EA] transition-colors cursor-pointer"
        >
          Top 10
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-[#e85d5d]/70 hover:text-[#e85d5d] transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0F0F0F] border border-[#1E1E1E] rounded shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {results.slice(0, 10).map((artist) => (
            <button
              key={artist.slug}
              onMouseDown={() => addArtist(artist)}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 hover:bg-[#141414] transition-colors text-left cursor-pointer"
            >
              {artist.imageUrl ? (
                <img src={artist.imageUrl} alt="" className="w-7 h-7 rounded object-cover" />
              ) : (
                <div className="w-7 h-7 rounded bg-[#1E1E1E] flex items-center justify-center">
                  <Music size={10} className="text-[#444444]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F4F0EA] truncate">{artist.name}</p>
                <p className="text-[9px] text-[#444444]">
                  {artist.genres?.primary?.name || 'Artist'} · {formatNumber(artist.spotify.monthlyListeners)} listeners
                </p>
              </div>
              <span className="text-[9px] font-mono text-[#444444]">#{artist.rank}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
