import { motion } from 'motion/react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded bg-[#DA7756]/20 flex items-center justify-center text-[#DA7756] font-mono text-[10px] font-bold shrink-0">
        M
      </div>
      <div className="border-l-2 border-[#DA7756]/40 pl-4 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-[#DA7756] rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
