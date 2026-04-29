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
      className="bg-[#171614] border border-[#2C2B28] rounded p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded bg-[#DA7756]/10 flex items-center justify-center">
          <Sparkles size={14} className="text-[#DA7756]" />
        </div>
        <span className="text-xs font-medium text-[#DA7756]">Cadence Analysis</span>
      </div>

      {/* Summary Text */}
      <p className="text-sm text-[#F5F0E8]/80 leading-relaxed mb-5">
        {displayedText}
        {!done && <span className="inline-block w-0.5 h-4 bg-[#DA7756] ml-0.5 animate-pulse" />}
      </p>

      {/* Key Metrics */}
      {summary.keyMetrics && (
        <div className="flex flex-wrap gap-3 mb-5">
          {summary.keyMetrics.map((m) => (
            <div key={m.label} className="bg-[#0D0C0B] rounded px-3 py-2 border border-[#2C2B28]">
              <p className="text-[10px] text-[#9B9590] mb-0.5">{m.label}</p>
              <p className="font-mono text-sm text-[#F5F0E8]">
                {m.value}
                {m.delta && <span className={`ml-1.5 text-xs ${m.delta.startsWith('+') || m.delta === 'up' ? 'text-[#7BAF73]' : m.delta === 'down' ? 'text-[#C75F4F]' : 'text-[#9B9590]'}`}>{m.delta}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {summary.suggestions && done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
          {summary.suggestions.map((s) => (
            <span key={s} className="text-xs text-[#9B9590] border border-[#2C2B28] rounded px-3 py-1.5 hover:border-[#3D3B37] hover:text-[#F5F0E8] transition-colors cursor-pointer">{s}</span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
