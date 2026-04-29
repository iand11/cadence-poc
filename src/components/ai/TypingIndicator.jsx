import { motion } from 'motion/react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded bg-[#00D4FF]/20 flex items-center justify-center text-[#00D4FF] font-mono text-[10px] font-bold shrink-0">
        M
      </div>
      <div className="border-l-2 border-[#00D4FF]/40 pl-4 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-[#00D4FF] rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
