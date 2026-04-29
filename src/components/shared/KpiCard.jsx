import { motion } from 'motion/react';
import { formatDelta } from '../../utils/formatters';
import AnimatedNumber from './AnimatedNumber';

export default function KpiCard({ title, value, delta, icon: Icon, index = 0, prefix = '', suffix = '' }) {
  const isPositive = typeof delta === 'number' ? delta >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: 'easeOut' }}
      className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-5 hover:border-[#2A2A2A] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#888888]">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-[#444444]" />}
      </div>
      <div className="font-mono text-2xl font-light text-[#F4F0EA] tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-[#7ab87a]' : 'bg-[#e85d5d]'}`} />
          <span className={`font-mono text-xs ${isPositive ? 'text-[#7ab87a]' : 'text-[#e85d5d]'}`}>
            {typeof delta === 'number' ? formatDelta(delta) : delta}
          </span>
        </div>
      )}
    </motion.div>
  );
}
