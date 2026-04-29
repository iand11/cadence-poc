import { Link, useLocation, useNavigate } from 'react-router';
import { Search, Bell, FileText, LayoutDashboard, Music, Star, Sparkles, ListMusic } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { searchArtists } from '../../data/artists';
import { formatNumber } from '../../utils/formatters';
import { useFavorites } from '../../hooks/useFavorites';

export default function AppBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const { toggleFavorite, isFavorite } = useFavorites();
  const results = query.length >= 2 ? searchArtists(query).slice(0, 6) : [];

  const handleSelect = (artist) => {
    navigate(`/artist/${artist.slug}`);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-50 bg-[#080808]/80 backdrop-blur-xl border-b border-[#1E1E1E]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex items-center h-14 gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded bg-[#00D4FF]/15 flex items-center justify-center">
              <span className="font-mono text-sm font-bold text-[#00D4FF]">M</span>
            </div>
            <span className="font-['Epilogue'] text-sm font-medium text-[#F4F0EA] hidden sm:block">
              Cadence
            </span>
          </Link>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="flex items-center gap-2.5 h-9 px-3.5 rounded bg-[#0F0F0F] border border-[#1E1E1E] focus-within:border-[#2A2A2A] transition-colors">
              <Search size={14} className="text-[#444444] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                placeholder="Search artists..."
                className="flex-1 bg-transparent text-xs text-[#F4F0EA] placeholder-[#444444] outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center text-[9px] font-mono text-[#444444] bg-[#080808] border border-[#1E1E1E] rounded px-1 py-0.5">
                ⌘K
              </kbd>
            </div>

            {/* Inline dropdown results */}
            <AnimatePresence>
              {focused && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F0F0F] border border-[#1E1E1E] rounded shadow-2xl z-50 overflow-hidden"
                >
                  {results.map((artist) => (
                    <button
                      key={artist.slug}
                      onMouseDown={() => handleSelect(artist)}
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
                        <p className="text-[9px] text-[#444444]">{formatNumber(artist.spotify.monthlyListeners)} listeners</p>
                      </div>
                      <span className="text-[9px] font-mono text-[#444444]">#{artist.rank}</span>
                      <button
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          toggleFavorite(artist.slug);
                        }}
                        className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          size={12}
                          className={isFavorite(artist.slug) ? 'fill-[#00D4FF] text-[#00D4FF]' : 'text-[#444444] hover:text-[#888888]'}
                        />
                      </button>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                location.pathname === '/'
                  ? 'text-[#F4F0EA] bg-[#0F0F0F]'
                  : 'text-[#888888] hover:text-[#F4F0EA]'
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden md:inline">Chat</span>
            </Link>
            <Link
              to="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                location.pathname.startsWith('/dashboard')
                  ? 'text-[#F4F0EA] bg-[#0F0F0F]'
                  : 'text-[#888888] hover:text-[#F4F0EA]'
              }`}
            >
              <LayoutDashboard size={14} />
              <span className="hidden md:inline">Dashboard</span>
            </Link>
            <Link
              to="/tracks"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                location.pathname.startsWith('/track')
                  ? 'text-[#F4F0EA] bg-[#0F0F0F]'
                  : 'text-[#888888] hover:text-[#F4F0EA]'
              }`}
            >
              <Music size={14} />
              <span className="hidden md:inline">Tracks</span>
            </Link>
            <Link
              to="/playlists"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                location.pathname.startsWith('/playlist')
                  ? 'text-[#F4F0EA] bg-[#0F0F0F]'
                  : 'text-[#888888] hover:text-[#F4F0EA]'
              }`}
            >
              <ListMusic size={14} />
              <span className="hidden md:inline">Playlists</span>
            </Link>
            <Link
              to="/reports"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                location.pathname.startsWith('/reports')
                  ? 'text-[#F4F0EA] bg-[#0F0F0F]'
                  : 'text-[#888888] hover:text-[#F4F0EA]'
              }`}
            >
              <FileText size={14} />
              <span className="hidden md:inline">Reports</span>
            </Link>
          </div>

          {/* Right: Bell + Avatar */}
          <div className="flex items-center gap-3 shrink-0">
            <button className="relative text-[#888888] hover:text-[#F4F0EA] transition-colors">
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#e85d5d] rounded-full text-[8px] font-bold text-white flex items-center justify-center">3</span>
            </button>
            <div className="w-7 h-7 rounded-full bg-[#141414] border border-[#1E1E1E] flex items-center justify-center">
              <span className="font-mono text-[10px] text-[#888888]">SJ</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
