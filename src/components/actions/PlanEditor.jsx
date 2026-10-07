import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Plus, X, Check, Sparkles } from 'lucide-react';
import { OWNERS } from '../../hooks/useActions';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER, DATA_TYPE_LABELS, getPriorityLevel } from '../../data/actions';
import { STEP_CATEGORY_LABELS } from '../../data/actionSteps';
import { blankDraftAction, newKey } from '../../data/actionPlans';

const INPUT = 'bg-[#0D0C0B] border border-[#2C2B28] rounded-md px-2.5 text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#DA7756]/40 transition-colors';
const SELECT = `${INPUT} h-8 font-mono text-[#9B9590] cursor-pointer`;

function DraftActionCard({ item, index, onChange, onRemove, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const set = (patch) => onChange({ ...item, ...patch });
  const setStep = (key, patch) => set({ steps: item.steps.map(s => (s.key === key ? { ...s, ...patch } : s)) });
  const removeStep = (key) => set({ steps: item.steps.filter(s => s.key !== key) });
  const addStep = () => set({ steps: [...item.steps, { key: newKey('s'), text: '', category: 'tactical' }] });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
      className="rounded-lg border border-[#2C2B28] bg-[#171614]"
    >
      <div className="group flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="shrink-0 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[item.priority] }} />
        <input
          value={item.action}
          onChange={e => set({ action: e.target.value })}
          placeholder={`Action ${index + 1}: what needs to happen?`}
          autoFocus={defaultOpen && !item.action}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[#F5F0E8] placeholder-[#6B6560] outline-none"
        />
        <span className="hidden sm:inline text-[10px] font-mono text-[#6B6560] shrink-0">
          {item.steps.length} step{item.steps.length !== 1 ? 's' : ''}
        </span>
        <select
          value={item.owner || ''}
          onChange={e => set({ owner: e.target.value || null })}
          aria-label="Owner"
          className={`${SELECT} w-28 shrink-0`}
        >
          <option value="">Unassigned</option>
          {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          type="date"
          value={item.dueDate || ''}
          onChange={e => set({ dueDate: e.target.value || null })}
          aria-label="Due date"
          className={`${INPUT} h-8 w-[124px] shrink-0 font-mono text-[#9B9590] [color-scheme:dark]`}
        />
        <button
          onClick={onRemove}
          aria-label="Remove action"
          className="shrink-0 text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-2 border-t border-[#2C2B28]/60 space-y-2.5">
              <textarea
                value={item.text}
                onChange={e => set({ text: e.target.value })}
                placeholder="Why this matters (optional)"
                rows={2}
                className={`${INPUT} w-full py-2 resize-none leading-relaxed`}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[10px] font-mono text-[#6B6560]">Priority</label>
                <div className="flex items-center gap-1">
                  {PRIORITY_ORDER.map(level => (
                    <button
                      key={level}
                      onClick={() => set({ priority: level })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                        item.priority === level ? 'border-[#DA7756]/40 bg-[#DA7756]/10 text-[#F5F0E8]' : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                      {PRIORITY_LABELS[level]}
                    </button>
                  ))}
                </div>
                <label className="text-[10px] font-mono text-[#6B6560] ml-2">Area</label>
                <select
                  value={item.dataType}
                  onChange={e => set({ dataType: e.target.value })}
                  className={`${SELECT} w-32`}
                >
                  {Object.entries(DATA_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                {item.steps.map(step => (
                  <div key={step.key} className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-[#3D3B37] shrink-0" />
                    <input
                      value={step.text}
                      onChange={e => setStep(step.key, { text: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') addStep(); }}
                      placeholder="Describe the step"
                      autoFocus={!step.text}
                      className={`${INPUT} h-8 flex-1 min-w-0`}
                    />
                    <select
                      value={step.category}
                      onChange={e => setStep(step.key, { category: e.target.value })}
                      aria-label="Step type"
                      className={`${SELECT} w-24 shrink-0`}
                    >
                      {Object.entries(STEP_CATEGORY_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <button
                      onClick={() => removeStep(step.key)}
                      aria-label="Remove step"
                      className="shrink-0 text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addStep}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
                >
                  <Plus size={11} /> Add step
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Editable plan: name, actions (each with owner/due/priority/steps), plus
// optional data-driven suggestions from the artist's generated actions.
export default function PlanEditor({ draft, onChange, artistName, suggestions = [], pickedSuggestions, onToggleSuggestion }) {
  // Hand-built plans open their cards; generated plans start collapsed.
  const [openKeys, setOpenKeys] = useState(() => new Set(draft.actions.filter(a => !a.action).map(a => a.key)));

  const setAction = (key, next) => onChange({ ...draft, actions: draft.actions.map(a => (a.key === key ? next : a)) });
  const removeAction = (key) => onChange({ ...draft, actions: draft.actions.filter(a => a.key !== key) });
  const addAction = () => {
    const a = blankDraftAction();
    setOpenKeys(prev => new Set(prev).add(a.key));
    onChange({ ...draft, actions: [...draft.actions, a] });
  };

  const totalSteps = draft.actions.reduce((n, a) => n + a.steps.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B6560] mb-1.5">Plan name</label>
        <input
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Summer single rollout"
          className={`${INPUT} h-9 w-full text-[13px]`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B6560]">
            Actions · {draft.actions.length} · {totalSteps} steps
          </span>
          <button
            onClick={addAction}
            className="flex items-center gap-1.5 text-[10px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer"
          >
            <Plus size={11} /> Add action
          </button>
        </div>
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {draft.actions.map((a, i) => (
              <DraftActionCard
                key={a.key}
                item={a}
                index={i}
                defaultOpen={openKeys.has(a.key)}
                onChange={next => setAction(a.key, next)}
                onRemove={() => removeAction(a.key)}
              />
            ))}
          </AnimatePresence>
          {draft.actions.length === 0 && (
            <button
              onClick={addAction}
              className="w-full rounded-lg border border-dashed border-[#2C2B28] hover:border-[#DA7756]/40 py-6 text-[11px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
            >
              + Add the first action
            </button>
          )}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="pt-3 border-t border-[#2C2B28]">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B6560]">
            <Sparkles size={11} className="text-[#DA7756]" />
            Suggested from {artistName}'s data
          </div>
          <div className="space-y-1">
            {suggestions.map(s => {
              const on = pickedSuggestions?.has(s.id);
              const level = getPriorityLevel(s);
              return (
                <button
                  key={s.id}
                  onClick={() => onToggleSuggestion?.(s.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                    on ? 'border-[#DA7756]/30 bg-[#DA7756]/5' : 'border-[#2C2B28] hover:border-[#3D3B37]'
                  }`}
                >
                  <span className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center ${on ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'}`}>
                    {on && <Check size={10} className="text-[#0D0C0B]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                      <span className="text-[11px] text-[#F5F0E8] leading-snug">{s.action}</span>
                    </span>
                    {s.text && <span className="block text-[10px] text-[#6B6560] leading-relaxed mt-0.5 line-clamp-1">{s.text}</span>}
                  </span>
                  <span className="text-[9px] font-mono text-[#6B6560] shrink-0 mt-0.5">{DATA_TYPE_LABELS[s.dataType] || s.dataType}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
