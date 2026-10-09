import { motion } from 'motion/react';
import { Link2 } from 'lucide-react';
import SmartLinksPanel from '../components/ads/SmartLinksPanel';

/** Smart links: a landing page per release with tracked clicks to each streaming service. */
export default function LinksPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
          <Link2 size={15} className="text-[#DA7756]" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-[#F5F0E8]">Links</h2>
          <p className="text-[10px] font-mono text-[#6B6560]">Smart links, clicks and fans</p>
        </div>
      </div>
      <SmartLinksPanel />
    </motion.div>
  );
}
