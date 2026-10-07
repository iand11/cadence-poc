import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Trash2, Check, ChevronRight, Search, Music, FolderPlus } from 'lucide-react';
import { useFollowedArtists } from '../../hooks/useFollowedArtists';
import { NewGroupInput } from './ArtistGroups';

function Avatar({ artist, className = 'w-6 h-6' }) {
  return artist?.imageUrl ? (
    <img src={artist.imageUrl} alt="" className={`${className} rounded-full object-cover shrink-0 ring-2 ring-[#171614]`} />
  ) : (
    <div className={`${className} rounded-full bg-[#2C2B28] flex items-center justify-center shrink-0 ring-2 ring-[#171614]`}>
      <Music size={10} className="text-[#6B6560]" />
    </div>
  );
}

/** Overlapping avatars for a group's first few members. */
export function AvatarStack({ artists, max = 4, size = 'w-6 h-6' }) {
  if (artists.length === 0) return null;
  return (
    <span className="flex items-center -space-x-1.5">
      {artists.slice(0, max).map(a => <Avatar key={a.slug} artist={a} className={size} />)}
      {artists.length > max && (
        <span className={`${size} rounded-full bg-[#2C2B28] ring-2 ring-[#171614] flex items-center justify-center text-[9px] font-mono text-[#9B9590] shrink-0`}>
          +{artists.length - max}
        </span>
      )}
    </span>
  );
}

function GroupRow({ group, members, followedArtists, expanded, onToggleExpand }) {
  const { renameGroup, deleteGroup, toggleInGroup } = useFollowedArtists();
  const [renaming, setRenaming] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState('');

  const memberSet = useMemo(() => new Set(group.slugs), [group.slugs]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? followedArtists.filter(a => a.name.toLowerCase().includes(q)) : followedArtists;
    // Members first, then alphabetical
    return [...list].sort((a, b) => (memberSet.has(b.slug) - memberSet.has(a.slug)) || a.name.localeCompare(b.name));
  }, [followedArtists, query, memberSet]);

  const saveRename = () => {
    if (renaming?.trim()) renameGroup(group.id, renaming);
    setRenaming(null);
  };

  return (
    <div className={`rounded-lg border transition-colors ${expanded ? 'border-[#3D3B37] bg-[#131211]' : 'border-[#2C2B28]'}`}>
      <div className="group flex items-center gap-3 px-3.5 py-3">
        <button onClick={onToggleExpand} aria-label={expanded ? 'Collapse' : 'Edit artists'} className="text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />

        {renaming !== null ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <input
              value={renaming}
              onChange={e => setRenaming(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(null); }}
              autoFocus
              maxLength={40}
              className="h-7 flex-1 min-w-0 max-w-xs bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded-md px-2.5 text-xs text-[#F5F0E8] outline-none"
            />
            <button onClick={saveRename} className="text-[10px] font-mono text-[#7BAF73] hover:text-[#F5F0E8] cursor-pointer">Save</button>
            <button onClick={() => setRenaming(null)} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
          </span>
        ) : (
          <button onClick={onToggleExpand} className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
            <span className="text-sm text-[#F5F0E8] truncate">{group.name}</span>
            <span className="text-[10px] font-mono text-[#6B6560] shrink-0">
              {members.length} artist{members.length === 1 ? '' : 's'}
            </span>
            <span className="hidden sm:block ml-auto"><AvatarStack artists={members} max={5} /></span>
          </button>
        )}

        {renaming === null && (confirmDelete ? (
          <span className="flex items-center gap-2 text-[10px] font-mono shrink-0">
            <span className="text-[#9B9590] hidden sm:inline">Delete group? Artists stay followed.</span>
            <button onClick={() => deleteGroup(group.id)} className="text-[#C75F4F] hover:text-[#F5F0E8] cursor-pointer">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
          </span>
        ) : (
          <span className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleExpand}
              className="hidden sm:inline px-2 py-1 rounded text-[10px] font-mono text-[#9B9590] hover:text-[#DA7756] cursor-pointer"
            >
              {expanded ? 'Done' : 'Edit artists'}
            </button>
            <button onClick={() => setRenaming(group.name)} aria-label="Rename group" title="Rename" className="p-1.5 rounded text-[#6B6560] hover:text-[#F5F0E8] hover:bg-[#2C2B28] cursor-pointer">
              <Pencil size={12} />
            </button>
            <button onClick={() => setConfirmDelete(true)} aria-label="Delete group" title="Delete" className="p-1.5 rounded text-[#6B6560] hover:text-[#C75F4F] hover:bg-[#2C2B28] cursor-pointer">
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 border-t border-[#2C2B28]/70 space-y-3">
              <div className="flex items-center gap-2 mt-2.5 h-8 px-2.5 rounded-md bg-[#0D0C0B] border border-[#2C2B28] focus-within:border-[#3D3B37] max-w-sm">
                <Search size={12} className="text-[#6B6560] shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter artists you follow"
                  className="flex-1 bg-transparent text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {candidates.map(a => {
                  const on = memberSet.has(a.slug);
                  return (
                    <button
                      key={a.slug}
                      onClick={() => toggleInGroup(group.id, a.slug)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                        on ? 'border-[#DA7756]/40 bg-[#DA7756]/5' : 'border-[#2C2B28] hover:border-[#3D3B37]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'}`}>
                        {on && <Check size={10} strokeWidth={3} className="text-[#0D0C0B]" />}
                      </span>
                      <Avatar artist={a} className="w-6 h-6" />
                      <span className={`text-xs truncate ${on ? 'text-[#F5F0E8]' : 'text-[#9B9590]'}`}>{a.name}</span>
                    </button>
                  );
                })}
              </div>
              {candidates.length === 0 && (
                <p className="text-[11px] text-[#6B6560]">No followed artists match "{query}".</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Full group management: create (with suggestions), rename, delete, and pick
 * members from the artists the user follows.
 */
export default function GroupsManager({ initialExpandedId = null }) {
  const { groups, followedArtists, createGroup } = useFollowedArtists();
  const [expandedId, setExpandedId] = useState(initialExpandedId);
  const bySlug = useMemo(() => new Map(followedArtists.map(a => [a.slug, a])), [followedArtists]);

  const handleCreate = (name) => {
    const id = createGroup(name);
    if (id) setExpandedId(id); // open it so the user can add artists right away
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-[#3D3B37] p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <FolderPlus size={14} className="text-[#DA7756]" />
          <span className="text-xs text-[#F5F0E8]">Create a group</span>
          <span className="text-[10px] text-[#6B6560]">Name it yourself or pick a suggestion</span>
        </div>
        <NewGroupInput onCreate={handleCreate} autoFocus={groups.length === 0} />
      </div>

      {groups.length > 0 ? (
        <div className="space-y-1.5">
          {groups.map(g => (
            <GroupRow
              key={g.id}
              group={g}
              members={g.slugs.map(s => bySlug.get(s)).filter(Boolean)}
              followedArtists={followedArtists}
              expanded={expandedId === g.id}
              onToggleExpand={() => setExpandedId(id => (id === g.id ? null : g.id))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#6B6560] text-center py-6">
          No groups yet. Groups let you organize the artists you follow, for example by priority, career stage or label,
          and filter dashboard widgets by group.
        </p>
      )}
    </div>
  );
}
