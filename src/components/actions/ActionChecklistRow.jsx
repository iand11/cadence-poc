import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, X, Plus, AlertCircle, Sparkles } from 'lucide-react';
import InlineEdit from './InlineEdit';
import { PRIORITY_COLORS, getPriorityLevel } from '../../data/actions';
import { STEP_CATEGORY_LABELS, STEP_CATEGORY_COLORS } from '../../data/actionSteps';
import { OWNERS } from '../../hooks/useActions';

const todayISO = () => new Date().toISOString().split('T')[0];
const isoPlusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const DUE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
];

// One action as a single flat checklist row (Prelude campaign style), with
// its tactical steps tucked into an expandable detail.
export default function ActionChecklistRow({
  item,
  onSetOwner,
  onEditAction,
  onToggleStep,
  onEditStep,
  onAddStep,
  onRemoveStep,
  onDeselect,
  onDelete,
  onAskAI,
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const newStepRef = useRef(null);

  const priorityColor = PRIORITY_COLORS[getPriorityLevel(item)];
  const steps = item.steps || [];
  const completedSteps = steps.filter(s => s.completed).length;
  // An action is "done" only when every one of its tasks is complete — never by manual toggle.
  const done = steps.length > 0 && completedSteps === steps.length;
  const today = todayISO();
  const overdue = !done && item.dueDate && item.dueDate < today;

  const applyPreset = (v) => {
    if (v === '') return;
    onEditAction?.(item.id, 'dueDate', v === 'clear' ? null : isoPlusDays(Number(v)));
  };

  const handleAddStep = () => {
    const trimmed = newStepText.trim();
    if (trimmed) {
      onAddStep?.(item.id, trimmed);
      setNewStepText('');
      setAddingStep(false);
    }
  };

  const isExtraStep = (stepId) => stepId.includes('-x');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      className="rounded-lg border border-[#2C2B28] bg-[#171614] overflow-hidden"
    >
      {/* Row */}
      <div className="group flex items-center gap-3 px-4 py-3">
        {/* Disclosure chevron — expand tasks */}
        <button
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse tasks' : 'Expand tasks'}
          className="shrink-0 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          <ChevronRight size={15} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {/* Derived completion status — checks itself when every task is done (not clickable) */}
        <div
          title={done ? 'All tasks complete' : `${completedSteps} of ${steps.length} tasks complete`}
          className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${
            done ? 'bg-[#7BAF73] border-[#7BAF73] text-[#0D0C0B]' : 'border-[#3D3B37]'
          }`}
          style={done ? undefined : { borderColor: priorityColor + '66' }}
        >
          {done && <Check size={13} strokeWidth={3} />}
        </div>

        {/* Headline — click to expand steps */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="min-w-0 flex-1 text-left cursor-pointer"
        >
          <span className={`text-[13px] leading-snug truncate block ${done ? 'text-[#6B6560] line-through' : 'text-[#F5F0E8]'}`}>
            {item.action}
          </span>
        </button>

        {/* Tasks count — also expands */}
        {steps.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className={`flex items-center gap-1 text-[10px] font-mono shrink-0 transition-colors cursor-pointer ${
              done ? 'text-[#7BAF73]' : 'text-[#6B6560] hover:text-[#9B9590]'
            }`}
          >
            {completedSteps}/{steps.length} tasks
          </button>
        )}

        {/* Owner */}
        <select
          value={item.owner || ''}
          onChange={e => onSetOwner?.(item.id, e.target.value || null)}
          className="h-8 w-28 shrink-0 bg-[#0D0C0B] border border-[#2C2B28] rounded-md px-2 text-[11px] font-mono text-[#9B9590] outline-none focus:border-[#DA7756]/40 transition-colors cursor-pointer"
        >
          <option value="">Unassigned</option>
          {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Due preset */}
        <select
          value=""
          onChange={e => applyPreset(e.target.value)}
          aria-label="Quick due date"
          className="h-8 w-[76px] shrink-0 bg-[#0D0C0B] border border-[#2C2B28] rounded-md px-2 text-[11px] font-mono text-[#9B9590] outline-none focus:border-[#DA7756]/40 transition-colors cursor-pointer"
        >
          <option value="">Due…</option>
          {DUE_PRESETS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
          {item.dueDate && <option value="clear">Clear</option>}
        </select>

        {/* Date input */}
        <div className="relative shrink-0">
          <input
            type="date"
            value={item.dueDate || ''}
            onChange={e => onEditAction?.(item.id, 'dueDate', e.target.value || null)}
            className={`h-8 w-[130px] bg-[#0D0C0B] border rounded-md px-2 text-[11px] font-mono outline-none focus:border-[#DA7756]/40 transition-colors [color-scheme:dark] ${
              overdue ? 'border-[#C75F4F]/60 text-[#C75F4F]' : 'border-[#2C2B28] text-[#9B9590]'
            }`}
          />
          {overdue && <AlertCircle size={12} className="pointer-events-none absolute -right-1.5 -top-1.5 text-[#C75F4F]" />}
        </div>

        {/* Remove */}
        {(onDeselect || onDelete) && (
          <button
            onClick={() => (item.source === 'ai' && onDelete ? onDelete(item.id) : onDeselect?.(item.id))}
            aria-label="Remove"
            className="shrink-0 text-[#6B6560] opacity-0 group-hover:opacity-100 hover:text-[#C75F4F] transition-all cursor-pointer"
            title={item.source === 'ai' ? 'Delete action' : 'Remove from list'}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Expandable steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[#2C2B28]/60">
              {item.text && (
                <p className="text-[11px] text-[#6B6560] leading-relaxed italic mb-3 mt-2">{item.text}</p>
              )}

              <div className="space-y-1.5">
                {steps.map(step => {
                  const catColor = STEP_CATEGORY_COLORS[step.category] || '#9B9590';
                  return (
                    <div key={step.id} className="group/step flex items-center gap-2.5 rounded-md bg-[#0D0C0B] border border-[#2C2B28] px-2.5 py-2">
                      <button
                        onClick={() => onToggleStep?.(step.id)}
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                          step.completed ? 'bg-[#7BAF73] border-[#7BAF73] text-[#0D0C0B]' : 'border-[#3D3B37] hover:border-[#7BAF73]'
                        }`}
                      >
                        {step.completed && <Check size={11} strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0 text-[11px] leading-snug">
                        {onEditStep ? (
                          <InlineEdit
                            value={step.text}
                            onSave={(v) => onEditStep(step.id, v)}
                            className={step.completed ? 'text-[#6B6560] line-through' : 'text-[#DDD6CC]'}
                          />
                        ) : (
                          <span className={step.completed ? 'text-[#6B6560] line-through' : 'text-[#DDD6CC]'}>{step.text}</span>
                        )}
                      </div>
                      <span
                        className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: catColor, backgroundColor: catColor + '15', border: `1px solid ${catColor}30` }}
                      >
                        {STEP_CATEGORY_LABELS[step.category] || step.category}
                      </span>
                      {isExtraStep(step.id) && onRemoveStep && (
                        <button
                          onClick={() => onRemoveStep(item.id, step.id)}
                          className="shrink-0 text-[#6B6560] hover:text-[#C75F4F] opacity-0 group-hover/step:opacity-100 transition-all cursor-pointer"
                          title="Remove step"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add step + Ask AI */}
              <div className="flex items-center gap-4 mt-2.5">
                {onAddStep && (addingStep ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      ref={newStepRef}
                      value={newStepText}
                      onChange={e => setNewStepText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddStep();
                        if (e.key === 'Escape') { setAddingStep(false); setNewStepText(''); }
                      }}
                      placeholder="Add a step…"
                      autoFocus
                      className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded-md px-2.5 py-1.5 text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    />
                    <button onClick={handleAddStep} disabled={!newStepText.trim()} className="text-[10px] font-mono text-[#7BAF73] hover:text-[#F5F0E8] disabled:text-[#3D3B37] transition-colors cursor-pointer">Add</button>
                    <button onClick={() => { setAddingStep(false); setNewStepText(''); }} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingStep(true)} className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer">
                    <Plus size={11} /> Add step
                  </button>
                ))}
                {onAskAI && !addingStep && (
                  <button onClick={() => onAskAI(item)} className="flex items-center gap-1.5 text-[10px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer ml-auto">
                    <Sparkles size={11} /> Tailored steps
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
