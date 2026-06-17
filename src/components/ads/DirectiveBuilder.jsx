import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Search, Music, Loader2, Heart, Eye, CheckCircle, Play, Plus, ChevronDown, Image, Link2, Upload, FileAudio, FileVideo, Trash2 } from 'lucide-react';
import { PLATFORM_OBJECTIVES, PLATFORM_CONSTRAINTS, PLATFORM_LABELS, CREATIVE_TYPES } from '../../data/directives';
import BudgetAllocator from './BudgetAllocator';
import { PLATFORM_COLORS } from '../../constants/colors';
import { allArtists } from '../../data/artists';
import { api } from '../../data/api';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

const LOCATION_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
];

const PLATFORM_CONTENT_CONFIG = {
  spotify: { label: 'Select a Track or Album', source: 'artist' },
  meta: { label: 'Boost an Instagram Post', source: 'content-feed', feedPlatform: 'instagram' },
  google: { label: 'Create a Search Ad', source: 'manual' },
  youtube: { label: 'Select a YouTube Video', source: 'content-feed', feedPlatform: 'youtube' },
  tiktok: { label: 'Boost a TikTok Video', source: 'content-feed', feedPlatform: 'tiktok' },
  x: { label: 'Promote a Post', source: 'content-feed', feedPlatform: 'twitter' },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:...;base64, prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">{label}</p>
      {children}
    </div>
  );
}

function FileUploadField({ label, accept, file, onChange, onClear, icon: Icon = Upload, required }) {
  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 flex items-center gap-1">
        <Icon size={9} /> {label} {required && <span className="text-[#C75F4F]">*</span>}
      </label>
      {file ? (
        <div className="flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5">
          <span className="text-[10px] text-[#F5F0E8] truncate flex-1">{file.name}</span>
          <span className="text-[9px] font-mono text-[#6B6560]">{(file.size / 1024).toFixed(0)}KB</span>
          <button onClick={onClear} className="text-[#6B6560] hover:text-[#C75F4F] cursor-pointer">
            <Trash2 size={10} />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 bg-[#0D0C0B] border border-dashed border-[#2C2B28] hover:border-[#3D3B37] rounded px-3 py-3 cursor-pointer transition-colors">
          <Upload size={12} className="text-[#6B6560]" />
          <span className="text-[10px] text-[#6B6560]">Choose file</span>
          <input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} className="hidden" />
        </label>
      )}
    </div>
  );
}

