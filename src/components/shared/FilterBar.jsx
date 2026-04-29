import { cn } from '../../utils/cn';

export default function FilterBar({ filters }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {filters.map((filter) => (
        <div key={filter.label} className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-[#9B9590] uppercase tracking-wide mr-1">{filter.label}</span>
          <div className="flex items-center gap-1">
            {filter.options.map((option) => {
              const isActive = filter.value === option;
              return (
                <button
                  key={option}
                  onClick={() => filter.onChange(option)}
                  className={cn(
                    'px-3 py-1 rounded-sm font-mono text-[10px] transition-colors',
                    isActive
                      ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/30'
                      : 'text-[#9B9590] border border-[#3D3B37] hover:text-[#F5F0E8] hover:border-[#6B6560]'
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
