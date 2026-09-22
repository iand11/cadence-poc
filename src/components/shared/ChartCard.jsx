import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';

export default function ChartCard({ title, subtitle, children, className, filters, action, colors: c }) {
  const [activeFilter, setActiveFilter] = useState(
    filters ? filters.findIndex((f) => f.active) : -1
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn('rounded p-5', className)}
      style={{
        backgroundColor: c?.surface || '#171614',
        border: `1px solid ${c?.border || '#2C2B28'}`,
      }}
    >
      <div className="flex items-end justify-between mb-1">
        <div>
          <h3 className="text-sm font-medium" style={{ color: c?.textPrimary || '#F5F0E8' }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: c?.textSecondary || '#9B9590' }}>{subtitle}</p>}
        </div>
        {action}
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
                    : 'hover:text-[#F5F0E8]'
                )}
                style={i !== activeFilter ? { color: c?.textSecondary || '#9B9590' } : undefined}
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
