import { motion } from 'motion/react';

export default function ChatSuggestions({ suggestions, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {suggestions.map((text, i) => (
        <motion.button
          key={text}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
          onClick={() => onSelect(text)}
          className="font-mono text-[11px] text-[#9B9590] border border-[#3D3B37] rounded px-3 py-1.5 hover:border-[#3D3B37] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
}
