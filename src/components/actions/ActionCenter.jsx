import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ListChecks, ChevronRight, Plus, Music, AlertCircle, UserX, Calendar } from 'lucide-react';
import ActionItem from './ActionItem';
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLevel } from '../../data/actions';
import { OWNERS } from '../../hooks/useActions';

const todayISO = () => new Date().toISOString().split('T')[0];
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Flat triage row list — overdue or unassigned actions across the whole roster.
function TriageList({ tasks, kind, today, setOwner }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-[#171614] border border-[#2C2B28] rounded-lg p-8 text-center text-[11px] font-mono text-[#6B6560]">
        {kind === 'overdue'
          ? 'Nothing overdue across your roster.'
          : 'Every selected action has an owner.'}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <AnimatePresence mode="popLayout">
        {tasks.map(t => {
          const overdue = t.dueDate && t.dueDate < today;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              className="flex items-center gap-3 bg-[#171614] border border-[#2C2B28] rounded-lg px-3.5 py-2.5 hover:border-[#3D3B37] transition-colors group"
            >
              <span
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                  kind === 'overdue' ? 'bg-[#C75F4F]/15 text-[#C75F4F]' : 'bg-[#2C2B28] text-[#9B9590]'
                }`}
              >
                {kind === 'overdue' ? <AlertCircle size={14} /> : <UserX size={14} />}
              </span>
              <Link to={`/app/actions/${t.artistSlug}`} className="min-w-0 flex-1">
                <div className="text-xs text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                  {t.action}
                </div>
                <div className="text-[10px] font-mono text-[#6B6560] truncate">
                  {t.artistName} · {PRIORITY_LABELS[getPriorityLevel(t)]}
                </div>
              </Link>
              {kind === 'unassigned' ? (
                <select
                  value={t.owner || ''}
                  onChange={e => setOwner(t.id, e.target.value || null)}
                  className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-2 py-1 text-[10px] font-mono text-[#F5F0E8] outline-none focus:border-[#DA7756]/40 shrink-0 cursor-pointer"
                >
                  <option value="">Assign…</option>
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <>
                  {t.owner && (
                    <span className="hidden sm:inline text-[10px] font-mono text-[#9B9590] bg-[#2C2B28] rounded-full px-2 py-0.5 shrink-0">
                      {t.owner}
                    </span>
                  )}
                  {t.dueDate && (
                    <span className={`text-[10px] font-mono shrink-0 ${overdue ? 'text-[#C75F4F]' : 'text-[#6B6560]'}`}>
                      {fmtDate(t.dueDate)}
                    </span>
                  )}
                </>
              )}
              <ChevronRight size={14} className="text-[#6B6560] shrink-0" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function ActionCenter({
  selectedActions,
  completedActions,
  ignoredActions,
  counts,
  restore,
  setOwner,
  onOpenSelector,
}) {
  const [view, setView] = useState('artists');
  const today = todayISO();

  // Group selected actions by artist, with roll-up progress + due metrics.
  const artistGroups = useMemo(() => {
    const map = new Map();
    for (const a of selectedActions) {
      if (!map.has(a.artistSlug)) {
        map.set(a.artistSlug, {
          slug: a.artistSlug,
          name: a.artistName,
          imageUrl: a.artistImage,
          actions: [],
        });
      }
      map.get(a.artistSlug).actions.push(a);
    }
    const groups = Array.from(map.values()).map(g => {
      const totalSteps = g.actions.reduce((s, a) => s + (a.steps || []).length, 0);
      const completedSteps = g.actions.reduce((s, a) => s + (a.steps || []).filter(st => st.completed).length, 0);
      const overdue = g.actions.filter(a => a.dueDate && a.dueDate < today).length;
      const nextDue = g.actions
        .filter(a => a.dueDate && a.dueDate >= today)
        .map(a => a.dueDate)
        .sort()[0] || null;
      const priorityCounts = { high: 0, medium: 0, low: 0 };
      g.actions.forEach(a => priorityCounts[getPriorityLevel(a)]++);
      return {
        ...g,
        totalSteps,
        completedSteps,
        pct: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        overdue,
        nextDue,
        priorityCounts,
      };
    });
    // Most work first: lowest completion, then most actions.
    groups.sort((a, b) => a.pct - b.pct || b.actions.length - a.actions.length);
    return groups;
  }, [selectedActions, today]);

  // Flattened triage lists across all artists.
  const { overdueTasks, unassignedTasks } = useMemo(() => {
    const overdueTasks = [];
    const unassignedTasks = [];
    for (const a of selectedActions) {
      if (a.dueDate && a.dueDate < today) overdueTasks.push(a);
      if (!a.owner) unassignedTasks.push(a);
    }
    overdueTasks.sort((x, y) => (x.dueDate || '').localeCompare(y.dueDate || ''));
    return { overdueTasks, unassignedTasks };
  }, [selectedActions, today]);

  // Archived items that were previously selected.
  const archivedItems = useMemo(
    () => [...completedActions, ...ignoredActions].filter(a => a.selected),
    [completedActions, ignoredActions],
  );

  const chips = [
    { id: 'artists', label: 'Artists', count: artistGroups.length },
    { id: 'overdue', label: 'Overdue', count: overdueTasks.length },
    { id: 'unassigned', label: 'Unassigned', count: unassignedTasks.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
            <ListChecks size={15} className="text-[#DA7756]" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#F5F0E8]">Action Center</h2>
            <p className="text-[10px] font-mono text-[#6B6560]">
              {counts.selected} selected · {artistGroups.length} artist{artistGroups.length !== 1 ? 's' : ''}{counts.completed > 0 ? ` · ${counts.completed} done` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSelector}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
          >
            <Plus size={11} />
            Add Actions
          </button>
        </div>
      </div>

      {/* Empty state */}
      {selectedActions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center mb-4">
            <ListChecks size={20} className="text-[#DA7756]" />
          </div>
          <p className="text-sm text-[#F5F0E8] mb-1">No actions selected yet</p>
          <p className="text-[11px] text-[#6B6560] mb-5 max-w-xs">
            Browse your roster's generated actions and select the ones you want to focus on.
          </p>
          <button
            onClick={onOpenSelector}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Add Actions
          </button>
        </div>
      )}

      {selectedActions.length > 0 && (
        <>
          {/* Segmented triage chips */}
          <div className="flex items-center gap-1.5 mb-5">
            {chips.map(c => (
              <button
                key={c.id}
                onClick={() => setView(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  view === c.id
                    ? 'bg-[#DA7756] text-[#0D0C0B]'
                    : 'border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]'
                }`}
              >
                {c.label}
                <span className={view === c.id ? 'opacity-70' : 'text-[#6B6560]'}>{c.count}</span>
              </button>
            ))}
          </div>

          {/* Artist cards */}
          {view === 'artists' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {artistGroups.map((g, index) => {
                  const priorityTags = PRIORITY_ORDER.filter(level => g.priorityCounts[level] > 0);
                  return (
                    <motion.div
                      key={g.slug}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                      layout
                    >
                      <Link
                        to={`/app/actions/${g.slug}`}
                        className="block bg-[#171614] border border-[#2C2B28] rounded-lg p-4 hover:border-[#3D3B37] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          {g.imageUrl ? (
                            <img
                              src={g.imageUrl}
                              alt={g.name}
                              className="w-11 h-11 rounded-lg object-cover object-[center_20%] shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-[#2C2B28] flex items-center justify-center shrink-0">
                              <Music size={18} className="text-[#6B6560]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">
                              {g.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                              {priorityTags.map(level => (
                                <span key={level} className="flex items-center gap-1 text-[9px] font-mono text-[#9B9590]">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                                  {g.priorityCounts[level]}
                                </span>
                              ))}
                              <span className="text-[10px] font-mono text-[#6B6560]">
                                {g.actions.length} action{g.actions.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-lg font-semibold text-[#F5F0E8] shrink-0">{g.pct}%</span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 bg-[#2C2B28] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#7BAF73] rounded-full transition-all"
                            style={{ width: `${g.pct}%` }}
                          />
                        </div>

                        {/* Footer */}
                        <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[#6B6560]">
                            {g.totalSteps > 0 ? `${g.completedSteps} of ${g.totalSteps} steps` : `${g.actions.length} action${g.actions.length !== 1 ? 's' : ''}`}
                          </span>
                          <span className="flex items-center gap-2.5">
                            {g.overdue > 0 && (
                              <span className="flex items-center gap-1 text-[#C75F4F]">
                                <AlertCircle size={11} /> {g.overdue} overdue
                              </span>
                            )}
                            {g.nextDue && (
                              <span className="flex items-center gap-1 text-[#6B6560]">
                                <Calendar size={10} /> {fmtDate(g.nextDue)}
                              </span>
                            )}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {view === 'overdue' && (
            <TriageList tasks={overdueTasks} kind="overdue" today={today} setOwner={setOwner} />
          )}
          {view === 'unassigned' && (
            <TriageList tasks={unassignedTasks} kind="unassigned" today={today} setOwner={setOwner} />
          )}
        </>
      )}

      {/* Archive section */}
      {view === 'artists' && archivedItems.length > 0 && (
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
                showArtist
                archived
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
