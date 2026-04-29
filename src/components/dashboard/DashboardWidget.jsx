import { GripVertical } from 'lucide-react';

export default function DashboardWidget({ title, children }) {
  return (
    <div className="h-full bg-[#171614] border border-[#2C2B28] rounded overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2B28]">
        <span className="text-xs font-medium text-[#9B9590]">{title}</span>
        <div className="drag-handle cursor-grab active:cursor-grabbing text-[#6B6560] hover:text-[#9B9590] transition-colors">
          <GripVertical size={14} />
        </div>
      </div>
      <div className="flex-1 p-4 overflow-hidden">{children}</div>
    </div>
  );
}
