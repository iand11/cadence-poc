import { useEffect, useRef, useState } from 'react';
import { Image, Upload, X, ChevronLeft, ChevronRight, Loader2, GripVertical } from 'lucide-react';
import { uploadAdImage } from '../../data/metaAds';

export const MAX_AD_IMAGES = 10;
const MAX_SIDE = 1440;

/** Downscale to at most 1440px on the long side and re-encode as JPEG so uploads stay small. */
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} isn't an image we can read.`)); };
    img.src = url;
  });
}

/**
 * Upload one or more images for a new ad and set their order. One image makes a
 * single-image ad; 2–10 make a carousel shown in this order.
 */
export default function AdImagesField({ images, onChange, fallbackImage }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  // Uploads finish one by one; append each to the newest list, not the one at start
  const latest = useRef(images);
  useEffect(() => { latest.current = images; }, [images]);

  const addFiles = async (fileList) => {
    setError(null);
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    const room = MAX_AD_IMAGES - latest.current.length - uploading;
    if (!files.length) return;
    if (room <= 0) { setError(`An Instagram carousel can have at most ${MAX_AD_IMAGES} images.`); return; }
    if (files.length > room) setError(`Only the first ${room} added: a carousel can have at most ${MAX_AD_IMAGES} images.`);
    const batch = files.slice(0, room);
    setUploading(n => n + batch.length);
    for (const file of batch) {
      try {
        const prepared = await prepareImage(file);
        const { url } = await uploadAdImage(prepared);
        latest.current = [...latest.current, url];
        onChange(latest.current);
      } catch (e) {
        setError(e.message);
      } finally {
        setUploading(n => n - 1);
      }
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (i) => onChange(images.filter((_, j) => j !== i));

  return (
    <div>
      <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">
        <span className="flex items-center gap-1">
          <Image size={9} /> Images
          <span className="text-[#6B6560]">
            {images.length > 1 ? `· carousel of ${images.length}, shown in this order` : '· add 2 or more for a carousel'}
          </span>
        </span>
      </label>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {images.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
              onDragEnd={() => setDragIndex(null)}
              className={`relative group rounded border bg-[#171614] overflow-hidden cursor-grab ${dragIndex === i ? 'border-[#DA7756] opacity-60' : 'border-[#2C2B28]'}`}
            >
              <img src={url} alt={`Image ${i + 1}`} className="w-full aspect-square object-cover pointer-events-none" />
              <span className="absolute top-1 left-1 text-[9px] font-mono bg-[#0D0C0B]/80 text-[#F5F0E8] rounded px-1">
                {i + 1}{i === 0 && images.length > 1 ? ' · first' : ''}
              </span>
              <button
                onClick={() => remove(i)}
                title="Remove"
                className="absolute top-1 right-1 p-0.5 rounded bg-[#0D0C0B]/80 text-[#9B9590] hover:text-[#C75F4F] cursor-pointer"
              >
                <X size={10} />
              </button>
              {images.length > 1 && (
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-[#0D0C0B]/80 px-1 py-0.5">
                  <button onClick={() => move(i, i - 1)} disabled={i === 0} title="Move earlier"
                    className="text-[#9B9590] hover:text-[#F5F0E8] disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    <ChevronLeft size={12} />
                  </button>
                  <GripVertical size={10} className="text-[#6B6560]" />
                  <button onClick={() => move(i, i + 1)} disabled={i === images.length - 1} title="Move later"
                    className="text-[#9B9590] hover:text-[#F5F0E8] disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length + uploading < MAX_AD_IMAGES && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDropActive(true); } }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); setDropActive(false); addFiles(e.dataTransfer.files); } }}
          className={`flex items-center justify-center gap-2 py-3 rounded border border-dashed cursor-pointer transition-colors ${
            dropActive ? 'border-[#DA7756] bg-[#DA7756]/10' : 'border-[#2C2B28] hover:border-[#3D3B37]'
          }`}
        >
          {uploading > 0
            ? <><Loader2 size={12} className="animate-spin text-[#9B9590]" /><span className="text-[10px] text-[#9B9590]">Uploading {uploading}…</span></>
            : <><Upload size={12} className="text-[#9B9590]" /><span className="text-[10px] text-[#9B9590]">{images.length ? 'Add more images' : 'Upload images'} · JPG, PNG or WebP · drop or click</span></>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      {!images.length && fallbackImage && (
        <button onClick={() => onChange([fallbackImage])} className="text-[9px] text-[#DA7756] hover:text-[#DA7756]/80 mt-1 cursor-pointer">
          Use artist image
        </button>
      )}
      {error && <p className="text-[9px] text-[#C75F4F] mt-1">{error}</p>}
      {images.length > 1 && <p className="text-[8px] text-[#6B6560] mt-1">Drag or use the arrows to reorder.</p>}
    </div>
  );
}
