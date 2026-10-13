import { useState } from 'react';
import { FileVideo, Upload, X, Sparkles } from 'lucide-react';
import { uploadAdVideo } from '../../data/metaAds';
import LyricVideoMaker from './LyricVideoMaker';

// Video for a new Meta ad: an uploaded file or a lyric video made in the browser. It goes
// to /api/ad-videos in chunks as soon as it's chosen; `value` is { url, name, size }.

const MAX_BYTES = 100 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export default function AdVideoField({ value, onChange, artist }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [making, setMaking] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setError(null);
    const type = (file.type || '').split(';')[0];
    if (type && !TYPES.includes(type)) return setError('Use an MP4, MOV or WebM video.');
    if (file.size > MAX_BYTES) return setError('That video is too large. Use one under 100 MB.');
    setProgress(0);
    try {
      const { url } = await uploadAdVideo(file, setProgress);
      setPreview(URL.createObjectURL(file));
      onChange({ url, name: file.name, size: file.size });
    } catch (e) {
      setError(e.message || 'Upload failed. Try again.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 flex items-center gap-1">
        <FileVideo size={9} /> Video <span className="text-[#6B6560]">· vertical 9:16 works best</span>
      </label>
      {value ? (
        <div className="flex items-center gap-3 bg-[#171614] border border-[#2C2B28] rounded p-2">
          <video src={preview || value.url} muted playsInline className="w-12 h-20 rounded object-cover bg-black shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#F5F0E8] truncate">{value.name}</p>
            <p className="text-[9px] font-mono text-[#6B6560]">{(value.size / (1024 * 1024)).toFixed(1)} MB · uploaded</p>
          </div>
          <button onClick={() => { onChange(null); setPreview(null); }} className="p-1 text-[#6B6560] hover:text-[#C75F4F] cursor-pointer" title="Remove video">
            <X size={12} />
          </button>
        </div>
      ) : progress !== null ? (
        <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-3">
          <div className="h-1 bg-[#2C2B28] rounded-full overflow-hidden">
            <div className="h-full bg-[#DA7756] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-[9px] text-[#6B6560] mt-1.5">Uploading… {Math.round(progress * 100)}%</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center justify-center gap-2 bg-[#0D0C0B] border border-dashed border-[#2C2B28] hover:border-[#3D3B37] rounded px-3 py-3 cursor-pointer transition-colors">
            <Upload size={12} className="text-[#6B6560]" />
            <span className="text-[10px] text-[#6B6560]">Upload a video · MP4 or MOV</span>
            <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e => upload(e.target.files?.[0])} className="hidden" />
          </label>
          <button onClick={() => setMaking(true)} className="w-full flex items-center gap-2 rounded-lg border border-[#DA7756]/40 bg-[#DA7756]/[0.07] hover:border-[#DA7756]/70 px-3 py-2.5 text-left cursor-pointer transition-colors">
            <Sparkles size={12} className="text-[#DA7756] shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-[#F5F0E8] font-medium">No video? Make a lyric video</span>
              <span className="block text-[10px] text-[#9B9590]">Upload the song, paste the lyrics and tap along. Ready in about a minute.</span>
            </span>
          </button>
        </div>
      )}
      {error && <p className="text-[9px] text-[#C75F4F] mt-1">{error}</p>}
      {making && (
        <LyricVideoMaker
          artist={artist}
          onClose={() => setMaking(false)}
          onDone={(file) => { setMaking(false); upload(file); }}
        />
      )}
    </div>
  );
}
