import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Pagination({ page, perPage, total, onPageChange, onPerPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const getVisiblePages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#2C2B28] bg-[#0D0C0B]">
      {/* Left: per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#6B6560]">Show</span>
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="bg-[#171614] border border-[#2C2B28] rounded px-1.5 py-0.5 text-[10px] text-[#F5F0E8] outline-none cursor-pointer focus:border-[#3D3B37]"
        >
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-[10px] text-[#6B6560]">
          {total > 0 ? `${start}–${end} of ${total}` : '0 results'}
        </span>
      </div>

      {/* Right: page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#171614] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          {getVisiblePages().map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="text-[10px] text-[#6B6560] px-1">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[24px] h-6 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  p === page
                    ? 'bg-[#DA7756]/15 text-[#DA7756] font-medium'
                    : 'text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#171614]'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1 rounded text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#171614] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
