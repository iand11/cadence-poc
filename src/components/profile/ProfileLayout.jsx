import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import AISummaryCard from './AISummaryCard';

const typeBadgeColors = {
  artist: 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20',
  track: 'bg-[#5b9bd5]/10 text-[#5b9bd5] border-[#5b9bd5]/20',
  album: 'bg-[#e8a849]/10 text-[#e8a849] border-[#e8a849]/20',
  playlist: 'bg-[#7ab87a]/10 text-[#7ab87a] border-[#7ab87a]/20',
  chart: 'bg-[#c084fc]/10 text-[#c084fc] border-[#c084fc]/20',
};

export default function ProfileLayout({ title, subtitle, type, aiSummary, headerRight, children }) {
  return (
    <div className="space-y-8">
      {/* Back + Hero */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#F4F0EA] transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${typeBadgeColors[type] || typeBadgeColors.artist}`}>
            {type}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-light text-[#F4F0EA]">{title}</h1>
          {headerRight}
        </div>
        {subtitle && <p className="text-sm text-[#888888] mt-1">{subtitle}</p>}
      </motion.div>

      {/* AI Summary */}
      {aiSummary && <AISummaryCard summary={aiSummary} />}

      {/* Collapsible Sections */}
      <div>{children}</div>
    </div>
  );
}
