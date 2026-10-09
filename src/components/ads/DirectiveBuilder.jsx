import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { X, Check, Search, Music, Loader2, Heart, Eye, CheckCircle, Play, Plus, ChevronDown, Link2, Upload, FileVideo, Trash2, AlertTriangle } from 'lucide-react';
import AdImagesField from './AdImagesField';
import AdPreview from './AdPreview';
import { PLATFORM_OBJECTIVES, PLATFORM_CONSTRAINTS, PLATFORM_LABELS, CREATIVE_TYPES } from '../../data/directives';
import BudgetAllocator from './BudgetAllocator';
import { PLATFORM_COLORS } from '../../constants/colors';
import { searchArtists, getArtist, getArtistAsync } from '../../data/artists';
import { api } from '../../data/api';
import { checkMetaLaunch, isMetaDirective, ACCOUNT_FIX_CODES } from '../../data/metaAds';
import { useMetaConnection } from '../../hooks/useMetaConnection';
import { useAsync } from '../../hooks/useAsync';
import { fetchSmartLinks } from '../../data/smartLinks';

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
  meta: { label: 'Boost an Instagram Post', source: 'content-feed', feedPlatform: 'instagram' },
  youtube: { label: 'Select a YouTube Video', source: 'content-feed', feedPlatform: 'youtube' },
  tiktok: { label: 'Boost a TikTok Video', source: 'content-feed', feedPlatform: 'tiktok' },
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

