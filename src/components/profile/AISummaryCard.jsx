import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export default function AISummaryCard({ summary }) {
  const [displayedText, setDisplayedText] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setDone(false);
    const interval = setInterval(() => {
      i++;
      setDisplayedText(summary.text.slice(0, i));
      if (i >= summary.text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 8);
    return () => clearInterval(interval);
  }, [summary.text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded bg-[#00D4FF]/10 flex items-center justify-center">
          <Sparkles size={14} className="text-[#00D4FF]" />
        </div>
        <span className="text-xs font-medium text-[#00D4FF]">Cadence Analysis</span>
      </div>

      {/* Summary Text */}
      <p className="text-sm text-[#F4F0EA]/80 leading-relaxed mb-5">
        {displayedText}
        {!done && <span className="inline-block w-0.5 h-4 bg-[#00D4FF] ml-0.5 animate-pulse" />}
      </p>

      {/* Key Metrics */}
      {summary.keyMetrics && (
        <div className="flex flex-wrap gap-3 mb-5">
          {summary.keyMetrics.map((m) => (
            <div key={m.label} className="bg-[#080808] rounded px-3 py-2 border border-[#1E1E1E]">
              <p className="text-[10px] text-[#888888] mb-0.5">{m.label}</p>
              <p className="font-mono text-sm text-[#F4F0EA]">
                {m.value}
                {m.delta && <span className={`ml-1.5 text-xs ${m.delta.startsWith('+') || m.delta === 'up' ? 'text-[#7ab87a]' : m.delta === 'down' ? 'text-[#e85d5d]' : 'text-[#888888]'}`}>{m.delta}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {summary.suggestions && done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
          {summary.suggestions.map((s) => (
            <span key={s} className="text-xs text-[#888888] border border-[#1E1E1E] rounded px-3 py-1.5 hover:border-[#2A2A2A] hover:text-[#F4F0EA] transition-colors cursor-pointer">{s}</span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
