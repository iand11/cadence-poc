import { GripVertical } from 'lucide-react';

export default function DashboardWidget({ title, children }) {
  return (
    <div className="h-full bg-[#0F0F0F] border border-[#1E1E1E] rounded overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E1E]">
        <span className="text-xs font-medium text-[#888888]">{title}</span>
        <div className="drag-handle cursor-grab active:cursor-grabbing text-[#444444] hover:text-[#888888] transition-colors">
          <GripVertical size={14} />
        </div>
      </div>
      <div className="flex-1 p-4 overflow-hidden">{children}</div>
    </div>
  );
}