export default function DirectiveBuilder({ isOpen, onClose, onSave, onSubmit, onAcceptAllocation, initialData, connectedPlatforms, launchMode, launchProgress }) {
  const editing = !!initialData?.id;

  const [platform, setPlatform] = useState(initialData?.platform || connectedPlatforms?.[0] || 'spotify');
  const [objective, setObjective] = useState(initialData?.objective || '');
  const [budgetAmount, setBudgetAmount] = useState(initialData?.budget?.amount || 500);
  const [budgetPeriod, setBudgetPeriod] = useState(initialData?.budget?.period || 'lifetime');
  const [startDate, setStartDate] = useState(initialData?.schedule?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.schedule?.endDate || '');
  const [locations, setLocations] = useState(initialData?.audience?.locations || ['US']);
  const [ageMin, setAgeMin] = useState(initialData?.audience?.ageRange?.[0] || 18);
  const [ageMax, setAgeMax] = useState(initialData?.audience?.ageRange?.[1] || 34);
  const [lookalike, setLookalike] = useState(initialData?.audience?.lookalike ?? true);
  const [creativeType, setCreativeType] = useState(initialData?.creative?.type || '');
  const [headline, setHeadline] = useState(initialData?.creative?.headline || '');
  const [description, setDescription] = useState(initialData?.creative?.description || '');
  const [cta, setCta] = useState(initialData?.creative?.callToAction || 'Listen Now');
  const [trackUrl, setTrackUrl] = useState(initialData?.creative?.trackUrl || '');
  const [postId, setPostId] = useState(initialData?.creative?.postId || null);
  const [postSource, setPostSource] = useState(initialData?.creative?.postSource || null);
  const [ownerPlatformId, setOwnerPlatformId] = useState(initialData?.creative?.igUserId || initialData?.creative?.pageId || null);
  const [rationale, setRationale] = useState(initialData?.rationale || '');

  // Generalized content picker state
  const [contentItems, setContentItems] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentLoadingMore, setContentLoadingMore] = useState(false);
  const [contentTab, setContentTab] = useState('track'); // Spotify: 'track' | 'album'
  const [selectedContentId, setSelectedContentId] = useState(null);
  const [contentTotal, setContentTotal] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [contentMode, setContentMode] = useState('select'); // 'select' | 'create'
  const [imageUrl, setImageUrl] = useState(initialData?.creative?.imageUrl || '');

  // Spotify ad creative files
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [advertiserName, setAdvertiserName] = useState(initialData?.creative?.advertiserName || '');

  // YouTube ad creative files
  const [videoFile, setVideoFile] = useState(null);
  const [targetCpm, setTargetCpm] = useState(initialData?.budget?.targetCpm ? initialData.budget.targetCpm / 1000000 : 2);

  const CONTENT_PAGE_SIZE = 12;

  // Artist selection
  const [artistSlug, setArtistSlug] = useState(initialData?.artistSlug || '');
  const [artistSearch, setArtistSearch] = useState('');

  const searchResults = useMemo(() => {
    if (!artistSearch || artistSearch.length < 2) return [];
    const q = artistSearch.toLowerCase();
    return allArtists.filter(a => a.name.toLowerCase().includes(q)).slice(0, 6);
  }, [artistSearch]);

  const selectedArtist = useMemo(() => {
    if (!artistSlug) return null;
    return allArtists.find(a => a.slug === artistSlug);
  }, [artistSlug]);

  const objectives = PLATFORM_OBJECTIVES[platform] || [];
  const creativeTypes = CREATIVE_TYPES[platform] || [];
  const constraint = PLATFORM_CONSTRAINTS[platform];

  // Auto-select first objective/creative when platform changes
  const effectiveObjective = objective && objectives.some(o => o.key === objective) ? objective : objectives[0]?.key || '';
  const effectiveCreativeType = creativeType && creativeTypes.includes(creativeType) ? creativeType : creativeTypes[0] || '';

  // Map content-feed API items to normalized shape
  const mapFeedItems = (items) => (items || []).map(item => ({
    _type: item.contentType,
    id: `feed-${item.id}`,
    platformId: item.platformId,
    title: item.title || 'No caption',
    subtitle: '',
    thumbnailUrl: item.thumbnailUrl,
    metric: (item.likes || 0) + (item.comments || 0) + (item.shares || 0),
    metricLabel: 'engagement',
    permalink: item.permalink,
    likes: item.likes,
    views: item.views,
    contentType: item.contentType,
    sourcePlatform: item.platform,
    ownerPlatformId: item.ownerPlatformId,
  }));

  // Fetch platform-specific content when artist is selected
  useEffect(() => {
    if (!artistSlug) {
      setContentItems([]);
      setContentTotal(0);
      return;
    }

    const config = PLATFORM_CONTENT_CONFIG[platform];
    if (!config) {
      setContentItems([]);
      setContentTotal(0);
      return;
    }

    const initPostId = initialData?.creative?.postId || null;
    let cancelled = false;
    setContentLoading(true);
    if (!initPostId) {
      setSelectedContentId(null);
      setPostId(null);
    }
    setContentOffset(0);
    setContentMode('select');

    // After items load, auto-select the matching post if initialData had one
    const autoSelect = (items) => {
      if (initPostId) {
        const match = items.find(i => i.platformId === initPostId);
        if (match) {
          setSelectedContentId(match.id);
          setPostId(match.platformId);
        }
      }
    };

    if (config.source === 'manual') {
      // Google Search: no content to fetch, go straight to create mode
      setContentItems([]);
      setContentTotal(0);
      setContentLoading(false);
      setContentMode('create');
      return;
    }

    if (config.source === 'artist') {
      // Spotify: fetch tracks and albums
      api.getArtist(artistSlug)
        .then(data => {
          if (cancelled) return;
          const items = [];
          for (const t of (data.tracks || [])) {
            items.push({
              _type: 'track',
              id: `track-${t.id}`,
              platformId: t.spotifyTrackId,
              title: t.name,
              subtitle: t.albumName || '',
              thumbnailUrl: t.imageUrl,
              metric: t.streams || 0,
              metricLabel: 'streams',
              permalink: t.spotifyTrackId ? `https://open.spotify.com/track/${t.spotifyTrackId}` : null,
            });
          }
          for (const a of (data.albums || [])) {
            items.push({
              _type: 'album',
              id: `album-${a.id}`,
              platformId: a.spotifyAlbumId,
              title: a.name,
              subtitle: a.releaseDate ? new Date(a.releaseDate).getFullYear().toString() : (a.type || ''),
              thumbnailUrl: a.imageUrl,
              metric: a.popularity || 0,
              metricLabel: 'popularity',
              permalink: a.spotifyAlbumId ? `https://open.spotify.com/album/${a.spotifyAlbumId}` : null,
            });
          }
          setContentItems(items);
          setContentTotal(items.length);
          autoSelect(items);
        })
        .catch(() => { if (!cancelled) { setContentItems([]); setContentTotal(0); } })
        .finally(() => { if (!cancelled) setContentLoading(false); });
    } else {
      // Social platforms: fetch from content-feed
      api.getContentFeed({ platform: config.feedPlatform, artist: artistSlug, sort: 'engagement', limit: CONTENT_PAGE_SIZE, offset: 0 })
        .then(data => {
          if (cancelled) return;
          const mapped = mapFeedItems(data?.items);
          setContentItems(mapped);
          setContentTotal(data?.total || 0);
          setContentOffset(CONTENT_PAGE_SIZE);
          autoSelect(mapped);
        })
        .catch(() => { if (!cancelled) { setContentItems([]); setContentTotal(0); } })
        .finally(() => { if (!cancelled) setContentLoading(false); });
    }

    return () => { cancelled = true; };
  }, [platform, artistSlug]);

  // Load more content items
  const loadMoreContent = () => {
    const config = PLATFORM_CONTENT_CONFIG[platform];
    if (!config || config.source === 'artist' || contentLoadingMore) return;

    setContentLoadingMore(true);
    api.getContentFeed({ platform: config.feedPlatform, artist: artistSlug, sort: 'engagement', limit: CONTENT_PAGE_SIZE, offset: contentOffset })
      .then(data => {
        const newItems = mapFeedItems(data?.items);
        setContentItems(prev => [...prev, ...newItems]);
        setContentOffset(prev => prev + CONTENT_PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setContentLoadingMore(false));
  };

  const hasMoreContent = PLATFORM_CONTENT_CONFIG[platform]?.source !== 'artist' && contentItems.length < contentTotal;

  const selectContent = (item) => {
    setSelectedContentId(item.id);
    setPostId(item.platformId);
    setHeadline(item.title || '');
    setTrackUrl(item.permalink || '');
    setPostSource(item.sourcePlatform || null);
    setOwnerPlatformId(item.ownerPlatformId || null);
    if (item._type === 'track' || item._type === 'album') {
      setCreativeType('audio');
    } else {
      setCreativeType(item.contentType === 'video' ? 'video' : 'image');
    }
  };

  const clearContentSelection = () => {
    setSelectedContentId(null);
    setPostId(null);
    setPostSource(null);
    setOwnerPlatformId(null);
  };

  const filteredContentItems = useMemo(() => {
    if (platform === 'spotify') {
      return contentItems.filter(c => c._type === contentTab);
    }
    return contentItems;
  }, [contentItems, contentTab, platform]);

  const budgetError = constraint?.minBudget && budgetAmount < constraint.minBudget
    ? `Minimum budget: $${constraint.minBudget}`
    : null;

  const canSave = artistSlug && effectiveObjective && !budgetError;

  const buildDirective = async () => {
    const base = {
      id: initialData?.id || `dir-${Date.now()}`,
      actionId: initialData?.actionId || null,
      artistSlug,
      artistName: selectedArtist?.name || initialData?.artistName || artistSlug,
      artistImage: selectedArtist?.imageUrl || initialData?.artistImage || null,
      platform,
      status: initialData?.status || 'draft',
      objective: effectiveObjective,
      budget: { amount: Number(budgetAmount), currency: 'USD', period: budgetPeriod },
      schedule: { startDate, endDate },
      audience: {
        locations,
        ageRange: [Number(ageMin), Number(ageMax)],
        interests: [],
        lookalike,
      },
      rationale,
      result: initialData?.result || null,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      approvedAt: initialData?.approvedAt || null,
    };

    if (platform === 'spotify') {
      const creative = {
        headline,
        advertiserName: advertiserName || selectedArtist?.name || artistSlug,
        trackUrl,
      };
      if (audioFile) creative.audioFile = await fileToBase64(audioFile);
      if (imageFile) creative.imageFile = await fileToBase64(imageFile);
      if (logoFile) creative.logoFile = await fileToBase64(logoFile);
      base.creative = creative;
    } else if (platform === 'youtube') {
      const creative = {
        headline,
        description,
        trackUrl,
      };
      if (videoFile) creative.videoFile = await fileToBase64(videoFile);
      base.creative = creative;
      base.budget.targetCpm = Math.round(targetCpm * 1000000);
    } else {
      base.creative = {
        type: effectiveCreativeType,
        assetUrl: null,
        headline,
        description,
        callToAction: cta,
        trackUrl,
        postId: postId || null,
        postSource: postSource || null,
        igUserId: postSource === 'instagram' ? ownerPlatformId : null,
        pageId: postSource === 'facebook' ? ownerPlatformId : null,
        imageUrl: imageUrl || selectedArtist?.imageUrl || initialData?.artistImage || null,
      };
    }

    return base;
  };

  const handleSave = async () => {
    if (!canSave) return;
    onSave(await buildDirective());
    if (!launchMode) onClose();
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    const d = await buildDirective();
    d.status = 'pending_approval';
    onSubmit(d);
    if (!launchMode) onClose();
  };

  const toggleLocation = (code) => {
    setLocations(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  if (!isOpen) return null;

  const isLastInQueue = launchProgress && launchProgress.current === launchProgress.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28] shrink-0">
          <div>
            <h3 className="text-sm font-medium text-[#F5F0E8]">
              {launchMode ? `Configure ${PLATFORM_LABELS[platform]} Campaign` : editing ? 'Edit Campaign' : 'New Ad Campaign'}
            </h3>
            {launchMode && launchProgress ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-1">
                  {Array.from({ length: launchProgress.total }, (_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < launchProgress.current - 1 ? 'bg-[#7BAF73]' :
                        i === launchProgress.current - 1 ? 'bg-[#DA7756]' :
                        'bg-[#2C2B28]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-mono text-[#6B6560]">
                  Platform {launchProgress.current} of {launchProgress.total}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-[#6B6560] mt-0.5">Configure your advertising directive</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Artist */}
          <Section label="Artist">
            {launchMode ? (
              // Locked in launch mode
              <div className="flex items-center gap-2">
                {selectedArtist?.imageUrl ? (
                  <img src={selectedArtist.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <span className="text-xs text-[#F5F0E8] font-medium">{selectedArtist?.name || artistSlug}</span>
              </div>
            ) : selectedArtist || artistSlug ? (
              <div className="flex items-center gap-2">
                {selectedArtist?.imageUrl ? (
                  <img src={selectedArtist.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <span className="text-xs text-[#F5F0E8] font-medium">{selectedArtist?.name || artistSlug}</span>
                <button
                  onClick={() => { setArtistSlug(''); setArtistSearch(''); }}
                  className="text-[10px] text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2">
                  <Search size={12} className="text-[#6B6560] shrink-0" />
                  <input
                    value={artistSearch}
                    onChange={e => setArtistSearch(e.target.value)}
                    placeholder="Search artists..."
                    className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#171614] border border-[#2C2B28] rounded shadow-2xl z-10 max-h-48 overflow-y-auto">
                    {searchResults.map(a => (
                      <button
                        key={a.slug}
                        onMouseDown={() => { setArtistSlug(a.slug); setArtistSearch(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#1C1B18] transition-colors text-left cursor-pointer"
                      >
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-[#2C2B28] flex items-center justify-center">
                            <Music size={8} className="text-[#6B6560]" />
                          </div>
                        )}
                        <span className="text-xs text-[#F5F0E8]">{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Platform */}
          <Section label="Platform">
            {launchMode || initialData?.creative?.postId ? (
              // Locked in launch mode or when boosting a specific post
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLOR_MAP[platform] }} />
                <span className="text-xs text-[#F5F0E8] font-mono">{PLATFORM_LABELS[platform]}</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PLATFORM_LABELS).map(p => {
                    const color = PLATFORM_COLOR_MAP[p] || '#9B9590';
                    const connected = connectedPlatforms?.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                          platform === p
                            ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                            : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590] hover:border-[#3D3B37]'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {PLATFORM_LABELS[p]}
                        {!connected && <span className="text-[8px] text-[#C75F4F]">*</span>}
                      </button>
                    );
                  })}
                </div>
                {constraint?.notes && (
                  <p className="text-[9px] text-[#6B6560] mt-1.5">{constraint.notes}</p>
                )}
              </>
            )}
          </Section>

          {/* Objective */}
          <Section label="Objective">
            <div className="flex flex-wrap gap-2">
              {objectives.map(o => (
                <button
                  key={o.key}
                  onClick={() => setObjective(o.key)}
                  className={`text-[10px] font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                    effectiveObjective === o.key
                      ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                      : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Budget */}
          <Section label="Budget">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 w-36">
                <span className="text-xs text-[#6B6560]">$</span>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={e => setBudgetAmount(e.target.value)}
                  min={0}
                  className="flex-1 bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-full"
                />
              </div>
              <div className="flex gap-1">
                {['daily', 'lifetime'].map(p => (
                  <button
                    key={p}
                    onClick={() => setBudgetPeriod(p)}
                    className={`text-[10px] font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                      budgetPeriod === p
                        ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                        : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {budgetError && <p className="text-[10px] text-[#C75F4F] mt-1">{budgetError}</p>}
          </Section>

          {/* Budget Allocator — shown when artist + objective + budget + 2+ platforms */}
          {!launchMode && !initialData?.creative?.postId && selectedArtist && effectiveObjective && budgetAmount > 0 && connectedPlatforms?.length >= 2 && onAcceptAllocation && (
            <BudgetAllocator
              artist={{
                spFollowers: selectedArtist.spotify?.followers || 0,
                igFollowers: selectedArtist.social?.instagram || 0,
                ytSubscribers: selectedArtist.social?.youtube || 0,
                ttFollowers: selectedArtist.social?.tiktok || 0,
                xFollowers: selectedArtist.social?.twitter || 0,
              }}
              objective={effectiveObjective}
              totalBudget={Number(budgetAmount)}
              connectedPlatforms={connectedPlatforms}
              onAccept={(allocations) => {
                onAcceptAllocation({
                  artistSlug,
                  artistName: selectedArtist.name,
                  artistImage: selectedArtist.imageUrl,
                  objective: effectiveObjective,
                  schedule: { startDate, endDate },
                  audience: { locations, ageRange: [Number(ageMin), Number(ageMax)], interests: [], lookalike },
                  creative: { type: effectiveCreativeType, headline, description, callToAction: cta, trackUrl, postId: postId || null },
                  rationale,
                  allocations,
                });
                onClose();
              }}
            />
          )}

          {/* Schedule */}
          <Section label="Schedule">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] outline-none font-mono"
              />
              <span className="text-[10px] text-[#6B6560]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] outline-none font-mono"
              />
            </div>
          </Section>

          {/* Audience */}
          <Section label="Audience">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-[#9B9590] mb-1.5">Locations</p>
                <div className="flex flex-wrap gap-1.5">
                  {LOCATION_OPTIONS.map(loc => (
                    <button
                      key={loc.code}
                      onClick={() => toggleLocation(loc.code)}
                      className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer ${
                        locations.includes(loc.code)
                          ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                          : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                      }`}
                    >
                      {loc.code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-[#9B9590] shrink-0">Age</p>
                <input
                  type="number"
                  value={ageMin}
                  onChange={e => setAgeMin(e.target.value)}
                  min={13}
                  max={65}
                  className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1.5 text-xs text-[#F5F0E8] outline-none font-mono w-16"
                />
                <span className="text-[10px] text-[#6B6560]">to</span>
                <input
                  type="number"
                  value={ageMax}
                  onChange={e => setAgeMax(e.target.value)}
                  min={13}
                  max={65}
                  className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1.5 text-xs text-[#F5F0E8] outline-none font-mono w-16"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lookalike}
                  onChange={e => setLookalike(e.target.checked)}
                  className="accent-[#DA7756]"
                />
                <span className="text-[10px] text-[#9B9590]">Use lookalike / similar audiences</span>
              </label>
            </div>
          </Section>

          {/* Content to Promote */}
          {artistSlug && PLATFORM_CONTENT_CONFIG[platform] && (
            <Section label={PLATFORM_CONTENT_CONFIG[platform]?.source === 'manual' ? 'Ad Creative' : 'Content to Promote'}>
              {/* Mode toggle: Select Existing / Create New (hidden for manual/search platforms) */}
              {PLATFORM_CONTENT_CONFIG[platform]?.source !== 'manual' && (
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => { setContentMode('select'); clearContentSelection(); }}
                  className={`text-[9px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    contentMode === 'select'
                      ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                      : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                  }`}
                >
                  Select Existing
                </button>
                <button
                  onClick={() => { setContentMode('create'); clearContentSelection(); }}
                  className={`flex items-center gap-1 text-[9px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    contentMode === 'create'
                      ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                      : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                  }`}
                >
                  <Plus size={9} />
                  Create New
                </button>
              </div>
              )}

              {contentMode === 'create' ? (
                /* Create new ad creative */
                PLATFORM_CONTENT_CONFIG[platform]?.source === 'manual' ? (
                  /* Google Search: responsive search ad fields */
                  <div className="space-y-3 bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
                    <div>
                      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Headlines <span className="text-[#6B6560]">(30 chars max each)</span></label>
                      <input
                        value={headline}
                        onChange={e => setHeadline(e.target.value)}
                        maxLength={30}
                        placeholder={`${selectedArtist?.name || 'Artist'} — New Music Out Now`}
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none mb-1.5"
                      />
                      <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        maxLength={30}
                        placeholder={`Stream ${selectedArtist?.name || 'Artist'} Now`}
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none mb-1.5"
                      />
                      <input
                        maxLength={30}
                        placeholder="Listen on All Platforms"
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                      />
                      <span className="text-[8px] text-[#6B6560] mt-1 block">Google rotates headlines to find the best combination</span>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Descriptions <span className="text-[#6B6560]">(90 chars max each)</span></label>
                      <textarea
                        maxLength={90}
                        rows={2}
                        placeholder={`Discover ${selectedArtist?.name || 'Artist'}'s latest tracks. Stream now on Spotify, Apple Music & more.`}
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none resize-none mb-1.5"
                      />
                      <textarea
                        maxLength={90}
                        rows={2}
                        placeholder="New album available everywhere. Join millions of fans streaming today."
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
                        <span className="flex items-center gap-1"><Link2 size={9} /> Final URL</span>
                      </label>
                      <input
                        value={trackUrl}
                        onChange={e => setTrackUrl(e.target.value)}
                        placeholder="https://open.spotify.com/artist/..."
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Keywords</label>
                      <input
                        placeholder={`${selectedArtist?.name || 'artist name'}, new music, stream ${selectedArtist?.name || 'artist'}`}
                        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                      />
                      <span className="text-[8px] text-[#6B6560] mt-1 block">Comma-separated search terms that trigger your ad</span>
                    </div>
                  </div>
                ) : (
                <div className="space-y-3 bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
                  <div>
                    <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Headline</label>
                    <input
                      value={headline}
                      onChange={e => setHeadline(e.target.value)}
                      placeholder={`Listen to ${selectedArtist?.name || artistSlug}`}
                      className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Description</label>
                    <input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={`Discover ${selectedArtist?.name || artistSlug}'s latest music`}
                      className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
                      <span className="flex items-center gap-1"><Image size={9} /> Image URL</span>
                    </label>
                    <input
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none font-mono"
                    />
                    {!imageUrl && selectedArtist?.imageUrl && (
                      <button
                        onClick={() => setImageUrl(selectedArtist.imageUrl)}
                        className="text-[9px] text-[#DA7756] hover:text-[#DA7756]/80 mt-1 cursor-pointer"
                      >
                        Use artist image
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
                      <span className="flex items-center gap-1"><Link2 size={9} /> Destination URL</span>
                    </label>
                    <input
                      value={trackUrl}
                      onChange={e => setTrackUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/..."
                      className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Call to Action</label>
                    <div className="flex gap-1">
                      {['Listen Now', 'Learn More', 'Watch Now', 'Shop Now'].map(c => (
                        <button
                          key={c}
                          onClick={() => setCta(c)}
                          className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer ${
                            cta === c
                              ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                              : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                )
              ) : (
                /* Select existing content */
                <>
                  {/* Spotify track/album tabs */}
                  {platform === 'spotify' && (
                    <div className="flex gap-1 mb-2">
                      {['track', 'album'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setContentTab(tab)}
                          className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer ${
                            contentTab === tab
                              ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                              : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                          }`}
                        >
                          {tab === 'track' ? 'Tracks' : 'Albums'}
                        </button>
                      ))}
                    </div>
                  )}

                  {contentLoading ? (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 size={12} className="animate-spin text-[#6B6560]" />
                      <span className="text-[10px] text-[#6B6560]">Loading content...</span>
                    </div>
                  ) : filteredContentItems.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {filteredContentItems.map(item => {
                          const isSelected = selectedContentId === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => isSelected ? clearContentSelection() : selectContent(item)}
                              className={`relative rounded border p-1.5 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#DA7756]/50 bg-[#DA7756]/10'
                                  : 'border-[#2C2B28] bg-[#0D0C0B] hover:border-[#3D3B37]'
                              }`}
                            >
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt=""
                                  className="w-full aspect-square object-cover rounded"
                                />
                              ) : (
                                <div className="w-full aspect-square rounded bg-[#1C1B18] flex flex-col items-center justify-center p-1.5">
                                  <Music size={14} className="text-[#6B6560] mb-1" />
                                  <p className="text-[8px] text-[#6B6560] text-center line-clamp-3 leading-tight">{item.title}</p>
                                </div>
                              )}
                              {item.thumbnailUrl && (
                                <p className="text-[9px] text-[#9B9590] mt-1 line-clamp-1">{item.title}</p>
                              )}
                              {item.subtitle && (
                                <p className="text-[8px] text-[#6B6560] line-clamp-1">{item.subtitle}</p>
                              )}
                              <div className="flex items-center gap-1 mt-0.5">
                                {item._type === 'track' || item._type === 'album' ? (
                                  <Play size={7} className="text-[#6B6560]" />
                                ) : item.views ? (
                                  <Eye size={7} className="text-[#6B6560]" />
                                ) : (
                                  <Heart size={7} className="text-[#6B6560]" />
                                )}
                                <span className="text-[8px] text-[#6B6560] font-mono">
                                  {(item.metric || 0).toLocaleString()} {item.metricLabel}
                                </span>
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1">
                                  <CheckCircle size={14} className="text-[#DA7756]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Load More */}
                      {hasMoreContent && (
                        <button
                          onClick={loadMoreContent}
                          disabled={contentLoadingMore}
                          className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] border border-[#2C2B28] hover:border-[#3D3B37] rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {contentLoadingMore ? (
                            <><Loader2 size={10} className="animate-spin" /> Loading...</>
                          ) : (
                            <><ChevronDown size={10} /> Load More ({contentTotal - contentItems.length} remaining)</>
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <Music size={20} className="text-[#2C2B28] mx-auto mb-2" />
                      <p className="text-[10px] text-[#6B6560]">
                        No {PLATFORM_CONTENT_CONFIG[platform].feedPlatform || platform} content found for this artist
                      </p>
                      <p className="text-[9px] text-[#6B6560]/60 mt-1">
                        Switch to <button onClick={() => setContentMode('create')} className="text-[#DA7756] hover:underline cursor-pointer">Create New</button> to build an ad from scratch
                      </p>
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Spotify Ad Creative — file uploads (only if no existing track selected) */}
          {platform === 'spotify' && artistSlug && !selectedContentId && (
            <Section label="Ad Creative">
              <div className="space-y-3 bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
                <FileUploadField
                  label="Audio File (.mp3, .wav)"
                  accept=".mp3,.wav,.ogg,.m4a,audio/*"
                  file={audioFile}
                  onChange={setAudioFile}
                  onClear={() => setAudioFile(null)}
                  icon={FileAudio}
                  required
                />
                <FileUploadField
                  label="Cover Image (.jpg, .png)"
                  accept=".jpg,.jpeg,.png,image/*"
                  file={imageFile}
                  onChange={setImageFile}
                  onClear={() => setImageFile(null)}
                  icon={Image}
                  required
                />
                <FileUploadField
                  label="Logo (optional)"
                  accept=".jpg,.jpeg,.png,.svg,image/*"
                  file={logoFile}
                  onChange={setLogoFile}
                  onClear={() => setLogoFile(null)}
                  icon={Image}
                />
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Headline</label>
                  <input
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    placeholder="New Album Out Now"
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Advertiser Name</label>
                  <input
                    value={advertiserName}
                    onChange={e => setAdvertiserName(e.target.value)}
                    placeholder={selectedArtist?.name || artistSlug}
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
                    <span className="flex items-center gap-1"><Link2 size={9} /> Track URL</span>
                  </label>
                  <input
                    value={trackUrl}
                    onChange={e => setTrackUrl(e.target.value)}
                    placeholder="https://open.spotify.com/track/..."
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none font-mono"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* YouTube Ad Creative — video upload (only if no existing video selected) */}
          {platform === 'youtube' && artistSlug && !selectedContentId && (
            <Section label="Ad Creative">
              <div className="space-y-3 bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
                <FileUploadField
                  label="Video File (.mp4, .webm)"
                  accept=".mp4,.webm,.mov,video/*"
                  file={videoFile}
                  onChange={setVideoFile}
                  onClear={() => setVideoFile(null)}
                  icon={FileVideo}
                  required
                />
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Headline</label>
                  <input
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    placeholder="Check out my new single"
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Description</label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Listen on all platforms"
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
                    <span className="flex items-center gap-1"><Link2 size={9} /> Destination URL</span>
                  </label>
                  <input
                    value={trackUrl}
                    onChange={e => setTrackUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Target CPV (cost per view)</label>
                  <div className="flex items-center gap-1 bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 w-28">
                    <span className="text-xs text-[#6B6560]">$</span>
                    <input
                      type="number"
                      value={targetCpm}
                      onChange={e => setTargetCpm(e.target.value)}
                      min={0}
                      step={0.01}
                      className="flex-1 bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-full"
                    />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Rationale */}
          <Section label="Rationale">
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Why run this campaign? (AI-generated or custom)"
              rows={3}
              className="w-full bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none resize-none"
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2C2B28] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-[10px] text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
            >
              {launchMode ? 'Cancel All' : 'Cancel'}
            </button>
            {launchMode && (
              <button
                onClick={async () => onSave(await buildDirective())}
                className="text-[10px] text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
              >
                Skip Platform
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {launchMode && launchProgress && (
              <span className="text-[9px] font-mono text-[#6B6560] mr-1">
                {launchProgress.current} / {launchProgress.total}
              </span>
            )}
            {launchMode ? (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
              >
                {isLastInQueue ? 'Launch All' : 'Next Platform'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="px-4 py-2 text-xs font-medium text-[#F5F0E8] border border-[#2C2B28] hover:border-[#3D3B37] rounded disabled:text-[#6B6560] disabled:border-[#2C2B28] transition-colors cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSave}
                  className="px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
                >
                  Submit for Approval
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
