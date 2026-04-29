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
      className="bg-[#171614] border border-[#2C2B28] rounded p-5 hover:border-[#3D3B37] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#9B9590]">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-[#6B6560]" />}
      </div>
      <div className="font-mono text-2xl font-light text-[#F5F0E8] tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
