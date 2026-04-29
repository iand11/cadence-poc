import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, FileText, Trash2, Clock, BarChart3, Music } from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { getArtist } from '../data/artists';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const WIDGET_LABELS = {
  'artist-comparison': 'Comparison',
  'streaming-trends': 'Streaming',
  'revenue-breakdown': 'Revenue',
  'social-growth': 'Social',
  'geography': 'Geography',
  'forecast': 'Forecast',
  'playlists': 'Playlists',
  'benchmarks': 'Benchmarks',
};

export default function ReportsList() {
  const { reports, createReport, deleteReport } = useReports();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleNew = () => {
    const id = createReport({ name: 'Untitled Report' });
    navigate(`/reports/${id}`);
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    deleteReport(id);
    setConfirmDelete(null);
  };

  const handleConfirmDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const handleCancelDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-[#F5F0E8]">Reports</h1>
          <p className="text-xs text-[#9B9590] mt-1">
            {reports.length} saved report{reports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#DA7756]/10 text-[#DA7756] rounded text-sm hover:bg-[#DA7756]/20 transition-colors cursor-pointer border border-[#DA7756]/20"
        >
          <Plus size={14} />
          New Report
        </button>
      </motion.div>

      {/* Report Grid or Empty State */}
      {reports.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <FileText size={40} className="mx-auto mb-3 text-[#6B6560] opacity-50" />
          <p className="text-sm text-[#9B9590] mb-4">No reports yet</p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#DA7756]/10 text-[#DA7756] rounded text-sm hover:bg-[#DA7756]/20 transition-colors cursor-pointer border border-[#DA7756]/20"
          >
            <Plus size={14} />
            Create your first report
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {reports.map((report, index) => {
              const artists = report.artists.map(s => getArtist(s)).filter(Boolean);
              const isConfirming = confirmDelete === report.id;

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  layout
                >
                  <Link
                    to={`/reports/${report.id}`}
                    className="block relative bg-[#171614] border border-[#2C2B28] rounded p-5 hover:border-[#3D3B37] transition-colors group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#DA7756] transition-colors pr-6 leading-snug">
                        {report.name}
                      </h3>
                      {!isConfirming && (
                        <button
                          onClick={(e) => handleConfirmDelete(e, report.id)}
                          className="absolute top-4 right-4 p-1 rounded text-[#6B6560] opacity-0 group-hover:opacity-100 hover:text-[#C75F4F] transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Delete Confirmation */}
                    {isConfirming && (
                      <div className="absolute inset-0 bg-[#171614]/95 backdrop-blur-sm rounded flex items-center justify-center gap-3 z-10">
                        <span className="text-xs text-[#9B9590]">Delete this report?</span>
                        <button
                          onClick={handleCancelDelete}
                          className="px-2.5 py-1 text-[10px] rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, report.id)}
                          className="px-2.5 py-1 text-[10px] rounded bg-[#C75F4F]/10 text-[#C75F4F] border border-[#C75F4F]/20 hover:bg-[#C75F4F]/20 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {/* Artist Avatars */}
                    <div className="flex items-center -space-x-2 mb-3">
                      {artists.slice(0, 5).map((a) =>
                        a.imageUrl ? (
                          <img
                            key={a.slug}
                            src={a.imageUrl}
                            alt={a.name}
                            title={a.name}
                            className="w-7 h-7 rounded-full border-2 border-[#171614] object-cover"
                          />
                        ) : (
                          <div
                            key={a.slug}
                            title={a.name}
                            className="w-7 h-7 rounded-full border-2 border-[#171614] bg-[#2C2B28] flex items-center justify-center"
                          >
                            <Music size={10} className="text-[#6B6560]" />
                          </div>
                        )
                      )}
                      {artists.length > 5 && (
                        <div className="w-7 h-7 rounded-full border-2 border-[#171614] bg-[#2C2B28] flex items-center justify-center">
                          <span className="text-[9px] font-mono text-[#9B9590]">+{artists.length - 5}</span>
                        </div>
                      )}
                      {artists.length === 0 && (
                        <span className="text-[10px] text-[#6B6560]">No artists selected</span>
                      )}
                    </div>

                    {/* Widget Tags */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {report.widgets.slice(0, 4).map((w) => (
                        <span
                          key={w}
                          className="text-[9px] font-mono bg-[#2C2B28] text-[#9B9590] rounded px-1.5 py-0.5"
                        >
                          {WIDGET_LABELS[w] || w}
                        </span>
                      ))}
                      {report.widgets.length > 4 && (
                        <span className="text-[9px] font-mono text-[#6B6560]">
                          +{report.widgets.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[10px] text-[#6B6560]">
                      <span className="flex items-center gap-1">
                        <BarChart3 size={10} />
                        {report.widgets.length} widget{report.widgets.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {timeAgo(report.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
