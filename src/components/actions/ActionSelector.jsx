import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Search, ArrowLeft, Check, Users, Monitor, BarChart3, Plus } from 'lucide-react';
import Badge from '../shared/Badge';
import { DATA_TYPE_LABELS, PLATFORM_LABELS } from '../../data/actions';
import { PLATFORM_COLORS } from '../../constants/colors';

const TYPE_DOTS = {
  warning: '#DA7756',
  danger: '#C75F4F',
  success: '#7BAF73',
  info: '#D4A574',
};

function buildArtistIndex(actions) {
  const map = new Map();
  for (const a of actions) {
    if (!map.has(a.artistSlug)) {
      map.set(a.artistSlug, { slug: a.artistSlug, name: a.artistName, imageUrl: a.artistImage, count: 0 });
    }
    map.get(a.artistSlug).count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildPlatformIndex(actions) {
  const map = new Map();
  for (const a of actions) {
    if (!map.has(a.platform)) {
      map.set(a.platform, { key: a.platform, label: PLATFORM_LABELS[a.platform] || a.platform, color: PLATFORM_COLORS[a.platform] || null, count: 0 });
    }
    map.get(a.platform).count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildDataTypeIndex(actions) {
  const map = new Map();
  for (const a of actions) {
    if (!map.has(a.dataType)) {
      map.set(a.dataType, { key: a.dataType, label: DATA_TYPE_LABELS[a.dataType] || a.dataType, count: 0 });
    }
    map.get(a.dataType).count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export default function ActionSelector({ isOpen, onClose, allActions, alreadySelected, onSelect, onCreateCustom, initialArtistSlug }) {
  const hasInitialArtist = !!initialArtistSlug;
  const [step, setStep] = useState(hasInitialArtist ? 'actions' : 'dimension');
  const [dimension, setDimension] = useState(hasInitialArtist ? 'artist' : null);
  const [filterValue, setFilterValue] = useState(null);
  const [artistSlug, setArtistSlug] = useState(initialArtistSlug || null);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(new Set());
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const searchRef = useRef(null);

  // Focus search on step changes
  useEffect(() => {
    if (isOpen && step !== 'actions') {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [step, isOpen]);

  const resetAndClose = useCallback(() => {
    onClose();
    setStep(initialArtistSlug ? 'actions' : 'dimension');
    setDimension(initialArtistSlug ? 'artist' : null);
    setFilterValue(null);
    setArtistSlug(initialArtistSlug || null);
    setSearch('');
    setChecked(new Set());
    setCustomText('');
    setShowCustom(false);
  }, [onClose, initialArtistSlug]);

  const alreadySelectedSet = useMemo(() => new Set(Object.keys(alreadySelected || {})), [alreadySelected]);

  // Pool of active, unselected actions
  const pool = useMemo(() => allActions.filter(a => a.status === 'active' && !alreadySelectedSet.has(a.id)), [allActions, alreadySelectedSet]);

  const artistIndex = useMemo(() => buildArtistIndex(pool), [pool]);
  const platformIndex = useMemo(() => buildPlatformIndex(pool), [pool]);
  const dataTypeIndex = useMemo(() => buildDataTypeIndex(pool), [pool]);

  // Filtered lists for search
  const searchLower = search.toLowerCase();

  const filteredArtists = useMemo(() => {
    if (!search) return artistIndex;
    return artistIndex.filter(a => a.name.toLowerCase().includes(searchLower));
  }, [artistIndex, searchLower, search]);

  const filteredPlatforms = useMemo(() => {
    if (!search) return platformIndex;
    return platformIndex.filter(p => p.label.toLowerCase().includes(searchLower));
  }, [platformIndex, searchLower, search]);

  const filteredDataTypes = useMemo(() => {
    if (!search) return dataTypeIndex;
    return dataTypeIndex.filter(d => d.label.toLowerCase().includes(searchLower));
  }, [dataTypeIndex, searchLower, search]);

  // Actions for the selected artist (filtered by platform/dataType if applicable)
  const artistActions = useMemo(() => {
    if (!artistSlug) return [];
    let items = pool.filter(a => a.artistSlug === artistSlug);
    if (dimension === 'platform' && filterValue) items = items.filter(a => a.platform === filterValue);
    if (dimension === 'dataType' && filterValue) items = items.filter(a => a.dataType === filterValue);
    return items;
  }, [pool, artistSlug, dimension, filterValue]);

  // Artists filtered for step 2 (when platform or dataType selected)
  const artistsForFilter = useMemo(() => {
    if (!filterValue) return [];
    const filtered = dimension === 'platform'
      ? pool.filter(a => a.platform === filterValue)
      : pool.filter(a => a.dataType === filterValue);
    return buildArtistIndex(filtered);
  }, [pool, filterValue, dimension]);

  const selectedArtist = artistIndex.find(a => a.slug === artistSlug);

  const handleDimensionPick = (dim) => {
    setDimension(dim);
    setSearch('');
    if (dim === 'artist') {
      setStep('artist');
    } else {
      setStep('dimension');
    }
  };

  const handleFilterPick = (key) => {
    setFilterValue(key);
    setSearch('');
    setStep('artist');
  };

  const handleArtistPick = (slug) => {
    setArtistSlug(slug);
    setSearch('');
    setChecked(new Set());
    setStep('actions');
  };

  const handleBack = () => {
    if (step === 'actions') {
      if (hasInitialArtist) {
        resetAndClose();
        return;
      }
      setArtistSlug(null);
      setChecked(new Set());
      setStep('artist');
    } else if (step === 'artist' && dimension !== 'artist') {
      setFilterValue(null);
      setStep('dimension');
      setDimension(null);
    } else {
      setStep('dimension');
      setDimension(null);
    }
    setSearch('');
  };

  const toggleCheck = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setChecked(new Set(artistActions.map(a => a.id)));
  };

  const deselectAll = () => {
    setChecked(new Set());
  };

  const handleConfirm = () => {
    if (checked.size > 0) {
      onSelect(Array.from(checked));
    }
    resetAndClose();
  };

  const handleCreateCustom = () => {
    if (!customText.trim() || !artistSlug) return;
    onCreateCustom?.({
      artistSlug,
      action: customText.trim(),
    });
    setCustomText('');
    setShowCustom(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={resetAndClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2C2B28] shrink-0">
          {step !== 'dimension' && (
            <button onClick={handleBack} className="p-1 text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer">
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[#F5F0E8]">
              {step === 'dimension' && 'Add Actions'}
              {step === 'artist' && (dimension === 'artist' ? 'Select Artist' : `Select Artist — ${dimension === 'platform' ? PLATFORM_LABELS[filterValue] || filterValue : DATA_TYPE_LABELS[filterValue] || filterValue}`)}
              {step === 'actions' && (selectedArtist?.name || artistSlug)}
            </h3>
            <p className="text-[10px] text-[#6B6560]">
              {step === 'dimension' && 'Choose how to browse actions'}
              {step === 'artist' && `${dimension === 'artist' ? artistIndex.length : artistsForFilter.length} artists available`}
              {step === 'actions' && `${artistActions.length} actions · ${checked.size} selected`}
            </p>
          </div>
          <button onClick={resetAndClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Search (shown in dimension and artist steps) */}
        {step !== 'actions' && (
          <div className="px-5 py-3 border-b border-[#2C2B28] shrink-0">
            <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2">
              <Search size={14} className="text-[#6B6560] shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={step === 'dimension' ? 'Search artists, platforms, data types...' : 'Search artists...'}
                className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#6B6560] hover:text-[#9B9590] cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Step: Choose Dimension */}
          {step === 'dimension' && !dimension && (
            <div className="space-y-2">
              {/* Dimension buttons */}
              {!search && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    onClick={() => handleDimensionPick('artist')}
                    className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-[#2C2B28] hover:border-[#DA7756]/30 hover:bg-[#1C1B18] transition-colors cursor-pointer"
                  >
                    <Users size={18} className="text-[#DA7756]" />
                    <span className="text-[10px] font-mono text-[#F5F0E8]">By Artist</span>
                    <span className="text-[9px] text-[#6B6560]">{artistIndex.length} artists</span>
                  </button>
                  <button
                    onClick={() => { setDimension('platform'); }}
                    className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-[#2C2B28] hover:border-[#DA7756]/30 hover:bg-[#1C1B18] transition-colors cursor-pointer"
                  >
                    <Monitor size={18} className="text-[#DA7756]" />
                    <span className="text-[10px] font-mono text-[#F5F0E8]">By Platform</span>
                    <span className="text-[9px] text-[#6B6560]">{platformIndex.length} platforms</span>
                  </button>
                  <button
                    onClick={() => { setDimension('dataType'); }}
                    className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-[#2C2B28] hover:border-[#DA7756]/30 hover:bg-[#1C1B18] transition-colors cursor-pointer"
                  >
                    <BarChart3 size={18} className="text-[#DA7756]" />
                    <span className="text-[10px] font-mono text-[#F5F0E8]">By Data Type</span>
                    <span className="text-[9px] text-[#6B6560]">{dataTypeIndex.length} types</span>
                  </button>
                </div>
              )}

              {/* Search results across all dimensions */}
              {search && (
                <>
                  {filteredArtists.length > 0 && (
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-1.5">Artists</p>
                      {filteredArtists.slice(0, 6).map(a => (
                        <button
                          key={a.slug}
                          onClick={() => { setDimension('artist'); handleArtistPick(a.slug); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                        >
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                              <Users size={11} className="text-[#6B6560]" />
                            </div>
                          )}
                          <span className="text-xs text-[#F5F0E8] flex-1 truncate">{a.name}</span>
                          <span className="text-[10px] font-mono text-[#6B6560]">{a.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredPlatforms.length > 0 && (
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-1.5 mt-3">Platforms</p>
                      {filteredPlatforms.map(p => (
                        <button
                          key={p.key}
                          onClick={() => { setDimension('platform'); handleFilterPick(p.key); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                        >
                          {p.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
                          <span className="text-xs text-[#F5F0E8] flex-1">{p.label}</span>
                          <span className="text-[10px] font-mono text-[#6B6560]">{p.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredDataTypes.length > 0 && (
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-1.5 mt-3">Data Types</p>
                      {filteredDataTypes.map(d => (
                        <button
                          key={d.key}
                          onClick={() => { setDimension('dataType'); handleFilterPick(d.key); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                        >
                          <span className="text-xs text-[#F5F0E8] flex-1">{d.label}</span>
                          <span className="text-[10px] font-mono text-[#6B6560]">{d.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredArtists.length === 0 && filteredPlatforms.length === 0 && filteredDataTypes.length === 0 && (
                    <p className="text-xs text-[#6B6560] text-center py-8">No results for "{search}"</p>
                  )}
                </>
              )}

              {/* Show platform/dataType list when dimension is selected but no filter yet */}
              {!search && dimension === 'platform' && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">Select a platform</p>
                  {platformIndex.map(p => (
                    <button
                      key={p.key}
                      onClick={() => handleFilterPick(p.key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                    >
                      {p.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
                      <span className="text-xs text-[#F5F0E8] flex-1">{p.label}</span>
                      <span className="text-[10px] font-mono text-[#6B6560]">{p.count} actions</span>
                    </button>
                  ))}
                </div>
              )}

              {!search && dimension === 'dataType' && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">Select a data type</p>
                  {dataTypeIndex.map(d => (
                    <button
                      key={d.key}
                      onClick={() => handleFilterPick(d.key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                    >
                      <span className="text-xs text-[#F5F0E8] flex-1">{d.label}</span>
                      <span className="text-[10px] font-mono text-[#6B6560]">{d.count} actions</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Select Artist */}
          {step === 'artist' && (
            <div className="space-y-0.5">
              {(dimension === 'artist' ? filteredArtists : (search ? artistsForFilter.filter(a => a.name.toLowerCase().includes(searchLower)) : artistsForFilter)).map(a => (
                <button
                  key={a.slug}
                  onClick={() => handleArtistPick(a.slug)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                >
                  {a.imageUrl ? (
                    <img src={a.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                      <Users size={12} className="text-[#6B6560]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#F5F0E8] truncate">{a.name}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#6B6560] shrink-0">{a.count} actions</span>
                </button>
              ))}
              {dimension === 'artist' && filteredArtists.length === 0 && (
                <p className="text-xs text-[#6B6560] text-center py-8">No artists found</p>
              )}
            </div>
          )}

          {/* Step: Select Actions */}
          {step === 'actions' && (
            <div className="space-y-1">
              {/* Select all / deselect all */}
              <div className="flex items-center gap-3 mb-3">
                <button onClick={selectAll} className="text-[10px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                  Select all ({artistActions.length})
                </button>
                {checked.size > 0 && (
                  <button onClick={deselectAll} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                    Deselect all
                  </button>
                )}
              </div>

              {/* Action checkboxes */}
              {artistActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => toggleCheck(action.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded border text-left transition-colors cursor-pointer ${
                    checked.has(action.id)
                      ? 'border-[#DA7756]/30 bg-[#DA7756]/5'
                      : 'border-[#2C2B28] hover:border-[#3D3B37]'
                  }`}
                >
                  <div className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    checked.has(action.id)
                      ? 'bg-[#DA7756] border-[#DA7756]'
                      : 'border-[#3D3B37]'
                  }`}>
                    {checked.has(action.id) && <Check size={10} className="text-[#0D0C0B]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_DOTS[action.insightType] || TYPE_DOTS.info }} />
                      <Badge variant={action.insightType === 'warning' ? 'warning' : action.insightType === 'success' ? 'success' : 'info'}>
                        {DATA_TYPE_LABELS[action.dataType] || action.dataType}
                      </Badge>
                      {action.platform !== 'general' && action.platform !== 'revenue' && (
                        <span className="text-[9px] font-mono text-[#6B6560]">
                          {PLATFORM_LABELS[action.platform] || action.platform}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#F5F0E8] leading-relaxed">{action.action}</p>
                    {action.text && (
                      <p className="text-[10px] text-[#6B6560] leading-relaxed mt-0.5 line-clamp-1">{action.text}</p>
                    )}
                  </div>
                </button>
              ))}

              {artistActions.length === 0 && (
                <p className="text-xs text-[#6B6560] text-center py-8">No available actions for this artist</p>
              )}

              {/* Create custom action */}
              <div className="mt-4 pt-3 border-t border-[#2C2B28]">
                {showCustom ? (
                  <div className="space-y-2">
                    <input
                      value={customText}
                      onChange={e => setCustomText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateCustom(); if (e.key === 'Escape') setShowCustom(false); }}
                      placeholder="Describe the action..."
                      autoFocus
                      className="w-full bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCreateCustom}
                        disabled={!customText.trim()}
                        className="text-[10px] font-mono text-[#7BAF73] hover:text-[#F5F0E8] disabled:text-[#3D3B37] transition-colors cursor-pointer"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setShowCustom(false); setCustomText(''); }}
                        className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustom(true)}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
                  >
                    <Plus size={10} />
                    Create custom action
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — confirm button for actions step */}
        {step === 'actions' && (
          <div className="px-5 py-3 border-t border-[#2C2B28] shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-[#6B6560]">
              {checked.size} action{checked.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleConfirm}
              disabled={checked.size === 0}
              className="px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
            >
              Add Selected
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
