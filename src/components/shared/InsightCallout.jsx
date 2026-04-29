import { Lightbulb } from 'lucide-react';

const TYPE_STYLES = {
  success: { border: '#7ab87a', bg: 'rgba(122, 184, 122, 0.05)', icon: '#7ab87a' },
  warning: { border: '#00D4FF', bg: 'rgba(232, 168, 73, 0.05)', icon: '#00D4FF' },
  danger:  { border: '#e85d5d', bg: 'rgba(232, 93, 93, 0.05)', icon: '#e85d5d' },
  info:    { border: '#5b9bd5', bg: 'rgba(91, 155, 213, 0.05)', icon: '#5b9bd5' },
};

function InsightItem({ type, text, action }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      className="rounded px-4 py-3"
      style={{ borderLeft: `3px solid ${style.border}`, background: style.bg }}
    >
      <p className="text-xs text-[#a1a1aa] leading-relaxed">{text}</p>
      {action && (
        <p className="text-xs text-[#F4F0EA] mt-1.5 leading-relaxed">
          <span style={{ color: style.icon }}>→</span> {action}
        </p>
      )}
    </div>
  );
}

export default function InsightCallout({ insights }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-[#1E1E1E]">
      <div className="flex items-center gap-1.5 mb-3">
        <Lightbulb size={12} className="text-[#00D4FF]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#888888]">Insights & Recommendations</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightItem key={i} {...insight} />
        ))}
      </div>
    </div>
  );
}
