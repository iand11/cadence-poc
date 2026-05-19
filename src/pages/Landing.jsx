import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkles, Sheet, ArrowRight, Music, Play, ChevronDown, Palette, Download, Edit3, Link2, Eye, BarChart3, FileText, MessageSquare } from 'lucide-react';

// ── Static data ──────────────────────────────────────────────────────────────

const LOGOS = ['Spotify', 'Apple Music', 'YouTube', 'TikTok', 'Instagram', 'Shazam'];

// Pre-compute waveform bar values (deterministic)
const WAVE_BARS = Array.from({ length: 80 }).map((_, i) => {
  const rand = Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
  const h = 16 + Math.sin(i * 0.5) * 24 + rand * 30;
  const dur = 1.4 + (Math.abs(Math.sin(i * 73.3 + 157.9) * 43758.5453) % 1) * 1.2;
  return { h, dur };
});

// Pre-compute orbit dots
const ORBIT_DOTS = Array.from({ length: 12 }).map((_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const radius = 140 + (i % 3) * 40;
  const size = 2 + (i % 3) * 1.5;
  const dur = 20 + i * 3;
  const opacity = 0.15 + (i % 4) * 0.1;
  return { angle, radius, size, dur, opacity };
});

// Pre-compute floating particles
const PARTICLES = [
  { size: 6, x: '12%', y: '25%', dur: 4, delay: 0 },
  { size: 4, x: '78%', y: '20%', dur: 5, delay: 1 },
  { size: 8, x: '88%', y: '55%', dur: 3.5, delay: 0.5 },
  { size: 5, x: '8%', y: '65%', dur: 4.5, delay: 2 },
  { size: 3, x: '55%', y: '82%', dur: 5.5, delay: 1.5 },
  { size: 6, x: '35%', y: '12%', dur: 4, delay: 0.8 },
  { size: 4, x: '92%', y: '35%', dur: 3.8, delay: 1.2 },
  { size: 7, x: '22%', y: '85%', dur: 4.2, delay: 0.3 },
  { size: 3, x: '65%', y: '10%', dur: 5.2, delay: 2.1 },
  { size: 5, x: '45%', y: '72%', dur: 3.6, delay: 1.8 },
];

