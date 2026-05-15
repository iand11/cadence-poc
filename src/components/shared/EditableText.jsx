import { useState, useRef, useEffect } from 'react';

/**
 * Inline-editable text component.
 * Renders as a normal element when not editing.
 * When editing=true, shows a dashed-underline hint. Click to activate contentEditable.
 * Save on blur or Enter (single-line). Escape reverts.
 */
export default function EditableText({
  value,
  onSave,
  editing,
  as: Tag = 'span',
  className = '',
  style,
  multiline = false,
  placeholder = '',
}) {
  const [active, setActive] = useState(false);

  // View mode — plain text
  if (!editing) {
    if (!value) return null;
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  // Edit mode, actively editing — contentEditable
  if (active) {
    return (
      <EditableContent
        value={value}
        onDone={(next) => {
          setActive(false);
          if (next !== value) onSave(next);
        }}
        El={Tag}
        className={className}
        style={style}
        multiline={multiline}
        placeholder={placeholder}
      />
    );
  }

  // Edit mode, idle — dashed underline hint, click to activate
  return (
    <Tag
      className={`${className} cursor-text`}
      style={{
        ...style,
        borderBottom: '1.5px dashed rgba(218,119,86,0.35)',
      }}
      onClick={(e) => {
        e.stopPropagation();
        setActive(true);
      }}
    >
      {value || <span className="text-[#6B6560] italic">{placeholder}</span>}
    </Tag>
  );
}

function EditableContent({ value, onDone, El, className, style, multiline, placeholder }) {
  const ref = useRef(null);
  const original = useRef(value || '');

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = value || '';
      ref.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  return (
    <El
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={`${className} cursor-text focus:outline-none`}
      style={{
        ...style,
        borderBottom: '1.5px dashed rgba(218,119,86,0.5)',
        minWidth: '2ch',
      }}
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? '';
        onDone(next);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          if (ref.current) ref.current.textContent = original.current;
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
