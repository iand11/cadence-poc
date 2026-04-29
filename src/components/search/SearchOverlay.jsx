import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, X, Music, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { searchArtists, getTopArtists } from '../../data/artists';
import { formatNumber } from '../../utils/formatters';

export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const results = query.length >= 1 ? searchArtists(query) : [];
  const trending = getTopArtists(6);

  const handleSelect = (artist) => {
    navigate(`/artist/${artist.slug}`);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="glass-panel rounded w-full max-w-xl max-h-[60vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <Search size={18} className="text-[#888888] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an artist..."
            className="flex-1 bg-transparent text-sm text-[#F4F0EA] placeholder-[#444444] outline-none"
          />
          <button type="button" onClick={onClose} className="text-[#444444] hover:text-[#888888] transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((artist) => (
                <button
                  key={artist.slug}
                  onClick={() => handleSelect(artist)}
                  className="flex items-center gap-3 w-full px-5 py-3 hover:bg-[#0F0F0F] transition-colors text-left cursor-pointer"
                >
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt="" className="w-9 h-9 rounded object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded bg-[#1E1E1E] flex items-center justify-center">
                      <Music size={14} className="text-[#444444]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F4F0EA]">{artist.name}</p>
                    <p className="text-[10px] text-[#888888]">
                      {artist.genres?.primary?.name || 'Artist'} · {artist.label} · {formatNumber(artist.spotify.monthlyListeners)} listeners
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#444444]">#{artist.rank}</span>
                  <ChevronRight size={14} className="text-[#444444]" />
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#888888]">No artists found for &quot;{query}&quot;</p>
            </div>
          ) : (
            /* Trending artists when empty */
            <div className="py-2">
              <p className="px-5 py-2 text-[10px] text-[#444444] uppercase tracking-wider">Top Artists</p>
              {trending.map((artist) => (
                <button
                  key={artist.slug}
                  onClick={() => handleSelect(artist)}
                  className="flex items-center gap-3 w-full px-5 py-2.5 hover:bg-[#0F0F0F] transition-colors text-left cursor-pointer"
                >
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-[#1E1E1E] flex items-center justify-center">
                      <Music size={12} className="text-[#444444]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F4F0EA]">{artist.name}</p>
                    <p className="text-[10px] text-[#888888]">{artist.genres?.primary?.name || 'Artist'} · {formatNumber(artist.spotify.monthlyListeners)} listeners</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#444444]">#{artist.rank}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