// Pre-compute marquee ticker items
const TICKER_ITEMS = [
  { artist: 'Drake', delta: '+12.4%', metric: 'Monthly Listeners' },
  { artist: 'Taylor Swift', delta: '+8.7%', metric: 'Spotify Followers' },
  { artist: 'Bad Bunny', delta: '+23.1%', metric: 'TikTok Growth' },
  { artist: 'SZA', delta: '+15.3%', metric: 'Playlist Reach' },
  { artist: 'The Weeknd', delta: '+9.8%', metric: 'Shazam Discoveries' },
  { artist: 'Billie Eilish', delta: '+18.6%', metric: 'Instagram Engagement' },
  { artist: 'Doja Cat', delta: '+31.2%', metric: 'TikTok Creations' },
  { artist: 'Metro Boomin', delta: '+14.5%', metric: 'Monthly Listeners' },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function Waveform({ bars = 60, className = '' }) {
  return (
    <div className={`flex items-end justify-center gap-[2px] ${className}`}>
      {WAVE_BARS.slice(0, bars).map((bar, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full origin-bottom"
          style={{ backgroundColor: `rgba(218, 119, 86, ${0.12 + (bar.h / 70) * 0.55})` }}
          initial={{ height: 2, opacity: 0 }}
          animate={{ height: [bar.h * 0.2, bar.h, bar.h * 0.4, bar.h * 0.9, bar.h * 0.2], opacity: 1 }}
          transition={{
            height: { duration: bar.dur, repeat: Infinity, repeatType: 'reverse', delay: i * 0.03, ease: 'easeInOut' },
            opacity: { duration: 0.5, delay: 0.8 + i * 0.015 },
          }}
        />
      ))}
    </div>
  );
}

function OrbitRing() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {/* Rings */}
      {[140, 180, 220].map((r, i) => (
        <motion.div
          key={r}
          className="absolute rounded-full border"
          style={{
            width: r * 2, height: r * 2,
            top: -r, left: -r,
            borderColor: `rgba(218,119,86,${0.04 + i * 0.015})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 40 + i * 15, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Dots */}
      {ORBIT_DOTS.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[#DA7756]"
          style={{
            width: dot.size, height: dot.size,
            top: -dot.size / 2, left: -dot.size / 2,
            opacity: dot.opacity,
          }}
          animate={{
            x: [Math.cos(dot.angle) * dot.radius, Math.cos(dot.angle + Math.PI) * dot.radius, Math.cos(dot.angle) * dot.radius],
            y: [Math.sin(dot.angle) * dot.radius, Math.sin(dot.angle + Math.PI) * dot.radius, Math.sin(dot.angle) * dot.radius],
          }}
          transition={{ duration: dot.dur, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // duplicate for seamless loop
  return (
    <div className="relative overflow-hidden py-3 border-y border-white/[0.03]">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-[#6B6560]">{item.artist}</span>
            <span className="text-[#7BAF73]">{item.delta}</span>
            <span className="text-[#3D3B37]">{item.metric}</span>
            <span className="text-[#2C2B28] mx-2">|</span>
          </span>
        ))}
      </motion.div>
      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0D0C0B] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0D0C0B] to-transparent pointer-events-none" />
    </div>
  );
}

const SHEET_COLOR_SWATCHES = [
  { hex: '#DA7756', label: 'Cadence' },
  { hex: '#4A90D9', label: 'Ocean' },
  { hex: '#7BAF73', label: 'Sage' },
  { hex: '#9B7ED8', label: 'Violet' },
  { hex: '#E8B960', label: 'Gold' },
  { hex: '#4ECDC4', label: 'Teal' },
];

const SHEET_CAPABILITIES = [
  { icon: Palette, label: 'Custom Colors', desc: 'Match any brand identity with accent and background presets' },
  { icon: Edit3, label: 'Editable Fields', desc: 'Click any text to override with your own copy' },
  { icon: Download, label: 'PDF Export', desc: 'One-click export to a polished, print-ready PDF' },
  { icon: Link2, label: 'Shareable Links', desc: 'Generate a public link anyone can view — no login needed' },
  { icon: Eye, label: 'Toggle Blocks', desc: 'Show or hide any section — overview, charts, tracks, geography' },
  { icon: Music, label: 'Spotify Embed', desc: 'Embed any Spotify artist, album, or track directly in the sheet' },
];

function MockArtistSheet() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 8 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative mx-auto max-w-5xl mt-4"
      style={{ perspective: 1200 }}
    >
      <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-[#171614] to-[#0D0C0B] p-1 shadow-2xl shadow-black/50">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#C75F4F]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#DA7756]/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#7BAF73]/40" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-12 py-1 rounded bg-[#0D0C0B] border border-white/[0.04] text-[9px] font-mono text-[#6B6560]">cadence.app/artist/billie-eilish/sheet</div>
          </div>
        </div>

        {/* Sheet content */}
        <div className="relative">
          {/* Toolbar strip */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.04] bg-[#0D0C0B]/50">
            <div className="flex items-center gap-1.5 text-[9px] text-[#9B9590]">
              <Edit3 size={10} className="text-[#DA7756]" />
              <span className="text-[#DA7756] font-medium">Editing</span>
            </div>
            <div className="flex gap-1 ml-3">
              {SHEET_COLOR_SWATCHES.map(s => (
                <motion.div
                  key={s.hex}
                  className="w-4 h-4 rounded-full border border-white/10 cursor-pointer"
                  style={{ backgroundColor: s.hex }}
                  whileHover={{ scale: 1.3, borderColor: 'rgba(255,255,255,0.4)' }}
                />
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#171614] border border-white/[0.04] text-[9px] text-[#9B9590]">
                <Link2 size={9} /> Share
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#DA7756]/20 border border-[#DA7756]/30 text-[9px] text-[#DA7756]">
                <Download size={9} /> PDF
              </div>
            </div>
          </div>

          {/* Hero banner with real artist image */}
          <div className="relative h-64 overflow-hidden">
            <img
              src="https://i.scdn.co/image/ab6761610000e5eb4a21b4760d2ecb7b0dcdc8da"
              alt="Billie Eilish"
              className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0D0C0B 0%, #0D0C0Bdd 30%, #0D0C0B66 60%, transparent 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
              <h3 className="text-3xl font-light tracking-tight text-[#F5F0E8] mb-1">Billie Eilish</h3>
              <p className="text-xs text-[#9B9590] tracking-wide">Alt-pop pioneer · Los Angeles, US · UMG</p>
            </div>
          </div>

          {/* KPI cards */}
          <div className="px-5 -mt-4 relative z-10">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Monthly Listeners', val: '84.0M', delta: 'Rank #11' },
                { label: 'Spotify Followers', val: '125.6M', delta: 'Rank #4' },
                { label: 'Shazam Count', val: '166.8M', delta: '' },
                { label: 'Instagram', val: '125.7M', delta: '' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg p-3" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
                  <div className="text-[8px] text-[#6B6560] uppercase tracking-wider mb-1">{kpi.label}</div>
                  <div className="text-base font-mono font-semibold text-[#F5F0E8]">{kpi.val}</div>
                  {kpi.delta && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1 h-1 rounded-full bg-[#7BAF73]" />
                      <span className="text-[9px] font-mono text-[#7BAF73]">{kpi.delta}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {/* Streaming chart mock */}
            <div className="rounded-lg p-4 h-36" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
              <div className="text-[9px] text-[#6B6560] uppercase tracking-wider mb-3">Streaming Trends</div>
              <div className="flex items-end justify-between h-20 gap-[3px]">
                {WAVE_BARS.slice(0, 40).map((bar, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{ backgroundColor: `rgba(218, 119, 86, ${0.2 + (bar.h / 70) * 0.5})` }}
                    initial={{ height: 0 }}
                    whileInView={{ height: bar.h * 0.7 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.01 }}
                  />
                ))}
              </div>
            </div>

            {/* Geography mock */}
            <div className="rounded-lg p-4 h-36" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
              <div className="text-[9px] text-[#6B6560] uppercase tracking-wider mb-3">Audience Geography</div>
              <div className="space-y-2 mt-2">
                {[
                  { city: 'Mexico City', pct: 82 },
                  { city: 'Jakarta', pct: 68 },
                  { city: 'London', pct: 61 },
                  { city: 'São Paulo', pct: 49 },
                ].map((row) => (
                  <div key={row.city} className="flex items-center gap-2">
                    <span className="text-[9px] text-[#9B9590] w-16 truncate">{row.city}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#0D0C0B] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#DA7756' }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${row.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#6B6560] w-8 text-right">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top tracks mock */}
          <div className="px-5 pb-5">
            <div className="rounded-lg p-4" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
              <div className="text-[9px] text-[#6B6560] uppercase tracking-wider mb-3">Top Tracks</div>
              {[
                { pos: 1, name: 'Birds of a Feather', streams: '2.9B', playlists: '52.1K' },
                { pos: 2, name: 'Lovely', streams: '2.8B', playlists: '44.3K' },
                { pos: 3, name: 'Bad Guy', streams: '2.5B', playlists: '39.7K' },
              ].map((t) => (
                <div key={t.pos} className="flex items-center gap-3 py-1.5 border-b border-white/[0.02] last:border-0">
                  <span className="text-[9px] font-mono text-[#6B6560] w-4 text-right">{t.pos}</span>
                  <div className="w-7 h-7 rounded bg-[#2C2B28] flex items-center justify-center">
                    <Music size={9} className="text-[#6B6560]" />
                  </div>
                  <span className="flex-1 text-[11px] text-[#F5F0E8] truncate">{t.name}</span>
                  <span className="text-[9px] font-mono text-[#9B9590]">{t.playlists}</span>
                  <span className="text-[9px] font-mono text-[#F5F0E8] w-12 text-right">{t.streams}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Reflection glow */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#DA7756]/[0.04] rounded-full blur-[40px]" />
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#F5F0E8] overflow-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0D0C0B]/50 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DA7756] to-[#C75F4F] flex items-center justify-center shadow-lg shadow-[#DA7756]/20">
              <span className="font-mono text-sm font-bold text-white">C</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">Cadence</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Link
              to="/app"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#DA7756] to-[#C75F4F] text-white text-xs font-semibold tracking-wide uppercase hover:shadow-lg hover:shadow-[#DA7756]/25 transition-all duration-300 hover:scale-[1.02]"
            >
              Launch App
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-14">
        {/* Animated background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Pulsing main glow */}
          <motion.div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(218,119,86,0.1) 0%, rgba(199,95,79,0.04) 35%, transparent 65%)' }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Drifting secondary glow */}
          <motion.div
            className="absolute top-[40%] left-[30%] w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(123,175,115,0.06) 0%, transparent 55%)' }}
            animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Third glow */}
          <motion.div
            className="absolute top-[20%] right-[15%] w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(74,144,217,0.04) 0%, transparent 60%)' }}
            animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(218,119,86,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(218,119,86,0.6) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          {/* Orbit rings */}
          <OrbitRing />
          {/* Particles */}
          {PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: p.size, height: p.size, left: p.x, top: p.y,
                background: 'radial-gradient(circle, rgba(218,119,86,0.4) 0%, transparent 70%)',
              }}
              animate={{ y: [0, -40, 0], opacity: [0, 0.7, 0], scale: [0.6, 1.4, 0.6] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <motion.div style={{ opacity: heroOpacity, scale: heroScale, y: heroY }} className="max-w-5xl mx-auto px-6 lg:px-10 text-center relative">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="mb-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#DA7756]/20 bg-[#DA7756]/[0.06] text-[10px] font-mono text-[#DA7756] uppercase tracking-widest">
              <motion.span className="w-2 h-2 rounded-full bg-[#7BAF73]" animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              Music Industry Intelligence Platform
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-display text-6xl sm:text-7xl lg:text-[5.5rem] font-light tracking-tight leading-[1.05] mb-8"
          >
            <motion.span
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Know your roster.
            </motion.span>
            <br />
            <motion.span
              className="text-gradient-signal"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Move faster.
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-lg sm:text-xl text-[#9B9590] max-w-2xl mx-auto leading-relaxed mb-12"
          >
            Branded artist sheets, streaming analytics, and AI-powered insights — built for A&R teams, managers, and label executives.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/app"
              className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:scale-[1.04] overflow-hidden"
            >
              {/* Animated gradient bg */}
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #DA7756, #C75F4F, #DA7756, #E8B960)' , backgroundSize: '300% 300%' }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)', backgroundSize: '200% 100%' }}
                animate={{ backgroundPosition: ['-100% 0', '200% 0'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative flex items-center gap-2.5">
                <Play size={15} className="fill-current" />
                Get Started Free
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>

          {/* Waveform */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} className="flex justify-center">
            <Waveform bars={80} className="h-20" />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          animate={{ opacity: [0.3, 0.7, 0.3], y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[9px] font-mono text-[#6B6560] uppercase tracking-widest">Scroll</span>
          <ChevronDown size={14} className="text-[#6B6560]" />
        </motion.div>
      </section>

      {/* ── Live ticker ── */}
      <Ticker />

      {/* ── Artist Sheets showcase ── */}
      <section className="py-20 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#9B7ED8]/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <span className="text-[10px] font-mono text-[#9B7ED8] uppercase tracking-widest">Artist Sheets</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center mb-10"
          >
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mb-3">Beautiful artist pages, built instantly</h2>
            <p className="text-sm text-[#9B9590] max-w-lg mx-auto leading-relaxed">
              Every artist gets a branded sheet with live data, editable copy, and one-click export. Customize colors, toggle sections, and share a link — no design tools needed.
            </p>
          </motion.div>
        </div>
        <MockArtistSheet />

        {/* Capabilities grid */}
        <div className="max-w-5xl mx-auto px-6 lg:px-10 mt-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SHEET_CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.04] bg-[#171614]/40 hover:border-[#9B7ED8]/20 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#9B7ED8]/[0.08] border border-[#9B7ED8]/15 group-hover:border-[#9B7ED8]/30 transition-colors">
                  <cap.icon size={14} className="text-[#9B7ED8]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#F5F0E8] mb-0.5">{cap.label}</p>
                  <p className="text-[10px] text-[#6B6560] leading-relaxed">{cap.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform logos ── */}
      <section className="relative border-y border-white/[0.04] bg-[#171614]/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-[10px] font-mono text-[#6B6560] uppercase tracking-widest text-center mb-6">
            Aggregating data across
          </motion.p>
          <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {LOGOS.map((name, i) => (
              <motion.span
                key={name}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ color: '#F5F0E8', scale: 1.05 }}
                className="text-sm font-medium text-[#6B6560] transition-colors cursor-default"
              >
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      </section>



      {/* ── Features ── */}
      <section className="py-28 relative">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <div className="space-y-0 divide-y divide-white/[0.04]">
            {[
              { icon: Sheet, accent: '#9B7ED8', title: 'Artist Sheets', body: 'Branded one-pagers for every artist on your roster. Drag blocks, pick colors, edit any field inline, embed Spotify players, and export to PDF — or share a live link with anyone.' },
              { icon: MessageSquare, accent: '#DA7756', title: 'AI Chat', body: 'Ask anything about your roster in plain English. Cadence answers with live data, renders charts inline, and can build full reports from a single prompt.' },
              { icon: BarChart3, accent: '#7BAF73', title: 'Analytics', body: 'Streaming trends, social growth, playlist intelligence, audience geography, and revenue estimates across Spotify, Apple Music, TikTok, YouTube, Instagram, and Shazam.' },
              { icon: FileText, accent: '#4A90D9', title: 'Reports', body: 'Compose reports from 8 widget types. Drag to reorder, select artists, and export. Reports auto-save and can be shared via link.' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="grid grid-cols-[auto_1fr] sm:grid-cols-[48px_180px_1fr] gap-x-6 gap-y-2 py-10 items-baseline"
              >
                <f.icon size={20} style={{ color: f.accent }} className="mt-1 hidden sm:block" />
                <h3 className="text-xl font-display font-light tracking-tight text-[#F5F0E8] col-span-2 sm:col-span-1">{f.title}</h3>
                <p className="text-sm text-[#9B9590] leading-relaxed col-span-2 sm:col-span-1">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Report showcase ── */}
      <section className="py-20 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#4A90D9]/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <span className="text-[10px] font-mono text-[#4A90D9] uppercase tracking-widest">Reports</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center mb-10"
          >
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mb-3">Compose and share in minutes</h2>
            <p className="text-sm text-[#9B9590] max-w-lg mx-auto leading-relaxed">
              Pick artists, drag widgets into place, and export to PDF. The AI can build one for you from a single prompt.
            </p>
          </motion.div>
        </div>

        {/* Mock report */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mx-auto max-w-5xl px-6 lg:px-10"
          style={{ perspective: 1200 }}
        >
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-[#171614] to-[#0D0C0B] p-1 shadow-2xl shadow-black/50">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#C75F4F]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#DA7756]/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#7BAF73]/40" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-12 py-1 rounded bg-[#0D0C0B] border border-white/[0.04] text-[9px] font-mono text-[#6B6560]">cadence.app/reports/artist-comparison</div>
              </div>
            </div>

            {/* Report content */}
            <div className="p-5">
              {/* Report header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-light text-[#F5F0E8] tracking-tight">Artist Comparison Report</h3>
                  <p className="text-[10px] text-[#6B6560] mt-0.5">Billie Eilish, The Weeknd, SZA · Generated May 2026</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#171614] border border-white/[0.04] text-[9px] text-[#9B9590]">
                    <Link2 size={9} /> Share
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#4A90D9]/20 border border-[#4A90D9]/30 text-[9px] text-[#4A90D9]">
                    <Download size={9} /> PDF
                  </div>
                </div>
              </div>

              {/* Comparison table */}
              <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid #2C2B28' }}>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#171614]">
                      <th className="text-left px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">Artist</th>
                      <th className="text-right px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">Listeners</th>
                      <th className="text-right px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">Followers</th>
                      <th className="text-right px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">Instagram</th>
                      <th className="text-right px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">TikTok</th>
                      <th className="text-right px-3 py-2.5 text-[#6B6560] font-medium uppercase tracking-wider">Playlists</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Billie Eilish', listeners: '84.0M', followers: '125.6M', ig: '125.7M', tt: '74.8M', pl: '12.4K' },
                      { name: 'The Weeknd', listeners: '105.1M', followers: '78.2M', ig: '72.3M', tt: '39.1M', pl: '15.8K' },
                      { name: 'SZA', listeners: '68.7M', followers: '30.1M', ig: '19.8M', tt: '18.2M', pl: '9.6K' },
                    ].map((row, i) => (
                      <tr key={row.name} className={i < 2 ? 'border-b border-white/[0.03]' : ''}>
                        <td className="px-3 py-2.5 text-[#F5F0E8] font-medium">{row.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#F5F0E8]">{row.listeners}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#9B9590]">{row.followers}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#9B9590]">{row.ig}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#9B9590]">{row.tt}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#9B9590]">{row.pl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Widget row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Streaming chart mock */}
                <div className="rounded-lg p-4" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
                  <div className="text-[9px] text-[#6B6560] uppercase tracking-wider mb-3">Streaming Trends</div>
                  <div className="flex items-end justify-between h-24 gap-[2px]">
                    {WAVE_BARS.slice(0, 50).map((bar, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{ backgroundColor: `rgba(74, 144, 217, ${0.15 + (bar.h / 70) * 0.5})` }}
                        initial={{ height: 0 }}
                        whileInView={{ height: bar.h * 0.6 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.4 + i * 0.01 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Revenue donut mock */}
                <div className="rounded-lg p-4" style={{ backgroundColor: '#1D1C19', border: '1px solid #2C2B28' }}>
                  <div className="text-[9px] text-[#6B6560] uppercase tracking-wider mb-3">Revenue Breakdown</div>
                  <div className="flex items-center gap-4">
                    {/* SVG donut */}
                    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
                      <motion.circle cx="40" cy="40" r="30" fill="none" stroke="#4A90D9" strokeWidth="8" strokeDasharray="113 188" strokeDashoffset="0" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 }} />
                      <motion.circle cx="40" cy="40" r="30" fill="none" stroke="#7BAF73" strokeWidth="8" strokeDasharray="50 188" strokeDashoffset="-113" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.5 }} />
                      <motion.circle cx="40" cy="40" r="30" fill="none" stroke="#DA7756" strokeWidth="8" strokeDasharray="25 188" strokeDashoffset="-163" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.7 }} />
                    </svg>
                    <div className="space-y-2 text-[9px]">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#4A90D9]" /><span className="text-[#9B9590]">Streaming</span><span className="font-mono text-[#F5F0E8] ml-auto">$4.2M</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#7BAF73]" /><span className="text-[#9B9590]">Sync</span><span className="font-mono text-[#F5F0E8] ml-auto">$1.8M</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#DA7756]" /><span className="text-[#9B9590]">Merch</span><span className="font-mono text-[#F5F0E8] ml-auto">$0.9M</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#4A90D9]/[0.04] rounded-full blur-[40px]" />
        </motion.div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-36 relative">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(218,119,86,0.07) 0%, transparent 65%)' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center relative">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl mx-auto mb-8 bg-gradient-to-br from-[#DA7756] to-[#C75F4F] flex items-center justify-center shadow-xl shadow-[#DA7756]/20"
            >
              <Sparkles size={28} className="text-white" />
            </motion.div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight mb-5">
              Ready to see your data{' '}
              <span className="text-gradient-signal">come alive?</span>
            </h2>
            <p className="text-base text-[#9B9590] mb-12 max-w-md mx-auto leading-relaxed">
              Join the labels and managers already using Cadence to make smarter, faster decisions.
            </p>
            <Link
              to="/app"
              className="group relative inline-flex items-center gap-2.5 px-12 py-5 rounded-xl text-white font-semibold tracking-wide transition-all duration-300 hover:scale-[1.04] overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #DA7756, #C75F4F, #DA7756, #E8B960)', backgroundSize: '300% 300%' }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              <span className="relative flex items-center gap-2.5">
                <Sparkles size={16} />
                Enter Cadence
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#DA7756] to-[#C75F4F] flex items-center justify-center">
              <span className="font-mono text-[9px] font-bold text-white">C</span>
            </div>
            <span className="text-xs text-[#6B6560]">Cadence</span>
          </div>
          <span className="text-[10px] text-[#6B6560]">&copy; 2026 Cadence. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
