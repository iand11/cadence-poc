import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, History, Music } from 'lucide-react';
import ActionItem from '../components/actions/ActionItem';
import ActionSelector from '../components/actions/ActionSelector';
import { useActions } from '../hooks/useActions';
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLevel } from '../data/actions';

function FilterPills({ options, value, onChange, label }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] shrink-0">{label}</span>
      <button
        onClick={() => onChange(null)}
        className={`text-[10px] font-mono px-2 py-1 rounded-full border transition-colors cursor-pointer ${
          value === null
            ? 'text-[#DA7756] border-[#DA7756]/30 bg-[#DA7756]/10'
            : 'text-[#6B6560] border-[#2C2B28] hover:text-[#9B9590] hover:border-[#3D3B37]'
        }`}
      >
        All
      </button>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key === value ? null : opt.key)}
          className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full border transition-colors cursor-pointer ${
            value === opt.key
              ? 'text-[#DA7756] border-[#DA7756]/30 bg-[#DA7756]/10'
              : 'text-[#6B6560] border-[#2C2B28] hover:text-[#9B9590] hover:border-[#3D3B37]'
          }`}
        >
          {opt.color && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opt.color }} />
          )}
          {opt.label}
          <span className="text-[#4A4844]">{opt.count}</span>
        </button>
      ))}
    </div>
  );
}

function getPriorityOptions(items) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const item of items) counts[getPriorityLevel(item)]++;
  return PRIORITY_ORDER
    .filter(level => counts[level] > 0)
    .map(level => ({ key: level, label: PRIORITY_LABELS[level], color: PRIORITY_COLORS[level], count: counts[level] }));
}

export default function ArtistActionsPage() {
  const { artistSlug } = useParams();
  const {
    actions, selectedActions, completedActions, ignoredActions,
    markCompleted, markIgnored, restore, toggleStep,
    editAction, editStep, addStep, removeStep,
    deleteAction, deselectAction, selectActions, addCustomAction,
  } = useActions();

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [filterPriority, setFilterPriority] = useState(null);

  // This artist's selected actions
  const artistActions = useMemo(
    () => selectedActions.filter(a => a.artistSlug === artistSlug),
    [selectedActions, artistSlug],
  );

  // Artist info from first action (or fallback)
  const artistInfo = useMemo(() => {
    const any = actions.find(a => a.artistSlug === artistSlug);
    return any ? { name: any.artistName, imageUrl: any.artistImage } : { name: artistSlug, imageUrl: null };
  }, [actions, artistSlug]);

  // Filter options
  const priorityOptions = useMemo(() => getPriorityOptions(artistActions), [artistActions]);

  const hasFilters = !!filterPriority;

  const filteredActions = useMemo(() => {
    let items = artistActions;
    if (filterPriority) items = items.filter(a => getPriorityLevel(a) === filterPriority);
    return items;
  }, [artistActions, filterPriority]);

  // Archived actions for this artist
  const archivedItems = useMemo(() => {
    if (!showArchive) return [];
    return [...completedActions, ...ignoredActions].filter(a => a.selected && a.artistSlug === artistSlug);
  }, [showArchive, completedActions, ignoredActions, artistSlug]);

  // Already selected IDs for the selector modal
  const alreadySelected = useMemo(() => {
    const map = {};
    for (const a of selectedActions) {
      if (a.artistSlug === artistSlug) map[a.id] = true;
    }
    return map;
  }, [selectedActions, artistSlug]);

  const resetFilters = () => {
    setFilterPriority(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/app/actions"
            className="w-8 h-8 rounded flex items-center justify-center text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#2C2B28] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          {artistInfo.imageUrl ? (
            <img src={artistInfo.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
              <Music size={16} className="text-[#6B6560]" />
            </div>
          )}
          <div>
            <h2 className="text-base font-medium text-[#F5F0E8]">{artistInfo.name}</h2>
            <p className="text-[10px] font-mono text-[#6B6560]">
              {artistActions.length} action{artistActions.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {artistActions.length > 0 && (
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
          )}
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
          >
            <Plus size={11} />
            Add Actions
          </button>
        </div>
      </div>

      {/* Filters */}
      {artistActions.length > 0 && priorityOptions.length > 1 && (
        <div className="space-y-2 mb-4 p-3 rounded bg-[#171614] border border-[#2C2B28]">
          <FilterPills options={priorityOptions} value={filterPriority} onChange={setFilterPriority} label="Priority" />
          {hasFilters && (
            <button onClick={resetFilters} className="text-[10px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {hasFilters && (
        <p className="text-[10px] font-mono text-[#6B6560] mb-3">
          Showing {filteredActions.length} of {artistActions.length} actions
        </p>
      )}

      {/* Action list */}
      {filteredActions.length > 0 ? (
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {filteredActions.map(item => (
              <ActionItem
                key={item.id}
                item={item}
                onComplete={markCompleted}
                onIgnore={markIgnored}
                onDelete={deleteAction}
                onDeselect={deselectAction}
                onToggleStep={toggleStep}
                onEditAction={editAction}
                onEditStep={editStep}
                onAddStep={addStep}
                onRemoveStep={removeStep}
                showArtist={false}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-xs text-[#6B6560] mb-4">
            {hasFilters ? 'No actions match these filters' : 'No actions selected for this artist yet'}
          </p>
          {!hasFilters && (
            <button
              onClick={() => setSelectorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors cursor-pointer"
            >
              <Plus size={12} />
              Add Actions
            </button>
          )}
        </div>
      )}

      {/* Archive section */}
      {showArchive && archivedItems.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#2C2B28]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B6560] mb-3">
            Archived ({archivedItems.length})
          </p>
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
        </div>
      )}
      {showArchive && archivedItems.length === 0 && artistActions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#2C2B28]">
          <p className="text-xs text-[#6B6560] text-center py-4">No archived items</p>
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
