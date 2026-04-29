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
          className="font-mono text-[11px] text-[#888888] border border-[#2A2A2A] rounded px-3 py-1.5 hover:border-[#2A2A2A] hover:text-[#F4F0EA] transition-colors cursor-pointer"
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
}
