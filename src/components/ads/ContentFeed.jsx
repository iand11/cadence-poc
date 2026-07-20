import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ChevronLeft, ChevronRight, Zap, Search, X } from 'lucide-react';
import ContentFeedItem from './ContentFeedItem';
import { api } from '../../data/api';
import { allArtists } from '../../data/artists';
import { useFavorites } from '../../hooks/useFavorites';
import { analyzeBoostPotential, generateBoostRecommendations } from '../../utils/boostDetection';
import { PLATFORM_COLORS } from '../../constants/colors';
import LoadingState from '../shared/LoadingState';

const PLATFORM_FILTERS = [
  { key: null, label: 'All' },
  { key: 'instagram', label: 'Instagram', color: PLATFORM_COLORS.instagram },
  { key: 'tiktok', label: 'TikTok', color: PLATFORM_COLORS.tiktok },
  { key: 'youtube', label: 'YouTube', color: PLATFORM_COLORS.youtube },
  { key: 'twitter', label: 'X', color: PLATFORM_COLORS.twitter },
];

const TYPE_FILTERS = [
  { key: null, label: 'All' },
  { key: 'posts', label: 'Posts' },
  { key: 'videos', label: 'Videos' },
];

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent' },
  { key: 'engagement', label: 'Engagement' },
];

const PAGE_SIZE = 20;

// Map content platform → ads platform for boost CTA
const ADS_PLATFORM_MAP = {
  instagram: 'meta',
  youtube: 'youtube',
  tiktok: 'tiktok',
  twitter: 'x',
};

