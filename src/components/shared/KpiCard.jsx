import { motion } from 'motion/react';
import { formatDelta } from '../../utils/formatters';
import AnimatedNumber from './AnimatedNumber';

export default function KpiCard({ title, value, delta, icon: Icon, index = 0, prefix = '', suffix = '', colors: c }) {
  const isPositive = typeof delta === 'number' ? delta >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: 'easeOut' }}
      className="rounded p-5 transition-colors"
      style={{
        backgroundColor: c?.surface || '#171614',
        border: `1px solid ${c?.border || '#2C2B28'}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: c?.textSecondary || '#9B9590' }}>{title}</span>
        {Icon && <Icon className="w-4 h-4" style={{ color: c?.textMuted || '#6B6560' }} />}
      </div>
      <div className="font-mono text-2xl font-light tracking-tight" style={{ color: c?.textPrimary || '#F5F0E8', fontVariantNumeric: 'tabular-nums' }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-[#7BAF73]' : 'bg-[#C75F4F]'}`} />
          <span className={`font-mono text-xs ${isPositive ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}`}>
            {typeof delta === 'number' ? formatDelta(delta) : delta}
          </span>
        </div>
      )}
    </motion.div>
  );
}