/** New Meta ads run as one of the Instagram accounts shared with Prelude. */
function MetaRunAsPicker({ value, onChange, onOpenAccounts }) {
  const { connection, refresh } = useMetaConnection();
  useEffect(() => { refresh(true); }, [refresh]);

  const accounts = connection?.instagramAccounts;
  const accountMap = connection?.selection?.accountMap || {};
  const selectCls = 'w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-xs text-[#F5F0E8] outline-none';

  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Run as (Instagram account)</label>
      {connection && !connection.connected ? (
        <p className="text-[10px] text-[#D4A574]">
          Connect Meta to choose an account.{' '}
          {onOpenAccounts && (
            <button onClick={() => onOpenAccounts()} className="text-[#DA7756] hover:underline cursor-pointer">Open Ad Accounts</button>
          )}
        </p>
      ) : !accounts ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[#6B6560]"><Loader2 size={10} className="animate-spin" /> Loading accounts…</p>
      ) : (
        <select value={value || ''} onChange={e => onChange(e.target.value || null)} className={selectCls}>
          <option value="">Choose an account…</option>
          {accounts.map(a => (
            <option key={a.igUserId} value={a.igUserId}>
              @{a.username}{accountMap[a.igUserId] ? ` · ${accountMap[a.igUserId].adAccountName}` : ' · no ad account assigned'}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Pick one of the user's smart links as a Meta ad's destination (tracks streaming clicks). */
function SmartLinkPicker({ value, onChange, artistSlug }) {
  const { data } = useAsync(() => fetchSmartLinks().catch(() => ({ links: [] })), []);
  const links = data?.links || [];
  if (!links.length) {
    return <p className="text-[9px] text-[#6B6560] mt-1">Tip: create a smart link in Campaigns → Links to track clicks through to each streaming service.</p>;
  }
  // The artist's own links first
  const sorted = [...links].sort((a, b) => (b.artistSlug === artistSlug) - (a.artistSlug === artistSlug));
  const selected = links.find(l => l.url === value);
  return (
    <div className="mt-1.5">
      <select
        value={selected?.slug || ''}
        onChange={e => { const l = links.find(x => x.slug === e.target.value); if (l) onChange(l.url); }}
        className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-1.5 text-[10px] text-[#9B9590] outline-none"
      >
        <option value="">Use a smart link…</option>
        {sorted.map(l => <option key={l.slug} value={l.slug}>{l.title}{l.artistName ? ` · ${l.artistName}` : ''}</option>)}
      </select>
      {selected && <p className="text-[9px] text-[#7BAF73] mt-1">Streaming-service clicks from this ad will be tracked.</p>}
    </div>
  );
}

const STEPS = ['Setup', 'Audience', 'Creative', 'Review'];

function StepBar({ step, maxStep, onGo }) {
  return (
    <div className="flex items-center gap-1 mt-2">
      {STEPS.map((label, i) => {
        const reachable = i <= maxStep;
        return (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && <span className={`w-4 h-px ${i <= maxStep ? 'bg-[#DA7756]/50' : 'bg-[#2C2B28]'}`} />}
            <button
              onClick={() => reachable && onGo(i)}
              disabled={!reachable}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                i === step ? 'bg-[#DA7756]/15 text-[#F5F0E8]'
                  : reachable ? 'text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer' : 'text-[#4A4743] cursor-default'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                i < step ? 'bg-[#7BAF73]/20 text-[#7BAF73]' : i === step ? 'bg-[#DA7756] text-[#0D0C0B]' : 'bg-[#2C2B28] text-[#6B6560]'
              }`}>
                {i < step ? <Check size={9} /> : i + 1}
              </span>
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReviewRow({ label, children, onEdit }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#2C2B28] last:border-0">
      <p className="w-24 shrink-0 text-[10px] font-mono text-[#6B6560] pt-0.5">{label}</p>
      <div className="flex-1 min-w-0 text-xs text-[#F5F0E8]">{children}</div>
      {onEdit && (
        <button onClick={onEdit} className="text-[10px] font-mono text-[#9B9590] hover:text-[#DA7756] cursor-pointer shrink-0">Edit</button>
      )}
    </div>
  );
}

export default function DirectiveBuilder({ isOpen, onClose, onSave, onSubmit, onAcceptAllocation, initialData, connectedPlatforms, launchMode, launchProgress, onOpenAccounts }) {
  // Meta ads can't be submitted until Meta + the artist's ad account are ready
  const [metaGate, setMetaGate] = useState(null); // null | { checking } | { message, fixable }
  const navigate = useNavigate();
  const editing = !!initialData?.id;
  // Step-by-step flow; reopen at the first step whenever a different campaign is loaded
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [stepFor, setStepFor] = useState(initialData);
  if (stepFor !== initialData) {
    setStepFor(initialData);
    setStep(0);
    setMaxStep(0);
  }
  const goTo = (i) => { setStep(i); setMaxStep(m => Math.max(m, i)); };

  const [platform, setPlatform] = useState(initialData?.platform || connectedPlatforms?.[0] || 'meta');
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
  // Instagram account a new (non-boost) Meta ad runs as
  const [runAsIgUserId, setRunAsIgUserId] = useState(initialData?.creative?.postId ? null : initialData?.creative?.igUserId || null);
  const [rationale, setRationale] = useState(initialData?.rationale || '');

  // Generalized content picker state
  const [contentItems, setContentItems] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentLoadingMore, setContentLoadingMore] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState(null);
  const [contentTotal, setContentTotal] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [contentMode, setContentMode] = useState('select'); // 'select' | 'create'
  // New-ad images, in the order they appear (2+ make a carousel)
  const [images, setImages] = useState(() => initialData?.creative?.images
    || (initialData?.creative?.imageUrl && !initialData?.creative?.postId ? [initialData.creative.imageUrl] : []));

  // YouTube ad creative files
  const [videoFile, setVideoFile] = useState(null);
  const [targetCpm, setTargetCpm] = useState(initialData?.budget?.targetCpm ? initialData.budget.targetCpm / 1000000 : 2);

  const CONTENT_PAGE_SIZE = 12;

  // Artist selection — the picked artist object is kept in state (the search
  // result IS the artist object); slug-only initialData resolves from the
  // cache, then the catalog
  const [artistSlug, setArtistSlug] = useState(initialData?.artistSlug || '');
  const [artistSearch, setArtistSearch] = useState('');
  const [pickedArtist, setPickedArtist] = useState(() =>
    initialData?.artistSlug ? getArtist(initialData.artistSlug) : null
  );

  const selectedArtist = artistSlug
    ? (pickedArtist?.slug === artistSlug ? pickedArtist : getArtist(artistSlug))
    : null;

  // Debounced server-side search across the full catalog
  const [rawSearchResults, setRawSearchResults] = useState([]);
  useEffect(() => {
    if (!artistSearch || artistSearch.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchArtists(artistSearch, 6)
        .then(artists => { if (!cancelled) setRawSearchResults(artists); })
        .catch(() => { if (!cancelled) setRawSearchResults([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [artistSearch]);

  const searchResults = artistSearch && artistSearch.length >= 2 ? rawSearchResults : [];

  // Resolve the artist object from the catalog when only a slug is known
  useEffect(() => {
    if (!artistSlug || selectedArtist) return;
    let cancelled = false;
    getArtistAsync(artistSlug)
      .then(artist => { if (!cancelled && artist) setPickedArtist(artist); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [artistSlug, selectedArtist]);

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

    // Fetch the artist's posts on this platform
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

    return () => { cancelled = true; };
  }, [platform, artistSlug]);

  // Load more content items
  const loadMoreContent = () => {
    const config = PLATFORM_CONTENT_CONFIG[platform];
    if (!config || contentLoadingMore) return;

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

  const hasMoreContent = contentItems.length < contentTotal;

  const selectContent = (item) => {
    setMetaGate(null);
    setSelectedContentId(item.id);
    setPostId(item.platformId);
    setHeadline(item.title || '');
    setTrackUrl(item.permalink || '');
    setPostSource(item.sourcePlatform || null);
    setOwnerPlatformId(item.ownerPlatformId || null);
    setCreativeType(item.contentType === 'video' ? 'video' : 'image');
  };

  const clearContentSelection = () => {
    setSelectedContentId(null);
    setPostId(null);
    setPostSource(null);
    setOwnerPlatformId(null);
  };

  const filteredContentItems = contentItems;

  const budgetError = constraint?.minBudget && budgetAmount < constraint.minBudget
    ? `Minimum budget: $${constraint.minBudget}`
    : null;

  const canSave = artistSlug && effectiveObjective && !budgetError;
  // Setup must be complete before moving on; later steps have sensible defaults
  const stepReady = step === 0 ? canSave : true;

  // Review-step preview: the boosted post, the uploaded YouTube video, or the new ad's images
  const { connection: metaConnection } = useMetaConnection();
  const videoPreviewUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  useEffect(() => () => { if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl); }, [videoPreviewUrl]);
  const selectedItem = contentItems.find(i => i.id === selectedContentId);
  const boostThumb = selectedItem?.thumbnailUrl
    || (initialData?.creative?.postId === postId ? initialData?.creative?.imageUrl : null);
  const previewMedia = postId
    ? (boostThumb ? [{ url: boostThumb, type: 'image' }] : [])
    : platform === 'youtube' && videoPreviewUrl ? [{ url: videoPreviewUrl, type: 'video' }]
    : images.map(url => ({ url, type: 'image' }));
  const previewIgId = postId ? ownerPlatformId : runAsIgUserId;
  const previewUsername = platform === 'meta'
    ? metaConnection?.instagramAccounts?.find(a => a.igUserId === previewIgId)?.username
    : null;

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

    if (platform === 'youtube') {
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
        igUserId: postId ? (postSource === 'instagram' ? ownerPlatformId : null) : runAsIgUserId,
        pageId: postSource === 'facebook' ? ownerPlatformId : null,
        images: postId ? [] : images,
        imageUrl: (!postId && images[0]) || selectedArtist?.imageUrl || initialData?.artistImage || null,
      };
    }

    return base;
  };

  const handleSave = async () => {
    if (!canSave) return;
    const d = await buildDirective();
    onSave(d);
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    const d = await buildDirective();
    if (isMetaDirective(d)) {
      setMetaGate({ checking: true });
      try {
        const ready = await checkMetaLaunch(d);
        d.adAccountId = ready.adAccountId;
        d.adAccountName = ready.adAccountName;
        d.igUsername = ready.igUsername;
        setMetaGate(null);
      } catch (e) {
        setMetaGate({ message: e.message, fixable: ACCOUNT_FIX_CODES.has(e.code) || e.code === 'not_configured' });
        return;
      }
    }
    d.status = 'pending_approval';
    onSubmit(d);
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
        className={`relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full ${step === 3 ? 'max-w-4xl' : 'max-w-2xl'} min-h-[min(560px,85vh)] max-h-[85vh] flex flex-col transition-[max-width]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28] shrink-0">
          <div>
            <h3 className="text-sm font-medium text-[#F5F0E8]">
              {launchMode ? `Configure ${PLATFORM_LABELS[platform]} Campaign` : editing ? 'Edit Campaign' : 'New Campaign'}
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
            ) : null}
            <StepBar step={step} maxStep={maxStep} onGo={goTo} />
          </div>
          <button onClick={onClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {step === 0 && (<>
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
                        onMouseDown={() => { setArtistSlug(a.slug); setPickedArtist(a); setArtistSearch(''); }}
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

          </>)}

          {step === 1 && (<>
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

          </>)}

          {step === 2 && (<>
          {/* Content to Promote */}
          {artistSlug && PLATFORM_CONTENT_CONFIG[platform] && (
            <Section label="Content to Promote">
              {/* Mode toggle: Select Existing / Create New */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => { setContentMode('select'); clearContentSelection(); setMetaGate(null); }}
                  className={`text-[9px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    contentMode === 'select'
                      ? 'border-[#DA7756]/30 bg-[#DA7756]/10 text-[#F5F0E8]'
                      : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                  }`}
                >
                  Select Existing
                </button>
                <button
                  onClick={() => { setContentMode('create'); clearContentSelection(); setMetaGate(null); }}
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

              {contentMode === 'create' ? (
                /* Create new ad creative */
                <div className="space-y-3 bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-3">
                  <>
                      {platform === 'meta' && (
                        <MetaRunAsPicker value={runAsIgUserId} onChange={(v) => { setRunAsIgUserId(v); setMetaGate(null); }} onOpenAccounts={onOpenAccounts} />
                      )}
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
                      <AdImagesField
                        images={images}
                        onChange={(next) => { setImages(next); setMetaGate(null); }}
                        fallbackImage={selectedArtist?.imageUrl}
                      />
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
                        {platform === 'meta' && <SmartLinkPicker value={trackUrl} onChange={setTrackUrl} artistSlug={artistSlug} />}
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
                  </>
                </div>
              ) : (
                /* Select existing content */
                <>
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

          {artistSlug && !PLATFORM_CONTENT_CONFIG[platform] && (
            <p className="text-[10px] text-[#6B6560]">No creative needed for this platform.</p>
          )}
          {!artistSlug && <p className="text-[10px] text-[#6B6560]">Choose an artist in Setup first.</p>}
          </>)}

          {step === 3 && (<>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
          <Section label="Preview">
            <AdPreview
              platform={platform}
              username={previewUsername}
              artistName={selectedArtist?.name || initialData?.artistName || artistSlug}
              avatar={selectedArtist?.imageUrl || initialData?.artistImage}
              media={previewMedia}
              headline={postId ? '' : headline}
              description={postId ? (selectedItem?.title || headline) : description}
              cta={postId ? null : cta}
              trackUrl={postId ? '' : trackUrl}
            />
          </Section>
          <div className="space-y-5 min-w-0">
          <Section label="Review">
            <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg px-3">
              <ReviewRow label="Artist" onEdit={launchMode ? null : () => goTo(0)}>
                {selectedArtist?.name || initialData?.artistName || artistSlug || '–'}
              </ReviewRow>
              <ReviewRow label="Platform" onEdit={launchMode ? null : () => goTo(0)}>{PLATFORM_LABELS[platform]}</ReviewRow>
              <ReviewRow label="Objective" onEdit={() => goTo(0)}>
                {objectives.find(o => o.key === effectiveObjective)?.label || '–'}
              </ReviewRow>
              <ReviewRow label="Budget" onEdit={() => goTo(0)}>
                ${Number(budgetAmount || 0).toLocaleString()} {budgetPeriod}
              </ReviewRow>
              <ReviewRow label="Schedule" onEdit={() => goTo(0)}>
                {startDate || 'Not set'} → {endDate || 'Not set'}
              </ReviewRow>
              <ReviewRow label="Audience" onEdit={() => goTo(1)}>
                {locations.join(', ') || 'No locations'} · ages {ageMin}–{ageMax}{lookalike ? ' · lookalike' : ''}
              </ReviewRow>
              <ReviewRow label="Creative" onEdit={() => goTo(2)}>
                {postId ? (
                  <span>Boost an existing post{headline ? `: "${headline}"` : ''}</span>
                ) : (
                  <div className="space-y-1.5">
                    <p>{headline ? `"${headline}"` : 'New ad, no headline'}</p>
                    {images.length > 0 && (
                      <div className="flex gap-1">
                        {images.map((url, i) => (
                          <img key={url} src={url} alt={`Image ${i + 1}`} className="w-10 h-10 rounded object-cover border border-[#2C2B28]" />
                        ))}
                        {images.length > 1 && <span className="text-[10px] text-[#6B6560] self-end ml-1">carousel</span>}
                      </div>
                    )}
                    {trackUrl && <p className="text-[10px] font-mono text-[#9B9590] truncate">→ {trackUrl}</p>}
                  </div>
                )}
              </ReviewRow>
            </div>
          </Section>

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
          </div>
          </>)}
        </div>

        {metaGate?.message && (
          <div className="px-5 py-2.5 border-t border-[#C75F4F]/30 bg-[#C75F4F]/10 shrink-0 flex items-start gap-2">
            <AlertTriangle size={12} className="text-[#C75F4F] mt-0.5 shrink-0" />
            <p className="flex-1 text-[11px] text-[#F5F0E8]">{metaGate.message}</p>
            {metaGate.fixable && onOpenAccounts && (
              <button
                onClick={() => onOpenAccounts(metaGate.message)}
                className="text-[10px] font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded px-2.5 py-1 shrink-0 cursor-pointer"
              >
                Open Ad Accounts
              </button>
            )}
          </div>
        )}

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
            {!launchMode && step < STEPS.length - 1 && (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="text-[10px] text-[#9B9590] hover:text-[#F5F0E8] disabled:text-[#4A4743] transition-colors cursor-pointer"
              >
                Save draft
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {launchMode && launchProgress && (
              <span className="text-[9px] font-mono text-[#6B6560] mr-1">
                {launchProgress.current} / {launchProgress.total}
              </span>
            )}
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                className="px-3 py-2 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => goTo(step + 1)}
                disabled={!stepReady}
                className="px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
              >
                Next: {STEPS[step + 1]}
              </button>
            ) : launchMode ? (
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
                  disabled={!canSave || metaGate?.checking}
                  className="px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
                >
                  {metaGate?.checking ? 'Checking ad account…' : 'Submit for Approval'}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
