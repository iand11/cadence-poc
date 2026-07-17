import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';

/* App-wide access gate. Wraps the whole router. The password is validated by
   /api/auth (server-side) and a signed HttpOnly cookie is set on success, so the
   password never ships in the client bundle.

   The /pitch route is exempt here — it has its own independent investor gate. */
const EXEMPT_PREFIXES = ['/pitch'];

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

export default function AppGate({ children }) {
  const location = useLocation();
  const exempt = EXEMPT_PREFIXES.some((p) => location.pathname.startsWith(p));

  const [status, setStatus] = useState('loading'); // loading | locked | unlocked
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check for an existing session on load
  useEffect(() => {
    if (exempt) return;
    let alive = true;
    fetch('/api/auth', { credentials: 'same-origin' })
      .then((r) => { if (alive) setStatus(r.ok ? 'unlocked' : 'locked'); })
      .catch(() => { if (alive) setStatus('locked'); });
    return () => { alive = false; };
  }, [exempt]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
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

  // The pitch route handles its own gating.
  if (exempt) return children;

  if (status === 'unlocked') return children;

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
      <h1 className="font-display text-2xl font-light tracking-tight mb-2">Private prototype</h1>
      <p className="text-[13px] text-[#9B9590] mb-7">Enter the access password to continue.</p>

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
          {submitting ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </GateFrame>
  );
}
