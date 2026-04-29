import { Lightbulb } from 'lucide-react';

const TYPE_STYLES = {
  success: { border: '#7BAF73', bg: 'rgba(123, 175, 115, 0.05)', icon: '#7BAF73' },
  warning: { border: '#DA7756', bg: 'rgba(218, 119, 86, 0.05)', icon: '#DA7756' },
  danger:  { border: '#C75F4F', bg: 'rgba(199, 95, 79, 0.05)', icon: '#C75F4F' },
  info:    { border: '#D4A574', bg: 'rgba(212, 165, 116, 0.05)', icon: '#D4A574' },
};

function InsightItem({ type, text, action }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      className="rounded px-4 py-3"
      style={{ borderLeft: `3px solid ${style.border}`, background: style.bg }}
    >
      <p className="text-xs text-[#ADA8A2] leading-relaxed">{text}</p>
      {action && (
        <p className="text-xs text-[#F5F0E8] mt-1.5 leading-relaxed">
          <span style={{ color: style.icon }}>→</span> {action}
        </p>
      )}
    </div>
  );
}

export default function InsightCallout({ insights }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-[#2C2B28]">
      <div className="flex items-center gap-1.5 mb-3">
        <Lightbulb size={12} className="text-[#DA7756]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#9B9590]">Insights & Recommendations</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightItem key={i} {...insight} />
        ))}
      </div>
    </div>
  );
}
