import { useMemo } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { useFollowedArtists, GROUP_SUGGESTIONS } from '../../hooks/useFollowedArtists';
import { AvatarStack } from './GroupsManager';

/**
 * Compact groups list for the dashboard sidebar (shares the Favorites card).
 * Clicking a group opens the groups manager on it. With no groups yet it
 * offers one-click suggestions.
 *
 * onOpen(groupId | null) opens the groups manager, expanded on that group.
 */
export default function GroupsSidebarList({ onOpen }) {
  const { groups, followedArtists, createGroup } = useFollowedArtists();
  const bySlug = useMemo(() => new Map(followedArtists.map(a => [a.slug, a])), [followedArtists]);

  if (groups.length === 0) {
    return (
      <div className="py-2">
        <div className="text-center mb-3">
          <FolderPlus size={16} className="mx-auto mb-1.5 text-[#3D3B37]" />
          <p className="text-[10px] text-[#6B6560] leading-relaxed">
            Organize the artists you<br />follow into groups
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {GROUP_SUGGESTIONS.slice(0, 4).map(s => (
            <button
              key={s}
              onClick={() => onOpen(createGroup(s))}
              className="px-2 py-0.5 rounded-full border border-dashed border-[#3D3B37] text-[10px] text-[#9B9590] hover:border-[#DA7756]/50 hover:text-[#DA7756] transition-colors cursor-pointer"
            >
              + {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => onOpen(null)}
          className="mt-2.5 w-full text-[10px] text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          Custom group…
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-0.5">
        {groups.map(g => {
          const members = g.slugs.map(s => bySlug.get(s)).filter(Boolean);
          return (
            <button
              key={g.id}
              onClick={() => onOpen(g.id)}
              title={`Manage ${g.name}`}
              className="group w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1C1B18] transition-colors text-left cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{g.name}</p>
                <p className="text-[9px] text-[#6B6560]">
                  {members.length ? `${members.length} artist${members.length === 1 ? '' : 's'}` : 'Add artists'}
                </p>
              </div>
              <AvatarStack artists={members} max={3} size="w-5 h-5" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onOpen(null)}
        className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-dashed border-[#2C2B28] text-[10px] text-[#6B6560] hover:text-[#DA7756] hover:border-[#DA7756]/40 transition-colors cursor-pointer"
      >
        <Plus size={10} /> New group
      </button>
    </div>
  );
}
