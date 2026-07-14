import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Play, ArrowRight, ArrowUpRight, Sparkles, Megaphone, Target, Mail, Lock,
  BarChart3, MessageSquare, Sheet, ListChecks, FileText, TrendingUp, Zap, Globe,
  ClipboardList, Rocket, Activity, Shuffle,
} from 'lucide-react';

/* Content is fetched from the server (/api/pitch) after authentication, so the
   copy/figures never ship in the client bundle. The server sends icon names as
   strings; this map resolves them to components. */
const ICON_MAP = {
  BarChart3, MessageSquare, Sheet, ListChecks, FileText,
  TrendingUp, Zap, Globe, ClipboardList, Rocket, Activity, Shuffle,
};

function Ico({ name, ...props }) {
  const Cmp = ICON_MAP[name] || Sparkles;
  return <Cmp {...props} />;
}

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5 },
};

function SectionLabel({ children, color = '#DA7756' }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color }}>
      {children}
    </span>
  );
}

function DemoVideo({ video }) {
  const [failed, setFailed] = useState(false);
  const { src, poster, caption } = video;

  return (
    <div>
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#171614] to-[#0D0C0B] p-1 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#C75F4F]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#DA7756]/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#7BAF73]/40" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-12 py-1 rounded bg-[#0D0C0B] border border-white/[0.04] text-[9px] font-mono text-[#6B6560]">
              musicspace.ai
            </div>
          </div>
        </div>

        {/* Video or placeholder */}
        <div className="relative aspect-video bg-[#0D0C0B]">
          {!failed ? (
            <video
              className="w-full h-full object-cover"
              src={src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 1.5; }}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <motion.div
                className="w-16 h-16 rounded-full bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center mb-4"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <Play size={22} className="text-[#DA7756] fill-[#DA7756] ml-0.5" />
              </motion.div>
              <p className="text-sm text-[#F5F0E8] mb-1">Demo video goes here</p>
              <p className="text-[11px] text-[#6B6560] max-w-sm leading-relaxed">
                Drop a file at <span className="font-mono text-[#9B9590]">/public/demo.mp4</span> (optional poster at{' '}
                <span className="font-mono text-[#9B9590]">/public/demo-poster.jpg</span>), or point{' '}
                <span className="font-mono text-[#9B9590]">video.src</span> at a hosted URL.
              </p>
            </div>
          )}
        </div>
      </div>
      {caption && <p className="text-center text-[11px] text-[#6B6560] mt-3">{caption}</p>}
    </div>
  );
}

