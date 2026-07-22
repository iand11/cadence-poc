import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Copy, Check, Image, Plus, Trash2, ChevronDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getArtist } from '../../data/artists';
import { formatNumber } from '../../utils/formatters';

const STAT_GROUPS = [
  {
    group: 'Spotify',
    stats: [
      { key: 'sp_listeners',       label: 'Monthly Listeners',       path: a => a.spotify?.monthlyListeners },
      { key: 'sp_followers',       label: 'Spotify Followers',       path: a => a.spotify?.followers },
      { key: 'sp_popularity',      label: 'Spotify Popularity',      path: a => a.spotify?.popularity, fmt: v => `${v}/100` },
      { key: 'sp_playlists',       label: 'Spotify Playlists',       path: a => a.playlists?.spotify?.total },
      { key: 'sp_editorial',       label: 'Editorial Playlists',     path: a => a.playlists?.spotify?.editorial },
      { key: 'sp_reach',           label: 'Playlist Reach',          path: a => a.playlists?.spotify?.reach },
      { key: 'sp_editorial_reach', label: 'Editorial Reach',         path: a => a.playlists?.spotify?.editorialReach },
    ],
  },
  {
    group: 'Social',
    stats: [
      { key: 'ig_followers',    label: 'Instagram Followers',   path: a => a.social?.instagram },
      { key: 'tt_followers',    label: 'TikTok Followers',      path: a => a.social?.tiktok },
      { key: 'tt_likes',        label: 'TikTok Likes',          path: a => a.social?.tiktokLikes },
      { key: 'tt_posts',        label: 'TikTok Track Posts',    path: a => a.social?.tiktokTrackPosts },
      { key: 'yt_subscribers',  label: 'YouTube Subscribers',   path: a => a.social?.youtube },
      { key: 'yt_views',        label: 'YouTube Total Views',   path: a => a.social?.youtubeViews },
      { key: 'yt_monthly',      label: 'YouTube Monthly Views', path: a => a.social?.youtubeMonthly },
      { key: 'tw_followers',    label: 'Twitter Followers',     path: a => a.social?.twitter },
    ],
  },
  {
    group: 'Engagement',
    stats: [
      { key: 'shazam',           label: 'Shazam Count',            path: a => a.engagement?.shazam },
      { key: 'genius',           label: 'Genius Pageviews',        path: a => a.engagement?.genius },
      { key: 'pandora_listen',   label: 'Pandora Listeners (28d)', path: a => a.engagement?.pandoraListeners },
      { key: 'pandora_streams',  label: 'Pandora Lifetime Streams',path: a => a.engagement?.pandoraLifetimeStreams },
    ],
  },
  {
    group: 'Other Platforms',
    stats: [
      { key: 'apple_playlists',  label: 'Apple Music Playlists',  path: a => a.playlists?.apple?.total },
      { key: 'apple_editorial',  label: 'Apple Editorial',        path: a => a.playlists?.apple?.editorial },
      { key: 'deezer_playlists', label: 'Deezer Playlists',       path: a => a.playlists?.deezer?.total },
      { key: 'amazon_playlists', label: 'Amazon Playlists',       path: a => a.playlists?.amazon?.total },
    ],
  },
];

function getStatDisplay(artist, stat) {
  const raw = stat.path(artist);
  if (raw == null || raw === 0) return null;
  if (stat.fmt) return stat.fmt(raw);
  return formatNumber(raw);
}

const ALL_STATS_FLAT = STAT_GROUPS.flatMap(g => g.stats);

const DEFAULT_SLOTS = [
  { type: 'stat', key: 'sp_listeners' },
  { type: 'stat', key: 'sp_followers' },
  { type: 'stat', key: 'ig_followers' },
  { type: 'stat', key: 'tt_followers' },
];

