import { cn } from '../../utils/cn';

export default function FilterBar({ filters }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {filters.map((filter) => (
        <div key={filter.label} className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-[#888888] uppercase tracking-wide mr-1">{filter.label}</span>
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
                      ? 'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30'
                      : 'text-[#888888] border border-[#2A2A2A] hover:text-[#F4F0EA] hover:border-[#444444]'
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