export default function ContentFeed({ onBoost }) {
  const { favorites } = useFavorites();
  const [items, setItems] = useState([]);
  const [artistAverages, setArtistAverages] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState(null);
  const [type, setType] = useState(null);
  const [sort, setSort] = useState('recent');
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState('favorites'); // 'favorites' | 'all'
  const [artistFilter, setArtistFilter] = useState(null);
  const [artistQuery, setArtistQuery] = useState('');
  const [artistDropdownOpen, setArtistDropdownOpen] = useState(false);
  const artistInputRef = useRef(null);

  const artistSearchResults = useMemo(() => {
    if (!artistQuery || artistQuery.length < 2) return [];
    const q = artistQuery.toLowerCase();
    return allArtists.filter(a => a.name.toLowerCase().includes(q)).slice(0, 6);
  }, [artistQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { limit: PAGE_SIZE, offset, sort };
    if (platform) params.platform = platform;
    if (type) params.type = type;
    if (artistFilter) params.artist = artistFilter;
    else if (scope === 'favorites') params.artists = favorites;

    api.getContentFeed(params)
      .then(data => {
        if (cancelled) return;
        setItems(data.items || []);
        setArtistAverages(data.artistAverages || {});
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [platform, type, sort, offset, artistFilter, scope, favorites]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [platform, type, sort, artistFilter, scope]);

  // Boost analysis per item
  const boostMap = useMemo(() => {
    const map = {};
    for (const item of items) {
      const avg = artistAverages[item.artistId]?.[item.platform]?.[item.contentType];
      if (avg) {
        map[item.id] = analyzeBoostPotential(item, avg);
      }
    }
    return map;
  }, [items, artistAverages]);

  const boostRecommendations = useMemo(() => {
    return generateBoostRecommendations(items, artistAverages);
  }, [items, artistAverages]);

  const [selectedId, setSelectedId] = useState(null);

  const handleBoost = (item) => {
    const adsPlatform = ADS_PLATFORM_MAP[item.platform];
    if (!adsPlatform || !onBoost) return;
    setSelectedId(item.id);

    const analysis = boostMap[item.id];
    const rationale = analysis?.reason
      ? `Organic content performing ${analysis.reason}. Auto-detected as boost candidate.`
      : `Boost organic ${item.contentType} from ${item.artistName}`;

    onBoost({
      artistSlug: item.artistSlug,
      artistName: item.artistName,
      artistImage: item.artistImage,
      platform: adsPlatform,
      objective: 'engagement',
      rationale,
      creative: {
        type: item.contentType === 'video' ? 'video' : 'image',
        headline: item.title || '',
        description: '',
        callToAction: 'Listen Now',
        trackUrl: item.permalink || '',
        postId: item.platformId || null,
        postSource: item.platform || null,
        igUserId: item.platform === 'instagram' ? item.ownerPlatformId : null,
        pageId: item.platform === 'facebook' ? item.ownerPlatformId : null,
        imageUrl: item.thumbnailUrl || null,
      },
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Boost recommendations banner */}
      {boostRecommendations.length > 0 && (
        <div className="bg-[#7BAF73]/8 border border-[#7BAF73]/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={12} className="text-[#7BAF73]" />
            <span className="text-[10px] font-medium text-[#7BAF73]">
              {boostRecommendations.length} boost recommendation{boostRecommendations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {boostRecommendations.slice(0, 5).map(rec => (
              <button
                key={rec.item.id}
                onClick={() => handleBoost(rec.item)}
                className="flex-shrink-0 flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-2.5 py-1.5 hover:border-[#7BAF73]/30 transition-colors cursor-pointer"
              >
                {rec.item.thumbnailUrl && (
                  <img src={rec.item.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" />
                )}
                <div className="text-left">
                  <p className="text-[10px] text-[#F5F0E8] line-clamp-1 max-w-[120px]">{rec.item.artistName}</p>
                  <p className="text-[9px] font-mono text-[#7BAF73]">{rec.multiplier}x above avg</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Scope: favorites vs all artists */}
        <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#0D0C0B] border border-[#2C2B28]">
          {[
            { key: 'favorites', label: 'Favorites' },
            { key: 'all', label: 'All artists' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer ${
                scope === s.key
                  ? 'bg-[#DA7756]/15 text-[#DA7756]'
                  : 'text-[#6B6560] hover:text-[#9B9590]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#2C2B28]" />

        {/* Artist search */}
        <div className="relative">
          {artistFilter ? (
            <button
              onClick={() => { setArtistFilter(null); setArtistQuery(''); }}
              className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 text-[#DA7756] cursor-pointer hover:bg-[#DA7756]/25 transition-colors"
            >
              {allArtists.find(a => a.slug === artistFilter)?.name || artistFilter}
              <X size={9} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 h-[26px] px-2.5 rounded bg-[#0D0C0B] border border-[#2C2B28] focus-within:border-[#3D3B37] transition-colors">
              <Search size={10} className="text-[#6B6560] shrink-0" />
              <input
                ref={artistInputRef}
                type="text"
                value={artistQuery}
                onChange={(e) => { setArtistQuery(e.target.value); setArtistDropdownOpen(true); }}
                onFocus={() => setArtistDropdownOpen(true)}
                onBlur={() => setTimeout(() => setArtistDropdownOpen(false), 200)}
                placeholder="Filter by artist..."
                className="bg-transparent text-[10px] text-[#F5F0E8] placeholder-[#6B6560] outline-none w-28"
              />
            </div>
          )}
          <AnimatePresence>
            {artistDropdownOpen && artistSearchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-full left-0 mt-1 bg-[#171614] border border-[#2C2B28] rounded shadow-2xl z-50 overflow-hidden min-w-[180px]"
              >
                {artistSearchResults.map(a => (
                  <button
                    key={a.slug}
                    onMouseDown={() => {
                      setArtistFilter(a.slug);
                      setArtistQuery('');
                      setArtistDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#1C1B18] transition-colors text-left cursor-pointer"
                  >
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#2C2B28]" />
                    )}
                    <span className="text-[10px] text-[#F5F0E8] truncate">{a.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#2C2B28]" />

        {/* Platform filter */}
        <div className="flex items-center gap-1">
          {PLATFORM_FILTERS.map(f => (
            <button
              key={f.key || 'all'}
              onClick={() => setPlatform(f.key)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer ${
                platform === f.key
                  ? 'bg-[#171614] border border-[#2C2B28] text-[#F5F0E8]'
                  : 'text-[#6B6560] hover:text-[#9B9590]'
              }`}
              style={platform === f.key && f.color ? { color: f.color } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#2C2B28]" />

        {/* Type filter */}
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key || 'all-type'}
              onClick={() => setType(f.key)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer ${
                type === f.key
                  ? 'bg-[#171614] border border-[#2C2B28] text-[#F5F0E8]'
                  : 'text-[#6B6560] hover:text-[#9B9590]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#2C2B28]" />

        {/* Sort */}
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer ${
                sort === s.key
                  ? 'bg-[#171614] border border-[#2C2B28] text-[#F5F0E8]'
                  : 'text-[#6B6560] hover:text-[#9B9590]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <span className="text-[9px] font-mono text-[#6B6560] ml-auto">{total} items</span>
      </div>

      {/* Content grid */}
      {loading ? (
        <LoadingState label="Loading content" size="section" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-[#9B9590] mb-1">No content found</p>
          <p className="text-[11px] text-[#6B6560]">
            {scope === 'favorites' && !artistFilter
              ? 'No content from your favorite artists — switch to All artists to see more'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                layout
              >
                <ContentFeedItem
                  item={item}
                  boostAnalysis={boostMap[item.id]}
                  onBoost={handleBoost}
                  selected={selectedId === item.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="flex items-center gap-1 text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
          >
            <ChevronLeft size={12} /> Prev
          </button>
          <span className="text-[10px] font-mono text-[#6B6560]">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
