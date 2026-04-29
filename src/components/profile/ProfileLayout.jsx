import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import AISummaryCard from './AISummaryCard';

const typeBadgeColors = {
  artist: 'bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20',
  track: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
  album: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
  playlist: 'bg-[#7BAF73]/10 text-[#7BAF73] border-[#7BAF73]/20',
  chart: 'bg-[#D4A574]/10 text-[#D4A574] border-[#D4A574]/20',
};

export default function ProfileLayout({ title, subtitle, type, aiSummary, headerRight, children }) {
  return (
    <div className="space-y-8">
      {/* Back + Hero */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#9B9590] hover:text-[#F5F0E8] transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${typeBadgeColors[type] || typeBadgeColors.artist}`}>
            {type}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-light text-[#F5F0E8]">{title}</h1>
          {headerRight}
        </div>
        {subtitle && <p className="text-sm text-[#9B9590] mt-1">{subtitle}</p>}
      </motion.div>

      {/* AI Summary */}
      {aiSummary && <AISummaryCard summary={aiSummary} />}

      {/* Collapsible Sections */}
      <div>{children}</div>
    </div>
  );
}
