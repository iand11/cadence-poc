import { useMemo } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ListChecks, ChevronRight, Plus, Music } from 'lucide-react';
import ActionItem from './ActionItem';
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLevel } from '../../data/actions';

export default function ActionCenter({
  selectedActions,
  completedActions,
  ignoredActions,
  counts,
  restore,
  onOpenSelector,
}) {
  // Group selected actions by artist
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
    return Array.from(map.values()).sort((a, b) => b.actions.length - a.actions.length);
  }, [selectedActions]);

  // Archived items that were previously selected
  const archivedItems = useMemo(() => {
    return [...completedActions, ...ignoredActions].filter(a => a.selected);
  }, [completedActions, ignoredActions]);

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

      {/* Artist cards grid */}
      {artistGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {artistGroups.map((group, index) => {
              const priorityCounts = { high: 0, medium: 0, low: 0 };
              group.actions.forEach(a => priorityCounts[getPriorityLevel(a)]++);
              const highCount = priorityCounts.high;
              const completedStepCount = group.actions.reduce((s, a) => s + (a.steps || []).filter(st => st.completed).length, 0);
              const totalStepCount = group.actions.reduce((s, a) => s + (a.steps || []).length, 0);
              const priorityTags = PRIORITY_ORDER.filter(level => priorityCounts[level] > 0);

              return (
                <motion.div
                  key={group.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  layout
                >
                  <Link
                    to={`/app/actions/${group.slug}`}
                    className="block relative bg-[#171614] border border-[#2C2B28] rounded overflow-hidden hover:border-[#3D3B37] transition-colors group"
                  >
                    {/* Artist image */}
                    <div className="relative h-32 overflow-hidden">
                      {group.imageUrl ? (
                        <img
                          src={group.imageUrl}
                          alt={group.name}
                          className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#2C2B28] flex items-center justify-center">
                          <Music size={28} className="text-[#6B6560]" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#171614] via-transparent to-transparent" />

                      {/* Action count badge */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/50 backdrop-blur-sm text-[#F5F0E8]">
                        {group.actions.length} action{group.actions.length !== 1 ? 's' : ''}
                      </div>

                      {/* High-priority badge */}
                      {highCount > 0 && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/50 backdrop-blur-sm" style={{ color: PRIORITY_COLORS.high }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS.high }} />
                          {highCount} high
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-4 -mt-2 relative">
                      <h3 className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#DA7756] transition-colors truncate">
                        {group.name}
                      </h3>

                      {/* Priority breakdown tags */}
                      {priorityTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {priorityTags.map(level => (
                            <span
                              key={level}
                              className="flex items-center gap-1 text-[9px] font-mono bg-[#2C2B28] text-[#9B9590] rounded px-1.5 py-0.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                              {priorityCounts[level]} {PRIORITY_LABELS[level]}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Progress footer */}
                      <div className="flex items-center justify-between mt-3">
                        {totalStepCount > 0 ? (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1 h-1 bg-[#2C2B28] rounded-full max-w-[100px]">
                              <div
                                className="h-1 bg-[#7BAF73] rounded-full transition-all"
                                style={{ width: `${(completedStepCount / totalStepCount) * 100}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-[#6B6560]">{completedStepCount}/{totalStepCount} steps</span>
                          </div>
                        ) : (
                          <span className="text-[9px] font-mono text-[#6B6560]">{group.actions.length} action{group.actions.length !== 1 ? 's' : ''}</span>
                        )}
                        <ChevronRight size={12} className="text-[#6B6560] shrink-0" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Archive section */}
      {archivedItems.length > 0 && (
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
