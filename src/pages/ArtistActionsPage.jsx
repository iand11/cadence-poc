import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, History, Music, AlertCircle, RotateCcw } from 'lucide-react';
import ActionItem from '../components/actions/ActionItem';
import ActionChecklistRow from '../components/actions/ActionChecklistRow';
import ActionSelector from '../components/actions/ActionSelector';
import { useActions } from '../hooks/useActions';
import { DATA_TYPE_LABELS } from '../data/actions';

// Section order for grouping actions (mirrors campaign phases).
const SECTION_ORDER = ['streaming', 'social', 'playlists', 'geography', 'revenue', 'general'];

export default function ArtistActionsPage() {
  const { artistSlug } = useParams();
  const {
    actions, selectedActions, ignoredActions,
    restore, toggleStep,
    editAction, setOwner, editStep, addStep, removeStep,
    deleteAction, deselectAction, selectActions, addCustomAction,
  } = useActions();

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  // This artist's checklist = selected actions that are active or completed.
  const checklistActions = useMemo(
    () => actions.filter(a => a.selected && a.artistSlug === artistSlug && (a.status === 'active' || a.status === 'completed')),
    [actions, artistSlug],
  );

  // Artist info from any action for this slug.
  const artistInfo = useMemo(() => {
    const any = actions.find(a => a.artistSlug === artistSlug);
    return any ? { name: any.artistName, imageUrl: any.artistImage } : { name: artistSlug, imageUrl: null };
  }, [actions, artistSlug]);

  // An action is done only when all of its tasks are complete.
  const isDone = (a) => (a.steps || []).length > 0 && (a.steps || []).every(s => s.completed);

  const progress = useMemo(() => {
    const total = checklistActions.length;
    const done = checklistActions.filter(isDone).length;
    const today = new Date().toISOString().split('T')[0];
    const overdue = checklistActions.filter(a => !isDone(a) && a.dueDate && a.dueDate < today).length;
    const hasChecked = checklistActions.some(a => (a.steps || []).some(s => s.completed));
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0, overdue, hasChecked };
  }, [checklistActions]);

  // Group into ordered sections by data type.
  const sections = useMemo(() => {
    const map = new Map();
    for (const a of checklistActions) {
      const key = a.dataType || 'general';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return SECTION_ORDER
      .filter(key => map.has(key))
      .map(key => ({ key, label: DATA_TYPE_LABELS[key] || key, items: map.get(key) }));
  }, [checklistActions]);

  // Ignored actions surface under History (completed ones show inline, checked).
  const archivedItems = useMemo(() => {
    if (!showArchive) return [];
    return ignoredActions.filter(a => a.selected && a.artistSlug === artistSlug);
  }, [showArchive, ignoredActions, artistSlug]);

  const alreadySelected = useMemo(() => {
    const map = {};
    for (const a of selectedActions) {
      if (a.artistSlug === artistSlug) map[a.id] = true;
    }
    return map;
  }, [selectedActions, artistSlug]);

  // Reset = uncheck every completed task across this artist's actions.
  const resetChecklist = useCallback(() => {
    checklistActions.forEach(a => (a.steps || []).forEach(s => { if (s.completed) toggleStep(s.id); }));
  }, [checklistActions, toggleStep]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] font-mono text-[#6B6560] mb-4">
        <Link to="/app/actions" className="hover:text-[#F5F0E8] transition-colors">Actions</Link>
        <span>›</span>
        <span className="text-[#9B9590]">{artistInfo.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-[#171614] border border-[#2C2B28] rounded-lg p-5">
        <div className="flex items-center gap-4">
          <Link
            to="/app/actions"
            className="w-8 h-8 rounded flex items-center justify-center text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#2C2B28] transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          {artistInfo.imageUrl ? (
            <img src={artistInfo.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover object-[center_20%] shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#2C2B28] flex items-center justify-center shrink-0">
              <Music size={20} className="text-[#6B6560]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#DA7756] mb-0.5">Actions</div>
            <h2 className="text-2xl font-medium text-[#F5F0E8] truncate leading-tight">{artistInfo.name}</h2>
            <p className="text-[10px] font-mono text-[#6B6560] mt-1">
              {progress.total} action{progress.total !== 1 ? 's' : ''} in play
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowArchive(v => !v)}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                showArchive
                  ? 'text-[#DA7756] border-[#DA7756]/30 bg-[#DA7756]/10'
                  : 'text-[#6B6560] border-[#2C2B28] hover:text-[#9B9590] hover:border-[#3D3B37]'
              }`}
            >
              <History size={11} />
              History
            </button>
            <button
              onClick={() => setSelectorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
            >
              <Plus size={11} />
              Add Actions
            </button>
          </div>
        </div>
      </div>

      {checklistActions.length > 0 ? (
        <div className="bg-[#171614] border border-[#2C2B28] rounded-lg p-6 mt-4">
          {/* Progress header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-[#F5F0E8]">{progress.done}</span>
              <span className="text-[12px] font-mono text-[#6B6560]">of {progress.total} done · {progress.pct}%</span>
              {progress.overdue > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#C75F4F] ml-2">
                  <AlertCircle size={11} /> {progress.overdue} overdue
                </span>
              )}
            </div>
            {progress.hasChecked && (
              <button
                onClick={resetChecklist}
                className="flex items-center gap-1.5 text-[11px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <div className="h-1.5 bg-[#2C2B28] rounded-full overflow-hidden">
            <div className="h-full bg-[#7BAF73] rounded-full transition-all duration-300" style={{ width: `${progress.pct}%` }} />
          </div>

          {/* Sections */}
          <div className="mt-6 space-y-6">
            {sections.map(section => (
              <div key={section.key}>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B6560] mb-2.5">
                  {section.label}
                </div>
                <div className="space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {section.items.map(item => (
                      <ActionChecklistRow
                        key={item.id}
                        item={item}
                        onSetOwner={setOwner}
                        onEditAction={editAction}
                        onToggleStep={toggleStep}
                        onEditStep={editStep}
                        onAddStep={addStep}
                        onRemoveStep={removeStep}
                        onDeselect={deselectAction}
                        onDelete={deleteAction}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center mt-4">
          <p className="text-xs text-[#6B6560] mb-4">No actions selected for this artist yet</p>
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors cursor-pointer"
          >
            <Plus size={12} />
            Add Actions
          </button>
        </div>
      )}

      {/* History (ignored actions) */}
      {showArchive && (
        <div className="mt-6 pt-4 border-t border-[#2C2B28]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B6560] mb-3">
            History ({archivedItems.length})
          </p>
          {archivedItems.length > 0 ? (
            <div className="space-y-1.5">
              {archivedItems.map(item => (
                <ActionItem
                  key={item.id}
                  item={item}
                  onRestore={restore}
                  showArtist={false}
                  archived
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B6560] text-center py-4">No dismissed actions</p>
          )}
        </div>
      )}

      {/* Selector modal — pre-filtered to this artist */}
      <ActionSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        allActions={actions}
        alreadySelected={alreadySelected}
        onSelect={selectActions}
        onCreateCustom={addCustomAction}
        initialArtistSlug={artistSlug}
      />
    </motion.div>
  );
}
