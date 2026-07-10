import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, RotateCcw, ChevronRight, Sparkles, Pencil, Plus, Trash2, BookmarkMinus, Calendar } from 'lucide-react';
import Badge from '../shared/Badge';
import { PRIORITY_LABELS, getPriorityLevel } from '../../data/actions';
import { STEP_CATEGORY_LABELS, STEP_CATEGORY_COLORS } from '../../data/actionSteps';

const PRIORITY_BADGE_VARIANT = {
  high: 'danger',
  medium: 'info',
  low: 'success',
};

const TYPE_BORDERS = {
  success: '#7BAF73',
  warning: '#DA7756',
  danger: '#C75F4F',
  info: '#D4A574',
};

const TYPE_BGS = {
  success: 'rgba(123, 175, 115, 0.04)',
  warning: 'rgba(218, 119, 86, 0.04)',
  danger: 'rgba(199, 95, 79, 0.04)',
  info: 'rgba(212, 165, 116, 0.04)',
};

function InlineEdit({ value, onSave, className = '', multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span className={`group/edit inline ${className}`}>
        <span>{value}</span>
        <button
          onClick={startEdit}
          className="inline-flex ml-1.5 opacity-0 group-hover/edit:opacity-100 text-[#6B6560] hover:text-[#DA7756] transition-all cursor-pointer align-middle"
          title="Edit"
        >
          <Pencil size={9} />
        </button>
      </span>
    );
  }

  const Tag = multiline ? 'textarea' : 'input';
  return (
    <span className="inline-flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
      <Tag
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') cancel();
        }}
        onBlur={save}
        rows={multiline ? 2 : undefined}
        className={`flex-1 bg-[#0D0C0B] border border-[#DA7756]/40 rounded px-2 py-1 outline-none text-[#F5F0E8] ${className}`}
        style={{ fontSize: 'inherit', fontFamily: 'inherit', lineHeight: 'inherit' }}
      />
    </span>
  );
}