export default function SocialPostModal({ artistSlug, accentColor = '#DA7756', onClose }) {
  const artist = getArtist(artistSlug);
  const cardRef = useRef(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);

  const primaryGenre = artist?.genres?.primary?.name || '';

  const availableStats = ALL_STATS_FLAT.filter(s => {
    const v = s.path(artist);
    return v != null && v !== 0;
  });

  const enabledStatKeys = new Set(slots.filter(s => s.type === 'stat').map(s => s.key));

  const visibleStats = slots.map(slot => {
    if (slot.type === 'custom') {
      if (!slot.value && !slot.label) return null;
      return { label: slot.label || '', value: slot.value || '' };
    }
    const def = ALL_STATS_FLAT.find(s => s.key === slot.key);
    if (!def) return null;
    const val = getStatDisplay(artist, def);
    if (!val) return null;
    return { label: def.label, value: val };
  }).filter(Boolean);

  const addStat = (key) => {
    if (!key || slots.length >= 4 || enabledStatKeys.has(key)) return;
    setSlots(prev => [...prev, { type: 'stat', key }]);
  };

  const addCustomSlot = () => {
    if (slots.length >= 4) return;
    setSlots(prev => [...prev, { type: 'custom', value: '', label: '' }]);
  };

  const updateCustomSlot = (index, field, value) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeSlot = (index) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
  };

  const generateImage = useCallback(async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        width: 1080,
        height: 1080,
        skipFonts: true,
      });
      setImageUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setGenerating(false);
    }
  }, [generating]);

  const slotsKey = JSON.stringify(slots);
  useEffect(() => {
    if (artist) {
      setImageUrl(null);
      const timer = setTimeout(generateImage, 400);
      return () => clearTimeout(timer);
    }
  }, [artist, slotsKey]);

  const handleDownload = useCallback(() => {
    if (!imageUrl || !artist) return;
    const link = document.createElement('a');
    link.download = `${artist.name.replace(/\s+/g, '_')}_Prelude.png`;
    link.href = imageUrl;
    link.click();
  }, [imageUrl, artist]);

  const handleCopyImage = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2000);
    } catch {
      handleDownload();
    }
  }, [imageUrl, handleDownload]);

  if (!artist) return null;

  const gridCols = visibleStats.length >= 2 ? '1fr 1fr' : '1fr';
  const atMax = slots.length >= 4;

  // Stats available in the dropdown (have data + not already added)
  const dropdownOptions = availableStats.filter(s => !enabledStatKeys.has(s.key));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2C2B28]">
            <div className="flex items-center gap-2">
              <Image size={14} className="text-[#DA7756]" />
              <span className="text-[13px] font-medium text-[#F5F0E8]">Social Post</span>
            </div>
            <button onClick={onClose} className="p-1 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex gap-5 p-5">
            {/* Left — Preview */}
            <div className="flex-1 min-w-0">
              <div className="rounded-lg overflow-hidden border border-[#2C2B28]">
                {imageUrl ? (
                  <img src={imageUrl} alt="Social post preview" className="w-full" />
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-[#0D0C0B]">
                    <span className="text-xs text-[#6B6560]">{generating ? 'Generating...' : 'Loading...'}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleDownload}
                  disabled={!imageUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors disabled:opacity-30"
                  style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  <Download size={12} /> Download
                </button>
                <button
                  onClick={handleCopyImage}
                  disabled={!imageUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors disabled:opacity-30 border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8]"
                >
                  {imageCopied ? <Check size={12} className="text-[#7BAF73]" /> : <Copy size={12} />}
                  {imageCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Right — Controls */}
            <div className="w-64 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[#6B6560]">Boxes</span>
                <span className="text-[11px] text-[#6B6560]">{slots.length}/4</span>
              </div>

              {/* Active slots */}
              <div className="space-y-1.5">
                {slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1.5">
                    {slot.type === 'stat' ? (
                      <span className="flex-1 text-xs text-[#9B9590] truncate">
                        {ALL_STATS_FLAT.find(s => s.key === slot.key)?.label}
                      </span>
                    ) : (
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          value={slot.value}
                          onChange={(e) => updateCustomSlot(i, 'value', e.target.value)}
                          placeholder="Value"
                          className="w-full bg-transparent text-xs text-[#F5F0E8] placeholder-[#4A4845] outline-none"
                        />
                        <input
                          type="text"
                          value={slot.label}
                          onChange={(e) => updateCustomSlot(i, 'label', e.target.value)}
                          placeholder="Label"
                          className="w-full bg-transparent text-[11px] text-[#6B6560] placeholder-[#4A4845] outline-none"
                        />
                      </div>
                    )}
                    <button onClick={() => removeSlot(i)} className="p-0.5 text-[#4A4845] hover:text-[#C75F4F] cursor-pointer transition-colors shrink-0">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add actions */}
              {!atMax && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) => { addStat(e.target.value); e.target.value = ''; }}
                      className="w-full appearance-none bg-[#0D0C0B] border border-[#2C2B28] rounded px-2.5 py-2 text-xs text-[#6B6560] outline-none cursor-pointer hover:border-[#4A4845] transition-colors"
                    >
                      <option value="" disabled>Add data...</option>
                      {STAT_GROUPS.map(group => {
                        const opts = group.stats.filter(s =>
                          !enabledStatKeys.has(s.key) && availableStats.some(a => a.key === s.key)
                        );
                        if (opts.length === 0) return null;
                        return (
                          <optgroup key={group.group} label={group.group}>
                            {opts.map(s => (
                              <option key={s.key} value={s.key}>
                                {s.label} ({getStatDisplay(artist, s)})
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A4845] pointer-events-none" />
                  </div>
                  <button
                    onClick={addCustomSlot}
                    className="flex items-center gap-1.5 w-full px-2.5 py-2 text-xs rounded border border-dashed border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590] hover:border-[#4A4845] cursor-pointer transition-colors"
                  >
                    <Plus size={10} />
                    Custom box
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Hidden card for rendering */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={cardRef}
            style={{
              width: 1080,
              height: 1080,
              position: 'relative',
              overflow: 'hidden',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {artist.imageUrl && (
              <img
                src={artist.imageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                }}
              />
            )}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.1) 100%)',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: 72,
            }}>
              {primaryGenre && (
                <div style={{
                  display: 'inline-block',
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: accentColor,
                  marginBottom: 16,
                }}>
                  {primaryGenre}
                </div>
              )}
              <div style={{
                fontSize: 72,
                fontWeight: 300,
                color: '#F5F0E8',
                lineHeight: 1.1,
                marginBottom: visibleStats.length > 0 ? 48 : 0,
                letterSpacing: '-0.02em',
              }}>
                {artist.name}
              </div>
              {visibleStats.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: 24,
                }}>
                  {visibleStats.map((s, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      padding: '20px 24px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{
                        fontSize: 36,
                        fontWeight: 300,
                        color: '#F5F0E8',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                      }}>
                        {s.value}
                      </div>
                      <div style={{
                        fontSize: 14,
                        color: 'rgba(245,240,232,0.5)',
                        marginTop: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{
              position: 'absolute',
              top: 48,
              right: 52,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 8,
              padding: '8px 14px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: `${accentColor}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: accentColor,
                fontFamily: 'monospace',
              }}>
                C
              </div>
              <span style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#F5F0E8',
              }}>
                Prelude
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
