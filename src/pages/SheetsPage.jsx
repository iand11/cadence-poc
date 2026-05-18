import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sheet, Trash2, Clock, Music, Search, X, Globe, Lock, Eye, Link2, Check } from 'lucide-react';
import { useSheets } from '../hooks/useSheets';
import { getArtist, searchArtists } from '../data/artists';

function getSheetVisibility(slug) {
  try {
    const stored = localStorage.getItem('cadence-artist-custom-' + slug);
    if (!stored) return 'private';
    const data = JSON.parse(stored);
    return data.visibility || 'private';
  } catch {
    return 'private';
  }
}

function toggleSheetVisibility(slug) {
  const key = 'cadence-artist-custom-' + slug;
  try {
    const stored = localStorage.getItem(key);
    const data = stored ? JSON.parse(stored) : {};
    data.visibility = data.visibility === 'public' ? 'private' : 'public';
    localStorage.setItem(key, JSON.stringify(data));
    return data.visibility;
  } catch {
    return 'private';
  }
}
import { formatNumber } from '../utils/formatters';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SheetsPage() {
  const { sheets, createSheet, deleteSheet } = useSheets();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [linkCopied, setLinkCopied] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const results = query.length >= 2 ? searchArtists(query) : [];

  const handleCreate = (artist) => {
    createSheet(artist.slug);
    setSearchOpen(false);
    setQuery('');
    navigate(`/app/artist/${artist.slug}/sheet`);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    deleteSheet(id);
    setConfirmDelete(null);
  };

  const handleConfirmDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const handleCancelDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(null);
  };

  const handleCopyLink = (e, slug) => {
    e.preventDefault();
    e.stopPropagation();
    const url = new URL(window.location.origin + `/app/artist/${slug}/sheet`);
    url.searchParams.set('view', 'true');
    navigator.clipboard.writeText(url.toString());
    setLinkCopied(slug);
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const handlePreview = (e, slug) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/app/artist/${slug}/sheet?view=true`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-[#F5F0E8]">Artist Sheets</h1>
          <p className="text-xs text-[#9B9590] mt-1">
            {sheets.length} saved sheet{sheets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openSearch}
          className="flex items-center gap-2 px-4 py-2 bg-[#DA7756]/10 text-[#DA7756] rounded text-sm hover:bg-[#DA7756]/20 transition-colors cursor-pointer border border-[#DA7756]/20"
        >
          <Plus size={14} />
          New Sheet
        </button>
      </motion.div>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            onClick={closeSearch}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2C2B28]">
                <Search size={14} className="text-[#6B6560] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for an artist..."
                  className="flex-1 bg-transparent text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                />
                <button onClick={closeSearch} className="p-1 text-[#6B6560] hover:text-[#9B9590] cursor-pointer">
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {query.length >= 2 && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-[#6B6560]">
                    No artists found for "{query}"
                  </div>
                )}
                {results.map((artist) => (
                  <button
                    key={artist.slug}
                    onClick={() => handleCreate(artist)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#1C1B18] transition-colors text-left cursor-pointer"
                  >
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                        <Music size={14} className="text-[#6B6560]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F5F0E8] truncate">{artist.name}</p>
                      <p className="text-[10px] text-[#6B6560]">
                        {formatNumber(artist.spotify.monthlyListeners)} monthly listeners
                        {artist.genres?.primary?.name && ` · ${artist.genres.primary.name}`}
                      </p>
                    </div>
                  </button>
                ))}
                {query.length < 2 && (
                  <div className="px-4 py-8 text-center text-xs text-[#6B6560]">
                    Type to search your roster
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet Grid or Empty State */}
      {sheets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <Sheet size={40} className="mx-auto mb-3 text-[#6B6560] opacity-50" />
          <p className="text-sm text-[#9B9590] mb-4">No artist sheets yet</p>
          <button
            onClick={openSearch}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#DA7756]/10 text-[#DA7756] rounded text-sm hover:bg-[#DA7756]/20 transition-colors cursor-pointer border border-[#DA7756]/20"
          >
            <Plus size={14} />
            Create your first sheet
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {sheets.map((sheet, index) => {
              const artist = getArtist(sheet.artistSlug);
              if (!artist) return null;
              const isConfirming = confirmDelete === sheet.id;
              const visibility = getSheetVisibility(sheet.artistSlug);
              const primaryGenre = artist.genres?.primary?.name;
              const secondaryGenres = (artist.genres?.secondary || []).map(g => typeof g === 'string' ? g : g.name);
              const allGenres = [primaryGenre, ...secondaryGenres].filter(Boolean);

              return (
                <motion.div
                  key={sheet.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  layout
                >
                  <Link
                    to={`/app/artist/${artist.slug}/sheet`}
                    className="block relative bg-[#171614] border border-[#2C2B28] rounded overflow-hidden hover:border-[#3D3B37] transition-colors group"
                  >
                    {/* Artist Image */}
                    <div className="relative h-40 overflow-hidden">
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#2C2B28] flex items-center justify-center">
                          <Music size={32} className="text-[#6B6560]" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#171614] via-transparent to-transparent" />

                      {/* Visibility toggle */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSheetVisibility(sheet.artistSlug);
                          setVisibilityTick(t => t + 1);
                        }}
                        className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/50 backdrop-blur-sm cursor-pointer hover:bg-black/70 transition-colors"
                        style={{ color: visibility === 'public' ? '#7BAF73' : '#9B9590' }}
                        title={visibility === 'public' ? 'Public — click to make private' : 'Private — click to make public'}
                      >
                        {visibility === 'public' ? <Globe size={9} /> : <Lock size={9} />}
                        {visibility === 'public' ? 'Public' : 'Private'}
                      </button>

                      {/* Delete button */}
                      {!isConfirming && (
                        <button
                          onClick={(e) => handleConfirmDelete(e, sheet.id)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-black/40 text-[#9B9590] opacity-0 group-hover:opacity-100 hover:text-[#C75F4F] transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Delete Confirmation */}
                    {isConfirming && (
                      <div className="absolute inset-0 bg-[#171614]/95 backdrop-blur-sm rounded flex items-center justify-center gap-3 z-10">
                        <span className="text-xs text-[#9B9590]">Delete this sheet?</span>
                        <button
                          onClick={handleCancelDelete}
                          className="px-2.5 py-1 text-[10px] rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, sheet.id)}
                          className="px-2.5 py-1 text-[10px] rounded bg-[#C75F4F]/10 text-[#C75F4F] border border-[#C75F4F]/20 hover:bg-[#C75F4F]/20 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="p-4 -mt-2 relative">
                      <h3 className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#DA7756] transition-colors truncate">
                        {artist.name}
                      </h3>

                      {/* Genre Tags */}
                      {allGenres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {allGenres.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="text-[9px] font-mono bg-[#2C2B28] text-[#9B9590] rounded px-1.5 py-0.5"
                            >
                              {g}
                            </span>
                          ))}
                          {allGenres.length > 3 && (
                            <span className="text-[9px] font-mono text-[#6B6560]">
                              +{allGenres.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between text-[10px] text-[#6B6560] mt-3">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {timeAgo(sheet.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handlePreview(e, artist.slug)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#2C2B28] transition-colors cursor-pointer"
                            title="Preview"
                          >
                            <Eye size={10} />
                            Preview
                          </button>
                          <button
                            onClick={(e) => handleCopyLink(e, artist.slug)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#2C2B28] transition-colors cursor-pointer"
                            title="Copy share link"
                          >
                            {linkCopied === artist.slug ? <Check size={10} className="text-[#7BAF73]" /> : <Link2 size={10} />}
                            {linkCopied === artist.slug ? 'Copied!' : 'Share'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
