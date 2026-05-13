import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

const PILL_THRESHOLD = 4;

function DropdownFilter({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const isActive = value !== 'All';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 h-7 px-2.5 rounded border font-mono text-[10px] transition-colors cursor-pointer',
          isActive
            ? 'bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/30'
            : 'text-[#9B9590] border-[#3D3B37] hover:text-[#F5F0E8] hover:border-[#6B6560]'
        )}
      >
        <span className="uppercase tracking-wide text-[#6B6560]">{label}</span>
        <span className={isActive ? 'text-[#DA7756]' : 'text-[#F5F0E8]'}>{value}</span>
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] py-1 bg-[#171614] border border-[#2C2B28] rounded shadow-xl">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => { onChange(option); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-1.5 font-mono text-[10px] transition-colors cursor-pointer',
                value === option
                  ? 'text-[#DA7756] bg-[#DA7756]/5'
                  : 'text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#1C1B18]'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PillFilter({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] text-[#6B6560] uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((option) => {
          const isActive = value === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={cn(
                'px-2.5 py-1 rounded-sm font-mono text-[10px] transition-colors cursor-pointer',
                isActive
                  ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/30'
                  : 'text-[#9B9590] border border-[#3D3B37] hover:text-[#F5F0E8] hover:border-[#6B6560]'
              )}
            >
              {option === 'All' ? 'All' : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterBar({ filters }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter) =>
        filter.options.length <= PILL_THRESHOLD ? (
          <PillFilter key={filter.label} {...filter} />
        ) : (
          <DropdownFilter key={filter.label} {...filter} />
        )
      )}
    </div>
  );
}
