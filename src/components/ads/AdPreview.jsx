import { useEffect, useState } from 'react';
import {
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronRight, ChevronLeft,
  Music2, Share2, Plus, Play, ExternalLink,
} from 'lucide-react';

// Approximate in-app look of each platform's ad, for the builder's Review step.
// Not pixel-exact: enough to check the image order, crop, copy and button.

const handleFor = (name) => String(name || 'artist').toLowerCase().replace(/[^a-z0-9._]/g, '');
const domainOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

function Avatar({ src, size = 28, ring }) {
  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 bg-[#3a3a3a] ${ring ? 'p-[2px] bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' : ''}`}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full rounded-full bg-[#555]" />}
    </div>
  );
}

function Media({ media, index, aspect, className = '' }) {
  const item = media[index];
  if (!item) {
    return (
      <div className={`w-full ${aspect} bg-[#262626] flex items-center justify-center ${className}`}>
        <span className="text-[10px] text-[#8e8e8e]">No image yet</span>
      </div>
    );
  }
  if (item.type === 'video') {
    return <video src={item.url} className={`w-full ${aspect} object-cover bg-black ${className}`} muted autoPlay loop playsInline />;
  }
  return <img src={item.url} alt="" className={`w-full ${aspect} object-cover ${className}`} />;
}

function InstagramPreview({ handle, avatar, media, headline, description, cta, destination }) {
  const [index, setIndex] = useState(0);
  const count = media.length;
  return (
    <div className="w-[300px] bg-black text-white rounded-xl overflow-hidden border border-[#262626] font-sans">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar src={avatar} size={30} ring />
        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-[12px] font-semibold truncate">{handle}</p>
          <p className="text-[10px] text-[#a8a8a8]">Sponsored</p>
        </div>
        <MoreHorizontal size={16} />
      </div>
      <div className="relative">
        <Media media={media} index={index} aspect="aspect-square" />
        {count > 1 && (
          <>
            <span className="absolute top-2 right-2 text-[10px] bg-black/60 rounded-full px-2 py-0.5">{index + 1}/{count}</span>
            {index > 0 && (
              <button onClick={() => setIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 text-black flex items-center justify-center cursor-pointer">
                <ChevronLeft size={14} />
              </button>
            )}
            {index < count - 1 && (
              <button onClick={() => setIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 text-black flex items-center justify-center cursor-pointer">
                <ChevronRight size={14} />
              </button>
            )}
          </>
        )}
      </div>
      {cta && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#0095f6] text-white">
          <span className="text-[12px] font-semibold">{cta}</span>
          <ChevronRight size={14} />
        </div>
      )}
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart size={20} /><MessageCircle size={20} /><Send size={20} />
        {count > 1 && (
          <div className="flex-1 flex justify-center gap-1">
            {media.map((m, i) => <span key={m.url} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-[#0095f6]' : 'bg-[#555]'}`} />)}
          </div>
        )}
        <Bookmark size={20} className="ml-auto" />
      </div>
      <div className="px-3 pt-2 pb-3 text-[12px] leading-snug space-y-0.5">
        {headline && <p className="font-semibold">{headline}</p>}
        <p><span className="font-semibold mr-1">{handle}</span>{description || <span className="text-[#a8a8a8]">No caption</span>}</p>
        {destination && <p className="text-[10px] text-[#a8a8a8]">{destination}</p>}
      </div>
    </div>
  );
}

function TikTokPreview({ handle, avatar, media, headline, description, cta, artistName }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (media.length < 2) return undefined;
    const t = setInterval(() => setIndex(i => (i + 1) % media.length), 2500);
    return () => clearInterval(t);
  }, [media.length]);
  return (
    <div className="relative w-[260px] aspect-[9/16] bg-black text-white rounded-xl overflow-hidden border border-[#262626] font-sans">
      <Media media={media} index={Math.min(index, Math.max(media.length - 1, 0))} aspect="h-full" className="absolute inset-0 h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      <div className="absolute top-3 inset-x-0 flex justify-center gap-4 text-[12px] font-semibold">
        <span className="text-white/60">Following</span><span className="border-b-2 border-white pb-0.5">For You</span>
      </div>
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 text-[10px]">
        <div className="relative">
          <Avatar src={avatar} size={40} />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#fe2c55] flex items-center justify-center"><Plus size={10} /></span>
        </div>
        <div className="flex flex-col items-center"><Heart size={24} fill="white" /><span>12.4K</span></div>
        <div className="flex flex-col items-center"><MessageCircle size={24} /><span>318</span></div>
        <div className="flex flex-col items-center"><Bookmark size={22} /><span>906</span></div>
        <div className="flex flex-col items-center"><Share2 size={22} /><span>Share</span></div>
      </div>
      <div className="absolute left-3 right-14 bottom-3 space-y-1.5">
        <p className="text-[13px] font-semibold">@{handle}</p>
        <p className="text-[11px] leading-snug line-clamp-3">{description || headline || <span className="text-white/60">No caption</span>}</p>
        <p className="text-[10px] text-white/80">Sponsored</p>
        <p className="flex items-center gap-1 text-[10px] text-white/90"><Music2 size={10} /> Promoted music · {artistName}</p>
        {cta && <div className="w-full text-center text-[12px] font-semibold bg-[#fe2c55] rounded py-1.5">{cta}</div>}
      </div>
    </div>
  );
}

function YouTubePreview({ handle, avatar, media, headline, description, cta, destination }) {
  return (
    <div className="w-[320px] bg-[#0f0f0f] text-white rounded-xl overflow-hidden border border-[#262626] font-sans">
      <div className="relative">
        <Media media={media} index={0} aspect="aspect-video" />
        {media[0]?.type !== 'video' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-12 h-8 rounded-lg bg-[#ff0000] flex items-center justify-center"><Play size={16} fill="white" /></span>
          </span>
        )}
        <span className="absolute left-2 bottom-2 text-[10px] font-semibold bg-[#f2c94c] text-black rounded px-1.5 py-0.5">Ad · 0:15</span>
        <span className="absolute right-0 bottom-2 text-[11px] bg-black/70 border border-white/30 border-r-0 px-2.5 py-1 flex items-center gap-1">Skip <ChevronRight size={12} /></span>
      </div>
      <div className="flex gap-2.5 p-3">
        <Avatar src={avatar} size={34} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-snug line-clamp-2">{headline || 'Your headline'}</p>
          {description && <p className="text-[11px] text-[#aaa] line-clamp-1 mt-0.5">{description}</p>}
          <p className="text-[11px] text-[#aaa] mt-0.5">
            <span className="font-semibold text-white">Sponsored</span> · {destination || handle}
          </p>
        </div>
      </div>
      {cta && (
        <div className="px-3 pb-3">
          <div className="w-full flex items-center justify-center gap-1 text-[12px] font-medium bg-[#3ea6ff] text-[#0f0f0f] rounded-full py-2">
            {cta} <ExternalLink size={12} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * media: [{ url, type: 'image' | 'video' }] in display order.
 */
export default function AdPreview({ platform, username, artistName, avatar, media, headline, description, cta, trackUrl }) {
  const handle = username || handleFor(artistName);
  const props = { handle, avatar, media, headline, description, cta, destination: domainOf(trackUrl), artistName };
  return (
    <div className="flex flex-col items-center gap-2">
      {platform === 'tiktok' ? <TikTokPreview {...props} />
        : platform === 'youtube' ? <YouTubePreview {...props} />
        : <InstagramPreview key={media.map(m => m.url).join('|')} {...props} />}
      <p className="text-[9px] font-mono text-[#6B6560]">Preview · approximate look in the app</p>
    </div>
  );
}