function PitchContent({ data }) {
  const PITCH = data;
  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#F5F0E8] antialiased">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-[#0D0C0B]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#DA7756]/15 flex items-center justify-center">
              <span className="font-mono text-sm font-bold text-[#DA7756]">M</span>
            </div>
            <span className="font-['Epilogue'] text-sm font-medium">{PITCH.company}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* <Link to="/app" className="text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors flex items-center gap-1.5">
              Open the app <ArrowUpRight size={13} />
            </Link>
            <a
              href={`mailto:${PITCH.contact.email}`}
              className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-[#DA7756] text-[#0D0C0B] hover:bg-[#DA7756]/90 transition-colors"
            >
              Get in touch
            </a> */}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#DA7756]/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-14 relative">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#DA7756]/20 bg-[#DA7756]/[0.06] mb-8">
              <Sparkles size={11} className="text-[#DA7756]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#DA7756]">{PITCH.eyebrow}</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.05] max-w-4xl"
          >
            {PITCH.headline[0]}
            <br />
            <span className="text-gradient-signal">{PITCH.headline[1]}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-[#9B9590] max-w-2xl leading-relaxed mt-8"
          >
            {PITCH.subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-10"
          >
            <a
              href="#demo"
              className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#DA7756] text-[#0D0C0B] text-sm font-semibold hover:scale-[1.03] transition-transform"
            >
              <Play size={14} className="fill-current" />
              Watch the demo
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.06] bg-[#171614]/60">
              <Target size={13} className="text-[#7BAF73]" />
              <span className="text-xs text-[#9B9590]">
                Raising a <span className="text-[#F5F0E8] font-medium">{PITCH.raise.amount}</span> {PITCH.raise.stage} round
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Demo video ── */}
      <section id="demo" className="scroll-mt-16 pb-24">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="text-center mb-8">
            <SectionLabel>See it in action</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">The product, in 90 seconds</h2>
          </motion.div>
          <motion.div {...fade} transition={{ duration: 0.6, delay: 0.1 }}>
            <DemoVideo video={PITCH.video} />
          </motion.div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel color="#C75F4F">The problem</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.problem.heading}</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {PITCH.problem.points.map((p, i) => (
              <motion.div
                key={p.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-white/[0.05] bg-[#171614]/50"
              >
                <p className="text-sm font-medium text-[#F5F0E8] mb-2">{p.title}</p>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ── */}
      <section className="py-20 border-t border-white/[0.04] relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#DA7756]/[0.04] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 relative">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel>The solution</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.solution.heading}</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PITCH.solution.pillars.map((p, i) => (
              <motion.div
                key={p.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="p-6 rounded-2xl border border-white/[0.05] bg-[#171614]/50 hover:border-white/[0.1] transition-colors group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border transition-colors"
                  style={{ backgroundColor: p.accent + '14', borderColor: p.accent + '30' }}
                >
                  <Ico name={p.icon} size={17} style={{ color: p.accent }} />
                </div>
                <p className="text-sm font-medium text-[#F5F0E8] mb-1.5">{p.title}</p>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Flagship / core IP: the ad engine ── */}
      <section className="py-24 border-t border-[#DA7756]/15 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#DA7756]/[0.05] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#DA7756]/[0.08] rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 relative">
          <motion.div {...fade} className="max-w-3xl mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#DA7756]/30 bg-[#DA7756]/[0.1] mb-5">
              <Megaphone size={12} className="text-[#DA7756]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#DA7756]">{PITCH.flagship.eyebrow}</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tight leading-[1.08] mb-5">
              {PITCH.flagship.heading}
            </h2>
            <p className="text-[15px] text-[#9B9590] leading-relaxed">{PITCH.flagship.subhead}</p>
          </motion.div>

          {/* The loop */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {PITCH.flagship.steps.map((s, i) => (
              <motion.div
                key={s.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative p-6 rounded-2xl border border-[#DA7756]/20 bg-[#171614]/70"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-[11px] text-[#6B6560]">0{i + 1}</span>
                  <div className="w-9 h-9 rounded-xl bg-[#DA7756]/[0.12] border border-[#DA7756]/30 flex items-center justify-center">
                    <Ico name={s.icon} size={16} className="text-[#DA7756]" />
                  </div>
                </div>
                <p className="text-sm font-medium text-[#F5F0E8] mb-1.5">{s.title}</p>
                <p className="text-[12.5px] text-[#9B9590] leading-relaxed">{s.body}</p>
                {/* Connector arrow (desktop) */}
                {i < PITCH.flagship.steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[#0D0C0B] border border-[#DA7756]/25 items-center justify-center">
                    <ArrowRight size={11} className="text-[#DA7756]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Platforms + moat */}
          <motion.div {...fade} transition={{ duration: 0.5, delay: 0.1 }} className="grid lg:grid-cols-[1fr_auto] gap-6 items-center p-6 rounded-2xl border border-white/[0.06] bg-[#0D0C0B]/60">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#6B6560] mb-3">Launches natively across</p>
              <div className="flex flex-wrap gap-2">
                {PITCH.flagship.platforms.map((p) => (
                  <span key={p} className="text-[12px] font-medium text-[#F5F0E8] px-3 py-1.5 rounded-lg bg-[#171614] border border-white/[0.06]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:max-w-xs lg:border-l lg:border-white/[0.06] lg:pl-6">
              <div className="flex items-start gap-2">
                <Target size={14} className="text-[#7BAF73] mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-[#9B9590] leading-relaxed">{PITCH.flagship.moat}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Why now ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel color="#7BAF73">Why now</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">The timing is the thesis</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {PITCH.whyNow.points.map((p, i) => (
              <motion.div key={p.title} {...fade} transition={{ duration: 0.5, delay: i * 0.08 }} className="flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#7BAF73]/[0.1] border border-[#7BAF73]/25 flex items-center justify-center shrink-0">
                  <Ico name={p.icon} size={15} className="text-[#7BAF73]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F5F0E8] mb-1.5">{p.title}</p>
                  <p className="text-[13px] text-[#9B9590] leading-relaxed">{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Market ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel color="#D4A574">Market</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.market.heading}</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4">
            {[PITCH.market.tam, PITCH.market.sam, PITCH.market.som].map((m, i) => (
              <motion.div
                key={m.label}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="p-7 rounded-2xl border border-white/[0.05] bg-gradient-to-b from-[#171614]/70 to-[#0D0C0B]"
              >
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#6B6560] mb-3">{m.label}</p>
                <p className="font-display text-4xl font-light text-[#F5F0E8] mb-2">{m.value}</p>
                <p className="text-[12px] text-[#9B9590] leading-relaxed">{m.note}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-[#6B6560] mt-4 italic">{PITCH.market.footnote}</p>
        </div>
      </section>

      {/* ── Traction ──
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel>Traction</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.traction.heading}</h2>
          </motion.div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PITCH.traction.stats.map((s, i) => (
              <motion.div
                key={s.label}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="p-6 rounded-2xl border border-white/[0.05] bg-[#171614]/50 text-center"
              >
                <p className="font-display text-4xl font-light text-gradient-signal mb-2">{s.value}</p>
                <p className="text-[12px] text-[#9B9590] leading-snug">{s.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-[#6B6560] mt-4 italic">{PITCH.traction.note}</p>
        </div>
      </section> */}

      {/* ── Business model ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel color="#4A90D9">Business model</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.model.heading}</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4">
            {PITCH.model.tiers.map((t, i) => (
              <motion.div
                key={t.name}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-white/[0.05] bg-[#171614]/50"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-sm font-medium text-[#F5F0E8]">{t.name}</p>
                  <p className="text-sm font-mono text-[#DA7756]">{t.price}</p>
                </div>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">{t.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The ask ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fade}>
            <SectionLabel color="#DA7756">The ask</SectionLabel>
            <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tight mt-3 mb-4">
              Raising <span className="text-gradient-signal">{PITCH.raise.amount}</span>
            </h2>
            <p className="text-[15px] text-[#9B9590] leading-relaxed max-w-md">
              A {PITCH.raise.stage} round {PITCH.raise.line}
            </p>
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.6, delay: 0.1 }} className="space-y-4">
            {PITCH.ask.useOfFunds.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-[#F5F0E8]">{f.label}</span>
                  <span className="text-[13px] font-mono text-[#9B9590]">{f.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#171614] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#DA7756] to-[#E8B960]"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${f.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div {...fade} className="max-w-2xl mb-12">
            <SectionLabel>Team</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl font-light tracking-tight mt-3">{PITCH.team.heading}</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {PITCH.team.members.map((m, i) => (
              <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.08 }} className="p-6 rounded-2xl border border-white/[0.05] bg-[#171614]/50">
                {m.image ? (
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-14 h-14 rounded-full object-cover object-[center_5%] border border-white/[0.06] mb-4"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#2C2B28] border border-white/[0.06] mb-4" />
                )}
                <p className="text-sm font-medium text-[#F5F0E8]">{m.name}</p>
                <p className="text-[11px] font-mono text-[#DA7756] mb-2">{m.role}</p>
                <p className="text-[12px] text-[#9B9590] leading-relaxed">{m.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact CTA ── */}
      <section className="py-24 border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#DA7756]/[0.07] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center relative">
          <motion.div {...fade}>
            <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tight mb-5">{PITCH.contact.heading}</h2>
            <p className="text-[15px] text-[#9B9590] leading-relaxed max-w-xl mx-auto mb-9">{PITCH.contact.body}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`mailto:${PITCH.contact.email}`}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#DA7756] text-[#0D0C0B] text-sm font-semibold hover:scale-[1.03] transition-transform"
              >
                <Mail size={15} />
                {PITCH.contact.email}
              </a>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/[0.1] text-sm text-[#F5F0E8] hover:bg-white/[0.03] transition-colors"
              >
                Explore the live app
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-[#6B6560]">© {PITCH.company} · Confidential — for discussion purposes only</span>
          <span className="text-[11px] text-[#6B6560] font-mono">musicspace.ai</span>
        </div>
      </footer>
    </div>
  );
}

function GateFrame({ children }) {
  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#F5F0E8] flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#DA7756]/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm text-center"
      >
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded bg-[#DA7756]/15 flex items-center justify-center">
            <span className="font-mono text-sm font-bold text-[#DA7756]">M</span>
          </div>
          <span className="font-['Epilogue'] text-sm font-medium">MusicSpace</span>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function Pitch() {
  const [status, setStatus] = useState('loading'); // loading | locked | unlocked
  const [data, setData] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check for an existing session on load
  useEffect(() => {
    let alive = true;
    fetch('/api/pitch', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!alive) return;
        if (r.ok) {
          const j = await r.json();
          setData(j.data);
          setStatus('unlocked');
        } else {
          setStatus('locked');
        }
      })
      .catch(() => { if (alive) setStatus('locked'); });
    return () => { alive = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/pitch', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        const j = await r.json();
        setData(j.data);
        setStatus('unlocked');
      } else if (r.status === 401) {
        setError('Incorrect password. Try again.');
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.error || 'Something went wrong. Try again.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'unlocked' && data) return <PitchContent data={data} />;

  if (status === 'loading') {
    return (
      <GateFrame>
        <div className="w-12 h-12 rounded-full bg-[#171614] border border-white/[0.06] flex items-center justify-center mx-auto">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Lock size={18} className="text-[#6B6560]" />
          </motion.div>
        </div>
      </GateFrame>
    );
  }

  return (
    <GateFrame>
      <div className="w-12 h-12 rounded-full bg-[#171614] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
        <Lock size={18} className="text-[#DA7756]" />
      </div>
      <h1 className="font-display text-2xl font-light tracking-tight mb-2">This page is private</h1>
      <p className="text-[13px] text-[#9B9590] mb-7">Enter the access password to view the investor overview.</p>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Password"
          className={`w-full bg-[#171614] border rounded-lg px-4 py-3 text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none transition-colors text-center ${
            error ? 'border-[#C75F4F]/60' : 'border-[#2C2B28] focus:border-[#DA7756]/40'
          }`}
        />
        {error && <p className="text-[11px] text-[#C75F4F]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password.trim()}
          className="w-full px-4 py-3 rounded-lg bg-[#DA7756] text-[#0D0C0B] text-sm font-semibold hover:bg-[#DA7756]/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </GateFrame>
  );
}
