import { useState, useRef } from 'react';
import { Pencil } from 'lucide-react';

export default function InlineEdit({ value, onSave, className = '', multiline = false }) {
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
