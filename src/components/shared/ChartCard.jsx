import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';

export default function ChartCard({ title, subtitle, children, className, filters }) {
  const [activeFilter, setActiveFilter] = useState(
    filters ? filters.findIndex((f) => f.active) : -1
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn('bg-[#171614] border border-[#2C2B28] rounded p-5', className)}
    >
      <div className="flex items-end justify-between mb-1">
        <div>
          <h3 className="text-sm font-medium text-[#F5F0E8]">{title}</h3>
          {subtitle && <p className="text-xs text-[#9B9590] mt-0.5">{subtitle}</p>}
        </div>
        {filters && filters.length > 0 && (
          <div className="flex items-center gap-1">
            {filters.map((filter, i) => (
              <button
                key={filter.label}
                onClick={() => setActiveFilter(i)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs transition-colors',
                  i === activeFilter
                    ? 'text-[#DA7756] bg-[#DA7756]/10'
                    : 'text-[#9B9590] hover:text-[#F5F0E8]'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}
