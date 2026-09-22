import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Sparkles, Plus, Check } from 'lucide-react';
import { useActions } from '../../hooks/useActions';

export default function AISummaryCard({ summary }) {
  const navigate = useNavigate();
  const { addCustomAction } = useActions();
  const [displayedText, setDisplayedText] = useState('');
  const [done, setDone] = useState(false);
  const [added, setAdded] = useState({});

  const createAction = (s) => {
    if (added[s.label]) return;
    addCustomAction({
      artistSlug: summary.artistSlug,
      platform: s.platform,
      dataType: s.dataType,
      action: s.action,
      text: `Suggested from ${summary.artistName || 'artist'} Prelude Analysis.`,
    });
    setAdded((prev) => ({ ...prev, [s.label]: true }));
  };

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
        <span className="text-xs font-medium text-[#DA7756]">Prelude Analysis</span>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-2">
          {summary.suggestions.map((s) => {
            const isAdded = !!added[s.label];
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => createAction(s)}
                disabled={isAdded}
                className={`inline-flex items-center gap-1.5 text-xs border rounded px-3 py-1.5 transition-colors ${
                  isAdded
                    ? 'text-[#7BAF73] border-[#7BAF73]/30 bg-[#7BAF73]/10 cursor-default'
                    : 'text-[#9B9590] border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] cursor-pointer'
                }`}
              >
                {isAdded ? <Check size={12} /> : <Plus size={12} />}
                {isAdded ? 'Added to actions' : s.label}
              </button>
            );
          })}
          {summary.artistSlug && Object.keys(added).length > 0 && (
            <button
              type="button"
              onClick={() => navigate(`/app/actions/${summary.artistSlug}`)}
              className="text-xs text-[#DA7756] hover:underline cursor-pointer px-1"
            >
              View actions →
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