export default function ActionItem({ item, onComplete, onIgnore, onRestore, onDelete, onDeselect, onToggleStep, onEditAction, onEditStep, onAddStep, onRemoveStep, onAskAI, showArtist = true, archived = false }) {
  const [expanded, setExpanded] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const newStepRef = useRef(null);

  const borderColor = TYPE_BORDERS[item.insightType] || TYPE_BORDERS.info;
  const bgColor = TYPE_BGS[item.insightType] || TYPE_BGS.info;
  const priorityLevel = getPriorityLevel(item);

  const steps = item.steps || [];
  const completedCount = steps.filter(s => s.completed).length;
  const hasSteps = steps.length > 0;

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
      animate={{ opacity: archived ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="rounded transition-colors"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: bgColor,
      }}
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer group"
        onClick={() => !archived && setExpanded(v => !v)}
      >
        {/* Expand chevron */}
        {!archived && (
          <div className="mt-0.5 shrink-0">
            <ChevronRight
              size={12}
              className={`text-[#6B6560] transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {showArtist && (
              <span className="text-[11px] font-medium text-[#F5F0E8] truncate max-w-[160px]">
                {item.artistName}
              </span>
            )}
            <Badge variant={PRIORITY_BADGE_VARIANT[priorityLevel]}>
              {PRIORITY_LABELS[priorityLevel]} priority
            </Badge>
            {item.source === 'ai' && (
              <span className="text-[10px] font-mono text-[#DA7756]">AI</span>
            )}
            {item.dueDate && !archived && (
              <span className={`flex items-center gap-0.5 text-[9px] font-mono ml-auto ${
                item.dueDate < new Date().toISOString().split('T')[0] ? 'text-[#C75F4F]' : 'text-[#6B6560]'
              }`}>
                <Calendar size={8} />
                {new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {/* Action headline — editable */}
          <div className="text-xs text-[#F5F0E8] leading-relaxed">
            {!archived && onEditAction ? (
              <InlineEdit
                value={item.action}
                onSave={(v) => onEditAction(item.id, 'action', v)}
                className="text-xs"
              />
            ) : (
              <p>{item.action}</p>
            )}
          </div>

          {/* Progress indicator */}
          {hasSteps && !archived && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-[#2C2B28] rounded-full max-w-[120px]">
                <div
                  className="h-1 bg-[#7BAF73] rounded-full transition-all"
                  style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-[#6B6560]">{completedCount}/{steps.length}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {archived ? (
            <button
              onClick={() => onRestore?.(item.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#2C2B28] transition-colors cursor-pointer"
              title="Restore"
            >
              <RotateCcw size={12} />
            </button>
          ) : (
            <>
              <button
                onClick={() => onComplete?.(item.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#9B9590] hover:text-[#7BAF73] hover:bg-[#7BAF73]/10 transition-colors cursor-pointer"
                title="Mark complete"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => onIgnore?.(item.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#9B9590] hover:text-[#C75F4F] hover:bg-[#C75F4F]/10 transition-colors cursor-pointer"
                title="Ignore"
              >
                <X size={12} />
              </button>
              <button
                onClick={() => onDelete?.(item.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#9B9590] hover:text-[#C75F4F] hover:bg-[#C75F4F]/10 transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
              {onDeselect && (
                <button
                  onClick={() => onDeselect(item.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#9B9590] hover:text-[#DA7756] hover:bg-[#DA7756]/10 transition-colors cursor-pointer"
                  title="Remove from list"
                >
                  <BookmarkMinus size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expandable steps */}
      <AnimatePresence>
        {expanded && !archived && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 ml-5 border-t border-[#2C2B28]/50">
              {/* Context text — editable */}
              {item.text && (
                <div className="text-[11px] text-[#6B6560] leading-relaxed mb-3 italic">
                  {onEditAction ? (
                    <InlineEdit
                      value={item.text}
                      onSave={(v) => onEditAction(item.id, 'text', v)}
                      className="text-[11px] text-[#6B6560]"
                    />
                  ) : (
                    <p>{item.text}</p>
                  )}
                </div>
              )}

              {/* Due date */}
              {onEditAction && (
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={10} className="text-[#6B6560]" />
                  <label className="text-[9px] font-mono text-[#6B6560]">Due</label>
                  <input
                    type="date"
                    value={item.dueDate || ''}
                    onChange={e => onEditAction(item.id, 'dueDate', e.target.value || null)}
                    onClick={e => e.stopPropagation()}
                    className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-0.5 text-[10px] font-mono text-[#F5F0E8] outline-none focus:border-[#DA7756]/40 transition-colors [color-scheme:dark]"
                  />
                  {item.dueDate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditAction(item.id, 'dueDate', null); }}
                      className="text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer"
                      title="Clear date"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}

              {/* Steps */}
              <div className="space-y-1.5">
                {steps.map(step => {
                  const catColor = STEP_CATEGORY_COLORS[step.category] || '#9B9590';
                  return (
                    <div
                      key={step.id}
                      className="flex items-start gap-2.5 group/step"
                    >
                      <button
                        onClick={() => onToggleStep?.(step.id)}
                        className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                          step.completed
                            ? 'bg-[#7BAF73]/20 border-[#7BAF73]/40'
                            : 'border-[#3D3B37] hover:border-[#6B6560]'
                        }`}
                      >
                        {step.completed && <Check size={10} className="text-[#7BAF73]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        {onEditStep ? (
                          <InlineEdit
                            value={step.text}
                            onSave={(v) => onEditStep(step.id, v)}
                            className={`text-[11px] leading-relaxed ${step.completed ? 'text-[#6B6560] line-through' : 'text-[#F5F0E8]'}`}
                          />
                        ) : (
                          <p className={`text-[11px] leading-relaxed ${step.completed ? 'text-[#6B6560] line-through' : 'text-[#F5F0E8]'}`}>
                            {step.text}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ color: catColor, backgroundColor: catColor + '15', border: `1px solid ${catColor}30` }}
                      >
                        {STEP_CATEGORY_LABELS[step.category] || step.category}
                      </span>
                      {/* Delete button for user-added steps */}
                      {isExtraStep(step.id) && onRemoveStep && (
                        <button
                          onClick={() => onRemoveStep(item.id, step.id)}
                          className="w-4 h-4 mt-0.5 rounded flex items-center justify-center text-[#6B6560] hover:text-[#C75F4F] opacity-0 group-hover/step:opacity-100 transition-all cursor-pointer shrink-0"
                          title="Remove step"
                        >
                          <Trash2 size={9} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add step */}
              {onAddStep && (
                <div className="mt-2.5">
                  {addingStep ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        ref={newStepRef}
                        value={newStepText}
                        onChange={e => setNewStepText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddStep();
                          if (e.key === 'Escape') { setAddingStep(false); setNewStepText(''); }
                        }}
                        placeholder="New step..."
                        autoFocus
                        className="flex-1 bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded px-2 py-1 text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                      />
                      <button
                        onClick={handleAddStep}
                        disabled={!newStepText.trim()}
                        className="text-[10px] font-mono text-[#7BAF73] hover:text-[#F5F0E8] disabled:text-[#3D3B37] transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingStep(false); setNewStepText(''); }}
                        className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingStep(true); }}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
                    >
                      <Plus size={10} />
                      Add step
                    </button>
                  )}
                </div>
              )}

              {/* Ask AI for more */}
              {onAskAI && (
                <button
                  onClick={() => onAskAI(item)}
                  className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                >
                  <Sparkles size={10} />
                  Get tailored steps from MusicSpace
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
