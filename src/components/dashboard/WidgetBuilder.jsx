import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, Check, Sparkles, X } from 'lucide-react';
import { createWidgetSession } from '../../data/customWidgets';
import { CustomWidgetView } from './CustomWidget';

// Builds a custom widget from a request, shows it as a preview, and lets the user
// ask for changes until they add it to the dashboard. Nothing is saved before that.
//
// widget: a saved widget to edit, or null for a new one.
export default function WidgetBuilder({ widget, groups, onSave, onClose }) {
  const [session] = useState(() =>
    createWidgetSession({ groups, base: widget ? { requests: widget.requests, spec: widget.spec } : null }));
  const [requests, setRequests] = useState(widget?.requests || []);
  const [spec, setSpec] = useState(widget?.spec || null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [busy]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [steps, spec, busy]);

  const onProgress = (e) => setSteps(prev => {
    const done = prev.map(s => ({ ...s, done: true }));
    if (e.kind === 'think') return [...done, { label: prev.length ? 'Choosing how to show it' : 'Reading your request' }];
    if (e.kind === 'tools') return [...done, ...e.labels.map(label => ({ label }))];
    return [...done, { label: 'Drawing the widget', done: true }];
  });

  const submit = async (e) => {
    e.preventDefault();
    const ask = text.trim();
    if (!ask || busy) return;
    setText('');
    setError(null);
    setSteps([]);
    setElapsed(0);
    setBusy(true);
    setRequests(r => [...r, ask]);
    try {
      const next = await session.run(ask, onProgress);
      setSpec(next);
      setChanged(true);
      setRequests(session.requests());
      setSteps([]);
    } catch (err) {
      setError(err.message || "Couldn't build that widget");
      // The request didn't take; keep the list to what the preview reflects
      setRequests(r => r.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    if (changed && !window.confirm('Discard this widget?')) return;
    onClose();
  };

  const save = () => onSave({ id: widget?.id, requests, spec });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 overflow-y-auto"
      onClick={close}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-2xl bg-[#171614] border border-[#2C2B28] rounded-lg p-5 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#DA7756]" />
            <h2 className="text-sm text-[#F5F0E8]">{widget ? 'Edit widget' : 'New widget'}</h2>
          </div>
          <button onClick={close} disabled={busy} className="p-1 text-[#6B6560] hover:text-[#9B9590] disabled:opacity-40 cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* What was asked so far */}
        {requests.length > 0 && (
          <div className="space-y-1 mb-3">
            {requests.map((r, i) => (
              <p key={i} className="text-[11px] text-[#9B9590] leading-snug">
                <span className="text-[#6B6560] mr-1.5">{i === 0 ? '›' : '+'}</span>{r}
              </p>
            ))}
          </div>
        )}

        {/* Preview */}
        {spec && (
          <div className={`relative rounded border border-[#2C2B28] bg-[#0D0C0B] p-4 mb-3 transition-opacity ${busy ? 'opacity-40' : ''}`}>
            <h3 className="text-xs font-medium text-[#F5F0E8] truncate">{spec.title}</h3>
            {spec.subtitle && <p className="text-[10px] text-[#6B6560] truncate mb-2">{spec.subtitle}</p>}
            <div className={spec.subtitle ? '' : 'mt-2'}>
              <CustomWidgetView spec={spec} />
            </div>
          </div>
        )}

        {/* Progress */}
        {busy && (
          <div className="rounded border border-[#2C2B28] bg-[#0D0C0B] px-4 py-3 mb-3 space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                {s.done
                  ? <Check size={11} className="text-[#7BAF73] shrink-0" />
                  : <div className="w-[11px] h-[11px] rounded-full border-[1.5px] border-[#2C2B28] border-t-[#DA7756] animate-spin shrink-0" />}
                <span className={s.done ? 'text-[#6B6560]' : 'text-[#F5F0E8]'}>{s.label}</span>
                {!s.done && i === steps.length - 1 && <span className="ml-auto font-mono text-[10px] text-[#6B6560]">{elapsed}s</span>}
              </div>
            ))}
            {steps.length === 0 && (
              <div className="flex items-center gap-2 text-[11px] text-[#F5F0E8]">
                <div className="w-[11px] h-[11px] rounded-full border-[1.5px] border-[#2C2B28] border-t-[#DA7756] animate-spin" />
                Starting
              </div>
            )}
          </div>
        )}

        {error && <p className="text-[11px] text-[#C75F4F] mb-3">{error}</p>}

        {/* Request / change */}
        <form onSubmit={submit} className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] focus-within:border-[#DA7756]/40 rounded px-3 py-2 transition-colors">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
            disabled={busy}
            placeholder={spec ? 'Ask for a change, e.g. make it a bar chart' : 'Describe a widget, e.g. TikTok followers of my artists over 90 days'}
            className="flex-1 bg-transparent text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            title={spec ? 'Apply change' : 'Build widget'}
            className="w-7 h-7 rounded bg-[#DA7756] disabled:bg-[#2C2B28] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ArrowUp size={14} className="text-[#0D0C0B]" />
          </button>
        </form>

        {spec && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <button onClick={close} disabled={busy}
              className="px-3 py-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] disabled:opacity-40 transition-colors cursor-pointer">
              {widget ? 'Cancel' : 'Discard'}
            </button>
            <button onClick={save} disabled={busy || (widget && !changed)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0D0C0B] bg-[#DA7756] hover:bg-[#E08A6C] disabled:bg-[#2C2B28] disabled:text-[#6B6560] rounded transition-colors cursor-pointer">
              <Check size={12} />
              {widget ? 'Save' : 'Add to dashboard'}
            </button>
          </div>
        )}
        <div ref={endRef} />
      </motion.div>
    </motion.div>
  );
}
