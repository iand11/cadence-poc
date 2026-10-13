import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Music, Play, Pause, RotateCcw, Upload, Loader2, Check, Image as ImageIcon } from 'lucide-react';

// Lyric video maker for new TikTok/YouTube posts: the user uploads the song (Spotify doesn't
// give apps audio), picks a 15–30s section, pastes that section's lyrics and taps along to time
// each line. The video is drawn on a canvas (artist image, slow zoom, current line) and recorded
// in the browser with MediaRecorder, so nothing is uploaded or rendered on a server.

const W = 540;
const H = 960;
const FPS = 30;
const LENGTHS = [15, 30];

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const inputCls = 'w-full bg-[#171614] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-3 py-2 text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none';
const primaryBtn = 'flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer disabled:cursor-default';
const secondaryBtn = 'flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium text-[#9B9590] border border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] rounded transition-colors cursor-pointer';

function pickMimeType() {
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return types.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

// Images from other origins taint the canvas unless they're served with CORS; fall back to none
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws one frame at t seconds into the clip. */
function drawLyricFrame(ctx, t, { image, lines, times, length, artistName, songTitle }) {
  ctx.fillStyle = '#0D0C0B';
  ctx.fillRect(0, 0, W, H);

  if (image) {
    // Cover-fit with a slow zoom across the clip
    const zoom = 1 + 0.12 * Math.min(1, t / length);
    const scale = Math.max(W / image.width, H / image.height) * zoom;
    const iw = image.width * scale;
    const ih = image.height * scale;
    ctx.drawImage(image, (W - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#3A2118');
    g.addColorStop(1, '#0D0C0B');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.35)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  shade.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Current line: the last one whose start time has passed
  let current = -1;
  times.forEach((s, i) => { if (s != null && s <= t) current = i; });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (current >= 0) {
    const since = t - times[current];
    const fade = Math.min(1, since / 0.25);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#F5F0E8';
    ctx.font = '700 46px Epilogue, system-ui, sans-serif';
    const rows = wrap(ctx, lines[current], W - 80);
    const lineH = 58;
    const top = H / 2 - ((rows.length - 1) * lineH) / 2 + (1 - fade) * 16;
    rows.forEach((r, i) => ctx.fillText(r, W / 2, top + i * lineH));
    ctx.globalAlpha = 1;

    const next = lines[current + 1];
    if (next) {
      ctx.fillStyle = 'rgba(245,240,232,0.4)';
      ctx.font = '500 24px Epilogue, system-ui, sans-serif';
      wrap(ctx, next, W - 120).slice(0, 2).forEach((r, i) => ctx.fillText(r, W / 2, top + rows.length * lineH + 24 + i * 32));
    }
  }

  // Song + artist at the bottom, progress at the top
  ctx.fillStyle = '#F5F0E8';
  ctx.font = '600 26px Epilogue, system-ui, sans-serif';
  if (songTitle) ctx.fillText(songTitle, W / 2, H - 110);
  ctx.fillStyle = 'rgba(245,240,232,0.7)';
  ctx.font = '400 20px Epilogue, system-ui, sans-serif';
  if (artistName) ctx.fillText(artistName, W / 2, H - 76);
  ctx.fillStyle = 'rgba(245,240,232,0.2)';
  ctx.fillRect(40, 40, W - 80, 4);
  ctx.fillStyle = '#DA7756';
  ctx.fillRect(40, 40, (W - 80) * Math.min(1, t / length), 4);
}

export default function LyricVideoMaker({ artist, onDone, onClose }) {
  const [stage, setStage] = useState('setup'); // setup → sync → preview
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(15);
  const [lyrics, setLyrics] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [bgUrl, setBgUrl] = useState(artist?.imageUrl || null);
  const [image, setImage] = useState(null);
  const [times, setTimes] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const syncIndex = useRef(0);

  const lines = lyrics.split('\n').map(l => l.trim()).filter(Boolean);
  const clipLength = Math.min(length, Math.max(1, duration - start) || length);
  const frame = { image, lines, times, length: clipLength, artistName: artist?.name, songTitle: songTitle.trim() };
  const frameRef = useRef(frame);
  useEffect(() => { frameRef.current = frame; });

  useEffect(() => { loadImage(bgUrl).then(setImage); }, [bgUrl]);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  // Keep the preview canvas showing the current frame while paused
  useEffect(() => {
    if (stage !== 'preview' || playing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawLyricFrame(ctx, clock, frameRef.current);
  });

  const chooseAudio = (file) => {
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setStart(0);
    if (!songTitle) setSongTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  // Plays the clip from `from` seconds into it; onTick gets the clip time each frame
  const playClip = useCallback(async (from = 0, onTick) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start + from;
    await audio.play();
    setPlaying(true);
    const tick = () => {
      const t = audio.currentTime - start;
      if (t >= clipLength || audio.ended) { stop(); setClock(0); onTick?.(clipLength, true); return; }
      setClock(t);
      onTick?.(t, false);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [start, clipLength, stop]);

  const startSync = () => {
    setTimes(lines.map(() => null));
    syncIndex.current = 0;
    setStage('sync');
    playClip(0, (t, done) => { if (done) setStage('preview'); });
  };

  const tap = useCallback(() => {
    const i = syncIndex.current;
    if (i >= lines.length) return;
    const t = Math.max(0, (audioRef.current?.currentTime || 0) - start);
    setTimes(prev => { const next = [...prev]; next[i] = t; return next; });
    syncIndex.current = i + 1;
  }, [lines.length, start]);

  useEffect(() => {
    if (stage !== 'sync') return;
    const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, tap]);

  const preview = () => {
    if (playing) { stop(); return; }
    playClip(0, (t) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawLyricFrame(ctx, t, frameRef.current);
    });
  };

  // Records the canvas + the song section in real time
  const exportVideo = async () => {
    stop();
    setExporting(true);
    setProgress(0);
    setError(null);
    let audioCtx;
    try {
      const mimeType = pickMimeType();
      if (!mimeType) throw new Error('This browser cannot record video. Try Chrome.');
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      drawLyricFrame(ctx, 0, frameRef.current);

      const el = new Audio(audioUrl);
      el.preload = 'auto';
      await new Promise((res, rej) => { el.oncanplay = res; el.onerror = () => rej(new Error('Could not read the audio file.')); });
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaElementSource(el).connect(dest);

      const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 128_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(res => { recorder.onstop = res; });

      el.currentTime = start;
      await new Promise(res => { el.onseeked = res; });
      recorder.start(250);
      await el.play();
      await new Promise((res) => {
        const tick = () => {
          const t = el.currentTime - start;
          drawLyricFrame(ctx, Math.min(t, clipLength), frameRef.current);
          setProgress(Math.min(1, t / clipLength));
          if (t >= clipLength || el.ended) return res();
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
      el.pause();
      recorder.stop();
      await stopped;

      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const base = (songTitle.trim() || 'lyric-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      onDone(new File(chunks, `${base || 'lyric-video'}-lyrics.${ext}`, { type: mimeType.split(';')[0] }));
    } catch (e) {
      setError(e.message || 'Could not make the video.');
    } finally {
      audioCtx?.close();
      setExporting(false);
    }
  };

  const synced = times.length === lines.length && times.every(t => t != null);
  const canSync = !!audioFile && duration > 0 && lines.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={exporting ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2C2B28]">
          <div>
            <p className="text-sm font-medium text-[#F5F0E8]">Make a lyric video</p>
            <p className="text-[10px] text-[#6B6560]">
              {stage === 'setup' ? 'Song, section and lyrics' : stage === 'sync' ? 'Tap as each line starts' : 'Preview and export'}
            </p>
          </div>
          {!exporting && (
            <button onClick={onClose} className="p-1 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer"><X size={14} /></button>
          )}
        </div>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
            className="hidden"
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stage === 'setup' && (
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Song</label>
                {audioFile ? (
                  <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2">
                    <Music size={12} className="text-[#DA7756] shrink-0" />
                    <span className="text-xs text-[#F5F0E8] truncate flex-1">{audioFile.name}</span>
                    <span className="text-[9px] font-mono text-[#6B6560]">{duration ? fmt(duration) : ''}</span>
                    <label className="text-[10px] text-[#DA7756] hover:underline cursor-pointer">
                      Change<input type="file" accept="audio/*" className="hidden" onChange={e => chooseAudio(e.target.files?.[0])} />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 bg-[#0D0C0B] border border-dashed border-[#2C2B28] hover:border-[#3D3B37] rounded px-3 py-4 cursor-pointer">
                    <Upload size={12} className="text-[#6B6560]" />
                    <span className="text-[10px] text-[#9B9590]">Upload the song (MP3, WAV or M4A)</span>
                    <input type="file" accept="audio/*" className="hidden" onChange={e => chooseAudio(e.target.files?.[0])} />
                  </label>
                )}
              </div>

              {audioFile && duration > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-mono text-[#9B9590]">Section · starts at {fmt(start)}</label>
                    <div className="flex gap-1">
                      {LENGTHS.map(l => (
                        <button key={l} onClick={() => setLength(l)} className={`px-2 py-0.5 text-[9px] font-mono rounded border cursor-pointer ${length === l ? 'border-[#DA7756]/60 text-[#DA7756]' : 'border-[#2C2B28] text-[#9B9590]'}`}>{l}s</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => (playing ? stop() : playClip(0))} className="p-1.5 rounded bg-[#0D0C0B] border border-[#2C2B28] text-[#F5F0E8] cursor-pointer" title={playing ? 'Pause' : 'Play section'}>
                      {playing ? <Pause size={11} /> : <Play size={11} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, Math.floor(duration - length))}
                      value={start}
                      onChange={e => { stop(); setStart(Number(e.target.value)); }}
                      className="flex-1 accent-[#DA7756] cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-[#6B6560] w-20 text-right">{fmt(start)}–{fmt(start + clipLength)}</span>
                  </div>
                  <p className="text-[9px] text-[#6B6560] mt-1">Pick the hook or chorus. Press play to hear the section.</p>
                </div>
              )}

              <div>
                <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Lyrics for this section · one line per row</label>
                <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={5} placeholder={'I keep the light on in the glasshouse\nEvery window open wide…'} className={`${inputCls} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Song title</label>
                  <input value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="Glasshouse" className={inputCls} />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#9B9590] mb-1 block">Background</label>
                  <label className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] hover:border-[#3D3B37] rounded px-2 py-1.5 cursor-pointer">
                    {bgUrl ? <img src={bgUrl} alt="" className="w-6 h-6 rounded object-cover" /> : <ImageIcon size={12} className="text-[#6B6560]" />}
                    <span className="text-[10px] text-[#9B9590] truncate">{bgUrl === artist?.imageUrl ? 'Artist photo · change' : 'Change image'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBgUrl(URL.createObjectURL(f)); }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {stage === 'sync' && (
            <div>
              <div className="h-1 bg-[#2C2B28] rounded-full overflow-hidden mb-4">
                <div className="h-full bg-[#DA7756]" style={{ width: `${(clock / clipLength) * 100}%` }} />
              </div>
              <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
                {lines.map((l, i) => {
                  const next = times.findIndex(t => t == null);
                  const isNext = i === (next === -1 ? lines.length : next);
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${isNext ? 'bg-[#DA7756]/10 border border-[#DA7756]/40 text-[#F5F0E8]' : times[i] != null ? 'text-[#9B9590]' : 'text-[#6B6560]'}`}>
                      <span className="font-mono text-[9px] w-8 shrink-0">{times[i] != null ? fmt(times[i]) : ''}</span>
                      <span className="truncate">{l}</span>
                      {times[i] != null && <Check size={10} className="ml-auto text-[#7BAF73] shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <button onClick={tap} disabled={times.every(t => t != null)} className="w-full py-5 rounded-lg bg-[#DA7756] text-[#0D0C0B] text-sm font-medium hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] cursor-pointer">
                {times.every(t => t != null) ? 'All lines timed' : 'Tap when the highlighted line starts'}
              </button>
              <p className="text-[9px] text-[#6B6560] text-center mt-2">Or press the space bar.</p>
            </div>
          )}

          {stage === 'preview' && (
            <div className="flex gap-4">
              <canvas ref={canvasRef} width={W} height={H} className="w-[216px] h-[384px] rounded-lg border border-[#2C2B28] shrink-0" />
              <div className="flex-1 min-w-0 space-y-3">
                <button onClick={preview} disabled={exporting} className={secondaryBtn}>
                  {playing ? <Pause size={11} /> : <Play size={11} />}{playing ? 'Pause' : 'Play preview'}
                </button>
                <button onClick={startSync} disabled={exporting} className={secondaryBtn}>
                  <RotateCcw size={11} />Retime lyrics
                </button>
                {!synced && <p className="text-[10px] text-[#D4A574]">Some lines weren't timed and won't show. Retime to include them.</p>}
                <p className="text-[10px] text-[#6B6560]">9:16 · {clipLength}s · the song section plays under the lyrics.</p>
                {exporting && (
                  <div>
                    <div className="h-1 bg-[#2C2B28] rounded-full overflow-hidden">
                      <div className="h-full bg-[#DA7756]" style={{ width: `${progress * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-[#6B6560] mt-1">Recording the video in real time…</p>
                  </div>
                )}
                {error && <p className="text-[10px] text-[#C75F4F]">{error}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2C2B28]">
          <button onClick={stage === 'setup' ? onClose : () => { stop(); setStage('setup'); }} disabled={exporting} className="text-[10px] text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
            {stage === 'setup' ? 'Cancel' : 'Back'}
          </button>
          {stage === 'setup' && (
            <button onClick={startSync} disabled={!canSync} className={primaryBtn}>Time the lyrics</button>
          )}
          {stage === 'sync' && (
            <button onClick={() => { stop(); setStage('preview'); }} className={primaryBtn}>Done timing</button>
          )}
          {stage === 'preview' && (
            <button onClick={exportVideo} disabled={exporting || !times.some(t => t != null)} className={primaryBtn}>
              {exporting ? <><Loader2 size={12} className="animate-spin" />Making video…</> : 'Use this video'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
