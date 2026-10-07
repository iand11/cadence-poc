import { useState, useRef, useEffect } from 'react';
import { Tag, Check, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useFollowedArtists, GROUP_SUGGESTIONS } from '../../hooks/useFollowedArtists';

// Shared pieces for followed-artist groups: a per-artist group menu, chips,
// a filter bar (with create/rename/delete), and the name-with-suggestions input.

function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, open, onClose]);
}

/** Text input for naming a group, with suggestion chips for names not yet used. */
export function NewGroupInput({ onCreate, onCancel, autoFocus = true, compact = false }) {
  const { groups } = useFollowedArtists();
  const [name, setName] = useState('');
  const taken = new Set(groups.map((g) => g.name.toLowerCase()));
  const suggestions = GROUP_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

  const submit = (value) => {
    const v = (value ?? name).trim();
    if (!v) return;
    onCreate(v);
    setName('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel?.();
          }}
          placeholder="Name a new group"
          autoFocus={autoFocus}
          maxLength={40}
          className={`flex-1 min-w-0 bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded-md px-2.5 ${compact ? 'h-7' : 'h-8'} text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none`}
        />
        <button
          onClick={() => submit()}
          disabled={!name.trim()}
          className="text-[10px] font-mono text-[#7BAF73] hover:text-[#F5F0E8] disabled:text-[#3D3B37] transition-colors cursor-pointer"
        >
          Create
        </button>
        {onCancel && (
          <button onClick={onCancel} className="text-[10px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            Cancel
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="px-2 py-0.5 rounded-full border border-dashed border-[#3D3B37] text-[10px] text-[#9B9590] hover:border-[#DA7756]/50 hover:text-[#DA7756] transition-colors cursor-pointer"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small colored chips for the groups an artist belongs to. */
export function GroupChips({ slug, max = 3 }) {
  const { groupsFor } = useFollowedArtists();
  const list = groupsFor(slug);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {shown.map((g) => (
        <span
          key={g.id}
          className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] leading-tight"
          style={{ color: g.color, backgroundColor: g.color + '18', border: `1px solid ${g.color}35` }}
        >
          {g.name}
        </span>
      ))}
      {list.length > max && <span className="text-[9px] text-[#6B6560]">+{list.length - max}</span>}
    </span>
  );
}

/**
 * Button + popover to put one artist into groups (or create a new group with
 * them in it). Renders nothing for artists the user doesn't follow.
 */
export function GroupMenu({ slug, align = 'right', size = 'sm', label = false }) {
  const { groups, isFollowing, toggleInGroup, createGroup } = useFollowedArtists();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);
  const close = () => { setOpen(false); setCreating(false); };
  useClickOutside(ref, open, close);

  if (!isFollowing(slug)) return null;
  const inCount = groups.filter((g) => g.slugs.includes(slug)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Add to groups"
        aria-label="Add to groups"
        className={`flex items-center gap-1 rounded border transition-colors cursor-pointer ${
          size === 'sm' ? 'p-1' : 'px-2.5 py-1.5'
        } ${inCount > 0 ? 'border-[#DA7756]/30 text-[#DA7756]' : 'border-[#2C2B28] text-[#6B6560] hover:text-[#9B9590] hover:border-[#3D3B37]'}`}
      >
        <Tag size={size === 'sm' ? 11 : 12} />
        {label && <span className="text-[11px]">{inCount > 0 ? `${inCount} group${inCount === 1 ? '' : 's'}` : 'Add to group'}</span>}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-1 z-50 w-64 bg-[#171614] border border-[#2C2B28] rounded-md shadow-2xl shadow-black/60 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[9px] font-mono uppercase tracking-[0.15em] text-[#6B6560]">Groups</div>
          <div className="max-h-56 overflow-y-auto pb-1">
            {groups.map((g) => {
              const on = g.slugs.includes(slug);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleInGroup(g.id, slug)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-[#2C2B28]/50 transition-colors cursor-pointer"
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'}`}>
                    {on && <Check size={9} strokeWidth={3} className="text-[#0D0C0B]" />}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className={`truncate ${on ? 'text-[#F5F0E8]' : 'text-[#9B9590]'}`}>{g.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-[#6B6560]">{g.slugs.length}</span>
                </button>
              );
            })}
            {groups.length === 0 && !creating && (
              <p className="px-3 py-1.5 text-[11px] text-[#6B6560]">No groups yet.</p>
            )}
          </div>
          <div className="border-t border-[#2C2B28] p-2.5">
            {creating || groups.length === 0 ? (
              <NewGroupInput
                compact
                onCreate={(name) => { createGroup(name, [slug]); setCreating(false); }}
                onCancel={groups.length > 0 ? () => setCreating(false) : undefined}
              />
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer"
              >
                <Plus size={11} /> New group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter chips over followed artists — All · each group · Ungrouped — plus
 * creating, renaming and deleting groups. `value` is 'all' | 'ungrouped' | groupId.
 */
export function GroupFilterBar({ value, onChange, total, ungroupedCount }) {
  const { groups, createGroup, renameGroup, deleteGroup } = useFollowedArtists();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const chip = (active) => `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
    active ? 'bg-[#DA7756] text-[#0D0C0B]' : 'border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37]'
  }`;

  const active = groups.find((g) => g.id === value);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => onChange('all')} className={chip(value === 'all')}>
          All <span className={value === 'all' ? 'opacity-70' : 'text-[#6B6560]'}>{total}</span>
        </button>
        {groups.map((g) => (
          <button key={g.id} onClick={() => onChange(g.id)} className={chip(value === g.id)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: value === g.id ? '#0D0C0B' : g.color }} />
            {g.name}
            <span className={value === g.id ? 'opacity-70' : 'text-[#6B6560]'}>{g.slugs.length}</span>
          </button>
        ))}
        {groups.length > 0 && (
          <button onClick={() => onChange('ungrouped')} className={chip(value === 'ungrouped')}>
            Ungrouped <span className={value === 'ungrouped' ? 'opacity-70' : 'text-[#6B6560]'}>{ungroupedCount}</span>
          </button>
        )}
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border border-dashed border-[#3D3B37] text-[#6B6560] hover:text-[#DA7756] hover:border-[#DA7756]/50 transition-colors cursor-pointer"
          >
            <Plus size={11} /> New group
          </button>
        )}
      </div>

      {creating && (
        <div className="max-w-md">
          <NewGroupInput
            onCreate={(name) => { const id = createGroup(name); setCreating(false); if (id) onChange(id); }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {/* Selected group: rename / delete */}
      {active && !creating && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#6B6560]">
          {renaming?.id === active.id ? (
            <span className="flex items-center gap-2">
              <input
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { renameGroup(active.id, renaming.name); setRenaming(null); }
                  if (e.key === 'Escape') setRenaming(null);
                }}
                autoFocus
                maxLength={40}
                className="h-7 w-48 bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/40 rounded-md px-2.5 text-[11px] text-[#F5F0E8] outline-none"
              />
              <button onClick={() => { renameGroup(active.id, renaming.name); setRenaming(null); }} className="text-[#7BAF73] hover:text-[#F5F0E8] cursor-pointer">Save</button>
              <button onClick={() => setRenaming(null)} className="hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
            </span>
          ) : confirmDelete === active.id ? (
            <span className="flex items-center gap-2">
              Delete "{active.name}"? Artists stay followed.
              <button onClick={() => { deleteGroup(active.id); setConfirmDelete(null); onChange('all'); }} className="text-[#C75F4F] hover:text-[#F5F0E8] cursor-pointer">Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
            </span>
          ) : (
            <>
              <button onClick={() => setRenaming({ id: active.id, name: active.name })} className="flex items-center gap-1 hover:text-[#F5F0E8] cursor-pointer">
                <Pencil size={10} /> Rename
              </button>
              <button onClick={() => setConfirmDelete(active.id)} className="flex items-center gap-1 hover:text-[#C75F4F] cursor-pointer">
                <Trash2 size={10} /> Delete group
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Follow / Following toggle for an artist (profile headers etc.). */
export function FollowButton({ slug, className = '' }) {
  const { isFollowing, toggleFollow } = useFollowedArtists();
  const [hover, setHover] = useState(false);
  const on = isFollowing(slug);
  return (
    <button
      onClick={() => toggleFollow(slug)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
        on
          ? hover
            ? 'border border-[#C75F4F]/40 text-[#C75F4F]'
            : 'border border-[#DA7756]/30 bg-[#DA7756]/10 text-[#DA7756]'
          : 'bg-[#DA7756] text-[#0D0C0B] hover:bg-[#DA7756]/90'
      } ${className}`}
    >
      {on ? (hover ? <><X size={12} /> Unfollow</> : <><Check size={12} /> Following</>) : <><Plus size={12} /> Follow</>}
    </button>
  );
}
